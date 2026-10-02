import { TTSProvider } from "../tts";
import axios, { AxiosError } from 'axios';
import https from 'https';

// Keep-alive agent — reuses TCP/TLS connections so every request after
// the first doesn't pay the ~200ms handshake cost again.
const httpsAgent = new https.Agent({ keepAlive: true });

const httpClient = axios.create({
    baseURL:    'https://api.sarvam.ai',
    timeout:    12000,
    httpsAgent,
});

// Pre-warms the TCP/TLS connection to api.sarvam.ai so the first real TTS
// call doesn't pay the ~150ms handshake cost. Called fire-and-forget on auth.
export async function warmupTTSConnection(): Promise<void> {
    try {
        await httpClient.head("/");
    } catch {
        // Expected — HEAD may 404/405, we only care about the socket being open
    }
}

export class SarvamTTSProvider implements TTSProvider {

    private apiKey: string;

    constructor() {
        this.apiKey = process.env.SARVAM_API_KEY!;
    }

    async synthesize(text: string, languageCode: string): Promise<Buffer> {
        let response;
        try {
            response = await httpClient.post(
                '/text-to-speech',
                {
                    text,
                    target_language_code: languageCode,
                    model:                'bulbul:v3',
                    speaker:              'ritu',
                    speech_sample_rate:   8000,  // smaller payload = faster transfer, less latency
                    enable_preprocessing: false,
                    pace:                 1.0,
                    temperature:          0.1,
                },
                {
                    headers: {
                        'api-subscription-key': this.apiKey,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } catch (err) {
            const axErr = err as AxiosError;
            const status = axErr.response?.status;
            const body   = JSON.stringify(axErr.response?.data ?? axErr.message);
            console.error(`[TTS] Sarvam request failed  status=${status}  body=${body}`);
            throw new Error(`TTS failed (${status}): ${body}`);
        }

        const audioBase64 = response.data?.audios?.[0];
        if (!audioBase64) {
            console.error('[TTS] Sarvam returned no audio. Response:', JSON.stringify(response.data));
            throw new Error('TTS returned empty audio');
        }

        return Buffer.from(audioBase64, 'base64');
    }
}
