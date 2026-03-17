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
    
    const pathOld = path.join(__dirname, '../src/data/legal_data_old.json');
    const pathNew = path.join(__dirname, '../src/data/legal_data.json');
    let allDocs = [];

    if (fs.existsSync(pathOld)) {
        const parsedOld = JSON.parse(fs.readFileSync(pathOld, 'utf-8'));
        if (parsedOld.legaldocuments) {
            const docsOld = parsedOld.legaldocuments;
            docsOld.forEach(d => d._source = 'OLD'); 
            allDocs = allDocs.concat(docsOld);
        }
    }

    if (fs.existsSync(pathNew)) {
        const parsedNew = JSON.parse(fs.readFileSync(pathNew, 'utf-8'));
        if (parsedNew.legaldocuments) {
            const docsNew = parsedNew.legaldocuments;
            docsNew.forEach(d => d._source = 'NEW');
            allDocs = allDocs.concat(docsNew);
        }
    }

    if (allDocs.length === 0) return console.error("❌ Không tìm thấy dữ liệu!");

    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    
    let vectorBatch = []; // Mảng chứa tạm 50 vector
    let totalUploaded = 0; // Đếm tổng số đã lên mây
    let apiCallCount = 0;

    for (let d = 0; d < allDocs.length; d++) {
        const doc = allDocs[d];
        let cleanContent = stripHTML(doc.content || "");
        const finalChunks = chunkText(cleanContent);

        for (let i = 0; i < finalChunks.length; i++) {
            const textChunk = finalChunks[i];
            if (textChunk.length < 50) continue; 

            console.log(`⏳ Nhúng: [${doc._source}] Doc ${d} - Đoạn ${i+1}/${finalChunks.length}`);
            
            try {
                const result = await embedModel.embedContent(textChunk);
                
                vectorBatch.push({
                    id: `doc_${String(doc.id || d)}_chunk_${i}`,
                    values: result.embedding.values,
                    metadata: {
                        title: doc.title || "Không có tiêu đề",
                        document_type: doc.document_type || "Văn bản",
                        source_url: doc.source_url || "Không có link",
                        content: textChunk 
                    }
                });

                apiCallCount++;

                // BẮN LÊN PINECONE NGAY KHI ĐỦ 50 VECTOR
                if (vectorBatch.length >= 50) {
                    console.log(`\n📤 Đang đẩy lô 50 vector lên Pinecone...`);
                    await index.upsert(vectorBatch);
                    totalUploaded += vectorBatch.length;
                    console.log(`✅ Thành công! Tổng cộng đã lên mây: ${totalUploaded} vectors.`);
                    vectorBatch = []; // Xóa mảng tạm để nhúng lô mới
                }

            } catch (error) {
                console.error(`❌ Lỗi nhúng:`, error.message);
                // Nếu dính lỗi 429 Quota, dừng toàn bộ chương trình luôn để bảo toàn data
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

    // Đẩy nốt số vector lẻ còn sót lại (chưa đủ 50) lên Pinecone
    if (vectorBatch.length > 0) {
        console.log(`\n📤 Đang đẩy lô cuối cùng (${vectorBatch.length} vector)...`);
        await index.upsert(vectorBatch);
        totalUploaded += vectorBatch.length;
    }

    console.log(`🎉 HOÀN TẤT! Đã đẩy thành công tổng cộng ${totalUploaded} vectors lên Pinecone.`);
}

migrateData().catch(console.error);