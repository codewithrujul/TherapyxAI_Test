import { Router, Request, Response, NextFunction } from "express";
import {
    createRequestController,
    getStatusController,
    completeOnboardingController,
    getNotificationsController,
} from "../controller/onboardingRequest.controller";
import { verifyToken } from "../middleware/auth";

const router = Router();

const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        fn(req, res, next).catch(next);

// Protected User Route: Submit new therapist onboarding request
router.post("/therapist-onboarding/request", verifyToken, asyncHandler(createRequestController));

// Protected User Route: Get current user's onboarding request status
router.get("/therapist-onboarding/status", verifyToken, asyncHandler(getStatusController));

// Protected User Route: Complete onboarding form and convert user role to therapist
router.post("/therapist-onboarding/complete", verifyToken, asyncHandler(completeOnboardingController));

// Protected User/Admin Route: Get in-app notifications
router.get("/notifications", verifyToken, asyncHandler(getNotificationsController));

export default router;
