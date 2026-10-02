import { WebSocketServer } from "ws";
import { Server } from "http";
import { handleVoiceSocket } from "../controller/voice.controller";

export const registerVoiceRoute = (server: Server) => {
    const wss = new WebSocketServer({ server, path: "/ws/voice" });
    wss.on("connection", handleVoiceSocket);
    console.log("Voice WebSocket registered at /ws/voice");
};