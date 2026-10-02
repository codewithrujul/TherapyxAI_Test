import { Request, Response } from "express";
import { supabaseAdmin } from "../db/supabaseClient";

export const ping = (_req: Request, res: Response) => {
    res.status(200).json({ message: "pong", status: "server is running" });
};

// ── Real health check — used by Railway / UptimeRobot ────────────────────────
// Returns { status: "ok" | "degraded", db: "ok" | "error", uptime, memory }
// Railway health-check path should be set to: /api/health
export const health = async (_req: Request, res: Response) => {
    let dbStatus: "ok" | "error" = "ok";

    try {
        // Lightweight DB probe — just checks the connection is alive
        const { error } = await supabaseAdmin
            .from("sessions")
            .select("id")
            .limit(1);

        if (error) dbStatus = "error";
    } catch {
        dbStatus = "error";
    }

    const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

    res.status(dbStatus === "ok" ? 200 : 503).json({
        status:  dbStatus === "ok" ? "ok" : "degraded",
        db:      dbStatus,
        uptime:  Math.floor(process.uptime()),
        memory:  `${memMB}MB`,
    });
};
