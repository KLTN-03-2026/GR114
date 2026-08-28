require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const SystemConfig = require('../config/SystemConfig');
const { getLegalPineconeIndex } = require('./legalPineconeService');
const { readLegalVectorMetadata } = require('./legalIngestionContract');
const log = require('../utils/legalAiLogger');
const { timed, currentLatencyTracker } = require('../utils/latencyTracker');

let genAI;
let index;
let embedModel;
let currentApiKey = "";

const initCloudServices = () => {
    const activeKey = SystemConfig?.geminiApiKey || process.env.GEMINI_API_KEY;

    if (!activeKey) {
        console.error("Lỗi Pinecone RAG: Không tìm thấy API Key!");
        return;
    }

    if (!genAI || currentApiKey !== activeKey) {
        genAI = new GoogleGenerativeAI(activeKey);
        embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
        currentApiKey = activeKey;
    }


    index = getLegalPineconeIndex();
};

const mapPineconeRecord = (record, score = 0) => {
    const canonical = readLegalVectorMetadata(record?.metadata || {});
    let rawSource = canonical.source;
    if (!rawSource || rawSource === '#') rawSource = `https://vbpl.vn/pages/timkiem.aspx?keyword=${encodeURIComponent(canonical.title)}`;
    return {
        id: record.id, doc_id: canonical.doc_id, title: canonical.title,
        law_name: canonical.law_name, documentNumber: canonical.documentNumber,
        issueYear: canonical.issueYear, documentType: canonical.documentType,
        issueDate: canonical.issueDate, effectiveDate: canonical.effectiveDate,
        category: canonical.category, status: canonical.status, agency: canonical.agency,
        content: canonical.text, text: canonical.text, dieu: canonical.dieu,
        articleTitle: canonical.articleTitle, chuong: canonical.chuong,
        chunk_index: canonical.chunk_index, source: rawSource, sourceUrl: rawSource,
        score: Number(score) || 0
    };
};

// 2. Search function to query Pinecone with the embedding vector
const queryWithLatency = async (queryText, k = 5, latencyOverride = null) => {
    const latency = latencyOverride || currentLatencyTracker();
    try {
        initCloudServices();

        log.debug('RAG QUERY', { query: queryText, topK: k });


        latency?.increment('embeddingCalls');
        const result = await timed(latency, 'embeddingMs', () => embedModel.embedContent({
            content: {
                role: "user",
                parts: [{ text: queryText }]
            },
            taskType: "RETRIEVAL_QUERY"
        }));

        const queryVector = Array.from(result.embedding.values).slice(0, 768).map(Number);

        // search on Pinecone
        latency?.increment('pineconeCalls');
        const searchResults = await timed(latency, 'pineconeMs', () => index.query({
            vector: queryVector,
            topK: k,
            includeMetadata: true
        }));

        // Tại ragService.js - chỗ trả về kết quả
        if (searchResults.matches && searchResults.matches.length > 0) {
            const relatedDocs = searchResults.matches.map(match => {
                const meta = match.metadata || {};
                const canonical = readLegalVectorMetadata(meta);
                const fullTitle = canonical.title;

                // 1. Quét  URL
                let rawSource = canonical.source;

                // 2. NẾU Pinecone bị thiếu URL hoặc dính '#' -> Tạo Link Tìm Kiếm ĐÍCH DANH trên VBPL
                if (!rawSource || rawSource === '#') {
                    const encodedTitle = encodeURIComponent(fullTitle);
                    rawSource = `https://vbpl.vn/pages/timkiem.aspx?keyword=${encodedTitle}`;
                }

                return {
                    id: match.id,
                    doc_id: canonical.doc_id,
                    title: fullTitle,
                    law_name: canonical.law_name,
                    documentNumber: canonical.documentNumber,
                    issueYear: canonical.issueYear,
                    documentType: canonical.documentType,
                    issueDate: canonical.issueDate,
                    effectiveDate: canonical.effectiveDate,
                    category: canonical.category,
                    status: canonical.status,
                    agency: canonical.agency,
                    content: canonical.text,
                    text: canonical.text,
                    dieu: canonical.dieu,
                    articleTitle: canonical.articleTitle,
                    chuong: canonical.chuong,
                    chunk_index: canonical.chunk_index,
                    source: rawSource,
                    sourceUrl: rawSource,
                    score: match.score
                };
            });

            log.debug('RAG TOP-K', {
                results: relatedDocs.slice(0, 5).map((doc, rank) =>
                    `${rank + 1}:${doc.id}:${Number(doc.score || 0).toFixed(3)}:${doc.title}`
                ).join(' | ')
            });

            return relatedDocs;
        }
        return [];
    } catch (error) {
        console.error(" Lỗi Pinecone RAG:", error.message);
        return [];
    }
};

const query = async (queryText, k = 5) => queryWithLatency(queryText, k, currentLatencyTracker());

const fetchByIds = async (ids, latencyOverride = null) => {
    const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!uniqueIds.length) return [];
    const latency = latencyOverride || currentLatencyTracker();
    try {
        initCloudServices();
        latency?.increment('pineconeFetchCalls');
        const response = await timed(latency, 'pineconeFetchMs', () => index.fetch(uniqueIds));
        return Object.entries(response?.records || {}).map(([id, record]) =>
            mapPineconeRecord({ ...record, id: record?.id || id }, 0)
        );
    } catch (error) {
        console.error('[PINECONE FETCH FAILURE]', error.message);
        return [];
    }
};

module.exports = { query, queryWithLatency, fetchByIds, mapPineconeRecord };
