/**
 * Verifies the analysis queue plumbing WITHOUT touching real data or HuggingFace:
 *   - the migration ran (tables + claim function exist)
 *   - job insert, duplicate protection, atomic claim, status transitions
 *   - result tables accept the exact row shapes the worker writes
 *   - the public (anon) key CANNOT read or claim anything
 * Uses a randomly generated session id and deletes everything it created.
 *
 *   npx ts-node scripts/testQueueMechanics.ts
 */
import "./_env";
import { randomUUID } from "crypto";
import { supabase, supabaseAdmin } from "../db/supabaseClient";
import { processPendingJobs } from "../services/analysisQueue";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`);
}

async function main() {
    process.env.ANALYSIS_ENABLED = "true";   // this process only
    const sid = randomUUID();
    const uid = randomUUID();

    // Safety: processPendingJobs claims ANY due job. Don't run if real work is queued.
    // (Plain select, not HEAD: HEAD requests don't report a missing table as an error.)
    const { data: openRows, error: openErr } = await supabaseAdmin
        .from("analysis_jobs").select("id")
        .in("status", ["pending", "processing"]);
    const openCount = openRows?.length ?? 0;
    if (openErr) {
        check("analysis_jobs table exists (migration applied)", false, openErr.message);
        return;
    }
    if ((openCount ?? 0) > 0) {
        console.log(`ABORT: ${openCount} real open job(s) in the queue; not running claim tests against a live queue.`);
        return;
    }
    check("analysis_jobs table exists (migration applied)", true);

    try {
        // 1) insert + duplicate protection
        const row = { session_id: sid, user_id: uid, status: "pending", run_after: new Date().toISOString() };
        const ins = await supabaseAdmin.from("analysis_jobs").upsert(row, { onConflict: "session_id", ignoreDuplicates: true });
        check("insert job", !ins.error, ins.error?.message);
        await supabaseAdmin.from("analysis_jobs").upsert(row, { onConflict: "session_id", ignoreDuplicates: true });
        const { count: dupCount } = await supabaseAdmin.from("analysis_jobs")
            .select("id", { count: "exact", head: true }).eq("session_id", sid);
        check("duplicate enqueue is ignored (one job per session)", dupCount === 1, `count=${dupCount}`);

        // 2) result tables accept the shapes saveResult() writes
        const sum = await supabaseAdmin.from("session_analysis_summary").upsert({
            session_id: sid, user_id: uid, message_count: 3, high_risk_triggered: false,
            high_risk_turns: [], session_summary: { Normal: 0.5, Depression: 0.3, Anxiety: 0.1, PTSD: 0.05, Suicidal: 0.05 },
            dominant_flags: ["Normal"],
        }, { onConflict: "session_id" });
        check("session_analysis_summary accepts worker row shape", !sum.error, sum.error?.message);
        const aud = await supabaseAdmin.from("session_analysis_audit_log").upsert({
            session_id: sid, user_id: uid,
            per_turn_detail: [{ turn_index: 0, probabilities: { Normal: 0.9 }, primary: "Normal", is_high_risk: false }],
        }, { onConflict: "session_id" });
        check("session_analysis_audit_log accepts worker row shape", !aud.error, aud.error?.message);

        // 3) the public/anon key must be locked out (RLS on, no policies)
        const anonRead = await supabase.from("analysis_jobs").select("session_id").eq("session_id", sid);
        check("anon key cannot read analysis_jobs", !anonRead.error ? (anonRead.data ?? []).length === 0 : true,
              `returned ${(anonRead.data ?? []).length} row(s)`);
        const anonSum = await supabase.from("session_analysis_summary").select("session_id").eq("session_id", sid);
        check("anon key cannot read session_analysis_summary", !anonSum.error ? (anonSum.data ?? []).length === 0 : true,
              `returned ${(anonSum.data ?? []).length} row(s)`);
        const anonClaim = await supabase.rpc("claim_analysis_jobs", { batch_size: 1 });
        check("anon key cannot call claim_analysis_jobs", !!anonClaim.error, "call unexpectedly succeeded");

        // 4) real worker path: claim -> (no messages for a random session) -> 'skipped'
        await processPendingJobs();
        const { data: job } = await supabaseAdmin.from("analysis_jobs")
            .select("status, attempts, locked_at, last_error").eq("session_id", sid).single();
        check("worker claimed the job (attempts=1)", job?.attempts === 1, JSON.stringify(job));
        check("job with no messages ends as 'skipped'", job?.status === "skipped", JSON.stringify(job));
        check("lock released after processing", job?.locked_at === null, JSON.stringify(job));
    } finally {
        // Clean up everything created here.
        await supabaseAdmin.from("analysis_jobs").delete().eq("session_id", sid);
        await supabaseAdmin.from("session_analysis_summary").delete().eq("session_id", sid);
        await supabaseAdmin.from("session_analysis_audit_log").delete().eq("session_id", sid);
        console.log("(test rows cleaned up)");
    }

    console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
}

main().then(() => process.exit(failures === 0 ? 0 : 1)).catch(err => { console.error("ERROR:", err.message); process.exit(1); });
