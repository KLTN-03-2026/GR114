// scripts/testQuery.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index("legai-index");
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    const cauHoi = "Bao nhiêu tuổi thì được kết hôn?"; // Thử hỏi một câu trong data của bạn
    console.log(`🔎 Đang hỏi thử: "${cauHoi}"`);

    // 1. Biến câu hỏi thành vector
    const result = await model.embedContent(cauHoi);
    const vector = Array.from(result.embedding.values);

    // 2. Tìm trên Pinecone
    const queryResponse = await index.query({
        vector: vector,
        topK: 2,
        includeMetadata: true
    });

    // 3. In kết quả
    console.log("\n✅ KẾT QUẢ TỪ CLOUD BAY VỀ:");
    queryResponse.matches.forEach((match, i) => {
        console.log(`--- Kết quả ${i+1} (Độ khớp: ${(match.score * 100).toFixed(2)}%) ---`);
        console.log(`Tiêu đề: ${match.metadata.title}`);
        console.log(`Nội dung: ${match.metadata.text.substring(0, 200)}...`);
        console.log("\n");
    });
}

test().catch(console.error);