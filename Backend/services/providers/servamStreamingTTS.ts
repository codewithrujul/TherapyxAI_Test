import { SarvamAIClient } from "sarvamai";

// ─── Sarvam Streaming TTS ─────────────────────────────────────────────────────
// Uses bulbul:v3 via WebSocket streaming API.
//
// WHY linear16 codec:
//  Sarvam's default streaming codec sends raw linear16 PCM without a WAV header.
//  We explicitly request "linear16" to guarantee consistent raw bytes, accumulate
//  them on the backend until FLUSH_MS of audio is ready, then wrap in a single
//  WAV header and forward to the frontend.
//
//  Result: ~8 clean 500 ms chunks instead of 70+ micro-buffers → smooth playback.

const SPEECH_SAMPLE_RATE = 8000;          // Hz — must match configureConnection
const BITS_PER_SAMPLE    = 16;            // linear16
const BYTES_PER_SAMPLE   = BITS_PER_SAMPLE / 8;
const FLUSH_MS           = 500;           // emit one frontend chunk per 500 ms
const FLUSH_BYTES        =
    SPEECH_SAMPLE_RATE * BYTES_PER_SAMPLE * FLUSH_MS / 1000;
//  = 8000 × 2 × 0.5 = 8000 bytes

export class SarvamStreamingTTSSession {
    private socket:               any      = null;
    private socketReady:          boolean  = false;
    private closed:               boolean  = false;
    private pendingTexts:         string[] = [];
    private chunkCount:           number   = 0;

    // PCM accumulation buffer
    private pcmChunks:     Buffer[] = [];
    private totalPCMBytes: number   = 0;

    private readonly onChunk: (seq: number, base64: string) => void;

    private socketReadyPromise:  Promise<void>;
    private resolveSocketReady!: () => void;
    private rejectSocketReady!:  (e: Error) => void;

    private donePromise:  Promise<void>;
    private resolveDone!: () => void;

    constructor(
        languageCode: string,
        onChunk: (seq: number, base64: string) => void,
    ) {
        this.onChunk = onChunk;

        this.socketReadyPromise = new Promise<void>((res, rej) => {
            this.resolveSocketReady = res;
            this.rejectSocketReady  = rej;
        });
        this.donePromise = new Promise<void>(res => { this.resolveDone = res; });

        // Connect in background — sendText() buffers until ready
        this.connectSocket(languageCode);
    }

    private async connectSocket(languageCode: string) {
        const apiKey = process.env.SARVAM_API_KEY!;
        const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });

        try {
            this.socket = await client.textToSpeechStreaming.connect({
                model:                  "bulbul:v3" as any,
                send_completion_event:  "true"      as any,
                "Api-Subscription-Key": apiKey,
            } as any);

            this.socket.on("message", (msg: any) => {
                if (msg?.type === "audio" && msg?.data?.audio) {
                    this.accumulatePCM(msg.data.audio);
                }
                // { type:"event", data:{ event_type:"final" } } — all audio generated
                if (msg?.type === "event" && msg?.data?.event_type === "final") {
                    this.flushPCM("final event");
                    console.log(`[SarvamTTS] all audio generated  chunks=${this.chunkCount}`);
                    this.resolveDone();
                }
            });

            this.socket.on("close", () => {
                this.flushPCM("socket close");   // safety flush
                console.log(`[SarvamTTS] socket closed  chunks=${this.chunkCount}`);
                this.resolveDone();
            });

            this.socket.on("error", (err: Error) => {
                console.error(`[SarvamTTS] socket error: ${err.message}`);
                this.rejectSocketReady(err);
                this.resolveDone();
            });

            await this.socket.waitForOpen();

            // linear16 = raw signed 16-bit LE PCM, no container header
            // This guarantees every audio message is pure bytes we can accumulate directly.
            this.socket.configureConnection({
                target_language_code: languageCode,
                speaker:              "ritu",
                speech_sample_rate:   SPEECH_SAMPLE_RATE,
                enable_preprocessing: false,
                pace:                 1.0,
                output_audio_codec:   "linear16",
            });

            console.log(`[SarvamTTS] socket ready  lang=${languageCode}`);
            this.socketReady = true;
            this.resolveSocketReady();

            // Flush texts that arrived before the socket was ready
            const pending = this.pendingTexts.splice(0);
            for (const text of pending) {
                this.socket.convert(text);
            }

        } catch (err: any) {
            console.error(`[SarvamTTS] connect failed: ${err.message}`);
            this.rejectSocketReady(err);
            this.resolveDone();
        }
    }

    // ── Accumulate raw linear16 PCM, flush every FLUSH_MS of audio ───────────
    private accumulatePCM(base64: string): void {
        const buf = Buffer.from(base64, "base64");
        this.pcmChunks.push(buf);
        this.totalPCMBytes += buf.length;
        if (this.totalPCMBytes >= FLUSH_BYTES) {
            this.flushPCM("threshold");
        }
    }

    private flushPCM(reason: string): void {
        if (this.pcmChunks.length === 0) return;
        const allPCM = Buffer.concat(this.pcmChunks);
        this.pcmChunks     = [];
        this.totalPCMBytes = 0;
        const wav        = buildWAVBuffer(allPCM, SPEECH_SAMPLE_RATE);
        const durationMs = Math.round(allPCM.length / (SPEECH_SAMPLE_RATE * BYTES_PER_SAMPLE) * 1000);
        const seq        = this.chunkCount++;
        console.log(`[SarvamTTS] → seq=${seq}  ${durationMs}ms  ${(wav.length / 1024).toFixed(1)}KB  (${reason})`);
        this.onChunk(seq, wav.toString("base64"));
    }

    // ── Send a sentence to Sarvam for synthesis ───────────────────────────────
    sendText(text: string): void {
        if (this.closed) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        if (this.socketReady) {
            this.socket.convert(trimmed);
        } else {
            this.pendingTexts.push(trimmed);
        }
    }

    // ── Flush remaining audio, return total chunk count ───────────────────────
    async finalize(): Promise<number> {
        if (this.closed) return this.chunkCount;
        this.closed = true;

        // Wait for socket to open
        try {
            await Promise.race([
                this.socketReadyPromise,
                new Promise<void>((_, rej) =>
                    setTimeout(() => rej(new Error("TTS socket open timeout")), 5000)
                ),
            ]);
            const pending = this.pendingTexts.splice(0);
            for (const text of pending) {
                this.socket.convert(text);
            }
        } catch (err: any) {
            console.warn(`[SarvamTTS] finalize: ${err.message}`);
            return this.chunkCount;
        }

        // Signal Sarvam we're done sending text
        try { this.socket.flush(); } catch { /* ignore */ }

        // Wait for final event (or 15 s safety timeout)
        await Promise.race([
            this.donePromise,
            new Promise<void>(res =>
                setTimeout(() => { console.warn("[SarvamTTS] finalize timeout"); res(); }, 15000)
            ),
        ]);

        try { this.socket.close(); } catch { /* ignore */ }

        return this.chunkCount;
    }
}

// ── WAV header builder ────────────────────────────────────────────────────────
function buildWAVBuffer(pcm: Buffer, sampleRate = 8000, channels = 1, bits = 16): Buffer {
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
