// src/services/ragService.js - PHIÊN BẢN FINAL (Đọc tất cả JSON + Contracts)
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { HierarchicalNSW } = require('../utils/simpleVectorStore');

// --- THƯ VIỆN ĐỌC FILE ---
let pdf, mammoth;
try {
    pdf = require('pdf-parse');
    mammoth = require('mammoth');
} catch (e) {
    console.log("⚠️ Chưa cài pdf-parse/mammoth, sẽ bỏ qua file PDF/Word.");
}

// --- CẤU HÌNH ---
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'contracts');
const VECTOR_STORE_PATH = path.join(DATA_DIR, 'vector_store.json');

const VECTOR_SIZE = 384;
const TOP_K = 5;
const MAX_ELEMENTS = 100000;

let vectorIndex = null;
let documentMap = {};
let embeddingModel = null;

// --- 1. MODEL AI ---
const initEmbeddingModel = async () => {
    if (!embeddingModel) {
        const { env, pipeline } = await import('@xenova/transformers');
        env.useBrowserCache = false;
        embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✅ Model AI đã sẵn sàng');
    }
};

const createEmbedding = async (text) => {
    if (!embeddingModel) await initEmbeddingModel();
    // Cắt ngắn text nếu quá dài để tránh lỗi model
    const truncatedText = text.length > 2000 ? text.substring(0, 2000) : text;
    const result = await embeddingModel(truncatedText, { pooling: 'mean', normalize: true });
    return result.data;
};

// --- 2. ĐỌC TẤT CẢ FILE JSON (Cũ + Mới) ---
const loadAllJsonData = async () => {
    const documents = [];
    try {
        if (!fsSync.existsSync(DATA_DIR)) return [];
        const files = await fs.readdir(DATA_DIR);
        // Chỉ lấy file .json và trừ file não ra
        const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('vector_store'));

        console.log(`📂 Tìm thấy ${jsonFiles.length} file dữ liệu JSON:`, jsonFiles);

        for (const file of jsonFiles) {
            try {
                const filePath = path.join(DATA_DIR, file);
                const content = await fs.readFile(filePath, 'utf8');
                const data = JSON.parse(content);
                let count = 0;

                // Mảng chứa các key có thể có trong file cũ và mới
                const possibleKeys = [data.legaldocuments, data.laws, data.articles, data.data];

                possibleKeys.forEach(arr => {
                    if (Array.isArray(arr)) {
                        arr.forEach(doc => {
                            let title = doc.title || doc.name || "Tài liệu không tên";
                            let body = doc.content || doc.text || doc.body || "";

                            // Làm sạch HTML tag
                            let cleanContent = body.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

                            if (cleanContent.length > 0) {
                                documents.push({
                                    title: title,
                                    content: cleanContent,
                                    fullText: `Văn bản: ${title}. Nội dung: ${cleanContent}`,
                                    source: file
                                });
                                count++;
                            }
                        });
                    }
                });

                // Xử lý FAQs (nếu có)
                if (Array.isArray(data.faqs)) {
                    data.faqs.forEach(faq => {
                        documents.push({
                            title: faq.question,
                            content: faq.answer,
                            fullText: `Câu hỏi: ${faq.question}. Trả lời: ${faq.answer}`,
                            source: file
                        });
                        count++;
                    });
                }
                console.log(`   + Đã nạp ${count} mục từ file ${file}`);

            } catch (err) {
                console.error(`   ❌ Lỗi đọc file ${file} (có thể sai format):`, err.message);
            }
        }
    } catch (error) {
        console.error("❌ Lỗi quét thư mục data:", error);
    }
    return documents;
};

// --- 3. ĐỌC FILE UPLOADS (CONTRACTS) ---
const loadContracts = async () => {
    const documents = [];
    if (!fsSync.existsSync(UPLOADS_DIR)) return [];

    try {
        const files = await fs.readdir(UPLOADS_DIR);
        console.log(`📂 Đang quét thư mục contracts: ${files.length} file...`);

        for (const file of files) {
            const filePath = path.join(UPLOADS_DIR, file);
            const ext = path.extname(file).toLowerCase();
            let content = '';

            try {
                if (ext === '.pdf' && pdf) {
                    const dataBuffer = await fs.readFile(filePath);
                    const pdfData = await pdf(dataBuffer);
                    content = pdfData.text;
                } else if (ext === '.docx' && mammoth) {
                    const result = await mammoth.extractRawText({ path: filePath });
                    content = result.value;
                } else if (ext === '.txt') {
                    content = await fs.readFile(filePath, 'utf8');
                }

                if (content && content.trim().length > 0) {
                    documents.push({
                        title: `Hợp đồng: ${file}`,
                        content: content.replace(/\s+/g, ' ').trim(),
                        fullText: `Tài liệu hợp đồng: ${file}. ${content.replace(/\s+/g, ' ').trim()}`,
                        source: file
                    });
                }
            } catch (e) { console.log(`   ⚠️ Bỏ qua file lỗi ${file}: ${e.message}`); }
        }
    } catch (e) { console.log("Lỗi đọc contracts:", e.message); }
    return documents;
};

// --- 4. CHUẨN BỊ & VECTOR HÓA ---
const prepareDocuments = async () => {
    let allDocs = [];

    // Gộp tất cả nguồn dữ liệu
    const jsonDocs = await loadAllJsonData();
    const contractDocs = await loadContracts();
    allDocs = [...jsonDocs, ...contractDocs];

    console.log(`📚 TỔNG CỘNG: ${allDocs.length} tài liệu thô.`);

    const finalChunks = [];
    let docIndex = 0;

    // Cắt nhỏ văn bản (Chunking)
    allDocs.forEach(doc => {
        const chunks = chunkText(doc.fullText, 1000, 200);
        chunks.forEach((chunk, i) => {
            const newDoc = {
                id: `id-${docIndex}`,
                title: doc.title,
                content: chunk,
                sourceUrl: doc.source
            };
            documentMap[docIndex] = newDoc;
            finalChunks.push(newDoc);
            docIndex++;
        });
    });

    console.log(`✅ Đã cắt thành ${finalChunks.length} đoạn nhỏ để học.`);
    return finalChunks;
};

const chunkText = (text, chunkSize, overlap) => {
    if (!text || text.length <= chunkSize) return [text];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.substring(start, end));
        start = end - overlap;
        if (text.length - start < chunkSize / 2) { chunks[chunks.length - 1] += text.substring(start); break; }
    }
    return chunks;
};

// --- 5. HÀM CHÍNH: TẠO/NẠP VECTOR STORE ---
const createVectorStore = async (forceRetrain = false) => {
    // Nếu không bắt buộc học lại, thử load file cũ
    if (!forceRetrain) {
        try {
            if (fsSync.existsSync(VECTOR_STORE_PATH)) {
                console.log("🧠 Đang nạp 'Bộ não' từ ổ cứng...");
                const data = JSON.parse(await fs.readFile(VECTOR_STORE_PATH, 'utf8'));
                documentMap = data.documentMap;
                vectorIndex = new HierarchicalNSW('cosine', VECTOR_SIZE);
                vectorIndex.initIndex(MAX_ELEMENTS);
                vectorIndex.fromJSON(data.indexData);
                console.log("⚡ Khởi động xong (chỉ mất vài giây)!");
                return;
            }
        } catch (e) { console.log("⚠️ File save lỗi hoặc không khớp, sẽ học lại."); }
    }

    // Quy trình học lại từ đầu
    console.log("🔄 Bắt đầu học toàn bộ dữ liệu (quá trình này sẽ mất thời gian)...");
    vectorIndex = null;
    documentMap = {};

    const documents = await prepareDocuments();
    if (documents.length === 0) {
        console.log("⚠️ CẢNH BÁO: Không tìm thấy dữ liệu nào để học!");
        return;
    }

    if (!embeddingModel) await initEmbeddingModel();

    vectorIndex = new HierarchicalNSW('cosine', VECTOR_SIZE);
    vectorIndex.initIndex(MAX_ELEMENTS);

    console.log(`🚀 Đang vector hóa...`);
    for (let i = 0; i < documents.length; i++) {
        try {
            const embedding = await createEmbedding(documents[i].content);
            vectorIndex.addPoint(embedding, i);
            if ((i + 1) % 100 === 0) process.stdout.write(`\rTiến độ: ${i + 1}/${documents.length}`);
        } catch (e) { }
    }
    console.log("\n✅ Học xong!");

    // Lưu lại bộ não
    try {
        await fs.writeFile(VECTOR_STORE_PATH, JSON.stringify({
            documentMap, indexData: vectorIndex.toJSON()
        }), 'utf8');
        console.log("💾 Đã lưu bộ não thành công.");
    } catch (e) { console.log("Lỗi lưu file:", e.message); }
};

const query = async (queryText, k = TOP_K) => {
    if (!vectorIndex) await createVectorStore();
    const queryEmbedding = await createEmbedding(queryText);
    const result = vectorIndex.searchKnn(queryEmbedding, k);
    return result.neighbors.map(index => documentMap[index]);
};

module.exports = { createVectorStore, query };