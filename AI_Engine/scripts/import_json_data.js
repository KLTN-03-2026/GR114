const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); 

const { sql, poolConnect, pool } = require('../src/config/db'); 
const { Pinecone } = require('@pinecone-database/pinecone');

// --- 1. KHỞI TẠO TRỰC TIẾP GEMINI EMBEDDING ---
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// --- HÀM MỚI: TẨY DẤU TIẾNG VIỆT CHO PINECONE ID ---
const toAsciiId = (str) => {
    if (!str) return 'doc';
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu
        .replace(/đ/g, "d").replace(/Đ/g, "D") // Đổi chữ đ thành d
        .replace(/[^a-zA-Z0-9_-]/g, "-"); // Chỉ giữ lại chữ không dấu, số, gạch nối
};

const cleanMarkdown = (text) => {
    if (!text) return "";
    return text.replace(/<br>/gi, '\n')              
               .replace(/\| --- \|/g, '')            
               .replace(/\|/g, '')                   
               .replace(/(\*\*|\*|#|__|_)/g, '')     
               .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') 
               .replace(/\n{3,}/g, '\n\n')           
               .trim();
};

const smartChunk = (content) => {
    if (!content) return [];
    const chunks = [];
    const chunkSize = 1500; const overlap = 200;
    let start = 0; const max = content.length;
    while (start < max) {
        const end = Math.min(start + chunkSize, max);
        if (end <= start) break;
        const text = String(content.slice(start, end)).trim();
        if (text.length > 0) chunks.push({ text });
        if (end === max) break;
        start = end - overlap;
        if (start < 0) start = 0;
        if (start >= end) start = end;
    }
    return chunks;
};

const importData = async () => {
    try {
        console.log("⏳ Bắt đầu kết nối Database...");
        await poolConnect;

        const dataPath = path.join(__dirname, '../data', 'raw_data.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const laws = JSON.parse(rawData);
        
        console.log(`📂 Đã tải ${laws.length} văn bản từ raw_data.json.`);
        const indexName = process.env.PINECONE_INDEX_NAME || 'legai-index';
        const index = pc.index(indexName);

        let count = 0;

        for (const law of laws) {
            if (law.status !== "Còn hiệu lực") continue;

            const docId = law.id;
            console.log(`\n📌 Đang xử lý: ${docId} - ${law.title.substring(0, 50)}...`);

            // Kiểm tra trùng lặp
            const check = await pool.request().input('id', sql.NVarChar(100), docId).query('SELECT Id FROM LegalDocuments WHERE Id = @id');
            if (check.recordset.length > 0) {
                console.log(`⏩ Đã tồn tại trong DB. Bỏ qua.`);
                continue;
            }

            const cleanContent = cleanMarkdown(law.content);

            // BƯỚC A: LƯU VÀO SQL SERVER
            await pool.request()
                .input('id', sql.NVarChar(100), docId)
                .input('title', sql.NVarChar(500), law.title)
                .input('docNum', sql.NVarChar(100), law.documentNumber || 'Chưa cập nhật')
                .input('year', sql.Int, typeof law.issueYear === 'number' ? law.issueYear : 2026)
                .input('status', sql.NVarChar(50), law.status)
                .input('category', sql.NVarChar(100), law.category || 'Lĩnh vực khác')
                .input('content', sql.NVarChar(sql.MAX), cleanContent)
                .input('url', sql.NVarChar(1000), law.sourceUrl || '')
                .input('createdAt', sql.DateTime2, new Date(law.createdAt || Date.now()))
                .query(`
                    INSERT INTO dbo.LegalDocuments 
                    (Id, Title, DocumentNumber, IssueYear, Status, Category, Content, SourceUrl, CreatedAt, SyncStatusSsms, SyncStatusPinecone)
                    VALUES (@id, @title, @docNum, @year, @status, @category, @content, @url, @createdAt, 'success', 'pending')
                `);

            // BƯỚC B: TẠO VECTOR VÀ ĐẨY LÊN PINECONE
            const chunkData = smartChunk(cleanContent);
            const vectors = [];
            const safeVectorId = toAsciiId(docId); // <--- TẠO ID KHÔNG DẤU CHO PINECONE

            for (let chunkIdx = 0; chunkIdx < chunkData.length; chunkIdx++) {
                try {
                    const embedResult = await embedModel.embedContent(chunkData[chunkIdx].text);
                    vectors.push({
                        id: `${safeVectorId}_chunk_${chunkIdx}`, // <--- DÙNG ID SẠCH Ở ĐÂY
                        values: Array.from(embedResult.embedding.values).map(Number),
                        metadata: {
                            doc_id: docId, // Vẫn giữ lại docId có dấu trong metadata để sau này truy vấn SQL
                            title: law.title,
                            doc_type: 'law',
                            text: chunkData[chunkIdx].text,
                            chunk_length: chunkData[chunkIdx].text.length,
                            text_preview: chunkData[chunkIdx].text.substring(0, 300),
                            source: law.sourceUrl || ''
                        }
                    });
                    await new Promise(r => setTimeout(r, 400));
                } catch (e) {
                    if (e.message && e.message.includes('429')) {
                        console.log(`⏳ Quá tải Gemini, nghỉ 30s...`);
                        await new Promise(r => setTimeout(r, 30000));
                        chunkIdx--; continue;
                    } else {
                        console.error(`❌ Lỗi vector chunk ${chunkIdx}:`, e.message);
                    }
                }
            }

            // BƯỚC C: CHỐT HẠ
            if (vectors.length > 0) {
                for (let j = 0; j < vectors.length; j += 50) {
                    await index.upsert(vectors.slice(j, j + 50));
                }
                
                await pool.request().input('id', sql.NVarChar(100), docId)
                    .query("UPDATE LegalDocuments SET SyncStatusPinecone = 'success' WHERE Id = @id");

                console.log(`✅ Hoàn tất lưu DB & Pinecone!`);
                count++;
            } else {
                console.log(`⚠️ Đã lưu DB nhưng Pinecone THẤT BẠI do không tạo được vector!`);
            }
        }

        console.log(`\n🎉 XUẤT SẮC! Đã nạp thành công ${count} văn bản hoàn chỉnh vào hệ thống LegAI.`);
        process.exit(0);

    } catch (err) {
        console.error("❌ LỖI NGHIÊM TRỌNG:", err);
        process.exit(1);
    }
};

importData();