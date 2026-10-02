import { Request, Response } from "express";
import { verifySupabaseToken } from "../middleware/auth";
import { createSessionInDB, endSessionInDB, fetchUserSessions, fetchSessionDetail, getCreditBalance, updateMoodCheckout } from "../db/dbService";
import { triggerSessionEnd } from "../cache/sessionCache";
import { fetchSessionInsights, insightsFullyEnabled } from "../services/insights";

// ─── GET /api/credits ────────────────────────────────────────────────────────
export async function getCredits(req: Request, res: Response): Promise<void> {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Missing token" }); return; }

    const user = await verifySupabaseToken(token);
    if (!user) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    try {
        const balance = await getCreditBalance(user.id);
        res.status(200).json({ balance_minutes: balance });
    } catch (err) {
        console.error(`[SessionCtrl] getCredits error  userId=${user.id}  err=${(err as Error).message}`);
        res.status(500).json({ error: "Failed to fetch credits" });
    }
}

// ─── GET /api/sessions ───────────────────────────────────────────────────────
export async function getSessions(req: Request, res: Response): Promise<void> {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Missing token" }); return; }

    const user = await verifySupabaseToken(token);
    if (!user) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    try {
        const sessions = await fetchUserSessions(user.id);
        res.status(200).json({ sessions });
    } catch (err) {
        console.error(`[SessionCtrl] getSessions error  userId=${user.id}  err=${(err as Error).message}`);
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
}

// ─── GET /api/sessions/:id ────────────────────────────────────────────────────
export async function getSessionDetail(req: Request, res: Response): Promise<void> {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Missing token" }); return; }

    const user = await verifySupabaseToken(token);
    if (!user) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const { id } = req.params;
    try {
        const detail = await fetchSessionDetail(id as string, user.id);
        if (!detail.session) { res.status(404).json({ error: "Session not found" }); return; }
        res.status(200).json(detail);
    } catch (err) {
        console.error(`[SessionCtrl] getSessionDetail error  sessionId=${id}  err=${(err as Error).message}`);
        res.status(500).json({ error: "Failed to fetch session detail" });
    }
}

// ─── GET /api/sessions/:id/insights ───────────────────────────────────────────
// Signed-in users only. Returns soft, banded themes -- never raw scores, and never the
// suicide-risk score itself (see services/insights.ts). Hidden unless INSIGHTS_ENABLED=true.
export async function getSessionInsights(req: Request, res: Response): Promise<void> {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { res.status(401).json({ error: "Missing token" }); return; }

    const user = await verifySupabaseToken(token);
    if (!user) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const { id } = req.params;
    try {
        const insights = await fetchSessionInsights(id as string, user.id);
        if (!insights) { res.status(404).json({ error: "Session not found" }); return; }
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json(insights);
    } catch (err) {
        console.error(`[SessionCtrl] getSessionInsights error  sessionId=${id}  err=${(err as Error).message}`);
        res.status(500).json({ error: "Failed to fetch insights" });
    }
}

// ─── POST /api/session/start ──────────────────────────────────────────────────
export async function startSession(req: Request, res: Response): Promise<void> {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
        res.status(401).json({ error: "Missing token" });
        return;
    }

    const user = await verifySupabaseToken(token);
    if (!user) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    try {
        // Credit gate — user must have at least 1 minute remaining
        const balance = await getCreditBalance(user.id);
        if (balance <= 0) {
            res.status(402).json({ error: "insufficient_credits", balance: 0 });
            return;
        }

        const { moodCheckin, languageCode } = req.body as { moodCheckin?: number; languageCode?: string };
        const sessionId = await createSessionInDB(user.id, moodCheckin, languageCode);
        console.log(`[SessionCtrl] Session started  userId=${user.id}  sessionId=${sessionId}  mood=${moodCheckin ?? 'none'}  lang=${languageCode ?? 'en-IN'}`);
        res.status(200).json({ sessionId });
    } catch (err) {
        console.error(`[SessionCtrl] startSession error  userId=${user.id}  err=${(err as Error).message}`);
        res.status(500).json({ error: "Failed to create session" });
    }
}

// ─── POST /api/session/end ────────────────────────────────────────────────────
export async function endSession(req: Request, res: Response): Promise<void> {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
        res.status(401).json({ error: "Missing token" });
        return;
    }

    const user = await verifySupabaseToken(token);
    if (!user) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
        res.status(400).json({ error: "sessionId is required" });
        return;
    }

    try {
        // End session in DB + trigger summary generation from in-memory rolling summary
        await triggerSessionEnd(user.id, sessionId);
        console.log(`[SessionCtrl] Session ended  userId=${user.id}  sessionId=${sessionId}`);
        // insightsEnabled lets the app decide whether to show the "reflecting on your session" notice.
        res.status(200).json({ status: "ended", insightsEnabled: insightsFullyEnabled() });
    } catch (err) {
        console.error(`[SessionCtrl] endSession error  sessionId=${sessionId}  err=${(err as Error).message}`);
        res.status(500).json({ error: "Failed to end session" });
    }
}

// ─── POST /api/session/mood-checkout ──────────────────────────────────────────
// Works for both signed-in users (sessionId is the real DB row id) and guests
// (no reliable client-side sessionId — resolved server-side via guestId instead).
export async function submitMoodCheckout(req: Request, res: Response): Promise<void> {
    const { sessionId, guestId, moodCheckout } = req.body as {
        sessionId?: string; guestId?: string; moodCheckout?: number;
    };

    if (!Number.isInteger(moodCheckout) || (moodCheckout as number) < 1 || (moodCheckout as number) > 5) {
        res.status(400).json({ error: "moodCheckout must be an integer between 1 and 5" });
        return;
    }
    if (!sessionId && !guestId) {
        res.status(400).json({ error: "sessionId or guestId is required" });
        return;
    }

    // Signed-in requests may include a token — verify it if present, but don't require
    // it, since guests hit this same endpoint with no token at all.
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
        const user = await verifySupabaseToken(token);
        if (!user) { res.status(401).json({ error: "Invalid or expired token" }); return; }
    }

    try {
        const saved = await updateMoodCheckout({ sessionId, guestId, moodCheckout: moodCheckout as number });
        if (!saved) { res.status(404).json({ error: "No matching session found" }); return; }
        res.status(200).json({ status: "saved" });
    } catch (err) {
        console.error(`[SessionCtrl] submitMoodCheckout error  sessionId=${sessionId}  guestId=${guestId}  err=${(err as Error).message}`);
        res.status(500).json({ error: "Failed to save mood checkout" });
    }
}
