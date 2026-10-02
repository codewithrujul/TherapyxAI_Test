// voiceController.ts
// Streaming STT  → Sarvam saaras:v3 WebSocket (AudioWorklet PCM, no ffmpeg)
// Streaming TTS  → Sarvam bulbul:v3 WebSocket (one connection per turn, pipelined)
// `done` message includes `totalChunks` so frontend knows when to stop waiting.

import { WebSocket } from "ws";
import { IncomingMessage } from "http";
import { transcribeAudio } from "../services/stt";
import { Message, streamLLM } from "../services/llm";
import { splitSentences, synthesizeSpeech } from "../services/tts";
import { getContextMessages, addTurn } from "../memory/conversation";
import { verifySupabaseToken, AuthenticatedUser } from "../middleware/auth";
import { startSession, endSession, getProfile } from "../cache/sessionCache";
import { createGuestSessionInDB } from "../db/dbService";
import { UserProfile } from "../cache/sessionCache";
import { warmupSTTConnection } from "../services/providers/servamSTT";
import { warmupTTSConnection } from "../services/providers/servamTTS";
import { warmupEmbeddingConnection } from "../services/embedding";
import { SarvamStreamingTTSSession } from "../services/providers/servamStreamingTTS";
import { getSessionGreeting } from "../core/Greetings";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendJSON(ws: WebSocket, payload: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────
const processPipeline = async (
    ws: WebSocket,
    chunks: Buffer[],
    user: AuthenticatedUser,
) => {
    if (chunks.length === 0) {
        sendJSON(ws, { type: "status", text: "No audio received" });
        return;
    }

    // ── Pipeline timer ────────────────────────────────────────────────────────
    const T0 = Date.now();
    const elapsed = () => Date.now() - T0;
    const step = (label: string, extra = "") => {
        console.log(`[TIMING] ${String(elapsed()).padStart(5)}ms  ${label}${extra ? `  ${extra}` : ""}`);
    };

    step("end_of_speech received — pipeline start");

    const fullAudio    = Buffer.concat(chunks);
    const languageCode = getProfile(user.id)?.languageCode ?? "en-IN";
    const audioKB      = (fullAudio.length / 1024).toFixed(1);

    step(`audio ready`, `size=${audioKB}KB  lang=${languageCode}  chunks=${chunks.length}`);

    sendJSON(ws, { type: "status", text: "Transcribing..." });

    // ── STT — Sarvam batch HTTP API ───────────────────────────────────────────
    const sttStart = elapsed();
    let transcript: string;
    try {
        step(`STT via Sarvam batch`);
        transcript = await transcribeAudio(fullAudio, languageCode);
    } catch (err) {
        step(`STT error`);
        sendJSON(ws, { type: "error", text: String(err) });
        return;
    }
    step(`STT done`, `provider=sarvam-batch  took=${elapsed() - sttStart}ms  transcript="${transcript.slice(0, 60)}"`);

    if (!transcript.trim()) {
        sendJSON(ws, { type: "status", text: "No speech detected" });
        return;
    }

    sendJSON(ws, { type: "transcript", text: transcript });
    sendJSON(ws, { type: "status", text: "Thinking..." });

    // ── Build LLM messages ────────────────────────────────────────────────────
    const messages: Message[] = await getContextMessages(user.id, transcript);
    step(`LLM messages built`, `count=${messages.length}`);

    let buffer       = "";
    let fullResponse = "";
    let firstToken   = true;
    let sentenceCount = 0;

    // ── Open Streaming TTS session in parallel with LLM start ────────────────
    // Sarvam TTS WebSocket connects in background; sentences are queued until ready.
    const ttsSession = new SarvamStreamingTTSSession(
        languageCode,
        (seq: number, base64: string) => {
            if (seq === 0) step(`first audio chunk sent to frontend`, `total_to_first_audio=${elapsed()}ms`);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "audio", seq, data: base64, format: "wav" }));
            }
        },
    );

    const enqueueSentence = (text: string) => {
        const idx = sentenceCount++;
        if (idx === 0) step(`first sentence to TTS`, `text="${text.slice(0, 50)}"`);
        ttsSession.sendText(text);
    };

    // ── LLM streaming ─────────────────────────────────────────────────────────
    step(`LLM stream starting`, `provider=${languageCode === "en-IN" ? "groq" : "sarvam"}`);

    try {
        for await (const token of streamLLM(messages, languageCode)) {
            if (firstToken) {
                step(`LLM first token received`);
                firstToken = false;
            }

            buffer       += token;
            fullResponse += token;
            sendJSON(ws, { type: "token", text: token });

            const isFirstChunk = sentenceCount === 0;
            const sentences = splitSentences(buffer, isFirstChunk);
            if (sentences.length > 1) {
                for (const sentence of sentences.slice(0, -1)) {
                    enqueueSentence(sentence);
                }
                buffer = sentences[sentences.length - 1];
            }
        }

        step(`LLM stream done`, `total_tokens≈${fullResponse.split(" ").length} words`);

        if (buffer.trim()) enqueueSentence(buffer.trim());

        // Flush TTS → wait for all audio chunks → get total count
        const totalChunks = await ttsSession.finalize();

        step(`all TTS done + sent`, `total_chunks=${totalChunks}`);

        sendJSON(ws, { type: "done", text: fullResponse, totalChunks });

        step(`pipeline complete ✓`, `total=${elapsed()}ms`);

        // ── Summary table ─────────────────────────────────────────────────────
        console.log(`\n┌─────────────────────────────────────────────────┐`);
        console.log(`│  PIPELINE SUMMARY                               │`);
        console.log(`├─────────────────────────────────────────────────┤`);
        console.log(`│  lang=${languageCode.padEnd(5)}  audio=${audioKB.padStart(6)}KB                    │`);
        console.log(`│  total wall time: ${String(elapsed()).padStart(5)}ms                    │`);
        console.log(`└─────────────────────────────────────────────────┘\n`);

        await addTurn(user.id, transcript, fullResponse, "voice");

    } catch (err) {
        console.error(`[VC] Pipeline error:`, err);
        sendJSON(ws, { type: "error", text: String(err) });
    }
};

// ── Voice greeting pipeline — AI opens the session, no audio input needed ────
const processVoiceGreetPipeline = async (ws: WebSocket, user: AuthenticatedUser) => {
    const profile = getProfile(user.id);
    const languageCode = profile?.languageCode ?? "en-IN";
    const greeting = getSessionGreeting(languageCode, user.name, profile?.selectedReason);

    try {
        sendJSON(ws, { type: "token", text: greeting });
        const audio = await synthesizeSpeech(greeting, languageCode);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "audio", seq: 0, data: audio.toString("base64"), format: "wav" }));
        }
        sendJSON(ws, { type: "done", text: greeting, totalChunks: 1 });
        // NOTE: intentionally no addTurn - greeting is not part of conversation history
    } catch (err) {
        console.error("[VoiceGreetPipeline] error:", err);
        sendJSON(ws, { type: "error", text: String(err) });
    }
};

// WebSocket handler
export const handleVoiceSocket = (ws: WebSocket, req: IncomingMessage) => {
    console.log("Client connected");
    console.log("Request headers:", req.headers);

    let audioBuffer:       Buffer[]              = [];
    let authenticatedUser: AuthenticatedUser | null = null;
    let isAuthenticated:   boolean               = false;

    ws.on("message", async (data: Buffer, isBinary: boolean) => {
        if (isBinary) {
            audioBuffer.push(data);
            return;
        }

        const msg = JSON.parse(data.toString());

        switch (msg.type) {

            // ── auth ──────────────────────────────────────────────────────────
            case "auth": {
                if (isAuthenticated) {
                    sendJSON(ws, { type: "error", code: "ALREADY_AUTHENTICATED", message: "Already authenticated" });
                    return;
                }

                const AUTH_TIMEOUT_MS = 25_000;
                const withTimeout = <T>(p: Promise<T>): Promise<T> =>
                    Promise.race([
                        p,
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error("auth_timeout")), AUTH_TIMEOUT_MS)
                        ),
                    ]);

                // ── Guest auth path ───────────────────────────────────────────
                if (msg.guest_id && msg.guest_name) {
                    try {
                        const guestUserId = `guest_${msg.guest_id}`;
                        const sessionId   = await withTimeout(createGuestSessionInDB(msg.guest_id, msg.guest_name, msg.languageCode ?? "en-IN"));

                        isAuthenticated   = true;
                        authenticatedUser = { id: guestUserId, email: "", name: msg.guest_name };

                        const profile: UserProfile = {
                            id:           guestUserId,
                            name:         msg.guest_name,
                            languageCode: msg.languageCode ?? "en-IN",
                            selectedReason: msg.reason,
                        };

                        await withTimeout(startSession(profile, sessionId));

                        console.log(`[VoiceController] Guest auth  guestId=${msg.guest_id}  name=${msg.guest_name}`);
                        sendJSON(ws, {
                            type:      "auth:success",
                            user:      { id: guestUserId, name: msg.guest_name },
                            sessionId,
                        });

                        warmupSTTConnection();
                        warmupTTSConnection();
                        warmupEmbeddingConnection();
                    } catch (err) {
                        const msg_ = (err as Error).message;
                        const isTimeout = msg_ === "auth_timeout";
                        console.error("[VoiceController] Guest auth failed:", msg_);
                        sendJSON(ws, {
                            type:    "error",
                            code:    isTimeout ? "AUTH_TIMEOUT" : "GUEST_AUTH_FAILED",
                            message: isTimeout
                                ? "Session setup timed out — please try again."
                                : "Guest session could not be created.",
                        });
                        ws.close(1011, "Guest auth error");
                    }
                    break;
                }

                // ── Logged-in auth path ───────────────────────────────────────
                if (!msg.token) {
                    sendJSON(ws, { type: "error", code: "MISSING_TOKEN", message: "token or guest credentials required" });
                    ws.close(1008, "Missing auth");
                    return;
                }

                try {
                    const user = await withTimeout(verifySupabaseToken(msg.token));

                    if (!user) {
                        console.warn("[VoiceController] Invalid token — closing connection");
                        sendJSON(ws, { type: "error", code: "INVALID_TOKEN", message: "Token is invalid or expired — please log in again" });
                        ws.close(1008, "Unauthorized");
                        return;
                    }

                    isAuthenticated   = true;
                    authenticatedUser = user;

                    const profile: UserProfile = {
                        id:           user.id,
                        name:         user.name,
                        languageCode: msg.languageCode ?? "en-IN",
                        selectedReason: msg.reason,
                    };

                    await withTimeout(startSession(profile, msg.sessionId ?? ""));

                    console.log(`[VoiceController] Auth success  userId=${user.id}  email=${user.email}`);
                    sendJSON(ws, {
                        type: "auth:success",
                        user: { id: user.id, email: user.email, name: user.name },
                    });

                    warmupSTTConnection();
                    warmupTTSConnection();
                    warmupEmbeddingConnection();
                } catch (err) {
                    const msg_ = (err as Error).message;
                    const isTimeout = msg_ === "auth_timeout";
                    console.error("[VoiceController] Auth failed:", msg_);
                    sendJSON(ws, {
                        type:    "error",
                        code:    isTimeout ? "AUTH_TIMEOUT" : "AUTH_FAILED",
                        message: isTimeout
                            ? "Session setup timed out — please try again."
                            : "Authentication failed — please log in again.",
                    });
                    ws.close(1011, "Auth error");
                }
                break;
            }

            case "ping":
                sendJSON(ws, { type: "pong" });
                break;

            case "greet":
                // AI opens the voice session — no audio input, no user turn stored
                await processVoiceGreetPipeline(ws, authenticatedUser as AuthenticatedUser);
                break;

            case "speech_start": {
                audioBuffer = [];
                sendJSON(ws, { type: "status", text: "Listening..." });
                break;
            }

            case "end_of_speech": {
                await processPipeline(ws, audioBuffer, authenticatedUser as AuthenticatedUser);
                audioBuffer = [];
                break;
            }
        }
    });

    ws.on("close", async () => {
        if (authenticatedUser) {
            await endSession(authenticatedUser.id);
        } else {
            console.log("[VoiceController] Unauthenticated client disconnected");
        }
    });

    ws.on("error", (err) => console.error("WS error:", err));
};

