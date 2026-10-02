import { Request, Response } from "express";
import {
    submitOnboardingForm,
    getUserOnboardingStatus,
} from "../services/onboardingRequestService";
import { getUserInAppNotifications } from "../services/notificationService";

export async function createRequestController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const request = await submitOnboardingForm(req.user.id, req.body || {});
        res.status(201).json({
            success: true,
            message: "Your request to onboard as a therapist has been sent to the admin. You will be notified when the admin approves your request.",
            request,
        });
    } catch (error) {
        console.error("[OnboardingRequestController] createRequest failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "REQUEST_FAILED", message: (error as Error).message },
        });
    }
}

export async function getStatusController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const result = await getUserOnboardingStatus(req.user.id);
        res.status(200).json(result);
    } catch (error) {
        console.error("[OnboardingRequestController] getStatus failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_STATUS_FAILED", message: (error as Error).message },
        });
    }
}

export async function completeOnboardingController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const request = await submitOnboardingForm(req.user.id, req.body || {});
        res.status(200).json({
            success: true,
            message: "Your request to onboard as a therapist has been sent to the admin. You will be notified when the admin approves your request.",
            request,
        });
    } catch (error) {
        console.error("[OnboardingRequestController] completeOnboarding failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "COMPLETE_ONBOARDING_FAILED", message: (error as Error).message },
        });
    }
}

export async function getNotificationsController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const notifications = await getUserInAppNotifications(req.user.id, req.user.role);
        res.status(200).json({ notifications });
    } catch (error) {
        console.error("[OnboardingRequestController] getNotifications failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_NOTIFICATIONS_FAILED", message: (error as Error).message },
        });
    }
}
