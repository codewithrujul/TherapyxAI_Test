import { WebSocketServer } from "ws";
import { Server } from "http";
import { handleChatSocket } from "../controller/chat.controller";

export const registerChatRoute = (server: Server) => {
    const wss = new WebSocketServer({ server, path: "/ws/chat" });
    wss.on("connection", handleChatSocket);
    console.log("Chat WebSocket registered at /ws/chat");
};