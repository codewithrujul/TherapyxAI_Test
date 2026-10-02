import { SarvamAIClient } from "sarvamai";

// ─── Sarvam Streaming STT ─────────────────────────────────────────────────────
// Uses saaras:v3 model via WebSocket streaming API.
//
// Strategy: TRUE real-time streaming.
//  - sendAudio() forwards each 100ms PCM chunk to Sarvam immediately as raw PCM
//    (no WAV header — Sarvam's streaming engine treats it as a continuous stream)
//  - If socket not ready yet, chunks are buffered and flushed the moment it opens
//  - finalize() just calls flush() to signal end of speech and waits for transcript
//    (most audio is already processed by the time user stops speaking → fast response)

export class SarvamStreamingSTTSession {
    private socket:               any                  = null;
    private socketReady:          boolean              = false;
    private transcript:           string               = "";
    private resolveFinished!:     (t: string) => void;
    private finished:             Promise<string>;
    private closed:               boolean              = false;
    private pendingPCM:           Buffer[]             = [];   // only until socket opens
    private closeTimer:           ReturnType<typeof setTimeout> | null = null;

    private socketReadyPromise:   Promise<void>;
    private resolveSocketReady!:  () => void;
    private rejectSocketReady!:   (e: Error) => void;

    constructor(languageCode: string) {
        this.finished = new Promise(res => { this.resolveFinished = res; });

        this.socketReadyPromise = new Promise<void>((res, rej) => {
            this.resolveSocketReady = res;
            this.rejectSocketReady  = rej;
        });

        // Connect in background while user starts speaking
        this.connectSocket(languageCode);
    }

    private async connectSocket(languageCode: string) {
        const apiKey = process.env.SARVAM_API_KEY!;
        const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });

        try {
            this.socket = await client.speechToTextStreaming.connect({
                "language-code":        languageCode as any,
                model:                  "saaras:v3"  as any,
                mode:                   "transcribe" as any,
                sample_rate:            "16000",
                high_vad_sensitivity:   "true",
                vad_signals:            "true",
                flush_signal:           "true",
                "Api-Subscription-Key": apiKey,
            } as any);

            this.socket.on("message", (msg: any) => {
                console.log(`[SarvamSTT] msg:`, JSON.stringify(msg));

                // { type:"data", data:{ transcript:"..." } }
                const piece = msg?.data?.transcript?.trim();
                if (piece) {
                    this.transcript += (this.transcript ? " " : "") + piece;
                    console.log(`[SarvamSTT] transcript: "${piece}"`);

                    // Debounce close: wait 200ms after last transcript part
                    if (this.closeTimer) clearTimeout(this.closeTimer);
                    this.closeTimer = setTimeout(() => {
                        try { this.socket?.close(); } catch { /* ignore */ }
                    }, 200);
                }
            });

            this.socket.on("close", () => {
                console.log(`[SarvamSTT] socket closed  transcript="${this.transcript}"`);
                this.resolveFinished(this.transcript);
            });

            this.socket.on("error", (err: Error) => {
                console.error(`[SarvamSTT] socket error: ${err.message}`);
                this.rejectSocketReady(err);
                this.resolveFinished(this.transcript);
            });

            await this.socket.waitForOpen();
            console.log(`[SarvamSTT] socket ready  lang=${languageCode}`);
            this.socketReady = true;
            this.resolveSocketReady();

            // Flush any PCM chunks that arrived before socket was ready
            if (this.pendingPCM.length > 0) {
                console.log(`[SarvamSTT] flushing ${this.pendingPCM.length} buffered chunks`);
                const buffered = this.pendingPCM.splice(0);
                for (const chunk of buffered) {
                    this.streamChunk(chunk);
                }
            }

        } catch (err: any) {
            console.error(`[SarvamSTT] connect failed: ${err.message}`);
            this.rejectSocketReady(err);
            this.resolveFinished(this.transcript);
        }
    }

    // ── Send one raw PCM chunk to Sarvam (no WAV header) ─────────────────────
    private streamChunk(chunk: Buffer): void {
        try {
            this.socket.transcribe({
                audio:       chunk.toString("base64"),
                encoding:    "audio/raw",
                sample_rate: 16000,
            });
        } catch (err: any) {
            console.warn(`[SarvamSTT] streamChunk error: ${err.message}`);
        }
    }

    // ── Called for every 100ms PCM chunk from AudioWorklet ───────────────────
    sendAudio(chunk: Buffer): void {
        if (this.closed) return;
        if (!this.socketReady) {
            // Socket still connecting — buffer until ready
            this.pendingPCM.push(chunk);
            return;
        }
        // Socket open — stream immediately in real-time
        this.streamChunk(chunk);
    }

    // ── Finalize: signal end of speech, wait for transcript ──────────────────
    async finalize(): Promise<string> {
        if (this.closed) return this.transcript;
        this.closed = true;

        // Wait for socket (should already be open — user spoke for several seconds)
        const socketTimeout = new Promise<void>((_, rej) =>
            setTimeout(() => rej(new Error("socket open timeout")), 3000)
        );
        try {
            await Promise.race([this.socketReadyPromise, socketTimeout]);
        } catch (err: any) {
            console.warn(`[SarvamSTT] finalize: ${err.message}`);
            return this.transcript;
        }

        // Flush any remaining buffered chunks (edge case: very short speech)
        if (this.pendingPCM.length > 0) {
            const buffered = this.pendingPCM.splice(0);
            for (const chunk of buffered) {
                this.streamChunk(chunk);
            }
        }

        // Signal end of speech — Sarvam returns transcript for already-streamed audio
        try { this.socket.flush(); } catch { /* ignore */ }

        console.log(`[SarvamSTT] flush sent — waiting for transcript`);

        // Wait for transcript (fast — audio was streamed in real-time)
        // 7s timeout as safety net
        const timeout = new Promise<string>(res =>
            setTimeout(() => {
                console.warn(`[SarvamSTT] finalize timeout — forcing close`);
                try { this.socket?.close(); } catch { /* ignore */ }
                res(this.transcript);
            }, 7000)
        );
        return Promise.race([this.finished, timeout]);
    }
}
