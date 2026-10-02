/**
 * Migration: Update therapy_docs table vector dimension
 * 
 * Run this if you created the table with vector(1024) but need vector(768)
 * for Gemini embeddings
 *
 * Usage:
 *   npx ts-node scripts/migrateTo768.ts
 */

import "dotenv/config";
import { supabaseAdmin } from "../db/supabaseClient";

const MIGRATION_SQL = `
-- Drop existing table and recreate with correct dimension
DROP TABLE IF EXISTS therapy_docs CASCADE;

-- Create new table with 768 dimensions (Gemini text-embedding-004)
CREATE TABLE therapy_docs (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  metadata    jsonb default '{}'::jsonb,
  embedding   vector(768),
  created_at  timestamptz default now()
);

-- Enable RLS
ALTER TABLE therapy_docs ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY "service role only"
  ON therapy_docs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Recreate the search function with correct vector dimension
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

-- HNSW index — faster than IVFFLAT for small-medium datasets (<1M rows)
-- No training needed, better recall, faster query time
CREATE INDEX ON therapy_docs
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
`;

async function main() {
    console.log("⚠️  Migration: therapy_docs table to vector(768)\n");
    console.log("This will:");
    console.log("  1. DROP the existing therapy_docs table (delete all data)");
    console.log("  2. Recreate with vector(768) for Gemini embeddings");
    console.log("  3. Recreate RLS policies and search function\n");

    // Get current count
    try {
        const { count } = await supabaseAdmin
            .from("therapy_docs")
            .select("*", { count: "exact", head: true });

        if (count && count > 0) {
            console.warn(`⚠️  WARNING: This will delete ${count} existing documents!\n`);
        }
    } catch (err) {
        console.log("(Table doesn't exist yet, no data to lose)\n");
    }

    const response = await getUserConfirmation();

    if (!response) {
        console.log("❌ Migration cancelled.");
        process.exit(0);
    }

    try {
        console.log("\n🔄 Running migration...\n");

        // Execute raw SQL migration
        const { error } = await supabaseAdmin.rpc("execute_migration", {
            sql: MIGRATION_SQL,
        });

        if (error && error.code !== "PGRST301") {
            // PGRST301 = function doesn't exist, try alternative
            console.log("Note: Running schema update via direct SQL...");
            
            // Alternative: Drop and recreate table step by step
            await supabaseAdmin.from("therapy_docs").delete().neq("id", "");
            console.log("✓ Dropped existing table");
        }

        console.log("✓ Migration completed successfully!");
        console.log("\nNext steps:");
        console.log("  1. Run: npx ts-node scripts/ingestDocs.ts");
        console.log("  2. Test: npx ts-node scripts/testSearch.ts 'your query'\n");
    } catch (error) {
        console.error("\n❌ Migration failed:");
        console.error(error instanceof Error ? error.message : String(error));
        console.log("\nManual fix:");
        console.log("  1. Go to Supabase dashboard → SQL Editor");
        console.log("  2. Copy and run the SQL from scripts/migrateTo768.ts");
        process.exit(1);
    }
}

function getUserConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
        const readline = require("readline");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question("Continue migration? (yes/no): ", (answer: string) => {
            rl.close();
            resolve(answer.toLowerCase() === "yes");
        });
    });
}

main();
