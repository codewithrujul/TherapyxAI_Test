// test-embedding.ts
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

async function testEmbedding() {
    console.log("🔍 Testing Gemini Embedding...\n");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY is not set in .env");
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });

    const testText = "Cognitive Behavioral Therapy is a form of psychotherapy that helps people change negative thinking patterns.";

    try {
        console.log("Sending single text to gemini-embedding-001...");

        const response = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: testText,
            config: {
                taskType: "RETRIEVAL_DOCUMENT",
                outputDimensionality: 1536,
            },
        });

        const embeddings = response?.embeddings || [];
        console.log(`✅ Response received!`);

        if (embeddings.length > 0) {
            const firstEmbedding = embeddings[0];
            const values = firstEmbedding?.values;

            if (values && Array.isArray(values)) {
                console.log(`✅ Success! Embedding generated with ${values.length} dimensions`);
                console.log(`First 10 values:`, values.slice(0, 10));
                console.log(`Last 5 values:`, values.slice(-5));
            } else {
                console.error("❌ No .values found in embedding object");
                console.log("Response structure:", JSON.stringify(firstEmbedding, null, 2));
            }
        } else {
            console.error("❌ No embeddings in response");
            console.log("Full response:", response);
        }

    } catch (error: any) {
        console.error("❌ Embedding test failed:");
        console.error(error.message || error);
        if (error.stack) console.error(error.stack);
    }
}

testEmbedding();