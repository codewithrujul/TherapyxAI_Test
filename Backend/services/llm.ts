import { GroqLLMProvider } from "./providers/groqLLM";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { SarvamLLMProvider } from "./providers/sarvamLLM";
import { ChatMessage } from "./providers/sarvamLLM";
import { GeminiLLMProvider } from "./providers/geminiLLM";

export type Message = ChatMessage | ChatCompletionMessageParam;

export interface LLMProvider {
    stream(messages: Message[]): AsyncGenerator<string>;
    complete(messages: Message[]): Promise<string>;
}

// ── Per-provider singletons ───────────────────────────────────────────────────
// Both are kept warm simultaneously so switching between EN and HI sessions
// within the same server process has no cold-start penalty.

let _groqProvider:   LLMProvider | null = null;
let _sarvamProvider: LLMProvider | null = null;
let _geminiProvider: LLMProvider | null = null;

const getGroqProvider   = (): LLMProvider => { if (!_groqProvider)   _groqProvider   = new GroqLLMProvider();   return _groqProvider;   };
const getSarvamProvider = (): LLMProvider => { if (!_sarvamProvider) _sarvamProvider = new SarvamLLMProvider(); return _sarvamProvider; };
const getGeminiProvider = (): LLMProvider => { if (!_geminiProvider) _geminiProvider = new GeminiLLMProvider(); return _geminiProvider; };

// ── Language-based routing ────────────────────────────────────────────────────
// LLM_PROVIDER env var forces a specific provider for all languages.
// When unset (or "auto"), routing is based on languageCode:
//   en-IN  → Groq  (openai/gpt-oss-20b via GROQ_MODEL; llama-3.1-8b-instant was retired 2026-08-16)
//   hi-IN  → Sarvam (sarvam-105b, best Indian language quality)
//   mr-IN  → Sarvam (sarvam-105b, best Indian language quality)

const getProviderForLanguage = (languageCode: string): LLMProvider => {
    const override = process.env.LLM_PROVIDER;

    if (override && override !== "auto") {
        switch (override) {
            case "groq":   return getGroqProvider();
            case "sarvam": return getSarvamProvider();
            case "gemini": return getGeminiProvider();
            default:       return getSarvamProvider();
        }
    }

    // Auto-route: English → Groq, Indian languages → Sarvam
    switch (languageCode) {
        case "en-IN": return getGroqProvider();
        default:      return getSarvamProvider();   // hi-IN, mr-IN, any future Indian language
    }
};

// ── Public API ────────────────────────────────────────────────────────────────

export async function* streamLLM(messages: Message[], languageCode = "en-IN"): AsyncGenerator<string> {
    const provider = getProviderForLanguage(languageCode);
    console.log(`[LLM] provider=${languageCode === "en-IN" && !process.env.LLM_PROVIDER ? "groq" : (process.env.LLM_PROVIDER ?? "sarvam")}  lang=${languageCode}`);
    yield* provider.stream(messages);
}

export const completeLLM = async (messages: Message[], languageCode = "en-IN"): Promise<string> => {
    const provider = getProviderForLanguage(languageCode);
    return await provider.complete(messages);
};