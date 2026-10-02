/**
 * Verification script to check if KB setup is correct
 *
 * Usage:
 *   npx ts-node scripts/verifySetup.ts
 */

import "dotenv/config";
import { supabaseAdmin } from "../db/supabaseClient";
import { getEmbeddingProvider } from "../services/embedding";

async function checkEnvironment() {
    console.log("📋 Checking environment variables...\n");

    const required = [
        "SUPABASE_DATABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "GEMINI_API_KEY",
    ];

    let allSet = true;
    for (const key of required) {
        const value = process.env[key];
        if (!value) {
            console.log(`  ❌ ${key}: NOT SET`);
            allSet = false;
        } else {
            const masked = value.substring(0, 10) + "...";
            console.log(`  ✓ ${key}: ${masked}`);
        }
    }

    return allSet;
}

async function checkDatabase() {
    console.log("\n🗄️  Checking Supabase database...\n");

    try {
        // Check if table exists
        const { data, error } = await supabaseAdmin
            .from("therapy_docs")
            .select("*", { count: "exact", head: true });

        if (error) {
            if (error.code === "PGRST116") {
                console.log("  ❌ therapy_docs table NOT FOUND");
                console.log("     Run SQL from INGESTION_GUIDE.md step 1-5 to create it");
                return false;
            }
            throw error;
        }

        const count = data?.length || 0;
        console.log(`  ✓ therapy_docs table exists (${count} rows)`);
    } catch (err) {
        console.log(`  ❌ Database error: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }

    // Check if function exists
    try {
        const { data, error } = await supabaseAdmin.rpc("match_documents", {
            query_embedding: Array(768).fill(0),
            match_count: 1,
            threshold: 0.0,
        });

        if (error && error.code === "PGRST302") {
            console.log("  ⚠️  match_documents function NOT FOUND");
            console.log("     Run SQL from INGESTION_GUIDE.md step 4 to create it");
            return false;
        }

        console.log("  ✓ match_documents function exists");
    } catch (err) {
        console.log(`  ⚠️  Could not verify function: ${err instanceof Error ? err.message : String(err)}`);
    }

    return true;
}

async function checkEmbeddings() {
    console.log("\n🧠 Checking embedding service...\n");

    try {
        const provider = getEmbeddingProvider();
        console.log("  ✓ Embedding provider initialized (Gemini)");

        const embedding = await provider.embed("test");
        console.log(`  ✓ Embedding works (dimension: ${embedding.length})`);

        if (embedding.length !== 768) {
            console.log(`  ⚠️  WARNING: Expected 768 dimensions, got ${embedding.length}`);
            console.log("     Check that therapy_docs table uses vector(${embedding.length})");
            return false;
        }

        return true;
    } catch (err) {
        console.log(
            `  ❌ Embedding error: ${err instanceof Error ? err.message : String(err)}`
        );
        return false;
    }
}

async function main() {
    console.log("🔍 Knowledge Base Setup Verification\n");
    console.log("=====================================\n");

    const envOk = await checkEnvironment();
    const dbOk = await checkDatabase();
    const embeddingOk = await checkEmbeddings();

    console.log("\n=====================================\n");

    if (envOk && dbOk && embeddingOk) {
        console.log("✅ All checks passed! Ready to ingest documents.\n");
        console.log("Next step:");
        console.log("  npx ts-node scripts/ingestDocs.ts\n");
        process.exit(0);
    } else {
        console.log("❌ Some checks failed. See errors above.\n");
        console.log("Troubleshooting:");
        console.log("  1. Check .env file has all required keys");
        console.log("  2. Review INGESTION_GUIDE.md for table setup SQL");
        console.log("  3. Verify Supabase project is accessible\n");
        process.exit(1);
    }
}

main();
