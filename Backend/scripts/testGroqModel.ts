/**
 * Checks which Groq models your key can use and times a candidate model (first-token latency
 * matters for voice). Sends only a harmless one-line prompt. Never prints the API key.
 *
 *   npx ts-node scripts/testGroqModel.ts                    (tests openai/gpt-oss-20b)
 *   npx ts-node scripts/testGroqModel.ts some/other-model
 */
import "./_env";
import Groq from "groq-sdk";

async function timeStream(client: Groq, model: string, extra: Record<string, unknown>, label: string) {
    const t0 = Date.now();
    let first = -1;
    let text = "";
    try {
        const stream: any = await client.chat.completions.create({
            model,
            stream: true,
            messages: [
                { role: "system", content: "You are a warm, brief supportive companion." },
                { role: "user",   content: "I had a rough day. Reply in one short, kind sentence." },
            ],
            ...extra,
        } as any);
        for await (const chunk of stream) {
            const tok = chunk.choices?.[0]?.delta?.content || "";
            if (tok) { if (first < 0) first = Date.now() - t0; text += tok; }
        }
        console.log(`PASS  ${label}: first token ${first}ms, total ${Date.now() - t0}ms`);
        console.log(`      reply: ${text.trim().slice(0, 160)}`);
        return true;
    } catch (err: any) {
        console.log(`FAIL  ${label}: ${err?.status ?? ""} ${(err?.error?.error?.message ?? err?.message ?? "").slice(0, 200)}`);
        return false;
    }
}

async function main() {
    if (!process.env.GROQ_API_KEY) { console.log("GROQ_API_KEY not set"); return; }
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const candidate = process.argv[2] || "openai/gpt-oss-20b";

    const list = await client.models.list();
    const ids = list.data.map(m => m.id).sort();
    console.log(`Models your key can use (${ids.length}):\n  ` + ids.join("\n  "));
    console.log(`\nCurrent GROQ_MODEL setting: ${process.env.GROQ_MODEL ?? "(unset -> code default)"}`);
    console.log(`Old model in your key's list? ${ids.includes("llama-3.1-8b-instant")}`);
    console.log(`Candidate ${candidate} in list? ${ids.includes(candidate)}\n`);

    await timeStream(client, candidate, {}, `${candidate} (default reasoning)`);
    await timeStream(client, candidate, { reasoning_effort: "low" }, `${candidate} (reasoning_effort=low)`);
}

main().then(() => process.exit(0)).catch(err => { console.error("FAILED:", err?.message); process.exit(1); });
