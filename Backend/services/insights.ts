// Turns raw analysis results into the SAFE, soft, non-clinical shape the app may show.
//
// Rules this file enforces:
//  * Raw model scores never leave the Backend -- only bands ("light" / "moderate" / "strong").
//  * The suicide-risk score is NEVER returned or labelled. It can only switch on `showSupport`.
//  * Ownership is checked through the `sessions` table (session id + logged-in user), not the
//    user id stored on the analysis row -- so sessions that moved over from a guest account
//    can be shown to the user who now owns them.
//  * Everything is behind INSIGHTS_ENABLED (off by default): when off, the API says "hidden".

import { supabaseAdmin } from "../db/supabaseClient";

export type InsightStatus = "hidden" | "pending" | "ready" | "unavailable";
export type InsightLevel  = "light" | "moderate" | "strong";

export interface InsightTheme {
    key:   "low_mood" | "worry" | "difficult_experiences";
    label: string;
    level: InsightLevel;
}

export interface InsightsResponse {
    status:      InsightStatus;
    themes:      InsightTheme[];
    showSupport: boolean;
}

// Model class -> plain-language theme. "Normal" and "Suicidal" are deliberately absent.
const THEMES: Array<{ key: InsightTheme["key"]; source: string; label: string }> = [
    { key: "low_mood",              source: "Depression", label: "Low mood" },
    { key: "worry",                 source: "Anxiety",    label: "Worry & tension" },
    { key: "difficult_experiences", source: "PTSD",       label: "Stress from difficult experiences" },
];

const MAX_THEMES = 3;

export function bandScore(score: number): InsightLevel | null {
    if (score >= 0.70) return "strong";
    if (score >= 0.50) return "moderate";
    if (score >= 0.30) return "light";
    return null;   // below this, nothing is shown
}

export interface SummaryInput {
    session_summary:     Record<string, number> | null;
    high_risk_triggered: boolean | null;
}

const isEnabled = () => process.env.INSIGHTS_ENABLED === "true";

/**
 * True only when a session can actually end up showing insights: results must be produced
 * (ANALYSIS_ENABLED) AND displayed (INSIGHTS_ENABLED). The app uses this to decide whether
 * to tell the user "your reflections will appear in Session History".
 */
export const insightsFullyEnabled = (): boolean =>
    process.env.ANALYSIS_ENABLED === "true" && process.env.INSIGHTS_ENABLED === "true";

/** Pure function (no I/O) so it can be tested exhaustively. */
export function buildInsights(input: {
    enabled:   boolean;
    jobStatus: string | null;      // analysis_jobs.status, or null if there is no job
    summary:   SummaryInput | null;
}): InsightsResponse {
    const hidden: InsightsResponse = { status: "hidden", themes: [], showSupport: false };
    if (!input.enabled) return hidden;

    if (input.summary && input.summary.session_summary) {
        const scores = input.summary.session_summary;
        const themes = THEMES
            .map(t => ({ t, score: Number(scores[t.source]) || 0 }))
            .map(({ t, score }) => ({ key: t.key, label: t.label, level: bandScore(score), score }))
            .filter((x): x is { key: InsightTheme["key"]; label: string; level: InsightLevel; score: number } => x.level !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_THEMES)
            .map(({ key, label, level }) => ({ key, label, level }));

        return { status: "ready", themes, showSupport: Boolean(input.summary.high_risk_triggered) };
    }

    switch (input.jobStatus) {
        case "pending":
        case "processing": return { status: "pending",     themes: [], showSupport: false };
        case "failed":
        case "done":       return { status: "unavailable", themes: [], showSupport: false };  // done but no summary = something went wrong
        default:           return hidden;   // no job (old session, analysis off, guest) or skipped
    }
}

/**
 * Returns null when the session does not exist or does not belong to this user (caller sends 404).
 */
export async function fetchSessionInsights(sessionId: string, userId: string): Promise<InsightsResponse | null> {
    const enabled = isEnabled();

    // Ownership, via sessions (works for sessions that were linked over from a guest account).
    const { data: session, error: sessErr } = await supabaseAdmin
        .from("sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
    if (sessErr) throw new Error(`session lookup failed: ${sessErr.message}`);
    if (!session) return null;

    if (!enabled) return buildInsights({ enabled, jobStatus: null, summary: null });

    const [{ data: job, error: jobErr }, { data: summary, error: sumErr }] = await Promise.all([
        supabaseAdmin.from("analysis_jobs").select("status").eq("session_id", sessionId).maybeSingle(),
        supabaseAdmin.from("session_analysis_summary")
            .select("session_summary, high_risk_triggered").eq("session_id", sessionId).maybeSingle(),
    ]);
    if (jobErr) throw new Error(`job lookup failed: ${jobErr.message}`);
    if (sumErr) throw new Error(`summary lookup failed: ${sumErr.message}`);

    return buildInsights({ enabled, jobStatus: job?.status ?? null, summary: (summary as SummaryInput | null) ?? null });
}
