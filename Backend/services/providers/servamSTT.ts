import { STTProvider } from "../stt";
import axios from "axios";
import https from "https";

// Keep-alive agent — reuses TCP/TLS connections so every request after
// the first doesn't pay the ~200ms handshake cost again.
const httpsAgent = new https.Agent({ keepAlive: true });

const httpClient = axios.create({
    baseURL:    "https://api.sarvam.ai",
    timeout:    15000,
    httpsAgent,
});

// Pre-warms the TCP/TLS connection to api.sarvam.ai so the first real STT
// call doesn't pay the ~150ms handshake cost. Called fire-and-forget on auth.
export async function warmupSTTConnection(): Promise<void> {
    try {
        await httpClient.head("/");
    } catch {
        // Expected — HEAD may 404/405, we only care about the socket being open
    }
}

// ── WAV header (16 kHz mono 16-bit — matches AudioWorklet PCM output) ────────
function buildWAVBuffer(pcm: Buffer, sampleRate = 16000, channels = 1, bits = 16): Buffer {
    const byteRate   = sampleRate * channels * bits / 8;
    const blockAlign = channels * bits / 8;
    const h          = Buffer.alloc(44);
    h.write("RIFF",                  0);
    h.writeUInt32LE(36 + pcm.length, 4);
    h.write("WAVE",                  8);
    h.write("fmt ",                 12);
    h.writeUInt32LE(16,             16);
    h.writeUInt16LE(1,              20);
    h.writeUInt16LE(channels,       22);
    h.writeUInt32LE(sampleRate,     24);
    h.writeUInt32LE(byteRate,       28);
    h.writeUInt16LE(blockAlign,     32);
    h.writeUInt16LE(bits,           34);
    h.write("data",                 36);
    h.writeUInt32LE(pcm.length,     40);
    return Buffer.concat([h, pcm]);
}

export class SarvamSTTProvider implements STTProvider {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.SARVAM_API_KEY!;
    }

    async transcribe(audioBuffer: Buffer, languageCode: string): Promise<string> {
        // audioBuffer is raw Int16 PCM at 16kHz from AudioWorklet — wrap in WAV
        const wav = buildWAVBuffer(audioBuffer);
        const arrayBuffer = wav.buffer.slice(
            wav.byteOffset,
            wav.byteOffset + wav.byteLength
        ) as ArrayBuffer;

        const formData = new FormData();
        const blob = new Blob([arrayBuffer], { type: "audio/wav" });
        formData.append("file", blob, "audio.wav");
        formData.append("model", "saarika:v2.5");
        formData.append("language_code", languageCode);

        const response = await httpClient.post("/speech-to-text", formData, {
            headers: {
                "api-subscription-key": this.apiKey,
            },
        });

        return (response.data as { transcript: string }).transcript || "";
    }
}
