/*
 * =============================================================================
 * LEGAL DOCUMENT EMBEDDING - RATE-LIMITED GEMINI INTEGRATION
 * =============================================================================
 * 
 * Core Features:
 * - Real-time sliding window rate limiting (enforceRateLimit with 60s window)
 * - Dynamic token-based batching (max 7000 tokens per batch)
 * - Exponential backoff on 429 rate limit errors
 * - Precise token tracking with automatic history cleanup
 * - Full metadata preservation (doc_id, title, agency, chapter, article)
 * 
 * Rate Limiting Strategy:
 * - Quota: 30,000 TPM (hard limit)
 * - Target: 18,000 TPM (40% safety buffer)
 * - Mechanism: Sliding window + forced wait when TPM would exceed target
 * - Window size: 60 seconds, automatically purges expired entries
 * 
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { sql, poolConnect, pool } = require('../src/config/db');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

/*
 * =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const  CONFIG = {
    MAX_TOKENS_PER_BATCH: 7000,
    TARGET_TPM: 18000,
    CHARS_PER_TOKEN_VI: 2.5,
    MEASUREMENT_WINDOW_MS: 60000,
    MIN_DELAY_MS: 500,
    MAX_RETRIES: 5,
    INITIAL_RETRY_DELAY_MS: 60000,
    VERBOSE: true
};

const toAsciiId = (str) => {
    if (!str) return 'doc';
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9_-]/g, "-");
};

const cleanLegalContent = (text) => {
    if (!text) return "";
    let cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
    const uiNoise = [/Sign in/gi, /Download/gi, /Related Documents/gi, /Feedback/gi, /Search/gi, /View more/gi, /Print/gi];
    uiNoise.forEach(regex => { cleaned = cleaned.replace(regex, ""); });
    cleaned = cleaned.replace(/\[+?\d+\]+/g, "");
    const paragraphs = cleaned.split('\n\n');
    return paragraphs.filter((item, index) => paragraphs.indexOf(item) === index).join('\n\n');
};

const cleanMarkdown = (text) => {
    if (!text) return "";
    let cleaned = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/\|(\s*-+\s*\|)+/g, '')
        .replace(/\|/g, ' ')
        .replace(/(\*\*|\*|#|__|_|`)/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/\\/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return cleanLegalContent(cleaned);
};

const smartChunk = (content) => {
    if (!content) return [];
    const chunks = [];
    const regex = /(?=\n\s*Điều\s+\d+[a-zA-ZđĐ]*[\.:\s])/g;
    const parts = content.split(regex);
    let currentChuong = "Introductory Chapter";

    parts.forEach(part => {
        const text = part.trim();
        if (text.length > 0) {
            const chuongMatch = text.match(/(Chương\s+[IVXLCDM\d]+[^\n]*)/i);
            if (chuongMatch) currentChuong = chuongMatch[1].trim();

            const dieuMatch = text.match(/^(Điều\s+\d+[a-zA-ZđĐ]*)/i);
            const dieu = dieuMatch ? dieuMatch[1] : "Basis/Introduction";

            if (text.length > 2500) {
                const subChunks = text.match(/[\s\S]{1,1500}(?!\S)/g) || [text];
                subChunks.forEach(sub => chunks.push({ text: sub.trim(), dieu, chuong: currentChuong }));
            } else {
                chunks.push({ text, dieu, chuong: currentChuong });
            }
        }
    });
    return chunks;
};

function inferAgency(law) {
    const agencyVal = law.Agency || law.agency;
    if (agencyVal && agencyVal.trim() !== "" && agencyVal !== "null") return agencyVal.trim();
    const titleLower = (law.Title || law.title || "").toLowerCase();
    if (titleLower.includes("luật") || titleLower.includes("bộ luật")) return "NATIONAL_ASSEMBLY";
    if (titleLower.includes("nghị định")) return "GOVERNMENT";
    if (titleLower.includes("thông tư")) return "MINISTRY_DIRECTIVE";
    return "OTHER_ISSUING_AGENCY";
}

/*
 * =============================================================================
 * TOKEN ESTIMATION
 * =============================================================================
 */

function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / CONFIG.CHARS_PER_TOKEN_VI);
}

/*
 * =============================================================================
 * REAL-TIME SLIDING WINDOW TPM TRACKER
 * =============================================================================
 */

class TPMTracker {
    constructor() {
        this.tokenHistory = [];
        this.batchCount = 0;
        this.successCount = 0;
        this.totalTokens = 0;
        this.totalBatches = 0;
    }

    recordTokens(count) {
        const now = Date.now();
        this.tokenHistory.push({ timestamp: now, count });
        this.totalTokens += count;
        this.cleanupHistory();
    }

    cleanupHistory() {
        const now = Date.now();
        this.tokenHistory = this.tokenHistory.filter(
            entry => (now - entry.timestamp) < CONFIG.MEASUREMENT_WINDOW_MS
        );
    }

    getCurrentTPM() {
        this.cleanupHistory();
        if (this.tokenHistory.length === 0) return 0;
        return this.tokenHistory.reduce((sum, entry) => sum + entry.count, 0);
    }

    getStatus() {
        const tpm = this.getCurrentTPM();
        const utilization = (tpm / CONFIG.TARGET_TPM * 100).toFixed(1);
        return {
            currentTPM: tpm,
            batchCount: this.totalBatches,
            successCount: this.successCount,
            totalTokens: this.totalTokens,
            windowSize: this.tokenHistory.length,
            utilization: utilization + '%'
        };
    }
}

const tpmTracker = new TPMTracker();

/*
 * =============================================================================
 * RATE LIMIT ENFORCEMENT - REAL-TIME SLIDING WINDOW
 * =============================================================================
 * 
 * Mechanism: Uses a while(true) loop to enforce rate limits.
 * When (currentTPM + upcomingTokens > TARGET_TPM), forces the execution thread
 * to wait until old tokens expire from the 60-second window.
 */

async function enforceRateLimit(upcomingTokens) {
    while (true) {
        tpmTracker.cleanupHistory();
        const currentTPM = tpmTracker.getCurrentTPM();
        const projectedTPM = currentTPM + upcomingTokens;

        if (projectedTPM <= CONFIG.TARGET_TPM) {
            return;
        }

        const now = Date.now();
        const oldestEntry = tpmTracker.tokenHistory[0];

        if (!oldestEntry) {
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
        }

        const timeUntilExpiry = CONFIG.MEASUREMENT_WINDOW_MS - (now - oldestEntry.timestamp);
        const waitTime = Math.max(100, timeUntilExpiry + 50);

        if (CONFIG.VERBOSE) {
            console.log("  Rate limit triggered: TPM " + currentTPM + "/" + CONFIG.TARGET_TPM + " + " + upcomingTokens + " tokens. Waiting " + waitTime + "ms...");
        }

        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
}

/*
 * =============================================================================
 * DYNAMIC TOKEN-BASED BATCHING
 * =============================================================================
 * 
 * Groups chunks into batches where total token count <= MAX_TOKENS_PER_BATCH.
 * Does not use fixed batch size - purely token-driven.
 */

class DynamicBatcher {
    constructor(maxTokensPerBatch = CONFIG.MAX_TOKENS_PER_BATCH) {
        this.maxTokens = maxTokensPerBatch;
        this.currentBatch = [];
        this.currentTokens = 0;
    }

    addChunk(text) {
        const tokens = estimateTokens(text);

        if (this.currentTokens > 0 && this.currentTokens + tokens > this.maxTokens) {
            const batch = this.currentBatch;
            this.currentBatch = [text];
            this.currentTokens = tokens;
            return batch;
        }

        this.currentBatch.push(text);
        this.currentTokens += tokens;
        return null;
    }

    flush() {
        const batch = this.currentBatch;
        this.currentBatch = [];
        this.currentTokens = 0;
        return batch.length > 0 ? batch : null;
    }

    getStats() {
        return {
            batchSize: this.currentBatch.length,
            tokens: this.currentTokens,
            isFull: this.currentTokens >= CONFIG.MAX_TOKENS_PER_BATCH * 0.85
        };
    }
}

/*
 * =============================================================================
 * EMBEDDING WITH RETRY & EXPONENTIAL BACKOFF
 * =============================================================================
 */

async function embedChunksWithRetry(chunks) {
    let retries = CONFIG.MAX_RETRIES;
    let delayMs = CONFIG.INITIAL_RETRY_DELAY_MS;

    while (retries > 0) {
        try {
            const tokenCount = chunks.reduce((sum, text) => sum + estimateTokens(text), 0);

            await enforceRateLimit(tokenCount);

            if (CONFIG.VERBOSE) {
                const status = tpmTracker.getStatus();
                console.log("  Batch: " + chunks.length + " chunks, " + tokenCount + " tokens, Projected TPM: " + (status.currentTPM + tokenCount) + "/" + CONFIG.TARGET_TPM);
            }

            tpmTracker.recordTokens(tokenCount);
            tpmTracker.totalBatches++;

            const embedResult = await embedModel.batchEmbedContents({
                requests: chunks.map(text => ({
                    content: { role: "user", parts: [{ text }] }
                }))
            });

            if (!embedResult.embeddings || embedResult.embeddings.length === 0) {
                throw new Error('No embeddings returned from API');
            }

            tpmTracker.successCount++;
            return embedResult.embeddings;

        } catch (error) {
            if (error.message && error.message.includes('429')) {
                console.warn("  [WARNING] Rate limit error (429). Retry wait: " + delayMs + "ms. Remaining retries: " + (retries - 1));
                await new Promise(r => setTimeout(r, delayMs));
                delayMs *= 2;
                retries--;

                if (retries === 0) {
                    throw new Error("Failed after " + CONFIG.MAX_RETRIES + " retries: " + error.message);
                }
            } else {
                throw error;
            }
        }
    }
}

const importData = async () => {
    try {
        console.log("\n" + "=".repeat(80));
        console.log("LEGAL DOCUMENT EMBEDDING - GEMINI API INTEGRATION");
        console.log("=".repeat(80));
        console.log("Configuration:");
        console.log("  Max batch tokens: " + CONFIG.MAX_TOKENS_PER_BATCH);
        console.log("  Target TPM: " + CONFIG.TARGET_TPM);
        console.log("  Chars per token (Vietnamese): " + CONFIG.CHARS_PER_TOKEN_VI);
        console.log("  Measurement window: " + CONFIG.MEASUREMENT_WINDOW_MS + "ms");
        console.log("=".repeat(80) + "\n");

        console.log("Connecting to database...");
        await poolConnect;
        console.log("Database connection established\n");

        const dataPath = path.join(__dirname, '../clean_data.json');
        if (!fs.existsSync(dataPath)) {
            throw new Error("Source file clean_data.json not found");
        }

        const rawData = fs.readFileSync(dataPath, 'utf8');
        const laws = JSON.parse(rawData);
        console.log("Loaded " + laws.length + " documents from clean_data.json\n");

        const indexName = process.env.PINECONE_INDEX_NAME || 'legai-index-v3';
        const index = pc.index(indexName);
        console.log("Pinecone index: " + indexName + "\n");

        let successCount = 0;
        const totalLaws = laws.length;
        const startTime = Date.now();
        let totalVectorsUploaded = 0;

        /*
         * ===== MAIN DOCUMENT PROCESSING LOOP =====
         */
        for (let i = 0; i < totalLaws; i++) {
            const law = laws[i];
            const docId = law.Id || law.id;
            const docTitle = law.Title || law.title || "Legal Document";
            const docContent = law.Content || law.content || "";
            const docCategory = law.Category || law.category || "General";
            const docSourceUrl = law.SourceUrl || law.sourceUrl || "";

            console.log("\n[" + (i + 1) + "/" + totalLaws + "] Processing document ID: " + docId);
            console.log("   Title: " + docTitle.substring(0, 70) + "...");

            const cleanContent = cleanMarkdown(docContent);
            if (cleanContent.length < 100) {
                console.log("   Skipped: insufficient content length (" + cleanContent.length + " characters)\n");
                continue;
            }

            const statusCheck = await pool.request()
                .input('id', sql.NVarChar(100), docId)
                .query('SELECT SyncStatusPinecone FROM LegalDocuments WHERE Id = @id');

            if (statusCheck.recordset.length > 0 && statusCheck.recordset[0].SyncStatusPinecone === 'success') {
                console.log("   Already synced, skipping\n");
                continue;
            }

            const chunkData = smartChunk(cleanContent);
            console.log("   Generated " + chunkData.length + " chunks");

            const vectors = [];
            const safeVectorId = toAsciiId(docId);

            /*
             * ===== DYNAMIC TOKEN-BASED BATCHING LOOP =====
             */
            const batcher = new DynamicBatcher(CONFIG.MAX_TOKENS_PER_BATCH);
            let batchNumber = 0;
            let chunkIdx = 0;

            for (let j = 0; j < chunkData.length; j++) {
                const chunkText = chunkData[j].text;
                const fullBatch = batcher.addChunk(chunkText);

                if (fullBatch) {
                    batchNumber++;
                    try {
                        const embeddings = await embedChunksWithRetry(fullBatch);

                        for (let m = 0; m < embeddings.length; m++) {
                            const vector768 = Array.from(embeddings[m].values).slice(0, 768).map(Number);

                            let correspondingChunkData = null;
                            for (let k = j - fullBatch.length + 1; k <= j; k++) {
                                if (chunkData[k] && chunkData[k].text === fullBatch[m]) {
                                    correspondingChunkData = chunkData[k];
                                    break;
                                }
                            }

                            vectors.push({
                                id: safeVectorId + "_chunk_" + chunkIdx,
                                values: vector768,
                                metadata: {
                                    doc_id: docId,
                                    title: docTitle,
                                    law_name: docTitle,
                                    doc_type: docCategory,
                                    agency: inferAgency(law),
                                    text: fullBatch[m],
                                    chuong: correspondingChunkData ? correspondingChunkData.chuong : "Unknown",
                                    dieu: correspondingChunkData ? correspondingChunkData.dieu : "Unknown",
                                    chunk_index: chunkIdx,
                                    chunk_length: fullBatch[m].length,
                                    text_preview: fullBatch[m].substring(0, 300),
                                    source: docSourceUrl
                                }
                            });
                            chunkIdx++;
                        }
                    } catch (error) {
                        console.error("   FAILED - Batch #" + batchNumber + " embedding error: " + error.message);
                        throw error;
                    }
                }
            }

            const remainingBatch = batcher.flush();
            if (remainingBatch && remainingBatch.length > 0) {
                batchNumber++;
                try {
                    const embeddings = await embedChunksWithRetry(remainingBatch);

                    for (let m = 0; m < embeddings.length; m++) {
                        const vector768 = Array.from(embeddings[m].values).slice(0, 768).map(Number);

                        vectors.push({
                            id: safeVectorId + "_chunk_" + chunkIdx,
                            values: vector768,
                            metadata: {
                                doc_id: docId,
                                title: docTitle,
                                law_name: docTitle.substring(0, 50),
                                doc_type: docCategory,
                                agency: inferAgency(law),
                                text: remainingBatch[m],
                                chunk_index: chunkIdx,
                                chunk_length: remainingBatch[m].length,
                                text_preview: remainingBatch[m].substring(0, 300),
                                source: docSourceUrl
                            }
                        });
                        chunkIdx++;
                    }
                } catch (error) {
                    console.error("   FAILED - Final batch embedding error: " + error.message);
                    throw error;
                }
            }

            if (vectors.length > 0) {
                console.log("   Uploading " + vectors.length + " vectors to Pinecone...");
                for (let n = 0; n < vectors.length; n += 100) {
                    await index.upsert(vectors.slice(n, n + 100));
                }
                console.log("   Upload completed successfully (batches: " + batchNumber + ")");

                await pool.request()
                    .input('id', sql.NVarChar(100), docId)
                    .query("UPDATE LegalDocuments SET SyncStatusPinecone = 'success' WHERE Id = @id");

                totalVectorsUploaded += vectors.length;
                successCount++;
            }
        }

        /*
         * ===== FINAL SUMMARY REPORT =====
         */
        const elapsed = (Date.now() - startTime) / 1000;
        const status = tpmTracker.getStatus();

        console.log("\n" + "=".repeat(80));
        console.log("IMPORT PIPELINE COMPLETED");
        console.log("=".repeat(80));
        console.log("Summary Report:");
        console.log("  Documents processed: " + successCount + "/" + totalLaws);
        console.log("  Total vectors uploaded: " + totalVectorsUploaded);
        console.log("  Total batches sent: " + tpmTracker.totalBatches);
        console.log("  Successful batches: " + tpmTracker.successCount);
        console.log("  Total tokens consumed: " + tpmTracker.totalTokens.toLocaleString('en-US'));
        console.log("  Elapsed time: " + elapsed.toFixed(0) + "s (" + (elapsed / 60).toFixed(2) + " minutes)");
        console.log("  Final minute TPM: " + status.currentTPM + "/" + CONFIG.TARGET_TPM);
        console.log("  Peak utilization: " + status.utilization);
        console.log("=".repeat(80) + "\n");

        process.exit(0);

    } catch (err) {
        console.error("\nFATAL ERROR: " + err.message);
        console.error("Stack trace:", err.stack);
        process.exit(1);
    }
};

importData();