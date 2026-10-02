import "dotenv/config";
import { supabaseAdmin } from "../db/supabaseClient";
import { encrypt, encryptJson, isEncrypted } from "../utils/encryption";

const PAGE_SIZE = 500;

interface ChatRow {
    id: string;
    user_id: string;
    user_msg: unknown;
    ai_reply: unknown;
}

interface SummaryRow {
    id?: string;
    session_id: string;
    user_id: string;
    summary: unknown;
    memories: unknown;
}

function parseArgs() {
    const args = process.argv.slice(2);
    return {
        dryRun: args.includes("--dry-run"),
    };
}

function toPlainString(value: unknown): string {
    if (value == null) return "";
    return typeof value === "string" ? value : JSON.stringify(value);
}

async function backfillChatMessages(dryRun: boolean) {
    let from = 0;
    let scanned = 0;
    let updated = 0;

    while (true) {
        const { data, error } = await supabaseAdmin
            .from("chat_messages")
            .select("id, user_id, user_msg, ai_reply")
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw new Error(`Failed to read chat_messages: ${error.message}`);
        const rows = (data ?? []) as ChatRow[];
        if (rows.length === 0) break;

        for (const row of rows) {
            scanned += 1;
            const needsUserMsg = !isEncrypted(row.user_msg);
            const needsAiReply = !isEncrypted(row.ai_reply);
            if (!needsUserMsg && !needsAiReply) continue;

            updated += 1;
            if (dryRun) continue;

            const { error: updateError } = await supabaseAdmin
                .from("chat_messages")
                .update({
                    user_msg: needsUserMsg ? encrypt(toPlainString(row.user_msg), row.user_id) : row.user_msg,
                    ai_reply: needsAiReply ? encrypt(toPlainString(row.ai_reply), row.user_id) : row.ai_reply,
                })
                .eq("id", row.id);

            if (updateError) {
                throw new Error(`Failed to update chat_messages id=${row.id}: ${updateError.message}`);
            }
        }

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return { scanned, updated };
}

async function backfillSessionSummaries(dryRun: boolean) {
    let from = 0;
    let scanned = 0;
    let updated = 0;

    while (true) {
        let data: any[] | null = null;
        let error: any = null;

        const primary = await supabaseAdmin
            .from("session_summaries")
            .select("id, session_id, user_id, summary, memories")
            .range(from, from + PAGE_SIZE - 1);
        data = primary.data;
        error = primary.error;

        if (error?.code === "42703") {
            const fallback = await supabaseAdmin
                .from("session_summaries")
                .select("session_id, user_id, summary, memories")
                .range(from, from + PAGE_SIZE - 1);
            data = fallback.data;
            error = fallback.error;
        }

        if (error) throw new Error(`Failed to read session_summaries: ${error.message}`);
        const rows = (data ?? []) as SummaryRow[];
        if (rows.length === 0) break;

        for (const row of rows) {
            scanned += 1;
            const needsSummary = !isEncrypted(row.summary);
            const needsMemories = !isEncrypted(row.memories);
            if (!needsSummary && !needsMemories) continue;

            updated += 1;
            if (dryRun) continue;

            const query = supabaseAdmin
                .from("session_summaries")
                .update({
                    summary: needsSummary ? encrypt(toPlainString(row.summary), row.user_id) : row.summary,
                    memories: needsMemories ? encryptJson(row.memories ?? {}, row.user_id) : row.memories,
                });

            const scopedQuery = row.id
                ? query.eq("id", row.id)
                : query.eq("session_id", row.session_id).eq("user_id", row.user_id);

            const { error: updateError } = await scopedQuery;

            if (updateError) {
                throw new Error(`Failed to update session_summaries session_id=${row.session_id}: ${updateError.message}`);
            }
        }

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return { scanned, updated };
}

async function main() {
    const { dryRun } = parseArgs();
    console.log(`Sensitive data encryption backfill${dryRun ? " (dry run)" : ""}`);

    const chat = await backfillChatMessages(dryRun);
    console.log(`chat_messages scanned=${chat.scanned} ${dryRun ? "would_update" : "updated"}=${chat.updated}`);

    const summaries = await backfillSessionSummaries(dryRun);
    console.log(`session_summaries scanned=${summaries.scanned} ${dryRun ? "would_update" : "updated"}=${summaries.updated}`);

    if (dryRun) {
        console.log("Dry run complete. No rows were changed.");
    } else {
        console.log("Backfill complete. Existing plaintext sensitive fields are now encrypted.");
    }
}

main().catch((error: any) => {
    console.error("Encryption backfill failed:");
    console.error(error.message || error);
    process.exit(1);
});
