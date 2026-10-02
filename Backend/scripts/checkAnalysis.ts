/**
 * Diagnoses "I took a session but see no analysis": shows the latest sessions, whether each
 * got an analysis job / result, and which switches are set in THIS environment.
 * Prints IDs, statuses and timestamps only -- never message text or scores.
 *
 *   npx ts-node scripts/checkAnalysis.ts
 */
import "./_env";
import { supabaseAdmin } from "../db/supabaseClient";

async function main() {
    console.log("Switches in this environment (values shown only as set/not set):");
    for (const name of ["ANALYSIS_ENABLED", "INSIGHTS_ENABLED", "STORE_GUEST_CHATS", "HF_ANALYZE_URL", "HF_API_KEY"]) {
        const v = process.env[name];
        console.log(`  ${name.padEnd(18)} ${v ? (name.startsWith("HF_") ? "set" : `= ${v}`) : "NOT SET"}`);
    }

    const { data: sessions, error } = await supabaseAdmin
        .from("sessions")
        .select("id, status, start_time, end_time, user_id, guest_id")
        .order("start_time", { ascending: false })
        .limit(5);
    if (error) throw new Error(error.message);

    const ids = (sessions ?? []).map(s => s.id);
    const [{ data: jobs }, { data: sums }, { data: msgs }] = await Promise.all([
        supabaseAdmin.from("analysis_jobs").select("session_id, status, attempts, last_error, created_at").in("session_id", ids),
        supabaseAdmin.from("session_analysis_summary").select("session_id, message_count, dominant_flags").in("session_id", ids),
        supabaseAdmin.from("chat_messages").select("session_id").in("session_id", ids),
    ]);
    const msgCount = new Map<string, number>();
    for (const m of msgs ?? []) msgCount.set(m.session_id, (msgCount.get(m.session_id) ?? 0) + 1);

    console.log("\nLatest 5 sessions:");
    console.table((sessions ?? []).map(s => {
        const job = (jobs ?? []).find(j => j.session_id === s.id);
        const sum = (sums ?? []).find(j => j.session_id === s.id);
        return {
            session:    s.id.slice(0, 8),
            started:    s.start_time?.slice(0, 16).replace("T", " "),
            status:     s.status,
            kind:       s.user_id ? "signed-in" : "guest",
            saved_msgs: msgCount.get(s.id) ?? 0,
            job:        job ? `${job.status} (tries ${job.attempts})` : "none",
            job_error:  job?.last_error ?? "",
            result:     sum ? `yes (${sum.message_count} msgs)` : "no",
        };
    }));
}

main().then(() => process.exit(0)).catch(err => { console.error("FAILED:", err.message); process.exit(1); });
