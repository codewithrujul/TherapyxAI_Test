import { Router } from "express";
import { submitFeedback } from "../controller/feedback.controller";

const router = Router();

router.post("/feedback", submitFeedback);

export default router;
