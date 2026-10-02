import { GoogleGenAI } from "@google/genai";

export interface EmbeddingProvider {
    embed(text: string, taskType?: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT"): Promise<number[]>;
    embedBatch(texts: string[], taskType?: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT"): Promise<number[][]>;
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
    private client: GoogleGenAI;
    private modelName = "gemini-embedding-001";
    private readonly targetDimension = 768;
    private readonly MAX_BATCH_SIZE = 20;   // Safe for your use case

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY must be set in .env");
        this.client = new GoogleGenAI({ apiKey });
    }

    async embed(text: string, taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_QUERY"): Promise<number[]> {
        const [embedding] = await this.embedBatch([text], taskType);
        return embedding;
    }

    async embedBatch(texts: string[], taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_DOCUMENT"): Promise<number[][]> {
        if (texts.length === 0) return [];

        const results: number[][] = [];
        const batchSize = this.MAX_BATCH_SIZE;

        console.log(`[Embedding] Processing ${texts.length} texts  taskType=${taskType}  batches=${Math.ceil(texts.length / batchSize)}`);

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;

            console.log(`[Embedding] → Batch ${batchNum} (${batch.length} chunks)`);

            try {
                const response = await this.client.models.embedContent({
                    model: this.modelName,
                    contents: batch,
                    config: {
                        taskType,
                        outputDimensionality: this.targetDimension,
                    },
                });

                const embList = response?.embeddings || [];

                if (embList.length !== batch.length) {
                    throw new Error(`Mismatch: expected ${batch.length}, got ${embList.length}`);
                }

                for (const item of embList) {
                    const values = item?.values;

                    if (!values || !Array.isArray(values)) {
                        throw new Error("Invalid embedding values received");
                    }

                    let embedding = Array.from(values) as number[];

                    // Normalize (recommended for 1536 dims)
                    if (this.targetDimension < 3072) {
                        const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
                        if (norm > 0) {
                            embedding = embedding.map(v => v / norm);
                        }
                    }

                    results.push(embedding);
                }

                // Small delay between batches
                if (i + batchSize < texts.length) {
                    await new Promise(r => setTimeout(r, 300));
                }

            } catch (err: any) {
                console.error(`❌ Batch ${batchNum} failed:`, err.message || err);
                throw err;
            }
        }

        console.log(`[Embedding] ✓ Successfully generated ${results.length} embeddings`);
        return results;
    }
}

// ─── OPT-2: In-process LRU embedding cache ───────────────────────────────────
const EMBED_CACHE_MAX = 200;
const embedCache = new Map<string, number[]>();

function cacheKey(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}
function cacheGet(key: string): number[] | undefined {
    return embedCache.get(key);
}
function cacheSet(key: string, val: number[]): void {
    if (embedCache.size >= EMBED_CACHE_MAX) {
        // Evict oldest entry (Map preserves insertion order)
        embedCache.delete(embedCache.keys().next().value!);
    }
    embedCache.set(key, val);
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let embeddingProvider: EmbeddingProvider | null = null;

export const getEmbeddingProvider = (): EmbeddingProvider => {
    if (!embeddingProvider) {
        embeddingProvider = new GeminiEmbeddingProvider();
    }
    return embeddingProvider;
};

// For search queries (runtime) — use RETRIEVAL_QUERY, with LRU cache
export const embedText = async (text: string): Promise<number[]> => {
    const key = cacheKey(text);
    const cached = cacheGet(key);
    if (cached) {
        console.log(`[Embedding] Cache hit — 0ms`);
        return cached;
    }
    const result = await getEmbeddingProvider().embed(text, "RETRIEVAL_QUERY");
    cacheSet(key, result);
    return result;
};

// For ingestion — use RETRIEVAL_DOCUMENT
export const embedTexts = async (texts: string[]): Promise<number[][]> =>
    getEmbeddingProvider().embedBatch(texts, "RETRIEVAL_DOCUMENT");

// ─── OPT-5: Warmup Gemini TLS connection on auth ─────────────────────────────
// Fire-and-forget on user auth so the first real embed call doesn't pay the
// TLS handshake cost (~100–200ms).
export async function warmupEmbeddingConnection(): Promise<void> {
    if (process.env.ENABLE_RAG !== "true") return;  // skip if RAG is off
    try {
        await getEmbeddingProvider().embed("warmup", "RETRIEVAL_QUERY");
        console.log("[Embedding] Warmup complete");
    } catch {
        /* non-fatal — warmup failure is fine */
    }
}