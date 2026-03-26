#!/usr/bin/env node
/**
 * ====================================================================
 * UPLOAD TO PINECONE - VERSION 2.0 (PRODUCTION READY)
 * ====================================================================
 * 
 * Purpose: Upload 40,000 Vietnamese legal documents to Pinecone
 * Features:
 *   ✅ Smart chunking (article-aware: Điều 1, Điều 2, ...)
 *   ✅ Rate limit handling (500ms delay per Gemini API call)
 *   ✅ Checkpoint persistence (progress.txt)
 *   ✅ Batch processing (50 vectors/batch)
 *   ✅ Pinecone SDK v3.2.0 compatible
 *   ✅ Comprehensive error handling & logging
 *
 * Usage:
 *   npm install
 *   node scripts/uploadToPinecone_V2.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const JSONStream = require('JSONStream');
const lawStatusMap = JSON.parse(fs.readFileSync('./data/law_status_map.json', 'utf-8'));
// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Gemini Configuration
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: 'gemini-embedding-2-preview', // Mô hình embedding mới nhất của Gemini 

    // Pinecone Configuration
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_INDEX: 'legai-index',

    // Data paths
    DATA_PATH: 'D:/01_Projects/KLTN_DTU_2026/Repo_thamkhao/legal-ai-agent/data/uts_vlc_processed.json',
    CHECKPOINT_FILE: path.join(__dirname, 'progress.txt'),
    LOG_FILE: path.join(__dirname, 'upload.log'),

    // Processing parameters
    CHUNK_SIZE: 1500,           // Characters per chunk
    CHUNK_OVERLAP: 200,         // Overlap between chunks
    MIN_CHUNK_LENGTH: 50,       // Minimum chunk size (skip smaller)
    BATCH_SIZE: 80,             // Vectors per Pinecone batch
    GEMINI_DELAY_MS: 300,       // Delay between Gemini API calls (rate limiting)
    BATCH_DELAY_MS: 1000,       // Delay between batch uploads
    MAX_RETRIES: 3,             // Retry attempts for failed batches
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Log to console and file simultaneously
 */
function log(message, isError = false) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    if (isError) {
        console.error(logMessage);
    } else {
        console.log(logMessage);
    }

    fs.appendFileSync(CONFIG.LOG_FILE, logMessage + '\n');
}

/**
 * Delay function (for rate limiting)
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Save progress to checkpoint file
 */
function saveCheckpoint(documentIndex) {
    fs.writeFileSync(CONFIG.CHECKPOINT_FILE, String(documentIndex));
}

/**
 * Load progress from checkpoint file
 */
function loadCheckpoint() {
    if (fs.existsSync(CONFIG.CHECKPOINT_FILE)) {
        try {
            return parseInt(fs.readFileSync(CONFIG.CHECKPOINT_FILE, 'utf8').trim());
        } catch (e) {
            return -1;
        }
    }
    return -1;
}

/**
 * Validate configuration
 */
function validateConfig() {
    if (!CONFIG.GEMINI_API_KEY) {
        throw new Error('❌ GEMINI_API_KEY not found in .env file');
    }
    if (!CONFIG.PINECONE_API_KEY) {
        throw new Error('❌ PINECONE_API_KEY not found in .env file');
    }
    if (!fs.existsSync(CONFIG.DATA_PATH)) {
        throw new Error(`❌ Data file not found: ${CONFIG.DATA_PATH}`);
    }
    log(`✅ Configuration validated`);
}

// ============================================================================
// CHUNKING STRATEGY
// ============================================================================

/**
 * Split text into paragraph boundaries
 */
function splitByParagraph(text, maxLength) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const chunks = [];
    let current = '';

    for (const line of lines) {
        if ((current + ' ' + line).length > maxLength) {
            if (current) chunks.push(current);
            current = line;
        } else {
            current = current ? current + ' ' + line : line;
        }
    }

    if (current) chunks.push(current);
    return chunks;
}

/**
 * Smart chunking bằng thuật toán Sliding Window (1500 ký tự, overlap 200)
 *
 * Trả về mảng các object: { text: '...' }
 * Đảm bảo end luôn > start.
 */
function smartChunk(content) {
    if (!content || typeof content !== 'string' || content.length === 0) {
        return [];
    }

    const chunks = [];
    const chunkSize = Number(CONFIG.CHUNK_SIZE);
    const overlap = Number(CONFIG.CHUNK_OVERLAP);

    let start = 0;
    const max = content.length;

    while (start < max) {
        const end = Math.min(start + chunkSize, max);

        if (end <= start) {
            break;
        }

        const text = String(content.slice(start, end)).trim();
        if (text.length > 0) {
            chunks.push({ text });
        }

        if (end === max) {
            break;
        }

        start = end - overlap;
        if (start < 0) start = 0;

        if (start >= end) {
            start = end;
        }
    }

    return chunks;
}

/**
 * Split text into chunks with overlap
 * 
 * Algorithm:
 * - Create chunks of CHUNK_SIZE characters
 * - Overlap consecutive chunks by CHUNK_OVERLAP characters
 * - Try to break at newline/paragraph boundaries
 */
function splitWithOverlap(text, chunkSize, overlap) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);

        // Try to break at a line boundary (newline character)
        if (end < text.length) {
            const lastNewline = text.lastIndexOf('\n', end);
            if (lastNewline > start) {
                end = lastNewline;
            }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk.length >= CONFIG.MIN_CHUNK_LENGTH) {
            chunks.push(chunk);
        }

        start = end - overlap;
        if (start >= end) start = end;
    }

    return chunks;
}

// ============================================================================
// EMBEDDING & PINECONE
// ============================================================================

/**
 * Generate embedding vector for text using Gemini
 */
async function generateEmbedding(text) {
    try {
        const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: CONFIG.GEMINI_MODEL });

        const result = await model.embedContent(text);

        // Extract embedding values
        let vectorValues = result.embedding?.values;

        if (!vectorValues) {
            throw new Error('No embedding values returned from Gemini');
        }

        // Convert to regular JavaScript array if needed
        vectorValues = Array.from(vectorValues);

        // Validate vector dimension (Gemini returns 3072 dims)
        if (vectorValues.length !== 3072) {
            throw new Error(`Invalid vector dimension: ${vectorValues.length}, expected 3072`);
        }

        return vectorValues;
    } catch (error) {
        log(`❌ Embedding error: ${error.message}`, true);
        throw error;
    }
}

/**
 * Upload batch of vectors to Pinecone with retry logic
 * Pinecone SDK v3.2.0: index.upsert() accepts array directly
 */
async function uploadBatchToPinecone(pc, vectors, batchNum) {
    if (!vectors || vectors.length === 0) return;

    const validVectors = [];
    for (const v of vectors) {
        const cleanId = String(v.id || '').replace(/[^a-zA-Z0-9-]/g, '');
        if (!cleanId || !v.values || v.values.length === 0) continue;

        // 🧹 CHÌA KHÓA VÀNG Ở ĐÂY: Quét sạch mọi giá trị null trong metadata
        const cleanMetadata = {};
        if (v.metadata) {
            for (const [key, value] of Object.entries(v.metadata)) {
                if (value !== null && value !== undefined) {
                    // Pinecone chỉ nhận String, Number, Boolean, hoặc Array of Strings
                    if (typeof value === 'object' && !Array.isArray(value)) {
                        cleanMetadata[key] = JSON.stringify(value); // Ép object thành chuỗi
                    } else {
                        cleanMetadata[key] = value;
                    }
                } else {
                    // Nếu là null thì gán tạm thành chuỗi rỗng để Pinecone khỏi khóc
                    cleanMetadata[key] = "";
                }
            }
        }

        validVectors.push({
            id: cleanId,
            values: Array.from(v.values).map(Number),
            metadata: cleanMetadata
        });
    }

    if (validVectors.length === 0) return;

    console.log(`📤 Batch ${batchNum}: Bỏ qua SDK, dùng đường vòng REST API đẩy ${validVectors.length} vectors...`);

    let lastError = null;
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        try {
            // 1. Tự động tìm địa chỉ máy chủ Pinecone của bạn
            const indexInfo = await pc.describeIndex(CONFIG.PINECONE_INDEX);
            const host = indexInfo.host || (indexInfo.status && indexInfo.status.host);
            if (!host) throw new Error("Không lấy được địa chỉ Host từ Pinecone.");

            const baseUrl = host.startsWith('http') ? host : `https://${host}`;
            const apiKey = process.env.PINECONE_API_KEY || CONFIG.PINECONE_API_KEY;

            // 🚀 2. VŨ KHÍ HẠT NHÂN: Bắn thẳng dữ liệu lên máy chủ, không qua SDK
            const response = await fetch(`${baseUrl}/vectors/upsert`, {
                method: 'POST',
                headers: {
                    'Api-Key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ vectors: validVectors })
            });

            // 3. Bắt lỗi thật từ máy chủ (nếu có)
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server Pinecone từ chối: ${response.status} - ${errText}`);
            }

            console.log(`✅ Batch ${batchNum}: Thành công! (Đã xuyên thủng bằng REST API)`);
            return;
        } catch (error) {
            lastError = error;
            console.log(`⚠️  Batch ${batchNum}: Attempt ${attempt}/${CONFIG.MAX_RETRIES} failed - ${error.message}`);
            if (attempt < CONFIG.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Nghỉ 2s trước khi thử lại
            }
        }
    }
    throw new Error(`Thất bại hoàn toàn: ${lastError.message}`);
}
// ============================================================================
// MAIN PROCESSING LOOP
// ============================================================================

/**
 * Main function: Read JSON, chunk, embed, and upload to Pinecone
 */
async function main() {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  LEGAL DOCUMENTS PINECONE UPLOADER - v2.0 PRODUCTION      ║');
    console.log('║  Processing 40,000 Vietnamese legal documents             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');

    try {
        validateConfig();
        const statusnap = JSON.parse(fs.readFileSync('./data/law_status_map.json', 'utf-8'));
        const pc = new Pinecone({ apiKey: CONFIG.PINECONE_API_KEY });
        const lastProcessedIdx = loadCheckpoint();

        console.log(`📍 Starting from document index: ${lastProcessedIdx + 1}`);
        console.log(`📊 Configuration:`);
        console.log(`   - Chunk size: ${CONFIG.CHUNK_SIZE} chars`);
        console.log(`   - Chunk overlap: ${CONFIG.CHUNK_OVERLAP} chars`);
        console.log(`   - Batch size: ${CONFIG.BATCH_SIZE} vectors`);
        console.log(`   - Gemini rate limit: ${CONFIG.GEMINI_DELAY_MS}ms between calls`);
        console.log('');

        let docIndex = 0;
        let totalChunksCreated = 0;
        let totalVectorsUploaded = 0;
        let totalBatchesUploaded = 0;
        let currentBatch = [];
        let batchNum = 0;

        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const fileStream = fs.createReadStream(CONFIG.DATA_PATH, { encoding: 'utf8' });
            const jsonStream = JSONStream.parse('*');

            fileStream.on('error', (error) => {
                log(`❌ File stream error: ${error.message}`, true);
                reject(error);
            });

            jsonStream.on('error', (error) => {
                log(`❌ JSON parse error: ${error.message}`, true);
                reject(error);
            });

            jsonStream.on('data', async (doc) => {
                if (docIndex <= lastProcessedIdx) {
                    docIndex++;
                    return;
                }

                jsonStream.pause();
                try {
                    // 1. Khai báo các biến cơ bản từ doc TRƯỚC (Phải có 'content' ở đây)
                    const docId = doc.id || 'unknown';
                    const docTitle = doc.title ? doc.title.substring(0, 60) : 'Unknown';
                    const content = doc.content || ''; // 👈 Dòng này cực kỳ quan trọng, phải nằm TRÊN bộ lọc

                    // 2. 🔴 BỘ LỌC THÔNG MINH (Sử dụng đúng tên biến statusnap Duy đã đặt)
                    const currentStatus = statusnap[docId];

                    if (currentStatus === "Hết hiệu lực") {
                        log(`⏩ [SKIPPED] ${docIndex}. [${docTitle}] - Lý do: Luật đã hết hiệu lực.`);

                        docIndex++;
                        saveCheckpoint(docIndex);
                        jsonStream.resume();
                        return;
                    }

                    // 3. 🟢 NẾU CÒN HIỆU LỰC - Bắt đầu xử lý (Sử dụng 'content' đã khai báo ở bước 1)
                    log(`\n📄 Document [${docIndex}]: ${docTitle}...`);

                    // Smart chunk (sliding window)
                    const chunkData = smartChunk(content);
                    log(`✂️  Created ${chunkData.length} chunks`);
                    totalChunksCreated += chunkData.length;

                    // 4. Tạo embeddings và chuẩn bị vectors
                    for (let chunkIdx = 0; chunkIdx < chunkData.length; chunkIdx++) {
                        const chunk = chunkData[chunkIdx];

                        if (!chunk || typeof chunk.text !== 'string') {
                            log(`⚠️  Skipping malformed chunk at index ${chunkIdx}`);
                            continue;
                        }
                        // ... Logic tạo embedding tiếp theo của Duy ...
                        try {
                            // Generate embedding
                            const vector = await generateEmbedding(chunk.text);

                            // Prepare metadata with defaults, không null/undefined
                            const safeTitle = String(doc.title || '').trim();
                            const safeDocId = String(doc.id || `doc_${docIndex}`).trim();
                            const safeDocType = String(doc.type || 'law').trim();
                            const safeTextPreview = String(chunk.text || '').substring(0, 300);

                            // Prepare vector record for Pinecone
                            const vectorRecord = {
                                // 🛡️ ID BẤT BIẾN: Loại bỏ Date.now() để Upsert hoạt động đúng (ghi đè thay vì nhân bản)
                                id: `doc_${docIndex}_chunk_${chunkIdx}`,

                                // 📊 Chuyển đổi vector sang định dạng số chuẩn
                                values: Array.from(vector).map(Number),

                                metadata: {
                                    doc_id: String(safeDocId || ''),
                                    title: String(safeTitle || ''),
                                    doc_type: String(safeDocType || ''),

                                    // 🧼 CHỐNG LỖI NULL: Pinecone REST API cực ghét null, hãy để chuỗi rỗng
                                    article_num: '',
                                    part_num: '',
                                    parent_context: '',

                                    // 🧠 NỘI DUNG LÕI: Lưu toàn bộ text của chunk để AI truy xuất khi chat
                                    text: chunk.text,
                                    chunk_length: chunk.text.length,
                                    text_preview: String(safeTextPreview || '').substring(0, 300)
                                }
                            };

                            currentBatch.push(vectorRecord);
                            totalVectorsUploaded++;

                            // Upload batch when it reaches size limit
                            if (currentBatch.length >= CONFIG.BATCH_SIZE) {
                                batchNum++;
                                const batchToUpload = currentBatch.splice(0, CONFIG.BATCH_SIZE);
                                await uploadBatchToPinecone(pc, batchToUpload, batchNum);
                                totalBatchesUploaded++;
                                await delay(CONFIG.BATCH_DELAY_MS);
                            }

                            // Rate limiting for Gemini API
                            if ((chunkIdx + 1) % 10 === 0) {
                                await delay(CONFIG.GEMINI_DELAY_MS);
                            }

                        } catch (chunkError) {
                            log(`❌ Error processing chunk ${chunkIdx}: ${chunkError.message}`, true);

                            if (chunkError.message && chunkError.message.includes('429')) {
                                // tránh quá tải khi up liên tục
                                log(`⏳ Google quá tải rồi   ${chunkIdx}...`, true);

                                await delay(30000); // 30 giây 

                                chunkIdx--; // Lùi lại 1 bước để vòng lặp sau khi tăng (++) sẽ quay lại đúng chunk này
                                continue;   // Thử lại ngay lập tức
                            } else {
                                // Nếu là lỗi khác (ví dụ text quá dài) thì mới bỏ qua hoặc nghỉ ngắn
                                await delay(2000);

                            }
                        }
                    }

                    // Save checkpoint after each document
                    docIndex++;
                    saveCheckpoint(docIndex);
                } catch (docError) {
                    log(`❌ Error processing document ${docIndex}: ${docError.message}`, true);
                    docIndex++;
                    saveCheckpoint(docIndex);
                }

                jsonStream.resume();
            });

            jsonStream.on('end', async () => {
                try {
                    // Upload remaining vectors in batch
                    if (currentBatch.length > 0) {
                        batchNum++;
                        log(`\n📤 Uploading final batch with ${currentBatch.length} vectors...`);
                        await uploadBatchToPinecone(pc, currentBatch, batchNum);
                        totalBatchesUploaded++;
                    }

                    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

                    console.log('\n');
                    console.log('╔═══════════════════════════════════════════════════════════╗');
                    console.log('║                    ✅ UPLOAD COMPLETED                    ║');
                    console.log('╚═══════════════════════════════════════════════════════════╝');
                    console.log('');
                    console.log(`📊 Final Statistics:`);
                    console.log(`   - Documents processed: ${docIndex}`);
                    console.log(`   - Total chunks created: ${totalChunksCreated}`);
                    console.log(`   - Total vectors uploaded: ${totalVectorsUploaded}`);
                    console.log(`   - Total batches uploaded: ${totalBatchesUploaded}`);
                    console.log(`   - Time elapsed: ${elapsedTime}s`);
                    console.log('');
                    console.log(`📝 Logs saved to: ${CONFIG.LOG_FILE}`);
                    console.log(`📌 Progress checkpoint: ${CONFIG.CHECKPOINT_FILE}`);
                    console.log('');

                    resolve();
                } catch (finalError) {
                    log(`❌ Final upload error: ${finalError.message}`, true);
                    reject(finalError);
                }
            });

            fileStream.pipe(jsonStream);
        });

    } catch (error) {
        log(`❌ Fatal error: ${error.message}`, true);
        process.exit(1);
    }
}

// ============================================================================
// EXECUTION
// ============================================================================

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { smartChunk, generateEmbedding, uploadBatchToPinecone };