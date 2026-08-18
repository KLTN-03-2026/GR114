require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require('@pinecone-database/pinecone');
const SystemConfig = require('../config/SystemConfig');

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "legai-index-v3";
let genAI;
let pc;
let index;
let embedModel;
let currentApiKey = "";
let indexNameWithDB = "";

const initCloudServices = () => {
    const activeKey = SystemConfig?.geminiApiKey || process.env.GEMINI_API_KEY;
    const activeIndexName = SystemConfig?.pineconeIndex || process.env.PINECONE_INDEX_NAME || PINECONE_INDEX_NAME;

    if (!activeKey) {
        console.error("Lỗi Pinecone RAG: Không tìm thấy API Key!");
        return;
    }

    if (!genAI || currentApiKey !== activeKey) {
        genAI = new GoogleGenerativeAI(activeKey);
        embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
        currentApiKey = activeKey;
    }


    if (!pc || indexNameWithDB !== activeIndexName) {
        pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || SystemConfig?.pineconeApiKey });
        index = pc.index(activeIndexName);
        indexNameWithDB = activeIndexName;
        console.log(` [ĐỒNG BỘ THÀNH CÔNG]: RAG Service đã khóa mục tiêu vào Pinecone Index: ${activeIndexName}`);
    }
};

// 2. Search function to query Pinecone with the embedding vector
const query = async (queryText, k = 5) => {
    try {
        if (!index) initCloudServices();

        console.log(` Đang truy vấn Cloud cho: "${queryText}"`);


        const result = await embedModel.embedContent({
            content: {
                role: "user",
                parts: [{ text: queryText }]
            },
            taskType: "RETRIEVAL_QUERY"
        });

        const queryVector = Array.from(result.embedding.values).slice(0, 768).map(Number);

        // search on Pinecone
        const searchResults = await index.query({
            vector: queryVector,
            topK: k,
            includeMetadata: true
        });

        // Tại ragService.js - chỗ trả về kết quả
        if (searchResults.matches && searchResults.matches.length > 0) {
            return searchResults.matches.map(match => {
                const meta = match.metadata || {};
                const fullTitle = meta.title || meta.law_name || "Văn bản pháp luật";

                // 1. Quét  URL
                let rawSource = meta.source || meta.sourceUrl || meta.url || meta.link;

                // 2. NẾU Pinecone bị thiếu URL hoặc dính '#' -> Tạo Link Tìm Kiếm ĐÍCH DANH trên VBPL
                if (!rawSource || rawSource === '#') {
                    const encodedTitle = encodeURIComponent(fullTitle);
                    rawSource = `https://vbpl.vn/pages/timkiem.aspx?keyword=${encodedTitle}`;
                }

                return {
                    id: match.id,
                    title: fullTitle,
                    law_name: fullTitle,
                    content: meta.text || "Nội dung không khả dụng",
                    dieu: meta.dieu || "Căn cứ/Mở đầu",
                    chuong: meta.chuong || "Chương",
                    source: rawSource,
                    sourceUrl: rawSource,
                    score: match.score
                };
            });
        }
        return [];
    } catch (error) {
        console.error(" Lỗi Pinecone RAG:", error.message);
        return [];
    }
};

module.exports = { query };