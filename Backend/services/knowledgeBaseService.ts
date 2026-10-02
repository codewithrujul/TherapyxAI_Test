import { supabaseAdmin } from "../db/supabaseClient";
import { embedTexts } from "./embedding";

export interface Document {
    id?: string;
    content: string;
    metadata?: Record<string, any>;
}

export interface IngestOptions {
    chunkSize?: number;
    overlapSize?: number;
    batchSize?: number;
}

const DEFAULT_CHUNK_SIZE = 600;     // Slightly larger chunks for better context
const DEFAULT_OVERLAP_SIZE = 80;
const DEFAULT_INGEST_BATCH_SIZE = 20;

export function chunkText(
    text: string,
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    overlapSize: number = DEFAULT_OVERLAP_SIZE
): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const chunk = text.substring(start, end).trim();
        
        if (chunk.length > 10) {
            chunks.push(chunk);
        }

        // If we've reached the end, stop
        if (end >= text.length) break;

        // Move forward by (chunkSize - overlapSize)
        start += chunkSize - overlapSize;
    }

    return chunks;
}

/**
 * Ingest documents → chunk → embed → insert
 */
export async function ingestDocuments(
    documents: Document[],
    options: IngestOptions = {}
) {
    const opts = {
        chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE,
        overlapSize: options.overlapSize ?? DEFAULT_OVERLAP_SIZE,
        batchSize: options.batchSize ?? DEFAULT_INGEST_BATCH_SIZE,
    };

    console.log(`[KB] Starting ingestion of ${documents.length} documents...`);

    let totalChunks = 0;
    let insertedRows = 0;
    const pendingRows: any[] = [];

    const flushBatch = async () => {
        if (pendingRows.length === 0) return;

        console.log(`[KB] Embedding + inserting batch of ${pendingRows.length} chunks...`);

        const contents = pendingRows.map(r => r.content);
        const embeddings = await embedTexts(contents);   // Now safely batched inside

        const batchToInsert = pendingRows.map((row, i) => ({
            content: row.content,
            metadata: row.metadata || {},
            embedding: embeddings[i],
        }));

        const { error, count } = await supabaseAdmin
            .from("therapy_docs")
            .insert(batchToInsert);

        if (error) throw new Error(`Insert error: ${error.message}`);

        insertedRows += count ?? batchToInsert.length;
        pendingRows.length = 0;
    };

    console.log(`[KB] Processing ${documents.length} documents with chunking (size: ${opts.chunkSize}, overlap: ${opts.overlapSize})...`);
    // Chunking loop
    for (const doc of documents) {
        const chunks = chunkText(doc.content, opts.chunkSize, opts.overlapSize);
        console.log(`  └─ ${doc.content.substring(0, 70)}... → ${chunks.length} chunks`);
        for (const chunk of chunks) {
            pendingRows.push({
                content: chunk.trim(),
                metadata: doc.metadata || {},
            });
            totalChunks++;

            if (pendingRows.length >= opts.batchSize) {
                await flushBatch();
            }
        }
    }

    await flushBatch();   // Final flush

    console.log(`[KB] ✓ Successfully ingested ${insertedRows} rows (${totalChunks} total chunks)`);
    return { count: insertedRows };
}
/**
 * Search therapy docs by similarity
 */
export async function searchDocuments(
    queryEmbedding: number[],
    matchCount: number = 10,
    threshold: number = 0.7   // Default threshold - good starting point
) {
    const { data, error } = await supabaseAdmin.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_count: matchCount,
        threshold,
    });

    if (error) {
        console.error("Supabase RPC error:", error);
        throw new Error(`Search failed: ${error.message}`);
    }

    return data || [];
}
/**
 * Clear all therapy docs (WARNING: destructive)
 */
export async function clearDocuments() {
    console.log(`[KB] ⚠️  Clearing all documents from therapy_docs...`);

    // Safe way: delete everything using a always-true filter
    const { error } = await supabaseAdmin
        .from("therapy_docs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");  // Dummy UUID that never matches

    if (error) {
        console.error(`[KB] Clear failed:`, error.message);
        throw new Error(`[KB] Clear failed: ${error.message}`);
    }

    console.log(`[KB] ✓ All documents cleared successfully`);
}

export async function getDocumentCount() {
    const { count, error } = await supabaseAdmin
        .from("therapy_docs")
        .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count || 0;
}