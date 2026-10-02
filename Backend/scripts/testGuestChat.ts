/**
 * Verifies guest chat storage end to end (no HuggingFace involved):
 *   - off by default: nothing is stored when STORE_GUEST_CHATS is not "true"
 *   - on: messages land in guest_chat_messages (NOT chat_messages), encrypted, and decrypt back
 *   - the analysis worker's loader reads them back in order
 *   - the public (anon) key cannot read them
 *   - deleting the session removes its guest messages (cascade)
 * Creates ONE synthetic guest session and deletes it afterwards.
 *
 *   npx ts-node scripts/testGuestChat.ts     (run db/guest_chat_messages_migration.sql first)
 */
import "./_env";
import { randomUUID } from "crypto";
import { supabase, supabaseAdmin } from "../db/supabaseClient";
import { createGuestSessionInDB, saveChatMessage } from "../db/dbService";
import { decrypt } from "../utils/encryption";
import { loadUserMessages } from "../services/analysisQueue";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`);
}

async function main() {
    // Bail out early (creating nothing) if the migration hasn't been run.
    // (Not a HEAD request: those don't report a missing table as an error.)
    const probe = await supabaseAdmin.from("guest_chat_messages").select("id").limit(1);
    if (probe.error) {
        console.log(`guest_chat_messages not available (${probe.error.message}).\nRun Backend/db/guest_chat_messages_migration.sql in the Supabase SQL Editor first.`);
        process.exit(1);
    }
    check("guest_chat_messages table exists (migration applied)", true);

    const guestUserId = `guest_test_${randomUUID()}`;
    const sessionId = await createGuestSessionInDB(guestUserId, "TEST GUEST (auto-deleted)");
    const msgs = ["I have been feeling really low lately.", "Some days I cannot get out of bed."];

    try {
        // 1) default OFF: nothing stored
        delete process.env.STORE_GUEST_CHATS;
        await saveChatMessage(sessionId, guestUserId, "should not be stored", "reply", "chat");
        const { count: offCount } = await supabaseAdmin.from("guest_chat_messages")
            .select("id", { count: "exact", head: true }).eq("session_id", sessionId);
        check("nothing stored while STORE_GUEST_CHATS is unset", offCount === 0, `count=${offCount}`);

        // 2) ON: stored, encrypted, separate table
        process.env.STORE_GUEST_CHATS = "true";
        for (const m of msgs) {
            await saveChatMessage(sessionId, guestUserId, m, "assistant reply", "chat");
        }
        const { data: rows, error } = await supabaseAdmin.from("guest_chat_messages")
            .select("guest_id, user_msg, ai_reply, mode").eq("session_id", sessionId).order("created_at", { ascending: true });
        check("2 guest messages stored", !error && rows?.length === 2, error?.message ?? `rows=${rows?.length}`);
        check("stored text is encrypted (not plaintext)", !!rows && rows.every(r => r.user_msg.startsWith("enc:") && !r.user_msg.includes("feeling")));
        check("decrypts back to the original", !!rows && rows.map(r => decrypt(r.user_msg, guestUserId)).join("|") === msgs.join("|"));
        check("guest_id stored with the guest_ prefix", !!rows && rows.every(r => r.guest_id === guestUserId));

        const { count: regCount } = await supabaseAdmin.from("chat_messages")
            .select("id", { count: "exact", head: true }).eq("session_id", sessionId);
        check("nothing leaked into registered chat_messages", regCount === 0, `count=${regCount}`);

        // 3) the analysis worker's loader reads them back, in order
        const loaded = await loadUserMessages(sessionId, guestUserId);
        check("analysis loader returns the guest messages in order", loaded.join("|") === msgs.join("|"), JSON.stringify(loaded.length));

        // 4) public key locked out
        const anon = await supabase.from("guest_chat_messages").select("id").eq("session_id", sessionId);
        check("anon key cannot read guest_chat_messages", !anon.error ? (anon.data ?? []).length === 0 : true,
              `returned ${(anon.data ?? []).length} row(s)`);
    } finally {
        // 5) cleanup + cascade check
        await supabaseAdmin.from("sessions").delete().eq("id", sessionId);
        const { count: left } = await supabaseAdmin.from("guest_chat_messages")
            .select("id", { count: "exact", head: true }).eq("session_id", sessionId);
        check("deleting the session cascades to its guest messages", left === 0, `left=${left}`);
    }

    console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
}

main().then(() => process.exit(failures === 0 ? 0 : 1)).catch(err => { console.error("ERROR:", err.message); process.exit(1); });
