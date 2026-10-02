// "Sign in to get your reflections" for guests.
//
// A guest's conversation is not saved (unless STORE_GUEST_CHATS is on). To let a guest get
// reflections AFTER they agree and sign in, we:
//   1. hold their transcript in server MEMORY only, for a short window (default 20 min);
//   2. if they sign in / sign up WITH explicit consent, copy it into the normal chat_messages
//      table (encrypted with their own user key), record the consent, and queue the analysis;
//   3. otherwise it simply expires, or is deleted straight away if they decline.
// Nothing here writes a guest's text to the database without consent. Everything is off unless
// GUEST_REFLECTIONS_ENABLED=true.

import { supabaseAdmin } from "../db/supabaseClient";
import { encrypt, decrypt } from "../utils/encryption";
import { enqueueAnalysis } from "./analysisQueue";

export const guestReflectionsEnabled = (): boolean => process.env.GUEST_REFLECTIONS_ENABLED === "true";
const windowMs = (): number => (Number(process.env.GUEST_REFLECTION_WINDOW_MIN) > 0 ? Number(process.env.GUEST_REFLECTION_WINDOW_MIN) : 20) * 60_000;

const MAX_SESSIONS_PER_GUEST = 3;    // most recent sessions held per guest
const MAX_PAIRS_PER_SESSION  = 200;  // user/assistant exchanges kept per session
const MAX_GUESTS_HELD        = 200;  // hard cap on memory use
const MAX_SESSIONS_LOOKUP    = 50;   // guest sessions considered when claiming

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidGuestId = (id: unknown): id is string => typeof id === "string" && UUID_RE.test(id);

const asGuestUserId = (rawGuestId: string) => `guest_${rawGuestId}`;
const rawOf = (guestUserId: string) => guestUserId.replace(/^guest_/, "");

// ─── In-memory hold ───────────────────────────────────────────────────────────

interface Pair { user: string; assistant: string }
interface HeldSession { sessionId: string; pairs: Pair[]; endedAt: number }

const held = new Map<string, HeldSession[]>();   // key: raw guest id
let sweeper: NodeJS.Timeout | null = null;

function prune(): void {
    const cutoff = Date.now() - windowMs();
    for (const [guest, list] of held) {
        const keep = list.filter(s => s.endedAt >= cutoff);
        if (keep.length) held.set(guest, keep); else held.delete(guest);
    }
}

function ensureSweeper(): void {
    if (sweeper) return;
    sweeper = setInterval(prune, 60_000);
    sweeper.unref();   // never keeps the process alive
}

/**
 * Called when a guest session ends. Keeps the transcript in memory for the window.
 * No-op unless enabled, and skipped when guest chats are already being stored.
 */
export function holdGuestTranscript(guestUserId: string, sessionId: string, turns: Array<{ role: string; content: string }>): void {
    try {
        if (!guestReflectionsEnabled()) return;
        if (process.env.STORE_GUEST_CHATS === "true") return;   // already persisted in guest_chat_messages
        const raw = rawOf(guestUserId);
        if (!isValidGuestId(raw)) return;

        const pairs: Pair[] = [];
        for (let i = 0; i < turns.length && pairs.length < MAX_PAIRS_PER_SESSION; i += 2) {
            const user = turns[i]?.role === "user" ? turns[i].content : "";
            const assistant = turns[i + 1]?.role === "assistant" ? turns[i + 1].content : "";
            if (user && user.trim()) pairs.push({ user, assistant });
        }
        if (!pairs.length) return;

        prune();
        const list = (held.get(raw) ?? []).filter(s => s.sessionId !== sessionId);
        list.push({ sessionId, pairs, endedAt: Date.now() });
        held.set(raw, list.slice(-MAX_SESSIONS_PER_GUEST));

        while (held.size > MAX_GUESTS_HELD) held.delete(held.keys().next().value as string);   // drop oldest guest
        ensureSweeper();
    } catch (err) {
        console.error(`[GuestReflections] hold failed  err=${(err as Error).message}`);
    }
}

/** Forget any held transcript for this guest (e.g. they signed in without consent). */
export function discardHeld(rawGuestId: string): void {
    held.delete(rawGuestId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** This guest's session ids, newest first. Must be called BEFORE sessions are linked to a user. */
export async function getGuestSessionIds(rawGuestId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
        .from("sessions").select("id").eq("guest_id", rawGuestId)
        .order("start_time", { ascending: false }).limit(MAX_SESSIONS_LOOKUP);
    if (error) { console.error(`[GuestReflections] session lookup failed  err=${error.message}`); return []; }
    return (data ?? []).map(r => r.id as string);
}

// ─── Offer (does this guest have something we could give reflections for?) ─────

export async function getGuestOffer(rawGuestId: string): Promise<{ available: boolean; expiresInMin: number | null }> {
    if (!guestReflectionsEnabled() || !isValidGuestId(rawGuestId)) return { available: false, expiresInMin: null };

    prune();
    const mine = held.get(rawGuestId);
    if (mine?.length) {
        const newest = mine[mine.length - 1];
        const left = Math.max(1, Math.ceil((newest.endedAt + windowMs() - Date.now()) / 60_000));
        return { available: true, expiresInMin: left };
    }

    // Stored path (STORE_GUEST_CHATS=true): available for as long as the stored chat exists.
    if (process.env.STORE_GUEST_CHATS === "true") {
        const ids = await getGuestSessionIds(rawGuestId);
        if (ids.length) {
            const { data } = await supabaseAdmin.from("guest_chat_messages").select("id").in("session_id", ids).limit(1);
            if (data && data.length) return { available: true, expiresInMin: null };
        }
    }
    return { available: false, expiresInMin: null };
}

// ─── Decline (guest says "no thanks": discard everything we hold for them) ────

export async function declineGuestReflections(rawGuestId: string): Promise<{ removedStoredSessions: number }> {
    if (!isValidGuestId(rawGuestId)) return { removedStoredSessions: 0 };
    held.delete(rawGuestId);

    const ids = await getGuestSessionIds(rawGuestId);
    if (!ids.length) return { removedStoredSessions: 0 };

    const { data: gone } = await supabaseAdmin.from("guest_chat_messages").delete().in("session_id", ids).select("session_id");
    // Also remove any analysis that was produced for those guest sessions.
    await supabaseAdmin.from("analysis_jobs").delete().in("session_id", ids);
    await supabaseAdmin.from("session_analysis_summary").delete().in("session_id", ids);
    await supabaseAdmin.from("session_analysis_audit_log").delete().in("session_id", ids);
    return { removedStoredSessions: new Set((gone ?? []).map(r => r.session_id)).size };
}

// ─── Claim (guest signed in WITH consent) ─────────────────────────────────────

interface Row { user: string; assistant: string; mode: string; createdAt: string }

/**
 * Copies the guest's transcript(s) into chat_messages under the new user, records the consent,
 * and gets the analysis running. Call AFTER the guest's sessions have been linked to userId.
 * Throws if the consent record cannot be written (fails closed: nothing is copied).
 */
export async function claimGuestReflections(args: {
    rawGuestId: string; userId: string; sessionIds: string[]; consentVersion: string;
}): Promise<{ claimed: number; sessionIds: string[] }> {
    const { rawGuestId, userId, sessionIds, consentVersion } = args;
    if (!guestReflectionsEnabled() || !isValidGuestId(rawGuestId) || !sessionIds.length) return { claimed: 0, sessionIds: [] };

    const guestUserId = asGuestUserId(rawGuestId);
    const transcripts = new Map<string, Row[]>();

    // (a) stored path: guest_chat_messages, decrypted with the guest key
    const { data: stored, error: storedErr } = await supabaseAdmin
        .from("guest_chat_messages").select("session_id, user_msg, ai_reply, mode, created_at")
        .in("session_id", sessionIds).order("created_at", { ascending: true });
    if (storedErr) console.error(`[GuestReflections] stored read failed  err=${storedErr.message}`);
    for (const r of stored ?? []) {
        const list = transcripts.get(r.session_id) ?? [];
        list.push({ user: decrypt(r.user_msg, guestUserId), assistant: decrypt(r.ai_reply, guestUserId), mode: r.mode ?? "chat", createdAt: r.created_at });
        transcripts.set(r.session_id, list);
    }

    // (b) memory path: transcripts held after the session ended (only for sessions not already stored)
    prune();
    for (const s of held.get(rawGuestId) ?? []) {
        if (!sessionIds.includes(s.sessionId) || transcripts.has(s.sessionId)) continue;
        const base = s.endedAt - s.pairs.length * 1000;   // keep the original order via increasing timestamps
        transcripts.set(s.sessionId, s.pairs.map((p, i) => ({
            user: p.user, assistant: p.assistant, mode: "chat", createdAt: new Date(base + i * 1000).toISOString(),
        })));
    }
    if (!transcripts.size) return { claimed: 0, sessionIds: [] };

    // Consent evidence first. If this fails we copy nothing.
    const { error: consentErr } = await supabaseAdmin.from("reflection_consents").insert({
        user_id: userId, guest_id: rawGuestId, consent_version: consentVersion, session_ids: [...transcripts.keys()],
    });
    if (consentErr) throw new Error(`could not record consent: ${consentErr.message}`);

    const claimed: string[] = [];
    for (const [sessionId, rows] of transcripts) {
        // Idempotent: never write a session's messages twice.
        const { data: already } = await supabaseAdmin.from("chat_messages").select("id").eq("session_id", sessionId).limit(1);
        if (already && already.length) { claimed.push(sessionId); continue; }

        const { error: insErr } = await supabaseAdmin.from("chat_messages").insert(rows.map(r => ({
            session_id: sessionId, user_id: userId,
            user_msg: encrypt(r.user, userId), ai_reply: encrypt(r.assistant, userId),
            mode: r.mode, created_at: r.createdAt,
        })));
        if (insErr) { console.error(`[GuestReflections] copy failed  sessionId=${sessionId}  err=${insErr.message}`); continue; }
        claimed.push(sessionId);
    }

    for (const sessionId of claimed) {
        // Make the analysis belong to the real user and (re)run it if it hasn't finished.
        const { data: job } = await supabaseAdmin.from("analysis_jobs").select("status").eq("session_id", sessionId).maybeSingle();
        if (!job) {
            enqueueAnalysis(userId, sessionId);
        } else if (job.status === "done") {
            await supabaseAdmin.from("analysis_jobs").update({ user_id: userId }).eq("session_id", sessionId);
            await supabaseAdmin.from("session_analysis_summary").update({ user_id: userId }).eq("session_id", sessionId);
            await supabaseAdmin.from("session_analysis_audit_log").update({ user_id: userId }).eq("session_id", sessionId);
        } else {
            await supabaseAdmin.from("analysis_jobs").update({
                user_id: userId, status: "pending", attempts: 0, run_after: new Date().toISOString(), locked_at: null, last_error: null,
            }).eq("session_id", sessionId);
        }
    }

    // The guest-side copy is no longer needed once it lives under the user.
    if (claimed.length) {
        await supabaseAdmin.from("guest_chat_messages").delete().in("session_id", claimed);
        const remaining = (held.get(rawGuestId) ?? []).filter(s => !claimed.includes(s.sessionId));
        if (remaining.length) held.set(rawGuestId, remaining); else held.delete(rawGuestId);
    }
    console.log(`[GuestReflections] Claimed  userId=${userId}  sessions=${claimed.length}`);
    return { claimed: claimed.length, sessionIds: claimed };
}
