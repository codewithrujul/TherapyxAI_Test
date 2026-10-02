/**
 * Local debugging helper: shows a session's decrypted USER messages next to the
 * analysis scores each one received, so you can see WHY a result came out the way it did.
 *
 *   npx ts-node scripts/showSession.ts <session_id> <user_id>
 *
 * Prints decrypted message text to YOUR terminal only. Only use it on your own test
 * accounts -- these are private conversations.
 * (Scores appear only if the session was already analyzed, e.g. via
 *  scripts/testAnalysis.ts session <session_id> <user_id>.)
 */
import "./_env";
import { supabaseAdmin } from "../db/supabaseClient";
import { decrypt } from "../utils/encryption";

async function main() {
    const [sessionId, userId] = process.argv.slice(2);
    if (!sessionId || !userId) {
        console.log("Usage: npx ts-node scripts/showSession.ts <session_id> <user_id>");
        return;
    }

    const { data: rows, error } = await supabaseAdmin
        .from("chat_messages")
        .select("user_msg")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    // Same filter as the worker (services/analysisQueue.ts) so turn numbers line up.
    const messages = (rows ?? [])
        .map(r => decrypt(r.user_msg, userId))
        .filter(m => typeof m === "string" && m.trim().length > 0);

    const [{ data: audit }, { data: summary }] = await Promise.all([
        supabaseAdmin.from("session_analysis_audit_log").select("per_turn_detail").eq("session_id", sessionId).maybeSingle(),
        supabaseAdmin.from("session_analysis_summary")
            .select("session_summary, dominant_flags, high_risk_triggered, high_risk_turns")
            .eq("session_id", sessionId).maybeSingle(),
    ]);
    const detail: any[] = audit?.per_turn_detail ?? [];

    console.log(`\nSession ${sessionId}  (${messages.length} user messages)\n`);
    messages.forEach((text, i) => {
        const d = detail.find(t => t.turn_index === i);
        const flag = d?.is_high_risk ? "  <-- HIGH RISK" : "";
        console.log(`[${i}] ${text.length > 220 ? text.slice(0, 220) + "…" : text}${flag}`);
        if (d) {
            const p = d.probabilities as Record<string, number>;
            const scores = Object.entries(p).sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join("  ");
            console.log(`     -> ${d.primary}   ${scores}\n`);
        } else {
            console.log("     -> (not analyzed yet)\n");
        }
    });

    if (summary) {
        console.log("Session summary:", JSON.stringify(summary, null, 2));
    } else {
        console.log("No analysis saved for this session yet.");
    }
}

main().then(() => process.exit(0)).catch(err => { console.error("FAILED:", err.message); process.exit(1); });
