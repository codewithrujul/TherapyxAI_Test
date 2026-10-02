// Post-session disorder analysis, backed by the `analysis_jobs` Supabase table.
//
// Everything here is OFF unless ANALYSIS_ENABLED=true, and nothing in this file is
// allowed to throw into the caller -- a failure here must never affect sessions.
// See db/session_analysis_migration.sql for the tables and the claim function.

import { supabaseAdmin } from "../db/supabaseClient";
import { decrypt } from "../utils/encryption";
import { callAnalysisService, AnalysisResult } from "./analysisClient";

const MAX_ATTEMPTS      = 3;
// Sessions sent to HuggingFace at once. Default 1: the free-tier Space has 2 CPUs and each
// analysis already uses them, so extra parallelism mostly causes slowdowns/timeouts.
// Raise via the ANALYSIS_CONCURRENCY env var only after measuring.
const CONCURRENCY       = Math.max(1, Math.floor(Number(process.env.ANALYSIS_CONCURRENCY)) || 1);
const POLL_MS           = 45_000;          // slow safety-net poll (retries / restart recovery)
const START_DELAY_MS    = 10_000;          // let in-flight saveChatMessage writes finish first
const RETRY_BACKOFF_MS  = [30_000, 120_000, 300_000];
const MAX_MESSAGES      = 200;             // bound the size of a single request

interface AnalysisJob {
    id:         number;
    session_id: string;
    user_id:    string;
    attempts:   number;
}

const isEnabled = () => process.env.ANALYSIS_ENABLED === "true";

let processing = false;   // prevents overlapping runs inside this process

// ─── Enqueue (called when a session ends) ─────────────────────────────────────

/** Fire-and-forget. Never throws, never blocks the caller. */
export function enqueueAnalysis(userId: string, sessionId: string): void {
    try {
        if (!isEnabled()) return;
        // Guests only have stored messages when STORE_GUEST_CHATS=true (see dbService.saveChatMessage).
        if (userId.startsWith("guest_") && process.env.STORE_GUEST_CHATS !== "true") return;

        void (async () => {
            try {
                const { error } = await supabaseAdmin
                    .from("analysis_jobs")
                    .upsert(
                        {
                            session_id: sessionId,
                            user_id:    userId,
                            status:     "pending",
                            run_after:  new Date(Date.now() + START_DELAY_MS).toISOString(),
                        },
                        { onConflict: "session_id", ignoreDuplicates: true }
                    );
                if (error) throw error;

                // Kick the worker right after the start delay instead of waiting for the poll.
                setTimeout(() => { void processPendingJobs(); }, START_DELAY_MS + 500).unref();
            } catch (err) {
                console.error(`[Analysis] enqueue failed  sessionId=${sessionId}  err=${(err as Error).message}`);
            }
        })();
    } catch (err) {
        console.error(`[Analysis] enqueue error  sessionId=${sessionId}  err=${(err as Error).message}`);
    }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startAnalysisWorker(): void {
    if (!isEnabled()) {
        console.log("[Analysis] Disabled (ANALYSIS_ENABLED != true)");
        return;
    }
    if (!process.env.HF_ANALYZE_URL || !process.env.HF_API_KEY) {
        console.error("[Analysis] ANALYSIS_ENABLED=true but HF_ANALYZE_URL / HF_API_KEY missing -- worker not started");
        return;
    }

    setInterval(() => { void processPendingJobs(); }, POLL_MS);
    // Pick up anything left over from before a restart shortly after boot.
    setTimeout(() => { void processPendingJobs(); }, 15_000).unref();
    console.log(`[Analysis] Worker started  poll=${POLL_MS / 1000}s  concurrency=${CONCURRENCY}`);
}

export async function processPendingJobs(): Promise<void> {
    if (!isEnabled() || processing) return;
    processing = true;
    try {
        for (let i = 0; i < 50; i++) {   // drain the queue, but never loop forever
            const { data, error } = await supabaseAdmin.rpc("claim_analysis_jobs", { batch_size: CONCURRENCY });
            if (error) {
                console.error(`[Analysis] claim failed  err=${error.message}`);
                return;
            }
            const jobs = (data ?? []) as AnalysisJob[];
            if (jobs.length === 0) return;
            await Promise.all(jobs.map(processJob));
        }
    } catch (err) {
        console.error(`[Analysis] worker error  err=${(err as Error).message}`);
    } finally {
        processing = false;
    }
}

async function processJob(job: AnalysisJob): Promise<void> {
    try {
        const messages = await loadUserMessages(job.session_id, job.user_id);
        if (messages.length === 0) {
            await updateJob(job.id, { status: "skipped", last_error: null });
            console.log(`[Analysis] Skipped (no messages)  sessionId=${job.session_id}`);
            return;
        }

        const result = await callAnalysisService(messages);
        await saveResult(job, result);
        await updateJob(job.id, { status: "done", last_error: null });

        const r = result.response;
        console.log(`[Analysis] Done  sessionId=${job.session_id}  messages=${r.message_count}  flags=${r.dominant_flags.join(",") || "none"}  highRisk=${r.high_risk_triggered}`);
        if (r.high_risk_triggered) {
            // TODO: hook human escalation in here. Deliberately logs IDs only, never message text.
            console.warn(`[Analysis] HIGH RISK  sessionId=${job.session_id}  userId=${job.user_id}  turns=${r.high_risk_turns.map(t => t.turn).join(",")}`);
        }
    } catch (err) {
        const msg = (err as Error).message;
        if (job.attempts >= MAX_ATTEMPTS) {
            await updateJob(job.id, { status: "failed", last_error: msg });
            console.error(`[Analysis] FAILED permanently  sessionId=${job.session_id}  attempts=${job.attempts}  err=${msg}`);
        } else {
            const delay = RETRY_BACKOFF_MS[Math.min(job.attempts - 1, RETRY_BACKOFF_MS.length - 1)];
            await updateJob(job.id, {
                status:    "pending",
                run_after: new Date(Date.now() + delay).toISOString(),
                last_error: msg,
            });
            console.warn(`[Analysis] Retry scheduled  sessionId=${job.session_id}  attempt=${job.attempts}/${MAX_ATTEMPTS}  err=${msg}`);
        }
    }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function updateJob(id: number, fields: Record<string, unknown>): Promise<void> {
    const { error } = await supabaseAdmin
        .from("analysis_jobs")
        .update({ ...fields, locked_at: null, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) console.error(`[Analysis] job update failed  id=${id}  err=${error.message}`);
}

/** The user's own messages for a session, decrypted, oldest first. */
export async function loadUserMessages(sessionId: string, userId: string): Promise<string[]> {
    // Guests live in their own table; registered users in chat_messages.
    const table = userId.startsWith("guest_") ? "guest_chat_messages" : "chat_messages";

    let { data, error } = await supabaseAdmin
        .from(table)
        .select("user_msg")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

    if (error) {
        // Ordering column might be named differently -- retry unordered rather than fail.
        console.warn(`[Analysis] ordered read failed (${error.message}); retrying unordered`);
        ({ data, error } = await supabaseAdmin
            .from(table)
            .select("user_msg")
            .eq("session_id", sessionId));
    }
    if (error) throw new Error(`could not read messages: ${error.message}`);

    const messages = (data ?? [])
        .map(row => decrypt(row.user_msg, userId))
        .filter(m => typeof m === "string" && m.trim().length > 0);

    if (messages.length > MAX_MESSAGES) {
        console.warn(`[Analysis] Truncating ${messages.length} -> ${MAX_MESSAGES} messages  sessionId=${sessionId}`);
        return messages.slice(0, MAX_MESSAGES);
    }
    return messages;
}

async function saveResult(job: AnalysisJob, result: AnalysisResult): Promise<void> {
    const r = result.response;

    // Strip any message text: results reference messages by turn number only, so this
    // never becomes a second, unencrypted copy of the conversation.
    const { error: sumErr } = await supabaseAdmin.from("session_analysis_summary").upsert({
        session_id:          job.session_id,
        user_id:             job.user_id,
        message_count:       r.message_count,
        high_risk_triggered: r.high_risk_triggered,
        high_risk_turns:     r.high_risk_turns.map(t => ({ turn: t.turn, suicidal_prob: t.suicidal_prob })),
        session_summary:     r.session_summary,
        dominant_flags:      r.dominant_flags,
    }, { onConflict: "session_id" });
    if (sumErr) throw new Error(`summary save failed: ${sumErr.message}`);

    const { error: auditErr } = await supabaseAdmin.from("session_analysis_audit_log").upsert({
        session_id:      job.session_id,
        user_id:         job.user_id,
        per_turn_detail: result.audit_log.per_turn_detail.map(t => ({
            turn_index:    t.turn_index,
            probabilities: t.probabilities,
            primary:       t.primary,
            is_high_risk:  t.is_high_risk,
        })),
    }, { onConflict: "session_id" });
    if (auditErr) throw new Error(`audit save failed: ${auditErr.message}`);
}
