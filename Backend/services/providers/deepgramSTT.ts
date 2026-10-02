import { DeepgramClient } from "@deepgram/sdk";
import type { listen } from "@deepgram/sdk";

type V1Socket    = Awaited<ReturnType<InstanceType<typeof DeepgramClient>["listen"]["v1"]["connect"]>>;
type V1Message   = listen.ListenV1Results | listen.ListenV1Metadata | listen.ListenV1UtteranceEnd | listen.ListenV1SpeechStarted;

// ─── Streaming STT Session ────────────────────────────────────────────────────
// One instance per user turn. Opened on speech_start, closed on end_of_speech.
// Audio chunks are forwarded to Deepgram in real-time as they arrive from the
// frontend — so by the time the user stops speaking, transcript is already ready.

export class DeepgramStreamingSession {
    private socketPromise:    Promise<V1Socket>;
    private finalTranscript:  string   = "";
    private resolveFinished!: (t: string) => void;
    private finished:         Promise<string>;
    private closed:           boolean  = false;
    private pendingChunks:    Buffer[] = [];   // chunks that arrive before socket opens

    constructor(languageCode: string) {
        const apiKey = process.env.DEEPGRAM_API_KEY!;
        const client = new DeepgramClient({ apiKey });

        this.finished = new Promise(res => { this.resolveFinished = res; });

        this.socketPromise = client.listen.v1.connect({
            model:           "nova-2",
            language:        languageCode as string,
            smart_format:    "true",
            interim_results: "false",          // final results only — cleaner transcript
            encoding:        "webm-opus",
            sample_rate:     16000,
            Authorization:   `Token ${apiKey}`,
        });

        this.socketPromise.then(socket => {
            socket.on("open", () => {
                console.log(`[Deepgram] session open  lang=${languageCode}`);
                // Flush any chunks buffered before socket was ready
                for (const chunk of this.pendingChunks) {
                    socket.sendMedia(chunk);
                }
                this.pendingChunks = [];
            });

            socket.on("message", (msg: V1Message) => {
                if (msg.type !== "Results") return;
                const result = msg as listen.ListenV1Results;
                const text   = result.channel?.alternatives?.[0]?.transcript?.trim();
                if (!text) return;
                if (result.is_final) {
                    this.finalTranscript += (this.finalTranscript ? " " : "") + text;
                    console.log(`[Deepgram] final piece: "${text}"`);
                }
            });

            socket.on("close", () => {
                console.log(`[Deepgram] closed  transcript="${this.finalTranscript}"`);
                this.resolveFinished(this.finalTranscript);
            });

            socket.on("error", (err: Error) => {
                console.error(`[Deepgram] error:`, err);
                this.resolveFinished(this.finalTranscript);
            });

        }).catch(err => {
            console.error(`[Deepgram] failed to open connection:`, err);
            this.resolveFinished("");
        });
    }

    // Forward audio chunk to Deepgram in real-time
    sendAudio(chunk: Buffer): void {
        if (this.closed) return;
        this.socketPromise.then(socket => {
            if (socket.readyState === 1 /* OPEN */) {
                socket.sendMedia(chunk);
            } else {
                this.pendingChunks.push(chunk);
            }
        }).catch(() => {});
    }

    // Signal end of audio and wait for Deepgram to flush final results
    async finalize(): Promise<string> {
        if (this.closed) return this.finalTranscript;
        this.closed = true;

        try {
            const socket = await this.socketPromise;
            socket.sendFinalize({ type: "Finalize" });      // tell Deepgram audio is done
            socket.sendCloseStream({ type: "CloseStream" }); // close gracefully
        } catch (err) {
            console.error(`[Deepgram] finalize error:`, err);
            return this.finalTranscript;
        }

        // Wait up to 3s for final results, then return whatever we have
        const timeout = new Promise<string>(res =>
            setTimeout(() => res(this.finalTranscript), 3000)
        );
        return Promise.race([this.finished, timeout]);
    }
}

// ─── Language code mapping ────────────────────────────────────────────────────

export function toDeepgramLanguage(languageCode: string): string {
    switch (languageCode) {
        case "en-IN": return "en-IN";
        case "hi-IN": return "hi";
        case "mr-IN": return "mr";
        default:      return "en-IN";
    }
}

// ─── Routing: only English uses Deepgram, Indian languages use Sarvam ─────────

export function shouldUseDeepgram(languageCode: string): boolean {
    return languageCode === "en-IN" && !!process.env.DEEPGRAM_API_KEY;
}
