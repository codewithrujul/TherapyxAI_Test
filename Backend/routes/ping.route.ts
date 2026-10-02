import { ping, health } from "../controller/ping.controller";
import { Router } from "express";

const router = Router();

router.get("/ping",   ping);
router.get("/health", health);   // Railway health-check path: /api/health

// /api/test-tts removed — development-only endpoint, must not exist in production

export default router;
