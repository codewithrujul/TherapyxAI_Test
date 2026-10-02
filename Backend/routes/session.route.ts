import { Router } from "express";
import { startSession, endSession, getSessions, getSessionDetail, getSessionInsights, getCredits, submitMoodCheckout } from "../controller/session.controller";

const router = Router();

router.get("/credits",              getCredits);
router.post("/session/start",       startSession);
router.post("/session/end",         endSession);
router.post("/session/mood-checkout", submitMoodCheckout);
router.get("/sessions",             getSessions);
router.get("/sessions/:id",         getSessionDetail);
router.get("/sessions/:id/insights", getSessionInsights);

export default router;
