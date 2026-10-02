/**
 * Read-only helper: lists recent sessions that have chat messages, so you can pick a
 * session_id / user_id pair for scripts/testAnalysis.ts. Prints IDs, counts and
 * timestamps only -- never message text.
 *
 *   npx ts-node scripts/listSessions.ts
 */
import "./_env";
import { supabaseAdmin } from "../db/supabaseClient";

async function main() {
    // Deliberately selects NO message columns.
    const { data, error } = await supabaseAdmin
        .from("chat_messages")
        .select("session_id, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
    if (error) throw new Error(error.message);

    const bySession = new Map<string, { user_id: string; count: number; last: string }>();
    for (const row of data ?? []) {
        const s = bySession.get(row.session_id);
        if (s) s.count++;
        else bySession.set(row.session_id, { user_id: row.user_id, count: 1, last: row.created_at });
    }

    const rows = [...bySession.entries()]
        .map(([session_id, v]) => ({ session_id, user_id: v.user_id, messages: v.count, last_message: v.last }))
        .slice(0, 8);
    console.table(rows);
    console.log("(counts are within the 500 most recent messages, so the oldest listed session may be undercounted)");
}

main().then(() => process.exit(0)).catch(err => { console.error("FAILED:", err.message); process.exit(1); });
