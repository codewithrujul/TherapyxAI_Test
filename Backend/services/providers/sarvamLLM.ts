import { SarvamAIClient, SarvamAI } from "sarvamai";
import { LLMProvider } from "../llm";

export type ChatMessage = SarvamAI.ChatCompletionRequestMessage;
export type SarvamModel  = SarvamAI.SarvamModelIds;


export class SarvamLLMProvider implements LLMProvider {
    private client: SarvamAIClient;
    private model:  SarvamModel;

    constructor() {
        this.client = new SarvamAIClient({
            apiSubscriptionKey: process.env.SARVAM_API_KEY!,
        });

        // sarvam-105b is the currently supported Sarvam model for Indian languages.
        // Older id `sarvam-30b` was deprecated; prefer `sarvam-105b`.
        this.model = (process.env.SARVAM_MODEL ?? "sarvam-105b") as SarvamModel;
    }

    // ── stream — yields tokens one by one as they arrive ─────────────────────
        
    async *stream(messages: ChatMessage[]): AsyncGenerator<string> {
        const response = await this.client.chat.completions({
            model:       this.model,
            stream:      true,
            temperature: 0.5,   // slightly higher — more natural conversational tone
            messages,
        });

        // ── Filter <think>...</think> blocks ─────────────────────────────────
        // Key: when inside a think block, accumulate into thinkBuf WITHOUT
        // clearing it — so </think> can always be detected even if the tag
        // is split across multiple streaming chunks.
        let insideThink = false;
        let thinkBuf    = "";   // accumulates content inside <think>...</think>
        let outBuf      = "";   // accumulates content outside think blocks

        for await (const chunk of response) {
            const token = chunk.choices[0]?.delta?.content ?? "";
            if (!token) continue;

            if (insideThink) {
                thinkBuf += token;
                if (thinkBuf.includes("</think>")) {
                    insideThink = false;
                    const after = thinkBuf.split("</think>").pop()?.trimStart() ?? "";
                    thinkBuf = "";
                    if (after) { outBuf += after; yield after; }
                }
                continue;
            }

            outBuf += token;

            if (outBuf.includes("<think>")) {
                insideThink = true;
                const before = outBuf.split("<think>")[0];
                thinkBuf     = outBuf.split("<think>").slice(1).join("<think>");
                outBuf       = "";
                if (before.trim()) yield before;
                // Handle case where </think> is in the same chunk
                if (thinkBuf.includes("</think>")) {
                    insideThink = false;
                    const after = thinkBuf.split("</think>").pop()?.trimStart() ?? "";
                    thinkBuf = "";
                    if (after) { outBuf += after; yield after; }
                }
                continue;
            }

            yield outBuf;
            outBuf = "";
        }

        if (outBuf.trim() && !insideThink) yield outBuf;
    }

    // ── complete — used for summaries, memory extraction etc ──────────────────

    async complete(messages: ChatMessage[]): Promise<string> {
        const response = await this.client.chat.completions({
            model:       this.model,
            stream:      false,
            temperature: 0.3,   // lower for structured outputs like JSON
            messages,
        });

        const raw = response.choices[0]?.message?.content ?? "";
        return raw.replace(/<think>[\s\S]*?<\/think>/g, "").trimStart();
    }
}