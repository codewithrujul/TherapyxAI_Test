import { SarvamTTSProvider } from "./providers/servamTTS";

export interface TTSProvider {
    synthesize(text: string, languageCode: string): Promise<Buffer>;
}


// Singleton — created once, reused across all TTS calls
let _provider: TTSProvider | null = null;
const getProvider = (): TTSProvider => {
    if (_provider) return _provider;
    const name = process.env.TTS_PROVIDER || "sarvam";
    switch (name) {
        case "sarvam": _provider = new SarvamTTSProvider(); break;
        default:       _provider = new SarvamTTSProvider();
    }
    return _provider;
};

// sentence splitter
// isFirstChunk: if true, use a lower word threshold so the user hears
// the first audio sooner — breaks the silence faster.
//
// Rules:
//  1. Split only on hard sentence endings (. ! ?) — never on commas/semicolons.
//     Splitting mid-clause gives each chunk its own start/end intonation which
//     sounds robotic. Keeping clauses together lets the TTS model produce
//     natural rising/falling tone across the whole thought.
//  2. Word-count flush as a safety valve for very long sentences.
export const splitSentences = (text: string, isFirstChunk = false): string[] => {
    // Hard sentence boundaries only: . ! ? and Hindi danda
    const byStrong = text.trim().split(/(?<=[.!?।])\s+/).map(s => s.trim()).filter(Boolean);
    if (byStrong.length > 1) return byStrong;

    // Word flush — emit early on first chunk to cut time-to-first-audio.
    // 7 words ≈ ~70ms of Groq streaming — small enough to start TTS fast,
    // large enough to avoid a single-word chunk that sounds abrupt.
    const flushAt = isFirstChunk ? 5 : 30;
    const words = text.trim().split(/\s+/);
    if (words.length >= flushAt) {
        return [
            words.slice(0, flushAt).join(' '),
            words.slice(flushAt).join(' '),
        ].filter(Boolean);
    }

    return [text]; // keep buffering
};

export const synthesizeSpeech = async (text: string, languageCode: string): Promise<Buffer> => {
    const provider = getProvider();
    return await provider.synthesize(text, languageCode);
};