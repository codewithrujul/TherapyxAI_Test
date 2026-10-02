// HTTP client for the disorder-detection service hosted on HuggingFace Spaces.
// Env vars are read at call time (not import time) so dotenv ordering never matters.

export interface AnalysisResponse {
    message_count:       number;
    high_risk_triggered: boolean;
    high_risk_turns:     Array<{ turn: number; text?: string; suicidal_prob: number }>;
    session_summary:     Record<string, number>;
    dominant_flags:      string[];
}

export interface AnalysisAuditLog {
    per_turn_detail: Array<{
        turn_index:    number;
        text?:         string;
        probabilities: Record<string, number>;
        primary:       string;
        is_high_risk:  boolean;
    }>;
}

export interface AnalysisResult {
    response:  AnalysisResponse;
    audit_log: AnalysisAuditLog;
}

// HF Spaces can be asleep or slow right after idling, so allow a long timeout.
// The job queue retries on failure, so this never needs to be perfect.
const REQUEST_TIMEOUT_MS = 120_000;

export async function callAnalysisService(userMessages: string[]): Promise<AnalysisResult> {
    const url = process.env.HF_ANALYZE_URL;
    const key = process.env.HF_API_KEY;
    if (!url || !key) {
        throw new Error("HF_ANALYZE_URL / HF_API_KEY are not set");
    }

    const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body:    JSON.stringify({ user_messages: userMessages }),
        signal:  AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    // Status only -- never include the response body or request payload in errors,
    // since those can contain user message text.
    if (!res.ok) {
        throw new Error(`analysis service returned HTTP ${res.status}`);
    }
    return (await res.json()) as AnalysisResult;
}
