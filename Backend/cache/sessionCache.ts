import { fetchPreviousSessionSummary, endSessionInDB, saveSessionSummary, deductSessionCredits } from "../db/dbService";
import { processSessionMemories, UserMemory } from "../memory/memoService";
import { enqueueAnalysis } from "../services/analysisQueue";
import { holdGuestTranscript } from "../services/guestReflections";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
    id:             string;
    name:           string;
    languageCode:   string;
    selectedReason?: string;
}

export interface Turn {
    role:    "user" | "assistant";
    content: string;
}

export interface SessionContext {
    sessionId:              string;
    profile:                UserProfile;
    turns:                  Turn[];           // all turns this session (used as live context)
    previousSessionSummary: string;           // loaded from DB at session start
    memory:                 UserMemory;
    lastActivityAt:         number;           // Date.now() — updated on every turn
    sessionStartAt:         number;           // Date.now() at session start — used for credit deduction
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const sessions = new Map<string, SessionContext>();

// ─── Auto-timeout: 3 minutes of inactivity ───────────────────────────────────

const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes
const WATCHER_INTERVAL_MS = 30_000;  // check every 30s

export function startInactivityWatcher(): void {
    setInterval(async () => {
        const now = Date.now();
        for (const [userId, ctx] of sessions.entries()) {
            if (now - ctx.lastActivityAt >= INACTIVITY_MS) {
                console.log(`[SessionCache] Auto-timeout  userId=${userId}  sessionId=${ctx.sessionId}`);
                await triggerSessionEnd(userId, ctx.sessionId);
            }
        }
    }, WATCHER_INTERVAL_MS);

    console.log("[SessionCache] Inactivity watcher started (3 min timeout)");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getSessionContext(userId: string): SessionContext | undefined {
    return sessions.get(userId);
}

export function getProfile(userId: string): UserProfile | null {
    return sessions.get(userId)?.profile ?? null;
}

export function updateActivity(userId: string): void {
    const ctx = sessions.get(userId);
    if (ctx) ctx.lastActivityAt = Date.now();
}

export async function startSession(profile: UserProfile, sessionId: string): Promise<void> {
    console.log(`[SessionCache] Starting  userId=${profile.id}  sessionId=${sessionId}`);

    const isGuest = profile.id.startsWith("guest_");

    // WS reconnect mid-session — preserve existing turns so the AI keeps context
    const existing = sessions.get(profile.id);
    if (existing && existing.sessionId === sessionId && !isGuest) {
        existing.profile        = profile;
        existing.lastActivityAt = Date.now();
        console.log(`[SessionCache] Reconnect — preserved ${existing.turns.length / 2} turn(s)  userId=${profile.id}`);
        return;
    }

    const { summary, memory } = isGuest
        ? { summary: "", memory: { interests: [], facts: [], mood: "", other: [] } as UserMemory }
        : await fetchPreviousSessionSummary(profile.id);

    sessions.set(profile.id, {
        sessionId,
        profile,
        turns:                  [],
        previousSessionSummary: summary,
        memory,
        lastActivityAt:         Date.now(),
        sessionStartAt:         Date.now(),
    });

    console.log(`[SessionCache] Session ready  userId=${profile.id}`);
}

// Called by both manual end (session.controller) and auto-timeout watcher
export async function triggerSessionEnd(userId: string, sessionId: string): Promise<void> {
    const isGuest = userId.startsWith("guest_");
    const ctx = sessions.get(userId);
    sessions.delete(userId);

    // Compute duration from in-memory start time — avoids a SELECT round trip in endSessionInDB
    const durationSecs = ctx?.sessionStartAt
        ? Math.floor((Date.now() - ctx.sessionStartAt) / 1000)
        : null;

    await endSessionInDB(sessionId, durationSecs);

    // Guests have no credits — skip deduction
    if (ctx && !isGuest) {
        const durationMins = Math.max(1, Math.ceil((durationSecs ?? 60) / 60));
        await deductSessionCredits(userId, sessionId, durationMins);
    }

    if (!ctx || ctx.turns.length === 0) {
        console.log(`[SessionCache] No turns to summarise  userId=${userId}`);
        return;
    }

    // Post-session disorder analysis. Fire-and-forget, never throws, and does nothing
    // unless ANALYSIS_ENABLED=true -- so it cannot affect session end either way.
    // Sits before the guest return: guests are analyzed only if STORE_GUEST_CHATS=true
    // (enqueueAnalysis itself skips them otherwise).
    enqueueAnalysis(userId, sessionId);

    // Guests have no persistent memory — skip summarisation
    if (isGuest) {
        // Held in memory only (short window) so a guest who signs in with consent can get reflections.
        holdGuestTranscript(userId, sessionId, ctx.turns);
        console.log(`[SessionCache] Guest session ended (no summary)  guestId=${userId}  sessionId=${sessionId}`);
        return;
    }

    const lines: string[] = [];
    for (let i = 0; i < ctx.turns.length; i += 2) {
        const user = ctx.turns[i];
        const ai   = ctx.turns[i + 1];
        if (user) lines.push(`User: ${user.content}`);
        if (ai)   lines.push(`AI: ${ai.content}`);
    }
    const transcript = lines.join("\n");

    // Fire-and-forget — LLM memory extraction can take 2–5 s; don't block the WS close handler
    processSessionMemories(userId, sessionId, transcript)
        .then(() => console.log(`[SessionCache] Session summarised  userId=${userId}`))
        .catch(err => console.error(`[SessionCache] summarise failed  userId=${userId}  err=${(err as Error).message}`));
}

// Called by WebSocket close — only ends if session still active
export async function endSession(userId: string): Promise<void> {
    const ctx = sessions.get(userId);
    if (!ctx) return;
    await triggerSessionEnd(userId, ctx.sessionId);
}
