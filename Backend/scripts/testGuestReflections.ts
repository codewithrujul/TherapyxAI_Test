/**
 * Verifies the guest "sign in to get reflections" flow end to end (no HuggingFace involved):
 *   - hold in memory -> offer available -> expires after the window
 *   - decline discards; signing in without consent discards
 *   - claim WITH consent: copied into chat_messages encrypted under the USER key, in order,
 *     consent row recorded, analysis job created for the user, claiming twice does not duplicate
 * Uses synthetic guest sessions and a real test user id; everything is deleted afterwards.
 *
 *   npx ts-node scripts/testGuestReflections.ts   (run db/reflection_consents_migration.sql first)
 */
import "./_env";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "../db/supabaseClient";
import { createGuestSessionInDB, linkGuestSessionsToUser } from "../db/dbService";
import { decrypt } from "../utils/encryption";
import {
    holdGuestTranscript, getGuestOffer, declineGuestReflections, claimGuestReflections,
    getGuestSessionIds, discardHeld,
} from "../services/guestReflections";

const TEST_USER_ID = "39186bf7-b7ba-4f4a-ae71-186aeccd1570";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`);
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const turns = [
    { role: "user", content: "I have been feeling really low lately." },
    { role: "assistant", content: "I'm sorry to hear that. Tell me more." },
    { role: "user", content: "Some days I cannot get out of bed." },
    { role: "assistant", content: "That sounds heavy." },
];

async function newGuest() {
    const raw = randomUUID();
    const sessionId = await createGuestSessionInDB(raw,"TEST GUEST (auto-deleted)");
    return { raw, guestUserId: `guest_${raw}`, sessionId };
}

async function main() {
    process.env.GUEST_REFLECTIONS_ENABLED = "true";
    delete process.env.STORE_GUEST_CHATS;
    process.env.GUEST_REFLECTION_WINDOW_MIN = "20";

    const probe = await supabaseAdmin.from("reflection_consents").select("id").limit(1);
    if (probe.error) {
        console.log(`reflection_consents not available (${probe.error.message}).\nRun Backend/db/reflection_consents_migration.sql in the Supabase SQL Editor first.`);
        process.exit(1);
    }
    check("reflection_consents table exists (migration applied)", true);

    const sessionIds: string[] = [];
    const guestIds: string[] = [];
    try {
        // 1) hold + offer
        const a = await newGuest(); sessionIds.push(a.sessionId); guestIds.push(a.raw);
        check("no offer before anything is held", !(await getGuestOffer(a.raw)).available);
        holdGuestTranscript(a.guestUserId, a.sessionId, turns);
        const offer = await getGuestOffer(a.raw);
        check("offer available after a guest session ends", offer.available && (offer.expiresInMin ?? 0) > 0, JSON.stringify(offer));
        check("guest session is found by raw guest id", (await getGuestSessionIds(a.raw)).includes(a.sessionId));

        // 2) claim WITH consent
        const ids = await getGuestSessionIds(a.raw);
        await linkGuestSessionsToUser(a.raw, TEST_USER_ID);
        const out = await claimGuestReflections({ rawGuestId: a.raw, userId: TEST_USER_ID, sessionIds: ids, consentVersion: "test-v1" });
        check("claim reports 1 session", out.claimed === 1, JSON.stringify(out));

        const { data: rows } = await supabaseAdmin.from("chat_messages")
            .select("user_msg, ai_reply, user_id").eq("session_id", a.sessionId).order("created_at", { ascending: true });
        check("2 messages copied into chat_messages", rows?.length === 2, `rows=${rows?.length}`);
        check("stored encrypted (not plaintext)", !!rows && rows.every(r => r.user_msg.startsWith("enc:") && !r.user_msg.includes("feeling")));
        check("decrypts with the USER key, in original order",
            !!rows && rows.map(r => decrypt(r.user_msg, TEST_USER_ID)).join("|") === [turns[0].content, turns[2].content].join("|"));
        check("assistant replies preserved", !!rows && decrypt(rows[0].ai_reply, TEST_USER_ID) === turns[1].content);

        const { data: consent } = await supabaseAdmin.from("reflection_consents").select("consent_version, session_ids").eq("guest_id", a.raw);
        check("consent recorded with version and session", consent?.length === 1 && consent[0].consent_version === "test-v1" && consent[0].session_ids.includes(a.sessionId));

        let job: { status: string; user_id: string } | null = null;
        for (let i = 0; i < 15 && !job; i++) {
            const { data } = await supabaseAdmin.from("analysis_jobs").select("status, user_id").eq("session_id", a.sessionId).maybeSingle();
            job = data; if (!job) await sleep(300);
        }
        check("analysis job queued for the real user", job?.user_id === TEST_USER_ID, JSON.stringify(job));

        check("no offer left after claiming", !(await getGuestOffer(a.raw)).available);
        const again = await claimGuestReflections({ rawGuestId: a.raw, userId: TEST_USER_ID, sessionIds: ids, consentVersion: "test-v1" });
        const { count } = await supabaseAdmin.from("chat_messages").select("id", { count: "exact", head: true }).eq("session_id", a.sessionId);
        check("claiming twice does not duplicate messages", again.claimed === 0 && count === 2, `claimed=${again.claimed} count=${count}`);

        // 3) decline
        const b = await newGuest(); sessionIds.push(b.sessionId); guestIds.push(b.raw);
        holdGuestTranscript(b.guestUserId, b.sessionId, turns);
        await declineGuestReflections(b.raw);
        check("decline removes the offer", !(await getGuestOffer(b.raw)).available);
        const declinedClaim = await claimGuestReflections({ rawGuestId: b.raw, userId: TEST_USER_ID, sessionIds: [b.sessionId], consentVersion: "test-v1" });
        check("nothing can be claimed after decline", declinedClaim.claimed === 0);

        // 4) signed in without consent -> discarded
        const c = await newGuest(); sessionIds.push(c.sessionId); guestIds.push(c.raw);
        holdGuestTranscript(c.guestUserId, c.sessionId, turns);
        discardHeld(c.raw);
        check("no-consent sign-in discards the held transcript", !(await getGuestOffer(c.raw)).available);

        // 5) expiry
        const d = await newGuest(); sessionIds.push(d.sessionId); guestIds.push(d.raw);
        process.env.GUEST_REFLECTION_WINDOW_MIN = "0.002";   // ~120 ms
        holdGuestTranscript(d.guestUserId, d.sessionId, turns);
        await sleep(300);
        check("held transcript expires after the window", !(await getGuestOffer(d.raw)).available);
        process.env.GUEST_REFLECTION_WINDOW_MIN = "20";

        // 6) disabled flag -> nothing held
        process.env.GUEST_REFLECTIONS_ENABLED = "false";
        const e = await newGuest(); sessionIds.push(e.sessionId); guestIds.push(e.raw);
        holdGuestTranscript(e.guestUserId, e.sessionId, turns);
        process.env.GUEST_REFLECTIONS_ENABLED = "true";
        check("nothing held while the flag is off", !(await getGuestOffer(e.raw)).available);
    } finally {
        if (sessionIds.length) {
            await supabaseAdmin.from("analysis_jobs").delete().in("session_id", sessionIds);
            await supabaseAdmin.from("session_analysis_summary").delete().in("session_id", sessionIds);
            await supabaseAdmin.from("session_analysis_audit_log").delete().in("session_id", sessionIds);
            await supabaseAdmin.from("chat_messages").delete().in("session_id", sessionIds);
            await supabaseAdmin.from("sessions").delete().in("id", sessionIds);
        }
        if (guestIds.length) await supabaseAdmin.from("reflection_consents").delete().in("guest_id", guestIds);
        const { count } = await supabaseAdmin.from("sessions").select("id", { count: "exact", head: true }).in("id", sessionIds);
        check("cleanup: synthetic sessions removed", count === 0, `left=${count}`);
    }

    console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
}

main().then(() => process.exit(failures === 0 ? 0 : 1)).catch(err => { console.error("ERROR:", err.message); process.exit(1); });
