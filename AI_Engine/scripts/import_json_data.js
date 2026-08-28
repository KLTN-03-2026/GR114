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
const { GoogleGenerativeAI } = require('@google/generative-ai');
const SystemConfig = require('../src/config/SystemConfig');
const { getLegalPineconeIndex } = require('../src/services/legalPineconeService');
const { getLegalDocumentId, buildLegalVectorRecord } = require('../src/services/legalIngestionContract');
const { chunkLegalArticles } = require('../src/services/articleAwareChunkingService');
const { createTokenBatches } = require('../src/services/legalEmbeddingBatchService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

/*
 * =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const CONFIG = {
    MAX_TOKENS_PER_BATCH: Number(process.env.LEGAL_EMBED_MAX_TOKENS) || 7000,
    TARGET_TPM: Number(process.env.LEGAL_EMBED_TARGET_TPM) || 18000,
    MAX_TOTAL_EMBED_TOKENS: 3400000,
    CHARS_PER_TOKEN_VI: 2.5,
    MEASUREMENT_WINDOW_MS: 60000,
    MIN_DELAY_MS: 500,
    MAX_RETRIES: 5,
    INITIAL_RETRY_DELAY_MS: 1000,
    MAX_RETRY_DELAY_MS: 60000,
    STANDARD_PRICE_USD_PER_MILLION_TOKENS: 0.20,
    VND_PER_USD: 26000,
    VERBOSE: true
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
        this.retryCount = 0;
        this.successfulTokens = 0;
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

function getErrorStatus(error) {
    const candidates = [
        error && error.status,
        error && error.statusCode,
        error && error.code,
        error && error.response && error.response.status,
        error && error.response && error.response.data && error.response.data.error && error.response.data.error.code,
        error && error.error && error.error.code
    ];

    for (const candidate of candidates) {
        const parsed = Number(candidate);
        if (Number.isInteger(parsed) && parsed >= 100 && parsed <= 599) return parsed;
    }

    const messageMatch = String((error && error.message) || '').match(/(?:^|\D)(408|429|5\d\d)(?:\D|$)/);
    return messageMatch ? Number(messageMatch[1]) : null;
}

function parseRetryDelayValue(value) {
    if (value === undefined || value === null) return null;

    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value * 1000);
    }

    if (typeof value === 'string') {
        const secondsMatch = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
        if (secondsMatch) return Number(secondsMatch[1]) * 1000;

        const numericSeconds = Number(value);
        if (Number.isFinite(numericSeconds)) return Math.max(0, numericSeconds * 1000);

        const retryDate = Date.parse(value);
        if (!Number.isNaN(retryDate)) return Math.max(0, retryDate - Date.now());
    }

    if (typeof value === 'object') {
        const seconds = Number(value.seconds || 0);
        const nanos = Number(value.nanos || 0);
        if (Number.isFinite(seconds) && Number.isFinite(nanos)) {
            return Math.max(0, (seconds * 1000) + (nanos / 1000000));
        }
    }

    return null;
}

function getServerRetryDelayMs(error) {
    const headers = (error && error.response && error.response.headers) || (error && error.headers);
    let retryAfter = null;
    if (headers) {
        retryAfter = typeof headers.get === 'function'
            ? headers.get('retry-after')
            : (headers['retry-after'] || headers['Retry-After']);
    }

    const retryAfterMs = parseRetryDelayValue(retryAfter);
    if (retryAfterMs !== null) return retryAfterMs;

    const detailContainers = [
        error && error.errorDetails,
        error && error.details,
        error && error.error && error.error.details,
        error && error.response && error.response.data && error.response.data.error && error.response.data.error.details
    ];

    for (const container of detailContainers) {
        const details = Array.isArray(container) ? container : (container ? [container] : []);
        for (const detail of details) {
            const type = String((detail && (detail['@type'] || detail.type)) || '');
            if (type.endsWith('google.rpc.RetryInfo') || type.endsWith('/RetryInfo')) {
                const retryInfoMs = parseRetryDelayValue(detail.retryDelay);
                if (retryInfoMs !== null) return retryInfoMs;
            }
        }
    }

    return null;
}

function isTransientStatus(status) {
    return status === 408 || status === 429 || status === 500 ||
        status === 502 || status === 503 || status === 504;
}

function getFallbackRetryDelayMs(retryIndex) {
    const exponentialDelay = Math.min(
        CONFIG.MAX_RETRY_DELAY_MS,
        CONFIG.INITIAL_RETRY_DELAY_MS * Math.pow(2, retryIndex)
    );
    const jitterMultiplier = 0.5 + Math.random();
    return Math.max(100, Math.round(exponentialDelay * jitterMultiplier));
}

function estimateCost(tokens) {
    const usd = (tokens / 1000000) * CONFIG.STANDARD_PRICE_USD_PER_MILLION_TOKENS;
    return { usd, vnd: usd * CONFIG.VND_PER_USD };
}

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
 * EMBEDDING WITH RETRY & EXPONENTIAL BACKOFF
 * =============================================================================
 */

async function embedChunksWithRetry(chunks) {
    let attempt = 0;

    while (attempt < CONFIG.MAX_RETRIES) {
        try {
            const tokenCount = chunks.reduce((sum, chunk) => sum + estimateTokens(chunk.text), 0);

            await enforceRateLimit(tokenCount);

            if (CONFIG.VERBOSE) {
                const status = tpmTracker.getStatus();
                console.log("  Batch: " + chunks.length + " chunks, " + tokenCount + " tokens, Projected TPM: " + (status.currentTPM + tokenCount) + "/" + CONFIG.TARGET_TPM);
            }

            tpmTracker.recordTokens(tokenCount);
            tpmTracker.totalBatches++;

            const embedResult = await embedModel.batchEmbedContents({
                requests: chunks.map(chunk => ({
                    content: { role: "user", parts: [{ text: chunk.text }] },
                    outputDimensionality: 768
                }))
            });

            if (!embedResult.embeddings || embedResult.embeddings.length === 0) {
                throw new Error('No embeddings returned from API');
            }

            tpmTracker.successCount++;
            tpmTracker.successfulTokens += tokenCount;
            return embedResult.embeddings;

        } catch (error) {
            const status = getErrorStatus(error);
            attempt++;

            if (!isTransientStatus(status) || attempt >= CONFIG.MAX_RETRIES) {
                throw error;
            }

            const serverDelayMs = getServerRetryDelayMs(error);
            const delayMs = serverDelayMs !== null
                ? serverDelayMs
                : getFallbackRetryDelayMs(attempt - 1);

            tpmTracker.retryCount++;
            console.warn(
                "  [WARNING] Transient HTTP " + status +
                ". Retry wait: " + delayMs + "ms" +
                (serverDelayMs !== null ? " (server-provided)" : " (exponential backoff with jitter)") +
                ". Remaining attempts: " + (CONFIG.MAX_RETRIES - attempt)
            );
            await new Promise(r => setTimeout(r, delayMs));
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
        console.log("  Nominal token budget: " + CONFIG.MAX_TOTAL_EMBED_TOKENS);
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

        await SystemConfig.loadFromDB();
        const index = getLegalPineconeIndex();
        const indexName = SystemConfig.pineconeIndex;
        console.log("Pinecone index: " + indexName + "\n");

        let successCount = 0;
        const totalLaws = laws.length;
        const startTime = Date.now();
        let totalVectorsUploaded = 0;
        let nominalDocumentTokensAdmitted = 0;
        let stoppedAtBudgetBoundary = false;

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

            const chunkData = chunkLegalArticles(cleanContent, { maxChars: 1500 });
            console.log("   Generated " + chunkData.length + " chunks");

            const documentEstimatedTokens = chunkData.reduce(
                (sum, chunk) => sum + estimateTokens(chunk.text),
                0
            );

            if (nominalDocumentTokensAdmitted + documentEstimatedTokens > CONFIG.MAX_TOTAL_EMBED_TOKENS) {
                stoppedAtBudgetBoundary = true;
                console.log(
                    "   Budget boundary reached. Stopping before this document (document tokens: " +
                    documentEstimatedTokens.toLocaleString('en-US') +
                    ", admitted: " + nominalDocumentTokensAdmitted.toLocaleString('en-US') +
                    ", budget: " + CONFIG.MAX_TOTAL_EMBED_TOKENS.toLocaleString('en-US') + ")"
                );
                break;
            }

            nominalDocumentTokensAdmitted += documentEstimatedTokens;
            console.log(
                "   Document admitted: " + documentEstimatedTokens.toLocaleString('en-US') +
                " estimated tokens (nominal total: " +
                nominalDocumentTokensAdmitted.toLocaleString('en-US') + ")"
            );

            const vectors = [];
            const safeVectorId = getLegalDocumentId({
                id: docId,
                documentNumber: law.DocumentNumber || law.documentNumber,
                title: docTitle
            });

            /*
             * ===== DYNAMIC TOKEN-BASED BATCHING LOOP =====
             */
            const batches = createTokenBatches(chunkData, {
                maxTokens: CONFIG.MAX_TOKENS_PER_BATCH,
                charsPerToken: CONFIG.CHARS_PER_TOKEN_VI
            });
            let batchNumber = 0;
            let chunkIdx = 0;

            for (const batch of batches) {
                batchNumber++;
                try {
                    const embeddings = await embedChunksWithRetry(batch);

                    for (let m = 0; m < embeddings.length; m++) {
                        const vector768 = Array.from(embeddings[m].values).slice(0, 768).map(Number);

                        vectors.push(buildLegalVectorRecord({
                            document: {
                                doc_id: safeVectorId,
                                title: docTitle,
                                sourceUrl: docSourceUrl,
                                agency: inferAgency(law),
                                documentNumber: law.DocumentNumber || law.documentNumber,
                                issueYear: law.IssueYear || law.issueYear,
                                category: docCategory,
                                status: law.Status || law.status
                            },
                            chunk: batch[m],
                            chunkIndex: chunkIdx,
                            values: vector768
                        }));
                        chunkIdx++;
                    }
                } catch (error) {
                    console.error("   FAILED - Batch #" + batchNumber + " embedding error: " + error.message);
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
        const achievedTPM = elapsed > 0 ? (tpmTracker.totalTokens / elapsed) * 60 : 0;
        const submittedCost = estimateCost(tpmTracker.totalTokens);

        if (tpmTracker.totalTokens > CONFIG.MAX_TOTAL_EMBED_TOKENS) {
            console.warn(
                "WARNING: Retry overhead caused actual submitted tokens (" +
                tpmTracker.totalTokens.toLocaleString('en-US') +
                ") to exceed the nominal budget (" +
                CONFIG.MAX_TOTAL_EMBED_TOKENS.toLocaleString('en-US') + ")."
            );
        }

        console.log("\n" + "=".repeat(80));
        console.log("IMPORT PIPELINE COMPLETED");
        console.log("=".repeat(80));
        console.log("Summary Report:");
        console.log("  Completed documents: " + successCount + "/" + totalLaws);
        console.log("  Stopped at budget boundary: " + (stoppedAtBudgetBoundary ? "yes" : "no"));
        console.log("  Total vectors uploaded: " + totalVectorsUploaded);
        console.log("  Gemini requests: " + tpmTracker.totalBatches);
        console.log("  Retry count: " + tpmTracker.retryCount);
        console.log("  Successful batches: " + tpmTracker.successCount);
        console.log("  Nominal document tokens admitted: " + nominalDocumentTokensAdmitted.toLocaleString('en-US'));
        console.log("  Actual estimated tokens submitted (including retries): " + tpmTracker.totalTokens.toLocaleString('en-US'));
        console.log("  Successful embedding tokens: " + tpmTracker.successfulTokens.toLocaleString('en-US'));
        console.log("  Achieved TPM (whole-run average): " + Math.round(achievedTPM).toLocaleString('en-US'));
        console.log("  Estimated Standard cost: $" + submittedCost.usd.toFixed(6));
        console.log("  Estimated Standard cost (VND): " + submittedCost.vnd.toFixed(2));
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
