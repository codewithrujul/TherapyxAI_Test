# Knowledge Base Ingestion Guide

This guide walks you through ingesting documents into your Supabase vector database.

## Overview

The ingestion pipeline has three components:

1. **`services/embedding.ts`** — Converts text to embeddings using Google Gemini
2. **`services/knowledgeBaseService.ts`** — Chunks, embeds, and stores documents in Supabase
3. **`scripts/ingestDocs.ts`** — CLI tool to run the ingestion

## Setup

### 1. Verify Vector Dimension

Your `therapy_docs` table needs to match your embedding model's output dimension.

**Current setup:** Google Gemini `text-embedding-004` outputs **768 dimensions**

If you created the table with `vector(1024)` (for Cohere), you have two options:

**Option A: Migrate to 768 dimensions** (Recommended — simpler)
```sql
-- Back up existing data (if any)
CREATE TABLE therapy_docs_backup AS SELECT * FROM therapy_docs;

-- Drop the old table
DROP TABLE therapy_docs CASCADE;

-- Create new table with 768 dimensions
CREATE TABLE therapy_docs (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  metadata    jsonb default '{}'::jsonb,
  embedding   vector(768),
  created_at  timestamptz default now()
);

-- Enable RLS
ALTER TABLE therapy_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only"
  ON therapy_docs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Recreate the search function
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768),
  match_count     int     default 5,
  threshold       float   default 0.75
)
RETURNS TABLE (
  id         uuid,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  FROM therapy_docs
  WHERE 1 - (embedding <=> query_embedding) > threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Recreate the index
CREATE INDEX ON therapy_docs
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Option B: Use Cohere embeddings instead** (More production-ready for multilingual)
If you prefer 1024-dim embeddings, you'll need to:
1. Add Cohere API key to `.env`:
   ```
   COHERE_API_KEY=your-key-here
   ```
2. Update `services/embedding.ts` to use Cohere instead of Gemini

### 2. Install Dependencies

The `@google/generative-ai` package is already in your `package.json`. Ensure dependencies are installed:

```bash
npm install
```

## Usage

### Ingest Sample Documents

Test the system with sample therapy documents:

```bash
npx ts-node scripts/ingestDocs.ts
```

**Output:**
```
🚀 Knowledge Base Ingestion Tool

📊 Current document count...
   Current: 0 documents

📄 Ingesting sample documents...

[KB] Starting ingestion of 5 documents...
[KB] Chunking documents (chunk_size=500)...
  └─ "Cognitive Behavioral Therapy..." → 4 chunks
  └─ "Mindfulness meditation..." → 3 chunks
  └─ "Dialectical Behavior..." → 4 chunks
  └─ "Acceptance and Commitment..." → 4 chunks
  └─ "Psychoeducation is a..." → 3 chunks
[KB] Total chunks to embed: 18
[KB] Embedding 18 chunks...
[KB] Inserting 18 rows into therapy_docs...
[KB] ✓ Successfully ingested 18 rows

✅ Ingestion complete!
   Ingested: 18 rows (5 documents)
   Final count: 18 documents
```

### Clear and Re-ingest

To delete all documents and start fresh:

```bash
npx ts-node scripts/ingestDocs.ts --clear
```

### Check Document Count

```bash
npx ts-node scripts/ingestDocs.ts --count
```

### Test Similarity Search

Once documents are ingested, test retrieval:

```bash
npx ts-node scripts/testSearch.ts "What is cognitive behavioral therapy?"
```

**Output:**
```
🔍 Searching for: "What is cognitive behavioral therapy?"

Embedding query...
Query embedding dimension: 768

Searching documents...
Found 5 matching documents:

1. Similarity: 94.2%
   Content: Cognitive Behavioral Therapy (CBT) is a form of psychotherapy that focuses on modifying dysfunctional thinking and behavior...
   Metadata: {"source":"CBT Guide","category":"therapy_techniques","difficulty":"intermediate"}

2. Similarity: 72.1%
   Content: Psychoeducation is a therapeutic approach that involves teaching clients about mental health...
   ...
```

## Customization

### Ingest Your Own Documents

Edit `scripts/ingestDocs.ts` and replace `SAMPLE_DOCUMENTS`:

```typescript
const MY_DOCUMENTS: Document[] = [
    {
        content: "Your text here...",
        metadata: {
            source: "My Document",
            category: "therapy",
        },
    },
    // ... more documents
];

// Then call:
const result = await ingestDocuments(MY_DOCUMENTS);
```

### Adjust Chunk Size

Larger chunks preserve more context, smaller chunks allow finer-grained search:

```typescript
await ingestDocuments(documents, {
    chunkSize: 1000,      // Default: 500 chars
    overlapSize: 150,     // Default: 50 chars (for context)
});
```

### Change Similarity Threshold

When searching, adjust how strict the similarity filter is:

```typescript
const results = await searchDocuments(
    queryEmbedding,
    5,           // Return top 5 matches
    0.70         // Only return results with >70% similarity
);
```

## Production Considerations

### 1. **Switch to Cohere for Multilingual Support**

For therapy applications serving Indian users (as your setup suggests), Cohere's multilingual model is better:

```bash
npm install cohere-ai
```

Then implement `CoherEmbeddingProvider` in `services/embedding.ts` and use `vector(1024)`.

### 2. **Batch Process Large PDFs**

For 100s of PDFs:
```typescript
import * as fs from "fs";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const loader = new PDFLoader("document.pdf");
const docs = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const chunks = await splitter.splitDocuments(docs);

await ingestDocuments(chunks.map(c => ({ content: c.pageContent, metadata: c.metadata })));
```

### 3. **Add Rate Limiting**

Gemini has rate limits. For large batches, add delays:

```typescript
const embeddings = [];
for (const text of texts) {
    embeddings.push(await embedText(text));
    await new Promise(r => setTimeout(r, 100)); // 100ms delay
}
```

### 4. **Monitor Ingestion Progress**

For 1000+ documents, add progress tracking:

```typescript
let processed = 0;
for (const chunk of chunks) {
    // ... embed and insert
    processed++;
    console.log(`Progress: ${processed}/${chunks.length} (${(processed/chunks.length*100).toFixed(1)}%)`);
}
```

## Troubleshooting

### "No embedding values returned"
- Check GEMINI_API_KEY is set in `.env`
- Verify the text isn't empty
- Check API rate limits (Gemini free tier: 60 requests/min)

### Vector dimension mismatch
- Run the SQL migration above to fix table schema

### Search returns no results
- Check that `--count` shows documents
- Lower the `threshold` parameter in `searchDocuments()`
- Verify the query embedding matches the table dimension

### Node modules not found
```bash
rm package-lock.json
npm install
```

## Next Steps

1. ✅ **Now:** Ingest sample data and test search
2. **Soon:** Integrate search into your chat routes (see below)
3. **Future:** Add PDF ingestion pipeline, schedule batch updates

### Integrate into Chat Routes

Once working, you can enhance your chat with RAG:

```typescript
// In routes/chat.route.ts or controllers/chat.controller.ts
import { embedText, searchDocuments } from "../services/embedding";

export async function chatWithRAG(userQuery: string, conversationId: string) {
    // 1. Search knowledge base
    const queryEmbedding = await embedText(userQuery);
    const relevantDocs = await searchDocuments(queryEmbedding, 3, 0.70);
    
    // 2. Build context
    const context = relevantDocs
        .map(doc => doc.content)
        .join("\n\n");
    
    // 3. Augment LLM prompt
    const systemPrompt = `You are a therapy assistant. Use this context:\n${context}\n\nAnswer the user's question.`;
    
    // 4. Stream response
    return await streamLLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
    ]);
}
```

---

**Ready to ingest?** Run:
```bash
npx ts-node scripts/ingestDocs.ts
```
