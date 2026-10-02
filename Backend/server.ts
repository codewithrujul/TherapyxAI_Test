import dotenv from "dotenv";
dotenv.config();
// Untracked, git-ignored secrets file for local dev (e.g. HF_API_KEY). Doesn't override
// anything already set, and simply does nothing where the file doesn't exist (Railway).
dotenv.config({ path: ".env.local" });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import pingRoute from "./routes/ping.route";
import { registerVoiceRoute } from "./routes/voice.route";
import authRouter from "./routes/auth.route";
import { registerChatRoute } from "./routes/chat.route";
import sessionRouter from "./routes/session.route";
import profileRouter from "./routes/profile.route";
import guestRouter from "./routes/guest.route";
import therapistRouter from "./routes/therapist.route";
import notificationRouter from "./routes/notification.route";
import onboardingRequestRouter from "./routes/onboardingRequest.route";
import feedbackRouter from "./routes/feedback.route";
import adminRouter from "./routes/admin.route";
import { WebSocketServer } from "ws";
import { handleVoiceSocket } from "./controller/voice.controller";
import { handleChatSocket } from "./controller/chat.controller";
import { startInactivityWatcher } from "./cache/sessionCache";
import { cleanupOrphanedSessions } from "./db/dbService";
import { startReminderScheduler } from "./services/reminderService";
import { startAnalysisWorker } from "./services/analysisQueue";

const app = express();

// Trust Railway's reverse proxy so express-rate-limit reads the correct client IP
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — only allow the frontend origin ─────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : ["http://localhost:5173"];

const corsOptions: cors.CorsOptions = {
    origin: (origin, cb) => {
        // Allow requests with no origin (mobile apps, curl, health checks)
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        // Return null (deny) instead of throwing — avoids 500, returns proper CORS rejection
        cb(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
};

// Handle preflight requests before rate limiter so OPTIONS never gets rate-limited
// Express 5 requires named wildcards — bare "*" throws a PathError at startup
app.options("*path", cors(corsOptions));
app.use(cors(corsOptions));

// ── Rate limiting — temporarily disabled ──────────────────────────────────────
// TODO: re-enable once trust proxy is confirmed working on Railway
// app.use("/api/auth", rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 10,
//     standardHeaders: true,
//     legacyHeaders: false,
//     message: { error: "Too many attempts. Please wait and try again." },
// }));
// app.use("/api", rateLimit({
//     windowMs: 60 * 1000,
//     max: 120,
//     standardHeaders: true,
//     legacyHeaders: false,
// }));

app.use(express.json());
app.use("/api", pingRoute);
 
// ── Register routes ───────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api",     sessionRouter);            // POST /api/session/start, /api/session/end
app.use("/api",     profileRouter);            // GET/PUT /api/profile
// Public guest endpoints. Must stay ABOVE adminRouter: it applies verifyToken + requireRole(["admin"])
// to every /api request that reaches it, so anything mounted after it answers 401 to guests.
app.use("/api",     guestRouter);              // GET /api/guest/reflection-offer, POST /api/guest/reflection-decline
app.use("/api",     therapistRouter);         // GET /api/therapists, POST /api/therapists/onboarding
app.use("/api",     notificationRouter);       // POST/GET /api/notifications/test-email
app.use("/api",     onboardingRequestRouter);  // Therapist onboarding request & status routes
app.use("/api",     feedbackRouter);           // POST /api/feedback
app.use("/api",     adminRouter);              // Admin Dashboard API routes (keep LAST: router.use(verifyToken, admin))
 
// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server] Unhandled error:", err.message);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
});


const server = createServer(app);

// // register voice WebSocket
// registerVoiceRoute(server);
// // registerChatRoute(server);  

// ── single WSS, route by path ──────────────────
const wss = new WebSocketServer({ server, perMessageDeflate: false });

wss.on("connection", (ws, req) => {
    const path = req.url;

    if (path === "/ws/voice") {
        console.log("Voice client connected");
        handleVoiceSocket(ws, req);
    } else if (path === "/ws/chat") {
        console.log("Chat client connected");
        handleChatSocket(ws, req);
    } else {
        console.log("Unknown path:", path);
        ws.close();
    }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket ready at ws://localhost:${PORT}/ws/voice`);
    console.log(`Chat  WS  → ws://localhost:${PORT}/ws/chat`);
    startInactivityWatcher();
    startReminderScheduler();
    startAnalysisWorker();   // no-op unless ANALYSIS_ENABLED=true
    cleanupOrphanedSessions().catch(err =>
        console.error("[Server] Orphaned session cleanup failed:", (err as Error).message)
    );
});

// ── Graceful shutdown — closes active WS sessions before exiting ──────────────
// Railway / PM2 sends SIGTERM on deploy/restart; SIGINT on Ctrl-C locally.
// 30-second hard kill prevents zombie processes if something hangs.
function shutdown(signal: string) {
    console.log(`[Server] ${signal} received — shutting down gracefully…`);

    // 1. Close all open WebSocket connections so clients reconnect cleanly
    wss.clients.forEach(client => {
        try { client.close(1001, "Server restarting"); } catch {}
    });

    // 2. Stop accepting new HTTP requests; wait for in-flight requests to finish
    server.close(() => {
        console.log("[Server] HTTP server closed — exiting.");
        process.exit(0);
    });

    // 3. Force-kill after 30 s if something is still hanging
    setTimeout(() => {
        console.error("[Server] Forced exit after 30 s timeout.");
        process.exit(1);
    }, 30_000).unref();   // .unref() so this timer doesn't prevent normal exit
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
