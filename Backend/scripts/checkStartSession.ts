/**
 * Diagnoses "can't start a session / credits not loading" for a signed-in user by exercising the
 * same things those two calls use. Prints statuses and counts only (no emails, tokens or text).
 *
 *   npx ts-node scripts/checkStartSession.ts <user_id>
 */
import "./_env";
import { supabaseAdmin } from "../db/supabaseClient";
import { getCreditBalance } from "../db/dbService";

async function main() {
    const userId = process.argv[2];
    if (!userId) { console.log("Usage: npx ts-node scripts/checkStartSession.ts <user_id>"); return; }

    // 1) Supabase Auth reachable, and does this user exist?
    const t0 = Date.now();
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    console.log(error
        ? `FAIL  Supabase Auth lookup: ${error.message}`
        : `PASS  Supabase Auth reachable (${Date.now() - t0}ms); user exists: ${!!data?.user}`);

    // 2) What the /credits and /session/start calls read
    try {
        const t1 = Date.now();
        const bal = await getCreditBalance(userId);
        console.log(`PASS  credit balance lookup (${Date.now() - t1}ms): ${bal} minute(s)  ->  ${bal > 0 ? "start-session credit gate passes" : "start-session would return 402 (insufficient credits)"}`);
    } catch (e: any) {
        console.log(`FAIL  credit balance lookup: ${e.message}`);
    }

    // 3) Can a session row be created + removed the way startSession does it? (rolled back immediately)
    const { data: row, error: insErr } = await supabaseAdmin.from("sessions")
        .insert({ user_id: userId, status: "active", language_code: "en-IN" }).select("id").single();
    if (insErr || !row) { console.log(`FAIL  creating a session row: ${insErr?.message}`); return; }
    await supabaseAdmin.from("sessions").delete().eq("id", row.id);
    console.log("PASS  can create a session row (test row deleted again)");
}

main().then(() => process.exit(0)).catch(err => { console.error("FAILED:", err.message); process.exit(1); });
