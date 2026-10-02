import { saveSessionSummary } from "../db/dbService";
import { completeLLM } from "../services/llm";

// ─── Singleton Mem0 client ────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

// export interface ExtractedMemory {
//     id:      string;
//     memory:  string;
//     score?:  number;
// }

// let _mem0Client: MemoryClient | null = null;
 
// function getMem0Client(): MemoryClient {
//     if (!_mem0Client) {
//         _mem0Client = new MemoryClient({
//             apiKey: process.env.MEM0_API_KEY!,
//         });
//     }
//     return _mem0Client;
// }
 

// ─── End of session — extract → save → delete ─────────────────────────────────

/**
 * processSessionMemories
 *
 * Called when WebSocket closes.
 *
 * 1. Feeds rollingSummary into Mem0 → Mem0 extracts structured memories
 * 2. Fetches extracted memories from Mem0
 * 3. Saves memories to Supabase session_summaries table
 * 4. Deletes from Mem0 — Mem0 is only used as extraction engine, not storage
 */


export interface UserMemory {
    interests: string[];   // topics user cares about e.g. ["cricket", "AI", "movies"]
    facts:     string[];   // concrete facts e.g. ["lives in Mumbai", "works in tech", "has a sister"]
    mood:      string;     // emotional state this session e.g. "curious", "stressed", "happy"
    other:     string[];   // anything else relevant e.g. ["prefers short answers", "speaks Hindi"]
}
 
export const EMPTY_MEMORY: UserMemory = {
    interests: [],
    facts:     [],
    mood:      "neutral",
    other:     [],
};
 
// ─── Extract memories using LLM ───────────────────────────────────────────────
 
async function extractMemories(
    userId:         string,
    rollingSummary: string
): Promise<UserMemory> {
    const messages = [
        {
            role:    "system" as const,
            content:
                `You extract structured user information from a conversation transcript. ` +
                `The conversation may be in any language (Hindi, English, Hinglish, etc.) — ` +
                `but you MUST write ALL output values in English only. ` +
                `Respond ONLY with a valid JSON object — no explanation, no markdown, no backticks. ` +
                `Use exactly this structure:\n` +
                `{\n` +
                `  "interests": ["topic1", "topic2"],\n` +
                `  "facts": ["fact about the user1", "fact2"],\n` +
                `  "mood": "one word describing user mood this session",\n` +
                `  "other": ["any other relevant detail1", "detail2"]\n` +
                `}\n\n` +
                `Rules:\n` +
                `- interests: hobbies, topics, subjects the user mentioned caring about\n` +
                `- facts: concrete personal facts (location, job, family, habits)\n` +
                `- mood: single word only in English (curious, happy, stressed, excited, neutral etc)\n` +
                `- other: preferences, communication style, anything that doesn't fit above\n` +
                `- Use empty arrays [] if nothing found for a category\n` +
                `- Keep each item concise — one fact per string\n` +
                `- ALL values must be in English regardless of the conversation language`,
        },
        {
            role:    "user" as const,
            content: `Extract user information from this conversation transcript:\n\n${rollingSummary}`,
        },
    ];
 
    try {
        const raw   = await completeLLM(messages);
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean) as UserMemory;
 
        // Validate expected keys exist
        const memory: UserMemory = {
            interests: Array.isArray(parsed.interests) ? parsed.interests : [],
            facts:     Array.isArray(parsed.facts)     ? parsed.facts     : [],
            mood:      typeof parsed.mood === "string"  ? parsed.mood      : "neutral",
            other:     Array.isArray(parsed.other)      ? parsed.other     : [],
        };
 
        console.log(
            `[MemoryService] Extracted  userId=${userId}  ` +
            `interests=${memory.interests.length}  facts=${memory.facts.length}  ` +
            `mood=${memory.mood}  other=${memory.other.length}`
        );
 
        return memory;
 
    } catch (err) {
        console.error(`[MemoryService] Extraction failed  userId=${userId}  err=${(err as Error).message}`);
        return EMPTY_MEMORY;
    }
}
 

export async function processSessionMemories(
    userId:         string,
    sessionId:      string,
    rollingSummary: string
): Promise<void> {
    if (!rollingSummary.trim()) {
        console.log(`[MemoryService] No summary to process  userId=${userId}`);
        return;
    }

    try {
        const memories = await extractMemories(userId, rollingSummary);
        await saveSessionSummary(sessionId, userId, rollingSummary, memories);
    } catch (err) {
        console.error(`[MemoryService] processSessionMemories failed  userId=${userId}  err=${(err as Error).message}`);
        await saveSessionSummary(sessionId, userId, rollingSummary, EMPTY_MEMORY);
    }
}

/**
 * extractMemoriesWithLLM
 *
 * Uses your existing LLM (Groq/Sarvam via completeLLM) to extract
 * structured memories from the rolling summary.
 * Returns a flat string[] — one memory per item.
 */
async function extractMemoriesWithLLM(
    userId:         string,
    rollingSummary: string
): Promise<string[]> {
    const messages = [
        {
            role:    "system" as const,
            content:
                `You extract user facts and memories from a conversation summary. ` +
                `Respond ONLY with a valid JSON array of strings. No explanation, no markdown, no backticks. ` +
                `Each string is one concise memory or fact about the user. ` +
                `Example: ["Likes cricket", "Lives in Mumbai", "Prefers Hindi", "Has a sister"]`,
        },
        {
            role:    "user" as const,
            content: `Extract memories from this conversation summary:\n\n${rollingSummary}`,
        },
    ];
 
    try {
        const raw   = await completeLLM(messages);
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean) as string[];
 
        if (!Array.isArray(parsed)) throw new Error("Response is not an array");
 
        console.log(`[MemoryService] LLM extracted ${parsed.length} memories  userId=${userId}`);
        return parsed;
 
    } catch (err) {
        console.error(`[MemoryService] LLM extraction failed  userId=${userId}  err=${(err as Error).message}`);
        return [];
    }
}
 

// async function extractMemoriesWithMem0(
//     userId:         string,
//     rollingSummary: string
// ): Promise<string[]> {
//     const mem0 = getMem0Client();
 
//     // Step 1 — Feed summary to Mem0 for extraction
//     await mem0.add(
//         [{ role: "user", content: rollingSummary }],
//         { user_id: userId }
//     );
//     console.log(`[MemoryService] Summary added to Mem0  userId=${userId}`);
 
//     // Step 2 — Fetch all extracted memories
//     const result   = await mem0.getAll({ user_id: userId });
//     const memories = (result as Array<{ memory: string }>).map((m) => m.memory);
//     console.log(`[MemoryService] Mem0 extracted ${memories.length} memories  userId=${userId}`);
 
//     // Step 3 — Delete from Mem0 (we store in Supabase ourselves)
//     await mem0.deleteAll({ user_id: userId });
//     console.log(`[MemoryService] Mem0 cleaned up  userId=${userId}`);
 
//     return memories;
// }