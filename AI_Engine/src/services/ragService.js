// File: src/services/ragService.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require('@pinecone-database/pinecone');
const SystemConfig = require('../config/SystemConfig');

// Đọc tên index linh hoạt từ file .env, mặc định là legai-index-v2
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "legai-index-v2";
let genAI;
let pc;
let index;
let embedModel;
let currentApiKey = "";

const initCloudServices = () => {
    const activeKey = SystemConfig?.geminiApiKey || process.env.GEMINI_API_KEY;
    // BỌC THÉP: Bốc trực tiếp tên index từ SystemConfig tĩnh đã được load từ DB lên!
    const activeIndexName = SystemConfig?.pineconeIndex || process.env.PINECONE_INDEX_NAME || "legai-index-v2";

    if (!activeKey) {
        console.error("Lỗi Pinecone RAG: Không tìm thấy API Key!");
        return;
    }

    if (!genAI || currentApiKey !== activeKey) {
        genAI = new GoogleGenerativeAI(activeKey);
        embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
        currentApiKey = activeKey;
    }

    // Cập nhật khởi tạo lại Index chuẩn theo DB 
    if (!pc || indexNameWithDB !== activeIndexName) {
        pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || SystemConfig?.pineconeApiKey });
        index = pc.index(activeIndexName);
        indexNameWithDB = activeIndexName; // Tạo một biến toàn cục lưu vết tên index hiện tại
        console.log(` [ĐỒNG BỘ THÀNH CÔNG]: RAG Service đã khóa mục tiêu vào Pinecone Index: ${activeIndexName}`);
    }
};

// 2. Hàm tìm kiếm tri thức pháp luật từ Cloud
const query = async (queryText, k = 5) => {
    try {
        if (!index) initCloudServices();

        console.log(` Đang truy vấn Cloud cho: "${queryText}"`);

        // Biến câu hỏi thành Vector bằng định dạng object chuẩn Protobuf
        const result = await embedModel.embedContent({
            content: {
                role: "user",
                parts: [{ text: queryText }]
            },
            taskType: "RETRIEVAL_QUERY"
        });

        // CÔNG NGHỆ MRL: Chủ động chặt vector 3072 chiều xuống đúng 768 chiều để so khớp với V2
        const queryVector = Array.from(result.embedding.values).slice(0, 768);

        // Tìm kiếm trên Pinecone
        const searchResults = await index.query({
            vector: queryVector,
            topK: k,
            includeMetadata: true
        });

        if (searchResults.matches && searchResults.matches.length > 0) {
            //console.log(` Đã lấy được ${searchResults.matches.length} tài liệu từ Pinecone.`);

            return searchResults.matches.map(match => ({
                id: match.id,
                title: match.metadata.title || "Tài liệu Pháp luật",
                content: match.metadata.text || "Nội dung không khả dụng",
                dieu: match.metadata.dieu || "Không rõ", // <--- HỨNG LẤY ĐIỀU TỪ PINECONE METADATA V2
                sourceUrl: match.metadata.source || "#",
                score: match.score
            }));
        }

        return [];
    } catch (error) {
        console.error(" Lỗi Pinecone RAG:", error.message);
        return [];
    }
};

module.exports = { query };