import { Request, Response } from "express";
import {
    getAdminUsersList,
    getAdminTherapistsList,
    getAdminOnboardingRequestsList,
    getAdminStats,
    AdminUsersFilter,
    AdminTherapistsFilter,
    AdminRequestsFilter,
} from "../services/adminService";
import {
    adminStartOnboarding,
    adminApproveOnboarding,
    adminRejectOnboarding,
} from "../services/onboardingRequestService";

export async function getAdminStatsController(req: Request, res: Response): Promise<void> {
    try {
        const stats = await getAdminStats();
        res.status(200).json({ success: true, stats });
    } catch (error) {
        console.error("[AdminController] getAdminStats failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_STATS_FAILED", message: (error as Error).message },
        });
    }
}

export async function getAdminUsersController(req: Request, res: Response): Promise<void> {
    try {
        const filter: AdminUsersFilter = {
            search: typeof req.query.search === "string" ? req.query.search : undefined,
            verificationStatus: req.query.verificationStatus as any,
            role: req.query.role as any,
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 15,
        };

        const result = await getAdminUsersList(filter);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error("[AdminController] getAdminUsers failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_USERS_FAILED", message: (error as Error).message },
        });
    }
}

export async function getAdminTherapistsController(req: Request, res: Response): Promise<void> {
    try {
        const filter: AdminTherapistsFilter = {
            search: typeof req.query.search === "string" ? req.query.search : undefined,
            verificationStatus: req.query.verificationStatus as any,
            status: req.query.status as any,
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 15,
        };

        const result = await getAdminTherapistsList(filter);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error("[AdminController] getAdminTherapists failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_THERAPISTS_FAILED", message: (error as Error).message },
        });
    }
}

export async function getAdminOnboardingRequestsController(req: Request, res: Response): Promise<void> {
    try {
        const filter: AdminRequestsFilter = {
            search: typeof req.query.search === "string" ? req.query.search : undefined,
            status: req.query.status as any,
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 15,
        };

        const result = await getAdminOnboardingRequestsList(filter);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error("[AdminController] getAdminOnboardingRequests failed:", (error as Error).message);
        res.status(500).json({
            error: { code: "FETCH_REQUESTS_FAILED", message: (error as Error).message },
        });
    }
}

export async function approveOnboardingController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Request ID is required" } });
            return;
        }

        const result = await adminApproveOnboarding(req.user.id, id);
        res.status(200).json({
            success: true,
            message: "Therapist onboarding request approved and user role converted to therapist successfully.",
            ...result,
        });
    } catch (error) {
        console.error("[AdminController] approveOnboarding failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "APPROVE_ONBOARDING_FAILED", message: (error as Error).message },
        });
    }
}

export async function startOnboardingController(req: Request, res: Response): Promise<void> {
    return approveOnboardingController(req, res);
}

export async function rejectOnboardingController(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { reason } = req.body;

        if (!id) {
            res.status(400).json({ error: { code: "INVALID_ID", message: "Request ID is required" } });
            return;
        }

        const request = await adminRejectOnboarding(req.user.id, id, reason);
        res.status(200).json({
            success: true,
            message: "Onboarding request rejected.",
            request,
        });
    } catch (error) {
        console.error("[AdminController] rejectOnboarding failed:", (error as Error).message);
        res.status(400).json({
            error: { code: "REJECT_ONBOARDING_FAILED", message: (error as Error).message },
        });
    }
}
