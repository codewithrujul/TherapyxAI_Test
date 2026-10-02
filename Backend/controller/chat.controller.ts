import { WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Message, streamLLM } from "../services/llm";
import { addTurn, getContextMessages } from "../memory/conversation";
import { verifySupabaseToken, AuthenticatedUser } from "../middleware/auth";
import { startSession, endSession, getProfile } from "../cache/sessionCache";
import { UserProfile } from "../cache/sessionCache";
import { getSessionGreeting } from "../core/Greetings";
import { createGuestSessionInDB } from "../db/dbService";

function sendJSON(ws: WebSocket, payload: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}
// ── Main pipeline — no STT, text comes directly ───────────────────────────────
const processChatPipeline = async (ws: WebSocket, userMessage: string, user: AuthenticatedUser) => {
    const languageCode = getProfile(user.id)?.languageCode ?? "en-IN";
    if (!userMessage.trim()) {
        ws.send(JSON.stringify({ type: "status", text: "Empty message" }));
        return;
    }

    console.log("Chat message received:", userMessage);
    ws.send(JSON.stringify({ type: "status", text: "Thinking..." }));

    const tokens: string[] = [];

    // ── Chat pipeline is text-only — no TTS audio dispatch ────────────────
    // ─────────────────────────────────────────────────────────────────────

    const messages: Message[] = await getContextMessages(user.id, userMessage);
    console.log(`[ChatController] Context messages prepared  count=${messages.length}`);

    try {
        for await (const token of streamLLM(messages, languageCode)) {
            tokens.push(token);
            ws.send(JSON.stringify({ type: "token", text: token }));
        }

        const fullResponse = tokens.join("");
        ws.send(JSON.stringify({ type: "done", text: fullResponse }));
        await addTurn(user.id, userMessage, fullResponse, "chat");

    } catch (err) {
        console.error("Pipeline error:", err);
        ws.send(JSON.stringify({ type: "error", text: String(err) }));
    }
};

// ── Greeting pipeline — AI opens the conversation, no user turn stored ───────
const processGreetPipeline = async (ws: WebSocket, user: AuthenticatedUser) => {
    const profile = getProfile(user.id);
    const languageCode = profile?.languageCode ?? "en-IN";
    const greeting = getSessionGreeting(languageCode, user.name, profile?.selectedReason);

    try {
        sendJSON(ws, { type: "token", text: greeting });
        sendJSON(ws, { type: "done", text: greeting });
        // NOTE: intentionally no addTurn - greeting is not part of conversation history
    } catch (err) {
        console.error("[GreetPipeline] error:", err);
        sendJSON(ws, { type: "error", text: String(err) });
    }
};

// WebSocket handler
export const handleChatSocket = (ws: WebSocket, req: IncomingMessage) => {
    console.log("Chat client connected");
    let authenticatedUser: AuthenticatedUser | null = null;
    let isAuthenticated: boolean = false;
    ws.on("message", async (data: Buffer, isBinary: boolean) => {
        // chat is always text — ignore binary
        if (isBinary) return;

        const msg = JSON.parse(data.toString());

        switch (msg.type) {
            case "auth": {
                if (isAuthenticated) {
                    sendJSON(ws, { type: "error", code: "ALREADY_AUTHENTICATED", message: "Already authenticated" });
                    return;
                }

                if (msg.guest_id && msg.guest_name) {
                    try {
                        const guestUserId = `guest_${msg.guest_id}`;
                        const sessionId = await createGuestSessionInDB(
                            msg.guest_id,
                            msg.guest_name,
                            msg.languageCode ?? "en-IN",
                        );

                        isAuthenticated = true;
                        authenticatedUser = { id: guestUserId, email: "", name: msg.guest_name };

                        const profile: UserProfile = {
                            id: guestUserId,
                            name: msg.guest_name,
                            languageCode: msg.languageCode ?? "en-IN",
                            selectedReason: msg.reason,
                        };

                        await startSession(profile, sessionId);
                        console.log(`[ChatController] Guest auth  guestId=${msg.guest_id}  name=${msg.guest_name}`);
                        sendJSON(ws, {
                            type: "auth:success",
                            user: { id: guestUserId, name: msg.guest_name },
                            sessionId,
                        });
                    } catch (err) {
                        console.error("[ChatController] Guest auth failed:", (err as Error).message);
                        sendJSON(ws, {
                            type: "error",
                            code: "GUEST_AUTH_FAILED",
                            message: "Guest session could not be created.",
                        });
                        ws.close(1011, "Guest auth error");
                    }
                    break;
                }

                if (!msg.token) {
                    sendJSON(ws, { type: "error", code: "MISSING_TOKEN", message: "token or guest credentials required" });
                    ws.close(1008, "Missing auth");
                    return;
                }
    
                const user = await verifySupabaseToken(msg.token);
    
                if (!user) {
                    console.warn("[CHATCONTROLLER] Invalid token — closing connection");
                    sendJSON(ws, { type: "error", code: "INVALID_TOKEN", message: "Token is invalid or expired — please log in again" });
                    ws.close(1008, "Unauthorized");
                    return;
                }
    
                // ✅ Auth passed — start context session
                isAuthenticated   = true;
                authenticatedUser = user;
    
                const profile: UserProfile = {
                    id:           user.id,
                    name:         user.name,
                    languageCode: msg.languageCode ?? "en-IN",  // client can send preferred language
                    selectedReason: msg.reason,
                };
    
                console.log(`[ChatController] Auth success  userId=${user.id}  email=${user.email}`);
                await startSession(profile, msg.sessionId ?? "");
    
                sendJSON(ws, {
                    type: "auth:success",
                    user: { id: user.id, email: user.email, name: user.name },
                });
                break;
            }
            case "ping":
                ws.send(JSON.stringify({ type: "pong" }));
                break;

            case "greet":
                if (!authenticatedUser) {
                    sendJSON(ws, { type: "error", code: "UNAUTHORIZED", message: "Authenticate before sending messages" });
                    return;
                }
                // AI opens the conversation — no user message stored in context
                await processGreetPipeline(ws, authenticatedUser);
                break;

            case "chat_message":
                if (!authenticatedUser) {
                    sendJSON(ws, { type: "error", code: "UNAUTHORIZED", message: "Authenticate before sending messages" });
                    return;
                }
                // msg.text = what user typed — skip STT directly to LLM
                await processChatPipeline(ws, msg.text, authenticatedUser);
                break;
        }
    });

    ws.on("close", async () => {
        if (authenticatedUser) {
            await endSession(authenticatedUser.id);
        } else {
            console.log("[ChatController] Unauthenticated client disconnected");
        }
    });

    ws.on("error", (err) => console.error("Chat WS error:", err));
};

