/**
 * Test similarity search against the knowledge base
 *
 * Usage:
 *   npx ts-node scripts/testSearch.ts "your search query here"
 *
 * Examples:
 *   npx ts-node scripts/testSearch.ts "What is Cognitive Behavioral Therapy?"
 *   npx ts-node scripts/testSearch.ts "How does mindfulness reduce anxiety?"
 *   npx ts-node scripts/testSearch.ts "Tell me about DBT skills"
 */

import "dotenv/config";
import { embedText } from "../services/embedding";
import { searchDocuments } from "../services/knowledgeBaseService";

async function main() {
    const query = process.argv.slice(2).join(" ").trim();

    if (!query) {
        console.log("❌ Please provide a search query");
        console.log("\nUsage:");
        console.log('  npx ts-node scripts/testSearch.ts "What is CBT?"');
        process.exit(1);
    }

    try {
        console.log(`🔍 Searching: "${query}"\n`);

        // Step 1: Embed the query
        console.log("Embedding query...");
        const queryEmbedding = await embedText(query);
        console.log(`✓ Query embedded (${queryEmbedding.length} dimensions)\n`);

        // Step 2: Search
        console.log("Searching knowledge base...");
        const results = await searchDocuments(queryEmbedding, 5, 0.75);   // Lowered threshold a bit for testing

        if (!results || results.length === 0) {
            console.log("⚠️ No matching documents found.");
            process.exit(0);
        }

        console.log(`✅ Found ${results.length} relevant results:\n`);

        results.forEach((result: any, idx: number) => {
            const similarityPercent = (result.similarity * 100).toFixed(1);
            console.log(`${idx + 1}. [${similarityPercent}%] ${result.metadata?.source || 'Unknown source'}`);
            console.log(`   ${result.content.substring(0, 180)}...`);
            console.log("─".repeat(90));
        });

    } catch (error: any) {
        console.error("❌ Search failed:");
        console.error(error.message || error);
        process.exit(1);
    }
}

main();