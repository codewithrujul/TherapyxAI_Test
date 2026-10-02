import { SarvamSTTProvider } from "./providers/servamSTT";

export interface STTProvider {
    transcribe(audioBuffer: Buffer, languageCode: string): Promise<string>;
}

let _provider: STTProvider | null = null;

const getProvider = (): STTProvider => {
    if (_provider) return _provider;
    const name = process.env.STT_PROVIDER || "sarvam";
    switch (name) {
        case "sarvam": _provider = new SarvamSTTProvider(); break;
        default:       _provider = new SarvamSTTProvider();
    }
    return _provider;
};

export const transcribeAudio = async (audioBuffer: Buffer, languageCode: string): Promise<string> => {
    const provider = getProvider();
    return await provider.transcribe(audioBuffer, languageCode);
};