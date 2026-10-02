import { Router, Request, Response, NextFunction } from "express";
import { sendTestEmailController } from "../controller/notification.controller";

const router = Router();

const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        fn(req, res, next).catch(next);

// Development / Test route to verify Resend email sending
router.post("/notifications/test-email", asyncHandler(sendTestEmailController));
router.get("/notifications/test-email", asyncHandler(sendTestEmailController));

export default router;
