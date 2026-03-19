require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stripHTML = (htmlString) => {
    if (!htmlString || typeof htmlString !== 'string') return "";
    let text = htmlString.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n');
    text = text.replace(/<[^>]*>?/gm, '');
    return text.replace(/\n\s*\n/g, '\n').trim();
};

const chunkText = (text, maxLength = 800) => {
    const sentences = text.split('\n');
    const chunks = [];
    let currentChunk = "";
    for (let sentence of sentences) {
        sentence = sentence.trim();
        if (!sentence) continue;
        if ((currentChunk.length + sentence.length) > maxLength) {
            chunks.push(currentChunk);
            currentChunk = sentence;
        } else {
            currentChunk += (currentChunk ? " " : "") + sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
};

async function migrateData() {
    console.log("🚀 Bắt đầu tẩy rửa và tải dữ liệu TRỰC TIẾP lên Pinecone...");
    const index = pc.index("legai-index");

    const pathNew = path.join(__dirname, '../src/data/legal_data.json');
    let allDocs = [];

    if (fs.existsSync(pathNew)) {
        const parsedNew = JSON.parse(fs.readFileSync(pathNew, 'utf-8'));
        if (parsedNew.legaldocuments) {
            allDocs = parsedNew.legaldocuments;
        }
    }

    if (allDocs.length === 0) return console.error("❌ Không tìm thấy dữ liệu!");

    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    let vectorBatch = [];
    let totalUploaded = 0;
    let apiCallCount = 0;

    for (let d = 0; d < allDocs.length; d++) {
        const doc = allDocs[d];
        let cleanContent = stripHTML(doc.content || "");
        const finalChunks = chunkText(cleanContent);

        for (let i = 0; i < finalChunks.length; i++) {
            const textChunk = finalChunks[i];
            if (textChunk.length < 50) continue;

            try {
                const result = await embedModel.embedContent(textChunk);

                // 1. TÌM KIẾM VECTOR THẬT SỰ
                let rawValues = result.embedding?.values || result.embedding || [];

                // 2. ÉP KIỂU VỀ MẢNG JAVASCRIPT CHUẨN
                let vectorValues = Array.from(rawValues);

                // 3. KIỂM TRA ĐỘ DÀI SỐNG CÒN (Bắt buộc phải 3072 chiều cho Gemini-Embedding-001)
                if (vectorValues.length !== 3072) {
                    console.error(`❌ CẢNH BÁO: Đoạn ${i} của Doc ${d} sinh ra vector dài ${vectorValues.length} (Kỳ vọng 768). Đã bỏ qua!`);
                    continue;
                }

                vectorBatch.push({
                    id: `doc_${String(doc.id || d)}_chunk_${i}`,
                    values: vectorValues,
                    metadata: {
                        title: String(doc.title || "Không có tiêu đề"),
                        document_type: String(doc.document_type || "Văn bản"),
                        source_url: String(doc.source_url || "Không có link"),
                        text: String(textChunk)
                    }
                });

                process.stdout.write(`\r⏳ Đã chuẩn bị được: ${vectorBatch.length} vector hợp lệ...`);
                apiCallCount++;

                if (vectorBatch.length >= 50) {
                    console.log(`\n📤 Đang đẩy lô 50 vector xịn lên Pinecone...`);
                    // Truyền bản sao chép (shallow copy) để tránh lỗi tham chiếu của thư viện Pinecone
                    await index.upsert({ records: vectorBatch });
                    totalUploaded += vectorBatch.length;
                    console.log(`✅ Thành công! Tổng cộng đã lên mây: ${totalUploaded} vectors.`);
                    vectorBatch = [];
                }

            } catch (error) {
                console.error(`\n❌ Lỗi nhúng ở Doc ${d}:`, error.message);
                if (error.message.includes('429')) {
                    console.log("🛑 Hệ thống báo hết Quota! Dừng kịch bản tại đây.");
                    process.exit(1);
                }
            } finally {
                if (apiCallCount % 10 === 0) {
                    await sleep(3000);
                }
            }
        }
    }

    if (vectorBatch.length > 0) {
        console.log(`\n📤 Đang đẩy lô cuối cùng (${vectorBatch.length} vector)...`);

        // KIỂM TRA LẦN CUỐI TRƯỚC KHI ĐẨY
        console.log(`🔍 [Debug] Dữ liệu mẫu ID 0: ${vectorBatch[0].id}, có ${vectorBatch[0].values.length} chiều.`);

        await index.upsert({ records: vectorBatch });
        totalUploaded += vectorBatch.length;
    }

    console.log(`🎉 HOÀN TẤT! Đã đẩy thành công tổng cộng ${totalUploaded} vectors lên Pinecone.`);
}

migrateData().catch(console.error);