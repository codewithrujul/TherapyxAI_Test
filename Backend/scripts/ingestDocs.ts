/**
 * Knowledge Base Ingestion Script
 *
 * Usage:
 *   npx ts-node scripts/ingestDocs.ts [--clear] [--count]
 *
 * Examples:
 *   npx ts-node scripts/ingestDocs.ts              # Ingest sample therapy KB
 *   npx ts-node scripts/ingestDocs.ts --clear      # Clear + ingest
 *   npx ts-node scripts/ingestDocs.ts --count      # Show current count
 */

import "dotenv/config";
import {
    ingestDocuments,
    clearDocuments,
    getDocumentCount,
} from "../services/knowledgeBaseService";

/**
 * Sample Therapy Knowledge Base Documents
 * You can add more documents here as your KB grows
 */
import { THERAPY_KNOWLEDGE_BASE } from "../core/TherapyKnowledgeBase";

const SAMPLE_DOCUMENTS = THERAPY_KNOWLEDGE_BASE.map(doc => ({
    content: doc.content,
    metadata: doc.metadata
}));

async function main() {
    const args = process.argv.slice(2);
    const shouldClear = args.includes("--clear");
    const shouldCount = args.includes("--count");

    try {
        console.log("🚀 Knowledge Base Ingestion Tool\n");

        const beforeCount = await getDocumentCount();
        console.log(`📊 Current document count: ${beforeCount}\n`);

        if (shouldClear) {
            await clearDocuments();
            console.log("🧹 Database cleared.\n");
        }

        if (shouldCount) {
            console.log(`Final count: ${beforeCount} documents`);
            process.exit(0);
        }

        console.log(`📄 Ingesting ${SAMPLE_DOCUMENTS.length} sample therapy documents...\n`);
        const result = await ingestDocuments(SAMPLE_DOCUMENTS);

        console.log(`\n✅ Ingestion completed successfully!`);
        console.log(`   Chunks ingested : ${result.count}`);
        console.log(`   Total documents now: ${beforeCount + (result.count ?? 0)}\n`);

    } catch (error: any) {
        console.error("\n❌ Ingestion failed:");
        console.error(error.message || error);
        process.exit(1);
    }
}

main();