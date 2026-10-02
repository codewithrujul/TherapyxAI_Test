import { ChatMessage } from "../services/providers/sarvamLLM";
import { getSessionContext, updateActivity } from "../cache/sessionCache";
import { SessionContext } from "../cache/sessionCache";
import { CLOSING_INSTRUCTION, FALLBACK_SYSTEM_PROMPT, PERSONA, RESPONSE_STYLE, SECTION_LABELS, getFinalLanguageGuard, getLanguageInstruction } from "../core/Constants";
import { saveChatMessage } from "../db/dbService";
import { embedText } from "../services/embedding";
import { searchDocuments } from "../services/knowledgeBaseService";
// How many recent turns (user+assistant pairs) to keep in full inside the prompt.
// 8 pairs = 16 messages ≈ ~2–3k tokens — well within Groq's 32k context.
// Beyond this limit the oldest pairs are dropped (not needed; session end
// summary is generated from ALL stored turns anyway).
const MAX_CONTEXT_TURNS = 8;
const MAX_RETRIEVED_DOCS = 2;  // was 4 — smaller Supabase payload + shorter LLM prompt
const KNOWLEDGE_THRESHOLD = 0.65;  // lowered from 0.74 — 768-dim scores run ~0.05–0.10 lower than 1536-dim

// ─── OPT-1: Skip RAG for short / conversational messages ─────────────────────
const SKIP_RAG_WORD_LIMIT = 6;
const CONVERSATIONAL_RE =
    /^(yes|no|okay|ok|sure|hmm|yeah|nah|right|got it|i see|go on|continue|tell me more|i don't know|idk|thanks|thank you|really|oh|ah|wow|huh)[\s.!?]*$/i;

function isConversational(text: string): boolean {
    const words = text.trim().split(/\s+/).length;
    if (words <= 3) return true;
    if (words <= SKIP_RAG_WORD_LIMIT && CONVERSATIONAL_RE.test(text.trim())) return true;
    return false;
}
// ─── Public API ───────────────────────────────────────────────────────────────

export async function addTurn(
    userId:        string,
    userText:      string,
    assistantText: string,
    mode:          "chat" | "voice" = "chat"
): Promise<void> {
    const ctx = getSessionContext(userId);
    if (!ctx) return;

    ctx.turns.push({ role: "user",      content: userText      });
    ctx.turns.push({ role: "assistant", content: assistantText });

    updateActivity(userId);

    // Persist turn to DB — only DB call needed here, no LLM call
    await saveChatMessage(ctx.sessionId, userId, userText, assistantText, mode);

    console.log(`[Conversation] Turn saved  userId=${userId}  sessionId=${ctx.sessionId}  totalTurns=${ctx.turns.length / 2}`);
}

export function buildSystemPrompt(userId: string): string {
    const ctx = getSessionContext(userId);
    if (!ctx) return FALLBACK_SYSTEM_PROMPT;

    const { profile, previousSessionSummary, memory, turns } = ctx;

    const lines: string[] = [
        PERSONA,
        "",
        getLanguageInstruction(profile.languageCode),
        "",
        RESPONSE_STYLE,
        "",
        SECTION_LABELS.userProfile,
        `Naam: ${profile.name}`,
        `Language preference: ${profile.languageCode}`,
    ];

    if (profile.selectedReason) {
        lines.push(`Primary focus topic / reason for session: ${profile.selectedReason}`);
    }

    lines.push("");

    // ── Long-term memories from past sessions ──────────────────────────────────
    const hasMemory =
        (memory?.facts?.length     ?? 0) > 0 ||
        (memory?.interests?.length ?? 0) > 0 ||
        (memory?.other?.length     ?? 0) > 0 ||
        (memory?.mood && memory.mood !== "neutral");

    if (hasMemory) {
        lines.push(SECTION_LABELS.userMemory);
        if (memory?.mood && memory.mood !== "neutral")
            lines.push(`Mood: ${memory.mood}`);
        if ((memory?.facts?.length ?? 0) > 0)
            lines.push(`Facts: ${memory.facts.join(", ")}`);
        if ((memory?.interests?.length ?? 0) > 0)
            lines.push(`Interests: ${memory.interests.join(", ")}`);
        if ((memory?.other?.length ?? 0) > 0)
            lines.push(`Other: ${memory.other.join(", ")}`);
        lines.push("");
    }

    // ── Previous session context (first turn only — turns array is empty) ──────
    if (turns.length === 0 && previousSessionSummary) {
        lines.push(SECTION_LABELS.previousSession);
        lines.push(previousSessionSummary);
        lines.push("");
    }

    lines.push(getFinalLanguageGuard(profile.languageCode));
    lines.push("");
    lines.push(CLOSING_INSTRUCTION);
    return lines.join("\n");
}

// Returns [system prompt, ...recent turns, current user message] for the LLM.
// No rolling summary needed — recent turns ARE the context.
export async function getContextMessages(userId: string, userMessage: string): Promise<ChatMessage[]> {
    const ctx          = getSessionContext(userId);
    let systemPrompt = buildSystemPrompt(userId);
    // Inject RAG knowledge into system prompt — controlled by ENABLE_RAG env flag
    if (process.env.ENABLE_RAG === "true") {
        if (!isConversational(userMessage)) {
            systemPrompt = await injectKnowledgeIntoPrompt(systemPrompt, userMessage);
        } else {
            console.log(`[RAG] Skipped — short/conversational (${userMessage.trim().split(/\s+/).length} words)`);
        }
    }
    if (ctx) {
        systemPrompt = `${systemPrompt}\n\n${getFinalLanguageGuard(ctx.profile.languageCode)}`;
    }
    if (!ctx || ctx.turns.length === 0) {
        return [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userMessage  },
        ];
    }

    // Take last MAX_CONTEXT_TURNS pairs (oldest dropped if session is very long)
    const maxRaw     = MAX_CONTEXT_TURNS * 2; // each pair = 2 entries
    const recentRaw  = ctx.turns.slice(-maxRaw);

    const history: ChatMessage[] = recentRaw.map(t => ({
        role:    t.role as "user" | "assistant",
        content: t.content,
    }));

    return [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
    ];
}

export function getRecentTurns(userId: string): ChatMessage[] {
    const ctx = getSessionContext(userId);
    if (!ctx) return [];
    return ctx.turns.map(t => ({ role: t.role, content: t.content })) as ChatMessage[];
}

// Builds a plain-text transcript from all stored turns — used by memoService
// to generate the session summary at the end.
export function buildTranscriptForSummary(userId: string): string {
    const ctx = getSessionContext(userId);
    if (!ctx || ctx.turns.length === 0) return "";

    const lines: string[] = [];
    for (let i = 0; i < ctx.turns.length; i += 2) {
        const user = ctx.turns[i];
        const ai   = ctx.turns[i + 1];
        if (user) lines.push(`User: ${user.content}`);
        if (ai)   lines.push(`AI: ${ai.content}`);
    }
    return lines.join("\n");
}

// ─── OPT-3: Hard timeout wrapper ─────────────────────────────────────────────
const RAG_TIMEOUT_MS = parseInt(process.env.RAG_TIMEOUT_MS ?? "2000", 10);

export async function injectKnowledgeIntoPrompt(
    baseSystemPrompt: string,
    userMessage: string
): Promise<string> {
    const timeout = new Promise<string>(resolve =>
        setTimeout(() => {
            console.warn(`[RAG] Timeout after ${RAG_TIMEOUT_MS}ms — using base prompt`);
            resolve(baseSystemPrompt);
        }, RAG_TIMEOUT_MS)
    );
    return Promise.race([_doRAG(baseSystemPrompt, userMessage), timeout]);
}

/**
 * Retrieves relevant knowledge from therapy_docs and injects it into the system prompt
 * Returns the enhanced system prompt with knowledge context
 */
async function _doRAG(
    baseSystemPrompt: string,
    userMessage: string
): Promise<string> {
    try {
        console.log(`[RAG] Retrieving knowledge for query: "${userMessage.substring(0, 70)}..."`);

        // Step 1: Embed the user message
        const queryEmbedding = await embedText(userMessage);

        // Step 2: Search knowledge base
        const relevantDocs = await searchDocuments(
            queryEmbedding, 
            MAX_RETRIEVED_DOCS,      // e.g., 4
            KNOWLEDGE_THRESHOLD      // e.g., 0.74
        );

        if (!relevantDocs || relevantDocs.length === 0) {
            console.log(`[RAG] No relevant knowledge found`);
            return baseSystemPrompt;
        }

        // Log matched docs
        console.log(`[RAG] Matched ${relevantDocs.length} doc(s):`);
        relevantDocs.forEach((doc: any, i: number) => {
            console.log(`  [${i + 1}] similarity=${doc.similarity?.toFixed(4)}  source="${doc.metadata?.source ?? "unknown"}"`);
            console.log(`       ${doc.content.substring(0, 120).replace(/\n/g, " ")}...`);
        });

        // Step 3: Format knowledge nicely
        const knowledgeBlocks = relevantDocs.map((doc: any, index: number) => {
            const source = doc.metadata?.source || "Therapy Knowledge Base";
            return `[Knowledge ${index + 1}] Source: ${source}\n${doc.content}`;
        }).join("\n\n");

        // Step 4: Inject into system prompt
        const enhancedPrompt = `${baseSystemPrompt}

=== RELEVANT KNOWLEDGE FROM THERAPY DATABASE ===
${knowledgeBlocks}

Instructions:
- Use the above knowledge when it is relevant to the user's message.
- Provide empathetic, practical, and actionable advice.
- If the knowledge is helpful, base your response on it.
- Always maintain a warm, supportive, and non-judgmental tone.`;

        console.log(`[RAG] ✓ Successfully injected ${relevantDocs.length} knowledge pieces`);
        return enhancedPrompt;

    } catch (error: any) {
        console.warn(`[RAG] Knowledge injection failed: ${error.message}`);
        // Return original prompt if RAG fails (graceful degradation)
        return baseSystemPrompt;
    }
}
