/**
 * Shows what the History page would receive for a session (the same function the
 * /api/sessions/:id/insights endpoint uses). Output is banded themes only -- no text, no scores.
 *
 *   npx ts-node scripts/checkInsightsEndpoint.ts <session_id_or_first_8_chars>
 */
import "./_env";
import { supabaseAdmin } from "../db/supabaseClient";
import { fetchSessionInsights } from "../services/insights";

async function main() {
    const prefix = process.argv[2];
    if (!prefix) { console.log("Usage: npx ts-node scripts/checkInsightsEndpoint.ts <session_id or first 8 chars>"); return; }

    const { data: recent } = await supabaseAdmin.from("sessions")
        .select("id, user_id").not("user_id", "is", null).order("start_time", { ascending: false }).limit(50);
    const s = (recent ?? []).find(r => r.id.startsWith(prefix));
    if (!s) { console.log(`No recent signed-in session starts with "${prefix}"`); return; }

    console.log(`INSIGHTS_ENABLED in this environment: ${process.env.INSIGHTS_ENABLED ?? "NOT SET"}`);
    const out = await fetchSessionInsights(s.id, s.user_id);
    console.log("What the History page receives for this session:");
    console.log(JSON.stringify(out, null, 2));
}
main().then(() => process.exit(0)).catch(err => { console.error("FAILED:", err.message); process.exit(1); });
