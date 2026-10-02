import { Request, Response, NextFunction } from "express";
import { supabase, supabaseAdmin } from "../db/supabaseClient";

// ─── Shared type ──────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
    id:          string;
    email:       string;
    name:        string;
    role?:       string; // 'patient' | 'therapist' | 'admin'
    therapistId?: string; // Primary key of public.therapists if user is a therapist
}

// ─── Extend Express Request ───────────────────────────────────────────────────

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

// ─── Core verify function — used by BOTH middleware and VoiceController ────────

/**
 * Verifies a Supabase JWT and returns the user with role information, or null if invalid.
 */
export async function verifySupabaseToken(token: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) return null;

    const userId = data.user.id;
    let role = "patient";
    let therapistId: string | undefined = undefined;

    try {
        // Fetch role from profiles table
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .maybeSingle();

        if (profile?.role) {
            role = profile.role;
        }

        // If user is a therapist, fetch their therapist ID
        const { data: therapist } = await supabaseAdmin
            .from("therapists")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

        if (therapist?.id) {
            therapistId = therapist.id;
            // Infer therapist role if therapist profile exists
            if (role === "patient") role = "therapist";
        }
    } catch (dbErr: any) {
        console.warn("[AuthMiddleware] Profile role lookup warning:", dbErr?.message || dbErr);
    }

    return {
        id:          userId,
        email:       data.user.email ?? "",
        name:        (data.user.user_metadata?.name as string) ?? "",
        role:        role,
        therapistId: therapistId,
    };
}

// ─── Express middleware — protects HTTP routes ────────────────────────────────

/**
 * verifyToken middleware
 * Attach to any Express route that requires authentication.
 */
export async function verifyToken(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
            error: { code: "NO_TOKEN", message: "Authorization header with Bearer token is required" },
        });
        return;
    }

    const token = authHeader.slice(7);
    const user  = await verifySupabaseToken(token);

    if (!user) {
        res.status(401).json({
            error: { code: "INVALID_TOKEN", message: "Token is invalid or has expired — please log in again" },
        });
        return;
    }

    req.user = user;
    next();
}

/**
 * requireRole middleware
 * Ensures the authenticated user possesses one of the allowed roles.
 *
 * Usage:
 *   router.get("/therapist/appointments", verifyToken, requireRole(['therapist', 'admin']), controller);
 */
export function requireRole(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "Authentication required" },
            });
            return;
        }

        const userRole = req.user.role || "patient";

        if (!allowedRoles.includes(userRole)) {
            res.status(403).json({
                error: { code: "FORBIDDEN", message: `Access denied. Action requires one of roles: [${allowedRoles.join(", ")}]` },
            });
            return;
        }

        next();
    };
}