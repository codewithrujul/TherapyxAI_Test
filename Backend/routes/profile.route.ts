import { Router, Request, Response, NextFunction } from "express";
import { getProfile, updateProfile } from "../controller/profile.controller";
import { verifyToken } from "../middleware/auth";

const router = Router();

const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        fn(req, res, next).catch(next);

router.get("/profile", verifyToken, asyncHandler(getProfile));
router.put("/profile", verifyToken, asyncHandler(updateProfile));

export default router;
