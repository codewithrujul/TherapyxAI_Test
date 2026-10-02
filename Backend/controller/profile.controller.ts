import { Request, Response } from "express";
import { fetchUserProfile, upsertUserProfile } from "../db/dbService";
import { supabaseAdmin } from "../db/supabaseClient";

const ALLOWED_AGE_GROUPS = new Set([
    "under-18",
    "18-24",
    "25-34",
    "35-44",
    "45-54",
    "55+",
    "prefer-not-to-say",
]);

const MAX_PROFILE_FIELD_LENGTH = 80;

function normalizeOptionalText(value: unknown, fieldName: string, maxLength = 80): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") {
        throw new Error(`${fieldName} must be a string`);
    }

    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > maxLength) {
        throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
    }

    return trimmed;
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeOptionalEmail(value: unknown, fieldName: string, maxLength = 320): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") {
        throw new Error(`${fieldName} must be a string`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${fieldName} is required`);
    }
    if (trimmed.length > maxLength) {
        throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
    }
    if (!isValidEmail(trimmed)) {
        throw new Error(`${fieldName} must be a valid email address`);
    }

    return trimmed;
}

function normalizeOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") {
        throw new Error(`${fieldName} must be a boolean`);
    }
    return value;
}

export async function getProfile(req: Request, res: Response): Promise<void> {
    if (!req.user) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
        return;
    }

    const profile = await fetchUserProfile(req.user.id);
    if (req.user.role) {
        profile.role = req.user.role;
    }
    res.status(200).json({ profile });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
    if (!req.user) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
        return;
    }

    try {
        const name       = normalizeOptionalText(req.body.name, "name", 120);
        const email      = normalizeOptionalEmail(req.body.email, "email", 320);
        const gender     = normalizeOptionalText(req.body.gender, "gender");
        const profession = normalizeOptionalText(req.body.profession, "profession");
        const ageGroup   = normalizeOptionalText(req.body.ageGroup, "ageGroup");
        const languageCode = normalizeOptionalText(req.body.languageCode, "languageCode", 20);
        const reason     = normalizeOptionalText(req.body.reason, "reason", 300);

        if (ageGroup && !ALLOWED_AGE_GROUPS.has(ageGroup)) {
            res.status(400).json({
                error: {
                    code:    "INVALID_AGE_GROUP",
                    message: "ageGroup is not one of the supported values",
                },
            });
            return;
        }

        const current = await fetchUserProfile(req.user.id);
        const nextGender     = gender     === undefined ? current.gender     : gender;
        const nextProfession = profession === undefined ? current.profession : profession;
        const nextAgeGroup   = ageGroup   === undefined ? current.ageGroup   : ageGroup;
        const isComplete     = Boolean(nextGender && nextProfession && nextAgeGroup);

        const onboardingSkipped = normalizeOptionalBoolean(req.body.onboardingSkipped, "onboardingSkipped");
        const requestedCompleted = normalizeOptionalBoolean(req.body.onboardingCompleted, "onboardingCompleted");

        if (name !== undefined || email !== undefined) {
            const updatePayload: Record<string, unknown> = {};
            if (name !== undefined) {
                const existingMetadata = (req.user as any).user_metadata ?? {};
                updatePayload.user_metadata = { ...existingMetadata, name };
            }
            if (email !== undefined) {
                updatePayload.email = email;
            }
            if (Object.keys(updatePayload).length > 0) {
                const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, updatePayload as any);
                if (authError) {
                    throw new Error(`Failed to update auth user: ${authError.message}`);
                }
            }
        }

        const profile = await upsertUserProfile(
            req.user.id,
            { email: email ?? req.user.email ?? "", name: name ?? req.user.name ?? "" },
            {
                gender,
                profession,
                ageGroup,
                languageCode,
                reason,
                onboardingSkipped,
                onboardingCompleted: requestedCompleted ?? (isComplete ? true : undefined),
            },
        );

        res.status(200).json({ profile });
    } catch (error) {
        res.status(400).json({
            error: {
                code:    "INVALID_PROFILE_PAYLOAD",
                message: (error as Error).message,
            },
        });
    }
}
