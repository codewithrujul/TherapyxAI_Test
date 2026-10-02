import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { LLMProvider, Message } from "../llm";

export class GeminiLLMProvider implements LLMProvider {
    private genAI: GoogleGenerativeAI;
    private modelName: string;

    constructor() {
        this.genAI      = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        this.modelName  = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite-preview-06-17";
    }

    // Converts OpenAI-style messages to Gemini format.
    // Gemini has no "system" role — it's passed separately as systemInstruction.
    // "assistant" role becomes "model" in Gemini.
    private toGeminiMessages(messages: Message[]): { system: string; contents: Content[] } {
        const systemParts: string[] = [];
        const contents: Content[]  = [];

        for (const msg of messages) {
            const role    = (msg as { role: string }).role;
            const content = (msg as { content: string }).content;

            if (role === "system") {
                systemParts.push(content);
            } else {
                contents.push({
                    role:  role === "assistant" ? "model" : "user",
                    parts: [{ text: content }],
                });
            }
        }

        return { system: systemParts.join("\n\n"), contents };
    }

    async *stream(messages: Message[]): AsyncGenerator<string> {
        const { system, contents } = this.toGeminiMessages(messages);
        console.log(`[Gemini] stream  model=${this.modelName}  contents=${contents.length}  hasSystem=${!!system}`);

        const model = this.genAI.getGenerativeModel({
            model:             this.modelName,
            systemInstruction: system || undefined,
            generationConfig: {
                temperature: 0.5,
            },
        });

        const result = await model.generateContentStream({ contents });

        let tokenCount = 0;
        for await (const chunk of result.stream) {
            const token = chunk.text();
            if (token) { tokenCount++; yield token; }
        }
        console.log(`[Gemini] stream done  tokens=${tokenCount}`);
    }

    async complete(messages: Message[]): Promise<string> {
        const { system, contents } = this.toGeminiMessages(messages);

        const model = this.genAI.getGenerativeModel({
            model:             this.modelName,
            systemInstruction: system || undefined,
            generationConfig: {
                temperature: 0.3,
            },
        });

        const result   = await model.generateContent({ contents });
        return result.response.text();
    }
}
