/**
 * Local test for the post-session analysis pipeline. Run from the Backend folder.
 *
 *   1) HuggingFace only (no database touched):
 *        npx ts-node scripts/testAnalysis.ts hf
 *
 *   2) Full pipeline on an EXISTING session (reads that session's real messages,
 *      decrypts them, calls HuggingFace, saves results to the new tables):
 *        npx ts-node scripts/testAnalysis.ts session <session_id> <user_id>
 *
 * Required env vars (set in your shell, NOT in the tracked .env file):
 *   HF_ANALYZE_URL, HF_API_KEY
 * Supabase + encryption keys come from Backend/.env as usual.
 */
import "./_env";
import { supabaseAdmin } from "../db/supabaseClient";
import { callAnalysisService } from "../services/analysisClient";
import { processPendingJobs } from "../services/analysisQueue";

async function testHuggingFace() {
    const messages = [
        "It's been okay I guess, kind of a long week at work.",
        "Not really anything specific, just tired all the time lately.",
        "Not great honestly, I keep lying awake overthinking everything.",
    ];
    console.log("Calling HuggingFace with 3 sample messages (first call can take a while if the Space was asleep)...");
    const t0 = Date.now();
    const result = await callAnalysisService(messages);
    console.log(`OK in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(JSON.stringify(result.response, null, 2));
}

async function testSession(sessionId: string, userId: string) {
    // Reset/create the job so this can be re-run on the same session.
    const { error } = await supabaseAdmin.from("analysis_jobs").upsert({
        session_id: sessionId,
        user_id:    userId,
        status:     "pending",
        attempts:   0,
        run_after:  new Date().toISOString(),
        locked_at:  null,
        last_error: null,
    }, { onConflict: "session_id" });
    if (error) throw new Error(`could not create job: ${error.message}`);
    console.log("Job created. Processing...");

    process.env.ANALYSIS_ENABLED = "true";   // this local process only
    await processPendingJobs();

    const { data: job } = await supabaseAdmin
        .from("analysis_jobs").select("status, attempts, last_error").eq("session_id", sessionId).single();
    console.log("\nJob row:", job);

    const { data: summary } = await supabaseAdmin
        .from("session_analysis_summary")
        .select("message_count, high_risk_triggered, high_risk_turns, session_summary, dominant_flags")
        .eq("session_id", sessionId).maybeSingle();
    console.log("\nSummary row:", JSON.stringify(summary, null, 2));
}

async function main() {
    const [mode, sessionId, userId] = process.argv.slice(2);
    if (mode === "hf") return testHuggingFace();
    if (mode === "session" && sessionId && userId) return testSession(sessionId, userId);
    console.log("Usage:\n  ts-node scripts/testAnalysis.ts hf\n  ts-node scripts/testAnalysis.ts session <session_id> <user_id>");
}

main().then(() => process.exit(0)).catch(err => { console.error("FAILED:", err.message); process.exit(1); });
