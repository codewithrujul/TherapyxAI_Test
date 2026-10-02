/**
 * Shows whether chats are actually producing replies over time, by language -- evidence of
 * whether the LLM provider is working in whatever environment wrote to this database.
 * Metadata only: dates, language codes and counts. No message text.
 *
 *   npx ts-node scripts/checkChatHealth.ts
 */
import "./_env";
import { supabaseAdmin } from "../db/supabaseClient";

async function main() {
    const since = "2026-08-01T00:00:00Z";
    const { data: sessions, error } = await supabaseAdmin
        .from("sessions").select("id, start_time, language_code, user_id, guest_id")
        .gte("start_time", since).order("start_time", { ascending: true }).limit(1000);
    if (error) throw new Error(error.message);

    const ids = (sessions ?? []).map(s => s.id);
    const counts = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
        const { data: msgs } = await supabaseAdmin.from("chat_messages").select("session_id").in("session_id", ids.slice(i, i + 200));
        for (const m of msgs ?? []) counts.set(m.session_id, (counts.get(m.session_id) ?? 0) + 1);
    }

    // Signed-in sessions only (guest chats aren't stored, so they can't show replies).
    console.log("Signed-in sessions since Aug 1 (guest chats are not stored, so they can't be counted):\n");
    const rows = (sessions ?? []).filter(s => s.user_id).map(s => ({
        date: s.start_time.slice(0, 16).replace("T", " "),
        lang: s.language_code,
        saved_exchanges: counts.get(s.id) ?? 0,
        replied: (counts.get(s.id) ?? 0) > 0 ? "yes" : "NO",
    }));
    console.table(rows);

    const cutoff = "2026-08-16";
    const after = rows.filter(r => r.date >= cutoff);
    const en = after.filter(r => r.lang === "en-IN");
    console.log(`\nAfter ${cutoff}: ${after.length} signed-in sessions; English (en-IN): ${en.length}, of which with replies: ${en.filter(r => r.replied === "yes").length}`);
    console.log(`After ${cutoff} non-English: ${after.filter(r => r.lang !== "en-IN").length}, with replies: ${after.filter(r => r.lang !== "en-IN" && r.replied === "yes").length}`);
}
main().then(() => process.exit(0)).catch(err => { console.error("FAILED:", err.message); process.exit(1); });
