const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { sql, poolConnect, pool } = require('../src/config/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const SystemConfig = require('../src/config/SystemConfig');
const { getLegalPineconeIndex } = require('../src/services/legalPineconeService');
const { getLegalDocumentId, buildLegalVectorRecord } = require('../src/services/legalIngestionContract');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

/**
 * ============================================================================
 * OPTIMIZED RATE LIMITING STRATEGY FOR GEMINI EMBEDDING 2
 * ============================================================================
 * 
 * Quota: 30,000 TPM (Tokens Per Minute) - THIS IS THE BOTTLENECK
 * Strategy: Maintain ~25,000 TPM to keep 5K safety margin
 * 
 * Algorithm:
 * 1. Count tokens BEFORE batching
 * 2. Accumulate chunks until reaching ~15,000 tokens (50% of minute quota)
 * 3. Send batch and record tokens consumed
 * 4. Calculate adaptive delay to maintain target TPM
 * 5. Exponential backoff (2x) on 429 errors
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Token limits
  MAX_TOKENS_PER_BATCH: 15000,      // Max tokens in single API call (50% safety)
  TARGET_TPM: 25000,                 // Target tokens per minute (safe < 30K)
  CHARS_PER_TOKEN_VI: 2.5,           // Vietnamese: ~2.5 chars per token

  // Timing
  MEASUREMENT_WINDOW_MS: 60000,      // 1 minute window for TPM tracking
  MIN_DELAY_MS: 500,                  // Minimum 500ms between requests

  // Retry strategy
  MAX_RETRIES: 5,
  INITIAL_RETRY_DELAY_MS: 5000,      // Start at 5s

  // Logging
  VERBOSE: true
};

// ============================================================================
// TELEMETRY TRACKING
// ============================================================================

class TPMTracker {
  constructor() {
    this.tokensInWindow = [];  // Array of {timestamp, count}
    this.batchCount = 0;
    this.successCount = 0;
    this.totalTokens = 0;
  }

  recordTokens(count) {
    const now = Date.now();
    this.tokensInWindow.push({ timestamp: now, count });
    this.totalTokens += count;

    // Clean old entries outside 60s window
    this.tokensInWindow = this.tokensInWindow.filter(
      entry => now - entry.timestamp < CONFIG.MEASUREMENT_WINDOW_MS
    );
  }

  getCurrentTPM() {
    if (this.tokensInWindow.length === 0) return 0;
    return this.tokensInWindow.reduce((sum, entry) => sum + entry.count, 0);
  }

  getStatus() {
    const tpm = this.getCurrentTPM();
    const utilization = (tpm / CONFIG.TARGET_TPM * 100).toFixed(1);
    return {
      currentTPM: tpm,
      batchCount: this.batchCount,
      successCount: this.successCount,
      totalTokens: this.totalTokens,
      windowSize: this.tokensInWindow.length,
      utilization: utilization + '%'
    };
  }
}

const tpmTracker = new TPMTracker();

// ============================================================================
// TOKEN ESTIMATION & COUNTING
// ============================================================================

/**
 * Estimate token count for Vietnamese text
 * Vietnamese tokenization: ~2.5 characters per token (conservative estimate)
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CONFIG.CHARS_PER_TOKEN_VI);
}

/**
 * Calculate adaptive delay based on current TPM and batch tokens
 * If we're at 50% of target, delay ~0s
 * If we're at 100% of target, delay proportionally
 */
function calculateAdaptiveDelay(tokensAboutToSend) {
  const currentTPM = tpmTracker.getCurrentTPM();
  const tpmAfterBatch = currentTPM + tokensAboutToSend;

  if (tpmAfterBatch <= CONFIG.TARGET_TPM) {
    return CONFIG.MIN_DELAY_MS; // No delay needed
  }

  // Linear scaling: if we would exceed target, delay proportionally
  const excessRatio = tpmAfterBatch / CONFIG.TARGET_TPM;
  const delayMs = (excessRatio - 1) * 60000; // Scale to 60 second window

  return Math.max(CONFIG.MIN_DELAY_MS, Math.min(delayMs, 60000));
}

// ============================================================================
// TEXT CLEANING & CHUNKING
// ============================================================================

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
  let currentChuong = "Chương mở đầu";

  parts.forEach(part => {
    const text = part.trim();
    if (text.length > 0) {
      const chuongMatch = text.match(/(Chương\s+[IVXLCDM\d]+[^\n]*)/i);
      if (chuongMatch) currentChuong = chuongMatch[1].trim();

      const dieuMatch = text.match(/^(Điều\s+\d+[a-zA-ZđĐ]*)/i);
      const dieu = dieuMatch ? dieuMatch[1] : "Căn cứ/Mở đầu";

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
  if (titleLower.includes("luật") || titleLower.includes("bộ luật")) return "QUỐC HỘI";
  if (titleLower.includes("nghị định")) return "CHÍNH PHỦ";
  if (titleLower.includes("thông tư")) return "BỘ NGÀNH CHI TIẾT";
  return "CƠ QUAN BAN HÀNH KHÁC";
}

// ============================================================================
// DYNAMIC BATCHING SYSTEM
// ============================================================================

/**
 * DynamicBatcher accumulates chunks until reaching max token limit
 * Returns batches of variable size but consistent token count
 */
class DynamicBatcher {
  constructor(maxTokensPerBatch = CONFIG.MAX_TOKENS_PER_BATCH) {
    this.maxTokens = maxTokensPerBatch;
    this.currentBatch = [];
    this.currentTokens = 0;
  }

  addChunk(text) {
    const tokens = estimateTokens(text);

    // If adding this chunk would exceed limit, return current batch (if not empty)
    if (this.currentTokens > 0 && this.currentTokens + tokens > this.maxTokens) {
      const batch = this.currentBatch;
      this.currentBatch = [text];
      this.currentTokens = tokens;
      return batch;  // Return full batch
    }

    this.currentBatch.push(text);
    this.currentTokens += tokens;
    return null;  // Batch not full yet
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
      isFull: this.currentTokens >= CONFIG.MAX_TOKENS_PER_BATCH * 0.85  // 85% full
    };
  }
}

// ============================================================================
// EMBEDDING WITH EXPONENTIAL BACKOFF
// ============================================================================

async function embedChunksWithRetry(chunks) {
  let retries = CONFIG.MAX_RETRIES;
  let delayMs = CONFIG.INITIAL_RETRY_DELAY_MS;

  while (retries > 0) {
    try {
      const tokenCount = chunks.reduce((sum, text) => sum + estimateTokens(text), 0);
      const adaptiveDelay = calculateAdaptiveDelay(tokenCount);

      if (CONFIG.VERBOSE) {
        const status = tpmTracker.getStatus();
        console.log(`  [Embedding] Chunks: ${chunks.length}, Tokens: ${tokenCount}, Delay: ${adaptiveDelay}ms, TPM: ${status.currentTPM}/${CONFIG.TARGET_TPM}`);
      }

      // Record tokens before sending
      tpmTracker.recordTokens(tokenCount);

      // Wait adaptive delay
      await new Promise(r => setTimeout(r, adaptiveDelay));

      // Call Gemini API
      const embedResult = await embedModel.batchEmbedContents({
        requests: chunks.map(text => ({
          content: { role: "user", parts: [{ text }] }
        }))
      });

      if (!embedResult.embeddings || embedResult.embeddings.length === 0) {
        throw new Error('No embeddings returned from Gemini API');
      }

      tpmTracker.successCount++;
      return embedResult.embeddings;

    } catch (error) {
      if (error.message && error.message.includes('429')) {
        // Rate limit error - exponential backoff
        console.warn(`⚠️  [429 Error] Rate limit hit. Retrying in ${delayMs}ms (${retries} retries left)...`);
        await new Promise(r => setTimeout(r, delayMs));
        delayMs *= 2;  // Double delay for next retry
        retries--;

        if (retries === 0) {
          throw new Error(`Failed to embed after ${CONFIG.MAX_RETRIES} retries: ${error.message}`);
        }
      } else {
        // Other error - throw immediately
        throw error;
      }
    }
  }
}

// ============================================================================
// MAIN IMPORT PIPELINE
// ============================================================================

const importData = async () => {
  try {
    console.log("\n" + "=".repeat(70));
    console.log("LEGAL DOCUMENT EMBEDDING - OPTIMIZED FOR 30K TPM QUOTA");
    console.log("=".repeat(70));
    console.log("Config: MAX_BATCH=" + CONFIG.MAX_TOKENS_PER_BATCH + " tokens, TARGET_TPM=" + CONFIG.TARGET_TPM + ", CHARS_PER_TOKEN=" + CONFIG.CHARS_PER_TOKEN_VI);
    console.log("=".repeat(70) + "\n");

    console.log("📡 Connecting to Database...");
    await poolConnect;
    console.log("✓ Database connected\n");

    const dataPath = path.join(__dirname, '../clean_data.json');
    if (!fs.existsSync(dataPath)) {
      throw new Error("Target file clean_data.json not found.");
    }

    const rawData = fs.readFileSync(dataPath, 'utf8');
    const laws = JSON.parse(rawData);
    console.log(`📂 Loaded ${laws.length} documents from clean_data.json\n`);

    await SystemConfig.loadFromDB();
    const indexName = SystemConfig.pineconeIndex;
    const index = getLegalPineconeIndex();
    console.log(`🔷 Using Pinecone index: ${indexName}\n`);

    let successCount = 0;
    const totalLaws = laws.length;
    const startTime = Date.now();

    // ===== MAIN LOOP =====
    for (let i = 0; i < totalLaws; i++) {
      const law = laws[i];
      const docId = law.Id || law.id;
      const docTitle = law.Title || law.title || "Văn bản pháp luật";
      const docContent = law.Content || law.content || "";
      const docCategory = law.Category || law.category || "Lĩnh vực khác";
      const docSourceUrl = law.SourceUrl || law.sourceUrl || "";

      console.log(`\n📋 [${i + 1}/${totalLaws}] ${docId} - ${docTitle.substring(0, 60)}...`);

      // Clean content
      const cleanContent = cleanMarkdown(docContent);
      if (cleanContent.length < 100) {
        console.log(`  ⊘ Skipped: insufficient content (${cleanContent.length} chars)`);
        continue;
      }

      // Check if already synced
      const statusCheck = await pool.request()
        .input('id', sql.NVarChar(100), docId)
        .query('SELECT SyncStatusPinecone FROM LegalDocuments WHERE Id = @id');

      if (statusCheck.recordset.length > 0 && statusCheck.recordset[0].SyncStatusPinecone === 'success') {
        console.log(`  ✓ Already synced, skipping...`);
        continue;
      }

      // Generate chunks
      const chunkData = smartChunk(cleanContent);
      console.log(`  📦 Generated ${chunkData.length} chunks`);

      const vectors = [];
      const safeVectorId = getLegalDocumentId({
        id: docId,
        documentNumber: law.DocumentNumber || law.documentNumber,
        title: docTitle
      });

      // ===== DYNAMIC BATCHING =====
      const batcher = new DynamicBatcher(CONFIG.MAX_TOKENS_PER_BATCH);
      let batchNumber = 0;

      for (let j = 0; j < chunkData.length; j++) {
        const chunkText = chunkData[j].text;

        // Try to add chunk to current batch
        const fullBatch = batcher.addChunk(chunkText);

        if (fullBatch) {
          // Batch is full, send it
          batchNumber++;
          console.log(`  🚀 Batch #${batchNumber}: ${fullBatch.length} chunks`);

          try {
            const embeddings = await embedChunksWithRetry(fullBatch);

            for (let m = 0; m < embeddings.length; m++) {
              const globalChunkIdx = vectors.length / (embeddings.length / fullBatch.length);
              // Find corresponding chunk data
              let chunkDataIdx = 0;
              for (let k = 0; k < j; k++) {
                if (batchNumber === 1 || k >= j - fullBatch.length) {
                  chunkDataIdx = k;
                  break;
                }
              }

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
                chunk: { text: fullBatch[m] },
                chunkIndex: vectors.length,
                values: vector768
              }));
            }
          } catch (error) {
            console.error(`  ✗ Batch embedding failed: ${error.message}`);
            throw error;
          }
        }
      }

      // Flush remaining chunks
      const remainingBatch = batcher.flush();
      if (remainingBatch && remainingBatch.length > 0) {
        batchNumber++;
        console.log(`  🚀 Batch #${batchNumber} (final): ${remainingBatch.length} chunks`);

        try {
          const embeddings = await embedChunksWithRetry(remainingBatch);

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
              chunk: { text: remainingBatch[m] },
              chunkIndex: vectors.length,
              values: vector768
            }));
          }
        } catch (error) {
          console.error(`  ✗ Final batch embedding failed: ${error.message}`);
          throw error;
        }
      }

      // Upload vectors to Pinecone
      if (vectors.length > 0) {
        console.log(`  📤 Uploading ${vectors.length} vectors to Pinecone...`);
        for (let n = 0; n < vectors.length; n += 100) {
          await index.upsert(vectors.slice(n, n + 100));
        }
        console.log(`  ✅ Uploaded successfully`);

        // Update database
        await pool.request()
          .input('id', sql.NVarChar(100), docId)
          .query("UPDATE LegalDocuments SET SyncStatusPinecone = 'success' WHERE Id = @id");

        successCount++;
      }
    }

    // ===== SUMMARY =====
    const elapsed = (Date.now() - startTime) / 1000;
    const status = tpmTracker.getStatus();

    console.log("\n" + "=".repeat(70));
    console.log("✅ PIPELINE COMPLETED SUCCESSFULLY");
    console.log("=".repeat(70));
    console.log("📊 Statistics:");
    console.log(`  - Documents processed: ${successCount}/${totalLaws}`);
    console.log(`  - Total vectors uploaded: ${tpmTracker.totalTokens}`);
    console.log(`  - Total batches: ${tpmTracker.batchCount}`);
    console.log(`  - Successful batches: ${tpmTracker.successCount}`);
    console.log(`  - Elapsed time: ${elapsed.toFixed(0)}s (${(elapsed / 60).toFixed(2)} minutes)`);
    console.log(`  - Final TPM: ${status.currentTPM}/${CONFIG.TARGET_TPM}`);
    console.log(`  - Max utilization: ${status.utilization}`);
    console.log("=".repeat(70) + "\n");

    process.exit(0);

  } catch (err) {
    console.error("\n❌ FATAL ERROR:", err.message);
    console.error("Stack:", err.stack);
    process.exit(1);
  }
};

importData();
