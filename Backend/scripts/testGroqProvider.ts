/**
 * Runs the app's real GroqLLMProvider (streaming = live chat, complete = session memory summaries).
 *   npx ts-node scripts/testGroqProvider.ts
 */
import "./_env";
import { GroqLLMProvider } from "../services/providers/groqLLM";

async function main() {
    console.log(`GROQ_MODEL = ${process.env.GROQ_MODEL ?? "(unset -> code default)"}`);
    const p = new GroqLLMProvider();
    const messages: any = [
        { role: "system", content: "You are a warm, brief supportive companion." },
        { role: "user",   content: "I had a rough day. Reply in one short, kind sentence." },
    ];

    const t0 = Date.now();
    let first = -1, streamed = "";
    for await (const tok of p.stream(messages)) {
        if (first < 0) first = Date.now() - t0;
        streamed += tok;
    }
    console.log(`PASS  stream():   first token ${first}ms, ${streamed.length} chars -> "${streamed.trim().slice(0, 120)}"`);

    const full = await p.complete(messages);
    console.log(`PASS  complete(): ${full.length} chars -> "${full.trim().slice(0, 120)}"`);
    if (!streamed.trim() || !full.trim()) { console.log("FAIL  empty reply"); process.exit(1); }
}
main().then(() => process.exit(0)).catch(err => { console.error("FAIL:", err?.status ?? "", err?.error?.error?.message ?? err?.message); process.exit(1); });
