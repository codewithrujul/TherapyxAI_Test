import { LLMProvider } from "../llm";
import Groq from "groq-sdk";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";

// llama-3.1-8b-instant was shut down by Groq on 2026-08-16 (recommended replacement:
// openai/gpt-oss-20b). See https://console.groq.com/docs/deprecations -- re-check that page
// now and then, and set GROQ_MODEL to change models without a code change.
const DEFAULT_MODEL = "openai/gpt-oss-20b";

// gpt-oss models are reasoning models. Low effort keeps first-token latency short for chat/voice.
// Only sent to gpt-oss models: other Groq models would reject the parameter.
const modelOptions = (model: string): Record<string, unknown> =>
    model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};

export class GroqLLMProvider implements LLMProvider {
    private client: Groq;

    constructor() {
        this.client = new Groq({
            apiKey: process.env.GROQ_API_KEY!,
        });
    }

    async *stream(messages: ChatCompletionMessageParam[]): AsyncGenerator<string> {
        const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
        const response = await this.client.chat.completions.create({
            model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
            stream: true,
            messages,
            ...modelOptions(model),
        } as any) as unknown as AsyncIterable<any>;

        for await (const chunk of response) {
            const token = chunk.choices[0]?.delta?.content || "";
            if (token) yield token;
        }
    }

    async complete(messages: ChatCompletionMessageParam[]): Promise<string> {
        const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
        const response: any = await this.client.chat.completions.create({
            model,
            stream: false,
            messages,
            ...modelOptions(model),
        } as any);

        return response.choices[0]?.message?.content || "";
    }
}
