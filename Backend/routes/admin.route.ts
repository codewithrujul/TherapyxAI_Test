import { Router, Request, Response, NextFunction } from "express";
import {
    getAdminStatsController,
    getAdminUsersController,
    getAdminTherapistsController,
    getAdminOnboardingRequestsController,
    startOnboardingController,
    approveOnboardingController,
    rejectOnboardingController,
} from "../controller/admin.controller";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        fn(req, res, next).catch(next);

// Protected Admin Middleware: Protect all /admin/* routes for users with role='admin'
router.use(verifyToken, requireRole(["admin"]));

// GET /api/admin/stats — Platform counters & stats overview
router.get("/admin/stats", asyncHandler(getAdminStatsController));

// GET /api/admin/users — User list with role, verification filters, search & pagination
router.get("/admin/users", asyncHandler(getAdminUsersController));

// GET /api/admin/therapists — Therapist list with verification filters & search
router.get("/admin/therapists", asyncHandler(getAdminTherapistsController));

// GET /api/admin/onboarding-requests — Onboarding requests list
router.get("/admin/onboarding-requests", asyncHandler(getAdminOnboardingRequestsController));

// POST /api/admin/onboarding-requests/:id/approve — Approve onboarding request action
router.post("/admin/onboarding-requests/:id/approve", asyncHandler(approveOnboardingController));

// POST /api/admin/onboarding-requests/:id/verify — Verify onboarding request action alias
router.post("/admin/onboarding-requests/:id/verify", asyncHandler(approveOnboardingController));

// POST /api/admin/onboarding-requests/:id/start — Legacy initiate onboarding action
router.post("/admin/onboarding-requests/:id/start", asyncHandler(startOnboardingController));

// POST /api/admin/onboarding-requests/:id/reject — Reject onboarding request action
router.post("/admin/onboarding-requests/:id/reject", asyncHandler(rejectOnboardingController));

export default router;
