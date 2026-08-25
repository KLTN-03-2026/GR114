const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const SystemConfig = require('../config/SystemConfig');
const log = require('../utils/legalAiLogger');
const { timedSync } = require('../utils/latencyTracker');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { YoutubeTranscript } = require('youtube-transcript');
const sql = require('mssql');
const { pool, poolConnect } = require('../config/db');
const ragService = require('./ragService');
const lawSourceService = require('./lawSourceService');
const { CANONICAL_CATEGORIES, normalizeLegalCategory } = require('../constants/legalCategories');
const { generateContentStreaming } = require('../utils/geminiStreamUtils');

const GEMINI_NORMAL_TIMEOUT_MS = 45000;
const DEFAULT_GEMINI_GROUNDING_TIMEOUT_MS = 90000;

function getGroundingTimeoutMs() {
    const configured = Number(process.env.GEMINI_GROUNDING_TIMEOUT_MS);
    return Number.isInteger(configured) && configured > 0
        ? configured
        : DEFAULT_GEMINI_GROUNDING_TIMEOUT_MS;
}

function getTimeoutSource(error) {
    if (error?.code === 'CLIENT_TIMEOUT') return 'CLIENT';
    const status = Number(error?.status || error?.statusCode || error?.response?.status);
    const value = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
    if (status === 504 || value.includes('504') || value.includes('DEADLINE_EXCEEDED') || value.includes('ETIMEDOUT') || value.includes('UPSTREAM TIMEOUT')) {
        return 'UPSTREAM';
    }
    return 'UNKNOWN';
}

function safeGenerationError(error) {
    return {
        status: error?.status || error?.statusCode || error?.response?.status || null,
        code: error?.code || null,
        message: String(error?.message || '').replace(/(?:key|token)=?[^\s&]+/gi, '[REDACTED]').slice(0, 300)
    };
}

function buildGroundingGapHint(context = {}) {
    const missing = Array.isArray(context.missingIssueIds) ? context.missingIssueIds : [];
    const mismatched = Array.isArray(context.targetMismatchedIssueIds) ? context.targetMismatchedIssueIds : [];
    if (missing.length === 0 && mismatched.length === 0) return '';
    return `\n[GROUNDING GAP HINT]\nƯu tiên xác minh các vấn đề còn thiếu: ${missing.join(', ') || 'không có'}.\nCác vấn đề chưa khớp đúng phiên bản luật được yêu cầu: ${mismatched.join(', ') || 'không có'}.\nChỉ thực hiện một lần Grounding tổng hợp cho toàn bộ các khoảng trống này.\n`;
}

function buildGroundingRescuePlan(context = {}, routingReason = '') {
    const issues = Array.isArray(context.issues) ? context.issues : [];
    if (issues.length === 0) return null;
    const orderedIds = issues.map(issue => issue.id);
    const requested = new Set([
        ...(Array.isArray(context.missingIssueIds) ? context.missingIssueIds : []),
        ...(Array.isArray(context.targetMismatchedIssueIds) ? context.targetMismatchedIssueIds : [])
    ]);
    if (routingReason === 'rag_irrelevant') orderedIds.forEach(id => requested.add(id));
    if (routingReason === 'rag_outdated') {
        const inferredFreshnessIds = issues.filter(issue =>
            /mới nhất|tuần này|tháng này|năm này|vừa ra|vừa ban hành|cập nhật/iu.test(issue.query || '')
        ).map(issue => issue.id);
        const freshnessIds = Array.isArray(context.freshnessIssueIds) && context.freshnessIssueIds.length
            ? context.freshnessIssueIds
            : (inferredFreshnessIds.length ? inferredFreshnessIds : orderedIds);
        freshnessIds.forEach(id => requested.add(id));
    }
    const issueIds = orderedIds.filter(id => requested.has(id));
    if (issueIds.length === 0) return null;
    const preservedIssueIds = orderedIds.filter(id => !requested.has(id));
    return {
        issueIds,
        fullQueryMode: preservedIssueIds.length === 0,
        preservedIssueIds,
        rescuedIssueIds: issueIds,
        issues: issues.filter(issue => requested.has(issue.id))
    };
}

function buildGroundingRescueInstruction(plan) {
    if (!plan) return '';
    const definitions = plan.issues.map(issue => {
        const target = issue.target || null;
        const targetText = target
            ? `; văn bản đích=${target.number || target.name || target.year || 'không nêu'}`
            : '';
        return `- ${issue.id}: ${issue.query}${targetText}`;
    }).join('\n');
    if (plan.fullQueryMode) {
        return `\n[GROUNDING RESCUE CONTRACT]\nKhông có vấn đề nào được RAG hỗ trợ đáng tin cậy. Dùng Google Search Grounding để trả lời toàn bộ các vấn đề sau trong MỘT yêu cầu:\n${definitions}\n`;
    }
    return `\n[GROUNDING RESCUE CONTRACT]\nChỉ dùng Google Search để xác minh các vấn đề cần cứu sau:\n${definitions}\nCác vấn đề đã có RAG và phải được bảo toàn: ${plan.preservedIssueIds.join(', ')}. Với các vấn đề này, chỉ tổng hợp từ RAG CONTEXT; không tìm kiếm lại, không thay thế căn cứ RAG bằng nguồn web. Trả về một câu trả lời cuối cùng theo thứ tự vấn đề gốc, kết hợp phần RAG được bảo toàn và phần được Grounding cứu.\n`;
}

function filterGroundingContextDocuments(documents, plan) {
    if (!plan) return documents;
    if (plan.fullQueryMode) return [];
    return documents.filter(doc =>
        doc.supportedIssueIds?.some(issueId => plan.preservedIssueIds.includes(issueId))
    );
}


// ==============================================================================
// HÀM LOGGING THỐNG KÊ 
// ==============================================================================
async function logUsage(featureName) {
    try {
        await poolConnect;
        const logRequest = pool.request();

        // Sử dụng input parameter để bảo mật
        logRequest.input('feature', sql.NVarChar, featureName);

        const upsertQuery = `
            IF EXISTS (SELECT 1 FROM [LegalBotDB].[dbo].[AIFeatureUsage] 
                       WHERE FeatureName = @feature 
                       AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE))
            BEGIN
                UPDATE [LegalBotDB].[dbo].[AIFeatureUsage]
                SET UsageCount = UsageCount + 1,
                    LastUsed = GETDATE()
                WHERE FeatureName = @feature
                AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
            END
            ELSE
            BEGIN
                INSERT INTO [LegalBotDB].[dbo].[AIFeatureUsage] (FeatureName, UsageCount, LastUsed, CreatedAt)
                VALUES (@feature, 1, GETDATE(), GETDATE())
            END
        `;

        await logRequest.query(upsertQuery);

        if (global.io) {
            global.io.emit('new_activity', { type: featureName });
        }
    } catch (err) {
        console.error(` Lỗi lưu thống kê ${featureName}:`, err.message);
    }
}
function cleanAIJsonString(rawString) {
    if (!rawString) return "[]";

    // 1. clean markdown 
    let cleaned = rawString
        .replace(/```json/gi, '')
        .replace(/```html/gi, '')
        .replace(/```/g, '')
        .trim();


    const jsonMatch = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);

    if (!jsonMatch) {
        console.warn("  AI không trả về định dạng JSON chuẩn:", cleaned);
        return cleaned.startsWith('[') ? "[]" : "{}";
    }

    let jsonString = jsonMatch[0];

    // 3. Anti CONTROL CHARACTER:

    let insideString = false;
    let bockThepString = "";

    for (let i = 0; i < jsonString.length; i++) {
        let char = jsonString[i];


        if (char === '"' && jsonString[i - 1] !== '\\') {
            insideString = !insideString;
            bockThepString += char;
            continue;
        }

        if (insideString) {

            if (char === '\n') bockThepString += '\\n';
            else if (char === '\r') bockThepString += '\\r';
            else if (char === '\t') bockThepString += '\\t';
            else bockThepString += char;
        } else {

            bockThepString += char;
        }
    }
    jsonString = bockThepString;


    jsonString = jsonString
        .replace(/^\{\s*\,/, '{')
        .replace(/^\[\s*\,/, '[')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();

    return jsonString;
}

/**
 * Evaluates whether retrieved RAG chunks match the requested legal documents.
 * 
 * @param {string} userQuery - The input prompt or raw question from user.
 * @param {Array<Object>} relatedDocs - Retrieved context chunks from Pinecone.
 * @returns {boolean} True if RAG context is relevant to the query; otherwise false.
 */
function checkRagRelevance(userQuery, relatedDocs) {
    if (!relatedDocs || relatedDocs.length === 0) return false;

    const checkText = userQuery.toLowerCase();

    // Extract document identification numbers (e.g., "03/2007", "15/2023", "59/2020")
    const lawNumberMatches = checkText.match(/\d+[\/\-_]\d+[\/\-_]?[a-zA-Z0-9]*/g) || [];

    // Verify document identifier alignment when explicitly requested
    if (lawNumberMatches.length > 0) {
        const isMatched = relatedDocs.some(doc => {
            const title = (doc.title || doc.law_name || doc.doc_id || "").toLowerCase();
            const content = (doc.content || doc.text || doc.noi_dung_tom_tat || "").toLowerCase();
            return lawNumberMatches.some(num => title.includes(num) || content.includes(num));
        });

        if (!isMatched) {
            console.warn(`[LEG_AI RELEVANCE CHECK]: Document identifier mismatch. Expected: [${lawNumberMatches.join(', ')}].`);
        }
        return isMatched;
    }

    // Fallback to vector semantic relevance threshold for keyword queries
    return relatedDocs.some(doc => (doc.score ? doc.score > 0.72 : true));
}

function isRagOutdated(relatedDocs, currentYear = new Date().getFullYear()) {
    return relatedDocs.every(doc => (doc.issueYear || 0) < currentYear);
}

function getRequestedLawIdentity(userQuestion) {
    const rawQuestion = String(userQuestion || '');
    const match = rawQuestion.match(/\b\d{1,3}\s*[\/_-]\s*\d{4}\s*[\/_-]\s*[a-zA-Z0-9Đđ]+\b/);
    if (!match) return null;

    return {
        lawNumber: match[0].replace(/\s+/g, ''),
        lawName: rawQuestion.replace(match[0], ' ').replace(/\s+/g, ' ').trim()
    };
}

async function cacheGroundedLawSource(userQuestion, groundingMetadata) {
    const identity = getRequestedLawIdentity(userQuestion);
    const chunks = groundingMetadata && groundingMetadata.groundingChunks;
    if (!identity || !Array.isArray(chunks)) return null;

    for (const chunk of chunks) {
        const cachedUrl = await lawSourceService.validateAndCacheGroundingSource(
            identity.lawNumber,
            identity.lawName,
            chunk
        );
        if (cachedUrl) {
            console.log(`[GROUNDING SOURCE CACHED] ${identity.lawNumber} -> ${cachedUrl}`);
            return cachedUrl;
        }
    }

    console.warn(`[GROUNDING SOURCE NOT CACHED] No metadata source matched ${identity.lawNumber}.`);
    return null;
}

function scheduleGroundedSourceCache(userQuestion, groundingMetadata, cacheFn = cacheGroundedLawSource) {
    const questionSnapshot = String(userQuestion || '');
    const metadataSnapshot = {
        groundingChunks: Array.isArray(groundingMetadata?.groundingChunks)
            ? groundingMetadata.groundingChunks.map(chunk => ({
                web: chunk?.web
                    ? { uri: chunk.web.uri, title: chunk.web.title }
                    : undefined
            }))
            : []
    };
    const startedAt = Date.now();

    log.line('SOURCE CACHE', { scheduled: true, blocking: false });
    return Promise.resolve()
        .then(() => cacheFn(questionSnapshot, metadataSnapshot))
        .then(cachedUrl => {
            log.line('SOURCE CACHE', {
                success: Boolean(cachedUrl),
                latencyMs: Date.now() - startedAt,
                reason: cachedUrl ? undefined : 'not_cached'
            });
            return cachedUrl;
        })
        .catch(error => {
            const message = String(error?.message || 'unknown_error').toLowerCase();
            log.line('SOURCE CACHE', {
                success: false,
                latencyMs: Date.now() - startedAt,
                reason: message.includes('timeout') ? 'redirect_timeout' : 'cache_error'
            });
            return null;
        });
}


// ==============================================================================
//  YOUTUBE (XỬ LÝ SHORTS & YOUTU.BE)
// ==============================================================================
function normalizeYouTubeUrl(rawUrl) {
    if (!rawUrl) return "";
    let videoId = "";

    try {
        if (rawUrl.includes('shorts/')) {
            // Lấy ID từ dạng shorts/ID
            videoId = rawUrl.split('shorts/')[1].split('?')[0];
        } else if (rawUrl.includes('youtu.be/')) {
            // Lấy ID từ dạng youtu.be/ID
            videoId = rawUrl.split('youtu.be/')[1].split('?')[0];
        } else if (rawUrl.includes('watch?v=')) {
            // Lấy ID từ dạng watch?v=ID
            videoId = rawUrl.split('watch?v=')[1].split('&')[0];
        }

        // Nếu tìm thấy ID, ép nó về định dạng chuẩn nhất
        if (videoId) {
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
    } catch (e) {
        console.warn("Lỗi khi chuẩn hóa URL:", e);
    }

    return rawUrl; // Trả về nguyên gốc nếu không parse được
}

// ==============================================================================
//  SOẠN THẢO 
// ==============================================================================
function normalizeArticle(article) {
    const normalized = String(article || "")
        .trim()
        .replace(/^(?:điều\s*)+/i, "")
        .replace(/\s+/g, " ");

    return normalized ? `Điều ${normalized}` : "Chưa rõ";
}

const RAG_SELECTOR_STOP_WORDS = new Set([
    "theo", "la", "là", "va", "và", "cua", "của", "co", "có",
    "duoc", "được", "nhung", "những", "nao", "nào", "gi", "gì",
    "mot", "một", "cac", "các", "ve", "về", "trong", "cho", "voi", "với"
]);

function normalizeSelectorText(value) {
    return String(value || "")
        .normalize("NFC")
        .toLocaleLowerCase("vi-VN")
        .replace(/[\p{P}\p{S}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getSelectorTokens(value) {
    return [...new Set(
        normalizeSelectorText(value)
            .split(" ")
            .filter(token => token && !RAG_SELECTOR_STOP_WORDS.has(token))
    )];
}

function getSiblingKey(doc) {
    const { title, sourceUrl } = getContextDocumentDetails(doc);
    const documentKey = doc.doc_id
        ? `doc_id:${doc.doc_id}`
        : `title_source:${title}\u0000${sourceUrl}`;
    return `${documentKey}\u0000article:${normalizeArticle(doc.dieu).toLocaleLowerCase('vi-VN')}`;
}

function selectRagChunks(rawUserQuestion, relatedDocs) {
    if (!Array.isArray(relatedDocs) || relatedDocs.length <= 1) {
        return {
            selectedDocs: relatedDocs || [],
            scores: [],
            fallbackAll: true,
            reason: "Not enough chunks to select"
        };
    }

    const queryTokens = getSelectorTokens(rawUserQuestion);
    if (queryTokens.length < 2) {
        return {
            selectedDocs: relatedDocs,
            scores: [],
            fallbackAll: true,
            reason: "Query has too few meaningful lexical tokens"
        };
    }

    const queryTokenSet = new Set(queryTokens);
    const searchableTokenSets = relatedDocs.map(doc => new Set(getSelectorTokens([
        doc.content || doc.text || doc.noi_dung_tom_tat || "",
        doc.title || doc.law_name || "",
        doc.dieu || ""
    ].join(" "))));
    const tokenWeights = new Map(queryTokens.map(token => {
        const documentFrequency = searchableTokenSets.reduce(
            (count, tokens) => count + (tokens.has(token) ? 1 : 0),
            0
        );
        return [token, 1 + Math.log((relatedDocs.length + 1) / (documentFrequency + 1))];
    }));
    const totalQueryWeight = queryTokens.reduce((total, token) => total + tokenWeights.get(token), 0);
    const lexicalScore = value => {
        const fieldTokens = new Set(getSelectorTokens(value));
        const matchedWeight = [...queryTokenSet].reduce(
            (total, token) => total + (fieldTokens.has(token) ? tokenWeights.get(token) : 0),
            0
        );
        return totalQueryWeight > 0 ? matchedWeight / totalQueryWeight : 0;
    };

    const pineconeScores = relatedDocs.map(doc => Number(doc.score) || 0);
    const minPineconeScore = Math.min(...pineconeScores);
    const maxPineconeScore = Math.max(...pineconeScores);
    const pineconeRange = maxPineconeScore - minPineconeScore;

    const scores = relatedDocs.map((doc, index) => {
        const contentScore = lexicalScore(doc.content || doc.text || doc.noi_dung_tom_tat || "");
        const titleScore = lexicalScore(doc.title || doc.law_name || "");
        const articleScore = lexicalScore(doc.dieu || "");
        const pineconePrior = pineconeRange > 0
            ? (pineconeScores[index] - minPineconeScore) / pineconeRange
            : 1;
        const finalScore = (contentScore * 0.68) +
            (titleScore * 0.14) +
            (articleScore * 0.10) +
            (pineconePrior * 0.08);

        return {
            id: doc.id,
            siblingKey: getSiblingKey(doc),
            pineconeScore: pineconeScores[index],
            contentScore,
            titleScore,
            articleScore,
            finalScore
        };
    });

    const siblingGroups = new Map();
    scores.forEach(score => {
        const current = siblingGroups.get(score.siblingKey);
        if (!current || score.finalScore > current.finalScore) {
            siblingGroups.set(score.siblingKey, score);
        }
    });
    const rankedGroups = [...siblingGroups.values()].sort((a, b) => b.finalScore - a.finalScore);

    if (rankedGroups.length <= 1) {
        return {
            selectedDocs: relatedDocs,
            scores,
            fallbackAll: false,
            reason: "All chunks belong to the same document/article group"
        };
    }

    const topGroup = rankedGroups[0];
    const secondGroup = rankedGroups[1];
    const finalScoreGap = topGroup.finalScore - secondGroup.finalScore;
    const contentScoreGap = topGroup.contentScore - secondGroup.contentScore;
    const hasClearSeparation = topGroup.contentScore > 0 &&
        finalScoreGap >= 0.08 &&
        contentScoreGap >= 0.05;

    if (!hasClearSeparation) {
        return {
            selectedDocs: relatedDocs,
            scores,
            fallbackAll: true,
            reason: `Ambiguous relevance separation (finalGap=${finalScoreGap.toFixed(4)}, contentGap=${contentScoreGap.toFixed(4)})`
        };
    }

    const selectedDocs = relatedDocs.filter(doc => getSiblingKey(doc) === topGroup.siblingKey);
    return {
        selectedDocs,
        scores,
        fallbackAll: false,
        reason: `Clear local relevance separation (finalGap=${finalScoreGap.toFixed(4)}, contentGap=${contentScoreGap.toFixed(4)}); kept complete sibling group`
    };
}

function getContextDocumentDetails(doc) {
    const title = doc.title || doc.law_name || "Văn bản pháp luật";
    let sourceUrl = doc.source || doc.sourceUrl || "";
    if (!sourceUrl || sourceUrl.trim() === "" || sourceUrl.includes("#")) {
        sourceUrl = "";
    }

    return { title, sourceUrl };
}

function buildRawContextText(documents) {
    if (!documents || documents.length === 0) return "<rag_context>Hoàn toàn không có dữ liệu RAG xác thực.</rag_context>";
    return documents.map((doc, index) => {
        const { title, sourceUrl } = getContextDocumentDetails(doc);
        let rawContent = doc.content || doc.noi_dung_tom_tat || "";
        const content = typeof rawContent === 'object' ? JSON.stringify(rawContent) : rawContent;

        return `<rag_chunk index="${index + 1}">
  <law_name>${title}</law_name>
  <article_number>Điều ${doc.dieu || "Chưa rõ"}</article_number>
  <protected_url DO_NOT_MODIFY="TRUE">${sourceUrl}</protected_url>
  <content_verbatim>${content}</content_verbatim>
</rag_chunk>`;
    }).join("\n\n");
}

function groupContextDocuments(documents) {
    const documentGroups = new Map();

    documents.forEach((doc, index) => {
        const { title, sourceUrl } = getContextDocumentDetails(doc);
        const documentKey = doc.doc_id
            ? `doc_id:${doc.doc_id}`
            : `title_source:${title}\u0000${sourceUrl}`;
        const articleNumber = normalizeArticle(doc.dieu);

        if (!documentGroups.has(documentKey)) {
            documentGroups.set(documentKey, {
                title,
                sourceUrl,
                articles: new Map()
            });
        }

        const documentGroup = documentGroups.get(documentKey);
        const articleKey = articleNumber.toLocaleLowerCase('vi-VN');
        if (!documentGroup.articles.has(articleKey)) {
            documentGroup.articles.set(articleKey, {
                articleNumber,
                chunks: []
            });
        }

        let rawContent = doc.content || doc.noi_dung_tom_tat || "";
        const content = typeof rawContent === 'object' ? JSON.stringify(rawContent) : rawContent;
        documentGroup.articles.get(articleKey).chunks.push({
            rank: index + 1,
            content
        });
    });

    return Array.from(documentGroups.values());
}

function buildStrictContextText(documents) {
    if (!documents || documents.length === 0) return "<rag_context>Hoàn toàn không có dữ liệu RAG xác thực.</rag_context>";

    return groupContextDocuments(documents).map(documentGroup => {
        const articles = Array.from(documentGroup.articles.values()).map(article => {
            const chunks = article.chunks.map(chunk =>
                `    <content_verbatim chunk_rank="${chunk.rank}">${chunk.content}</content_verbatim>`
            ).join("\n");

            return `  <rag_article article_number="${article.articleNumber}">\n${chunks}\n  </rag_article>`;
        }).join("\n\n");

        return `<rag_document>
  <law_name>${documentGroup.title}</law_name>
  <protected_url DO_NOT_MODIFY="TRUE">${documentGroup.sourceUrl}</protected_url>

${articles}
</rag_document>`;
    }).join("\n\n");
}
// =============================================================================
// CHỈ THỊ VÀ QUY TẮC TRUY XUẤT PHÁP LÝ (DYNAMIC TIME ENGINE)
// =============================================================================
const getSystemLawInstruction = () => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    return `
Bạn là Trợ lý Pháp lý AI cao cấp của hệ thống Legal AI. 
Nhiệm vụ của bạn là đưa ra câu trả lời, biểu mẫu, lộ trình hoặc kết quả kiểm toán có độ chính xác tuyệt đối (Deterministic).

# QUY TẮC THỜI GIAN THỰC TẾ (DYNAMIC TIME ENGINE):
- Bạn phải luôn nhận thức và hành xử như đang ở mốc thời gian thực tế là NĂM ${currentYear}.
- Khi đối chiếu các văn bản luật trong ngữ cảnh được cung cấp: Nếu xuất hiện văn bản luật mới ban hành hoặc sắp có hiệu lực (Ví dụ: Luật năm ${currentYear} hoặc ${previousYear}) xuất hiện cùng luật cũ, bạn BẮT BUỘC phải khẳng định văn bản mới nhất quy định về lĩnh vực đó. 
- Nêu rõ lộ trình chuyển giao hiệu lực văn bản, tuyệt đối không được lười biếng lấy luật cũ làm kết luận chủ đạo.

# QUY TẮC TRUY XUẤT KIẾN THỨC PHÁP LÝ (Áp dụng NGHIÊM NGẶT theo thứ tự sau):
=================================================
[QUY TẮC PHÁP LÝ BẮT BUỘC - STRICT STRICT LEGAL RULES]

1. TUYỆT ĐỐI BẢO TOÀN SỐ ĐIỀU VÀ SỐ KHOẢN (ZERO HALLUCINATION):
- Đọc kỹ số Điều và số Khoản trong VÙNG DỮ LIỆU XÁC THỰC (RAG Context).
- RAG ghi Điều mấy, Khoản mấy thì BẮT BUỘC ghi đúng con số đó. 
- CẤM TỰ Ý ĐÁNH LẠI SỐ KHOẢN 1, 2, 3 TỪ TRÊN XUỐNG! (Ví dụ: Nếu RAG ghi Khoản 4 là "Người mắc bệnh" thì BẮT BUỘC phải ghi Khoản 4, CẤM đổi thành Khoản 2 hay Khoản 3).
- CẤM nhầm lẫn giữa Điều 2 (Giải thích từ ngữ) và Điều 3 (Phân loại bệnh).

2. KỶ LUẬT COPY-PASTE LINK URL 100%:
- Nhúng link Markdown theo cú pháp: [Điều X - Tên Luật](URL_Source)
=================================================
QUY TẮC NGUỒN VÀ URL
=================================================

URL_SOURCE phải là URL CỤ THỂ của trang chi tiết văn bản pháp luật đang được trích dẫn.

Có 2 nguồn URL hợp lệ, theo thứ tự ưu tiên:

TRƯỜNG HỢP 1: RAG CUNG CẤP URL CHI TIẾT

Nếu <protected_url> chứa URL chi tiết của chính văn bản,
hãy sử dụng chính xác URL đó.

Không được sửa, rút gọn hoặc tự tạo lại URL này.


TRƯỜNG HỢP 2: RAG KHÔNG CUNG CẤP URL CHI TIẾT

Nếu <protected_url> rỗng, không tồn tại hoặc không phải URL
chi tiết của văn bản:

- Nếu Google Search Grounding đang được bật, được phép sử dụng
  URL chi tiết được tìm thấy từ kết quả Google Search Grounding.
- URL phải thuộc domain:
  https://vbpl.vn/
- Ưu tiên URL có cấu trúc:
  https://vbpl.vn/van-ban/chi-tiet/...

- Phải tìm URL thực tế từ kết quả tìm kiếm.
- Không được tự tạo URL.
- Không được suy đoán UUID hoặc slug.
- Không được lấy URL homepage làm URL của văn bản.


QUY TẮC QUAN TRỌNG:

https://vbpl.vn/

CHỈ là domain/homepage.

Nó KHÔNG được coi là URL chi tiết của một văn bản.

Do đó:

https://vbpl.vn/

KHÔNG BAO GIỜ được sử dụng làm URL_SOURCE cho một văn bản cụ thể.

Nếu không tìm thấy URL chi tiết đã được xác minh,
URL_SOURCE phải để trống.


THỨ TỰ ƯU TIÊN URL:

1. URL chi tiết hợp lệ từ RAG <protected_url>
2. URL chi tiết hợp lệ từ Google Search Grounding
3. Không tìm thấy → URL_SOURCE = ""


KHÔNG ĐƯỢC sử dụng URL của website khác làm URL_SOURCE,
kể cả khi website đó xác nhận đúng văn bản.

Ví dụ không hợp lệ:

https://thuvienphapluat.vn/...
https://luatvietnam.vn/...
https://chinhphu.vn/...
https://congbao.chinhphu.vn/...

Các nguồn khác chỉ được dùng để đối chiếu thông tin,
không được dùng làm URL_SOURCE cuối cùng.
- CẤM TUYỆT ĐỐI việc tự đổi số ID ở đuôi link (Ví dụ: Context cấp '--12900' thì BẮT BUỘC giữ nguyên '--12900', CẤM tự ý đổi thành '--22995' hay bất kỳ số nào khác).
=================================================

=================================================
[ƯU TIÊN 1: RAG NỘI BỘ LEGAI]
Nếu dữ liệu RAG chứa thông tin liên quan trực tiếp đến câu hỏi hoặc hồ sơ.
THÌ:
- Chỉ trích xuất đúng nội dung có trong ranh giới vùng dữ liệu xác thực được cung cấp.
- Không suy diễn thêm khung phạt hoặc tình tiết tăng nặng ngoài dữ liệu thô.
- NẾU một Điều luật xuất hiện trong dữ liệu nhưng bị khuyết các Khoản/Điểm (Ví dụ: dữ liệu chỉ hiển thị Khoản 1 và Khoản 2, hoàn toàn không nhắc gì tới Khoản 3, Khoản 4), bạn BẮT BUỘC phải coi như các Khoản/Điểm thiếu đó CHƯA TỒN TẠI trên hệ thống. Nghiêm cấm tự ý bổ sung từ kiến thức nền.

=================================================
[ƯU TIÊN 2: GOOGLE SEARCH GROUNDING CÓ GIỚI HẠN]
Nếu dữ liệu RAG nội bộ chưa đủ thông tin hoặc người dùng yêu cầu liệt kê chi tiết điều khoản mục nhỏ mà RAG bị cắt đoạn (chunking) khuyết thiếu:
Bạn ĐƯỢC PHÉP sử dụng công cụ tìm kiếm tích hợp để bổ sung dữ liệu.
CHỈ được lấy dữ liệu từ các nguồn chính thống sau:
- vbpl.vn
- thuvienphapluat.vn
Nếu tìm thấy dữ liệu trên hai nguồn này, bắt buộc phải trích rõ nguồn văn bản gốc.

=================================================
[ƯU TIÊN 3: TRI THỨC NỘI TẠI CÓ KIỂM SOÁT]
Nếu cả RAG nội bộ và Search grounding đều không có kết quả:
- Được phép dùng tri thức nội tại của hệ thống CHỈ để giải thích khái niệm hoặc định hướng tổng quan, dẫn dắt đến các nguyên tắc phổ biến (Luật Dân sự, Luật Doanh nghiệp, Luật SHTT).
- ĐƯỢC PHÉP: Trích dẫn các điều luật cơ bản, nổi tiếng nếu chắc chắn đúng 100%.
- TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý TẠO RA: Số hiệu văn bản giả lập, các Khoản/Điểm bị khuyết, mức phạt bằng tiền cụ thể hoặc số năm tù cụ thể.

[QUY TẮC AN TOÀN KHI SỬ DỤNG DỮ LIỆU INTERNET]
- MỤC ĐÍCH DUY NHẤT: Cập nhật các thông số mới nhất (tỷ lệ %, mức phạt, tên văn bản luật, chỉ thị mới ra đời trong giai đoạn ${previousYear}-${currentYear}).
- CẤM SAO CHÉP THỂ THỨC: TUYỆT ĐỐI KHÔNG được sao chép cấu trúc, văn phong, hay các mẫu biểu trôi nổi trên các trang blog luật sư, trang tin tức hoặc diễn đàn.
- BẢO TOÀN KIẾN TRÚC VĂN BẢN: Dữ liệu tìm kiếm được chỉ dùng làm "Nguyên liệu". Bạn phải tự ráp nguyên liệu đó vào cấu trúc chuẩn của một văn bản pháp lý/hành chính chuyên nghiệp. Trình bày rành mạch, không chèn các đường link báo mạng rác.
`;
};

// =============================================================================
// GET MODEL 
// =============================================================================
async function getActiveModel(userPrompt, isJson = false, relatedDocs = [], forceSearch = false, useProModel = false, rawUserQuestion = "", responseSchema = null, returnResponseDetails = false, ragAlreadySelected = false, groundingContext = {}, latency = null, progress = null) {
    const apiKey = process.env.GEMINI_API_KEY || SystemConfig?.geminiApiKey;
    const preferredModel = SystemConfig?.geminiModel;
    const temp = SystemConfig?.temperature || 0.1;

    if (!apiKey) throw new Error("Chưa có API Key trong hệ thống!");

    const genAI = new GoogleGenerativeAI(apiKey);

    // 1. Enable GOOGLE SEARCH 
    let enableGoogleSearch = false;
    let ragContext = "";
    let groundingRescue = null;
    const routerStarted = latency?.now();

    if (relatedDocs && relatedDocs.length > 0) {
        log.debug('GEMINI RAG INPUT', {
            documents: relatedDocs.slice(0, 5).map((doc, index) =>
                `${index + 1}:${doc.id}:${Number(doc.score || 0).toFixed(3)}:${doc.title || doc.law_name || '(no title)'}`
            ).join(' | ')
        });
        const checkText = (rawUserQuestion && rawUserQuestion.trim()) ? rawUserQuestion.toLowerCase() : userPrompt.toLowerCase();
        const isRagRelevant = checkRagRelevance(checkText, relatedDocs);

        const isDetailRequired = checkText.includes("chi tiết") ||
            checkText.includes("điều") ||
            checkText.includes("khoản") ||
            checkText.includes("mục nhỏ") ||
            checkText.includes("mức phạt") ||
            checkText.includes("phạt tiền") ||
            checkText.includes("bao nhiêu tiền") ||
            checkText.includes("mới nhất") ||

            checkText.includes("nghị định") ||
            checkText.includes("luật số");

        const currentYear = new Date().getFullYear();
        const isSeekingNewInfo = /mới nhất|tuần này|tháng này|năm này| vừa ra |vừa ban hành|cập nhật/i.test(checkText);
        const ragIsOutdated = isRagOutdated(relatedDocs, currentYear);
        //   (forceSearch = true)
        if (forceSearch || !isRagRelevant || (isSeekingNewInfo && ragIsOutdated)) {
            enableGoogleSearch = true;
        } else {
            enableGoogleSearch = false;
        }
        const routingReason = forceSearch ? 'forced' : !isRagRelevant ? 'rag_irrelevant' : (isSeekingNewInfo && ragIsOutdated) ? 'rag_outdated' : 'rag_sufficient';
        if (enableGoogleSearch) {
            groundingRescue = buildGroundingRescuePlan(groundingContext, routingReason);
            if (groundingRescue) {
                log.line('GROUNDING RESCUE', {
                    missingIssues: groundingRescue.issueIds.length,
                    issueIds: groundingRescue.issueIds.join(','),
                    fullQueryMode: groundingRescue.fullQueryMode,
                    ragIssuesPreserved: groundingRescue.preservedIssueIds.length
                });
            }
        }
        log.line('ROUTER', {
            grounding: enableGoogleSearch,
            reason: routingReason
        });
        if (latency) latency.add('routerMs', latency.now() - routerStarted);
        if (ragAlreadySelected) {
            log.debug('MULTI-RAG GROUNDING', { invokedAfterMergedEvaluation: enableGoogleSearch });
        }

        const selectorResult = ragAlreadySelected
            ? {
                selectedDocs: relatedDocs,
                scores: [],
                fallbackAll: false,
                reason: "Pre-selected per decomposed issue"
            }
            : timedSync(latency, 'selectorMs', () => selectRagChunks(
                (rawUserQuestion && rawUserQuestion.trim()) ? rawUserQuestion : userPrompt,
                relatedDocs
            ));
        const selectedDocs = filterGroundingContextDocuments(selectorResult.selectedDocs, groundingRescue);
        if (!ragAlreadySelected) {
            progress?.completed('RAG_SELECT', 'Đã chọn tài liệu liên quan');
        }
        log.debug('RAG SELECTOR', {
            rawChunks: relatedDocs.length,
            selectedChunks: selectedDocs.length,
            selectedIds: selectedDocs.map(doc => doc.id).join(',') || 'none',
            fallbackAll: selectorResult.fallbackAll,
            reason: selectorResult.reason
        });

        const ragPromptStarted = latency?.now();
        const rawContext = buildRawContextText(relatedDocs);
        const documentGroups = groupContextDocuments(selectedDocs);
        ragContext = buildStrictContextText(selectedDocs);
        if (latency) latency.add('promptBuildMs', latency.now() - ragPromptStarted);
        const articleGroups = documentGroups.reduce((total, documentGroup) => total + documentGroup.articles.size, 0);
        const savedChars = rawContext.length - ragContext.length;
        const savedPercent = rawContext.length > 0
            ? Number(((savedChars / rawContext.length) * 100).toFixed(2))
            : 0;
        log.verbose('RAG COMPACT METRICS', {
            rawChunks: relatedDocs.length,
            documentCount: documentGroups.length,
            articleGroups,
            rawContextChars: rawContext.length,
            compactContextChars: ragContext.length,
            savedChars,
            savedPercent
        });
    } else {

        // Empty context only enables Search when this caller explicitly grants
        // permission. The final chatbot call does so below; unrelated model
        // calls with no RAG context retain their existing Search-off behavior.
        enableGoogleSearch = forceSearch;

        if (enableGoogleSearch) {
            groundingRescue = buildGroundingRescuePlan(groundingContext, 'rag_irrelevant');
            if (groundingRescue) {
                log.line('GROUNDING RESCUE', {
                    missingIssues: groundingRescue.issueIds.length,
                    issueIds: groundingRescue.issueIds.join(','),
                    fullQueryMode: groundingRescue.fullQueryMode,
                    ragIssuesPreserved: groundingRescue.preservedIssueIds.length
                });
            }
            log.line('ROUTER', { grounding: true, reason: 'rag_empty' });
        } else {
            log.line('ROUTER', { grounding: false, reason: 'grounding_not_allowed' });
        }
        if (latency) latency.add('routerMs', latency.now() - routerStarted);
    }
    log.debug('GEMINI RESPONSE MODE', {
        grounded: enableGoogleSearch,
        expectedFormat: enableGoogleSearch ? 'text' : (isJson ? 'json' : 'text')
    });
    if (enableGoogleSearch) {
        progress?.started('GROUNDING', 'Đang kiểm tra nguồn pháp lý bổ sung…');
    }
    const promptStarted = latency?.now();
    const today = new Date().toLocaleDateString('vi-VN');
    const timeContext = `[THÔNG TIN THỜI GIAN THỰC TẾ CHO AI: Hôm nay là ngày ${today}.
     Bất kỳ tham chiếu nào về "tuần này", "tháng này", "năm này" trong câu hỏi của người dùng đều phải được hiểu là thời điểm hiện tại (${today}).
     Hãy dùng mốc này để đối chiếu dữ liệu RAG/Search.]`;
    const compiledPrompt = `
====================================================================
[DỮ LIỆU THỜI GIAN THỰC TẾ - DYNAMIC TIME ENGINE]
====================================================================
Hôm nay là ngày ${today}.
Bất kỳ tham chiếu nào về "tuần này", "tháng này", "năm này" đều phải được hiểu là thời điểm hiện tại.

====================================================================
[RAG CONTEXT - VÙNG DỮ LIỆU XÁC THỰC NỘI BỘ LEGALBOT]
====================================================================
${ragContext || "Không có dữ liệu RAG phù hợp trong kho lưu trữ nội bộ."}
${enableGoogleSearch ? buildGroundingGapHint(groundingContext) : ''}
${enableGoogleSearch ? buildGroundingRescueInstruction(groundingRescue) : ''}

    ====================================================================
    [GOOGLE SEARCH GROUNDING - QUY TẮC NGUỒN TÌM KIẾM]
    ====================================================================
    Với nguồn được Google Search Grounding bổ sung, chỉ chấp nhận URL văn bản
    đã được xác minh từ các domain sau, đúng thứ tự ưu tiên hiện hành:
    1. vbpl.vn
    2. thuvienphapluat.vn
    3. xaydungchinhsach.chinhphu.vn, chỉ khi trang chính thức chứa TOÀN VĂN
       đúng tên, số hiệu và nội dung văn bản cần trích dẫn.

    Nếu không có URL chi tiết/toàn văn hợp lệ từ các domain trên đã được
    Google Search Grounding xác minh, sourceUrl phải là chuỗi rỗng.

====================================================================
[CÂU HỎI CỦA NGƯỜI DÙNG - USER QUESTION]
====================================================================
"${userPrompt}"
    `;
    if (latency) latency.add('promptBuildMs', latency.now() - promptStarted);

    const normalizeModelName = (modelName) => {
        if (!modelName) return null;

        return modelName.replace(/^models\//, '');
    };

    // 2. PHÂN BỔ HÀNG ĐỢI MODEL - STRICT PRIORITY
    let fastQueue = [];

    if (useProModel) {
        // PRO MODEL PRIORITY: 
        fastQueue = ["models/gemini-3.1-pro-preview", "models/gemini-2.5-pro", "models/gemini-3.5-flash"];
    } else {
        // FLASH MODEL PRIORITY
        fastQueue = ["models/gemini-3.5-flash", "models/gemini-2.5-flash", "models/gemini-3.1-flash-lite"];
    }


    // Normalize the preferred model before inserting it into the queue.
    const normalizedPreferredModel = normalizeModelName(preferredModel);

    if (
        normalizedPreferredModel &&
        normalizedPreferredModel !== "gemini-3.1-flash-lite"
    ) {
        fastQueue = [
            normalizedPreferredModel,
            ...fastQueue.filter(
                model => normalizeModelName(model) !== normalizedPreferredModel
            )
        ];
    }


    // Normalize and deduplicate all model names.
    fastQueue = [
        ...new Set(
            fastQueue
                .map(normalizeModelName)
                .filter(Boolean)
        )
    ];

    progress?.started('SYNTHESIZING', 'Đang tổng hợp câu trả lời…');

    for (const modelName of fastQueue) {
        let timeoutId = null;
        let generationAbortController = null;
        let modelCallStarted = null;
        let modelTimingRecorded = false;
        const startedAt = new Date();
        const timeoutLimitMs = enableGoogleSearch ? getGroundingTimeoutMs() : GEMINI_NORMAL_TIMEOUT_MS;
        try {
            log.debug('GEMINI REQUEST', { model: modelName, grounding: enableGoogleSearch });

            const modelConfig = {
                model: modelName,
                systemInstruction: getSystemLawInstruction()
            };

            if (enableGoogleSearch) {
                modelConfig.tools = [{ googleSearch: {} }];
            }

            //console.log(`[DEBUG] Gemini model used: ${modelName}`, modelConfig);

            const model = genAI.getGenerativeModel(modelConfig);

            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    generationAbortController?.abort();
                    const timeoutError = new Error("TIMEOUT_EXCEEDED");
                    timeoutError.code = 'CLIENT_TIMEOUT';
                    reject(timeoutError);
                }, timeoutLimitMs);
            });

            const generationConfig = { temperature: temp, topP: 0.8 };

            if (isJson && !enableGoogleSearch) {
                generationConfig.responseMimeType = "application/json";

                if (responseSchema) {
                    generationConfig.responseSchema = responseSchema;
                }
            }

            generationAbortController = new AbortController();
            const apiPromise = generateContentStreaming(model, {
                contents: [{ role: "user", parts: [{ text: compiledPrompt }] }],
                generationConfig
            }, {
                grounded: enableGoogleSearch,
                requestOptions: { signal: generationAbortController.signal },
                onStart: () => progress?.streamStart(),
                onDelta: delta => progress?.streamChunk(delta),
                onError: () => progress?.streamError('STREAM_INTERRUPTED', 'Mất kết nối truyền trực tiếp; vẫn đang xử lý…', true)
            });

            const modelStarted = latency?.now();
            modelCallStarted = modelStarted;
            const result = await Promise.race([apiPromise, timeoutPromise]);
            const modelElapsed = latency ? latency.now() - modelStarted : 0;
            if (latency) {
                latency.add('finalModelMs', modelElapsed);
                if (enableGoogleSearch) latency.add('groundingMs', modelElapsed);
                modelTimingRecorded = true;
            }
            if (timeoutId) clearTimeout(timeoutId);
            if (result && result.response) {
                const finishReason = result.response.candidates?.[0]?.finishReason;
                if (finishReason === 'RECITATION') {
                    const recitationError = new Error('RECITATION');
                    recitationError.code = 'RECITATION';
                    throw recitationError;
                }
                const text = result.response.text();
                const groundingMetadata =
                    result.response.candidates?.[0]?.groundingMetadata;

                // Google Search Grounding supplies verified source URLs in
                // groundingMetadata, not in the generated text. Cache only a
                // metadata chunk that matches the requested document.
                if (enableGoogleSearch && groundingMetadata) {
                    scheduleGroundedSourceCache(rawUserQuestion, groundingMetadata);
                }

                if (text) {
                    if (enableGoogleSearch) {
                        progress?.completed('GROUNDING', 'Đã kiểm tra nguồn pháp lý bổ sung');
                    }
                    progress?.completed('SYNTHESIZING', 'Đã tổng hợp câu trả lời');
                    const usage = result.response.usageMetadata || {};
                    if (enableGoogleSearch) {
                        const sourceDomains = (groundingMetadata?.groundingChunks || []).map(chunk => {
                            const uri = chunk?.web?.uri;
                            try { return uri ? new URL(uri).hostname : null; } catch (_) { return null; }
                        }).filter(Boolean);
                        log.line('GROUNDING', {
                            model: modelName,
                            success: true,
                            latencyMs: Date.now() - startedAt.getTime(),
                            promptTokens: usage.promptTokenCount ?? 0,
                            outputTokens: usage.candidatesTokenCount ?? 0,
                            thoughtTokens: usage.thoughtsTokenCount ?? 0,
                            totalTokens: usage.totalTokenCount ?? 0,
                            citations: groundingMetadata?.groundingChunks?.length ?? 0
                        });
                        log.debug('GROUNDING SOURCES', { sources: [...new Set(sourceDomains)].join(',') || 'none' });
                    }
                    return returnResponseDetails
                        ? {
                            text,
                            grounded: enableGoogleSearch,
                            groundingMetadata: groundingMetadata || null,
                            model: modelName,
                            groundingRescue
                        }
                        : text;
                }
            }
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            if (latency && modelCallStarted != null && !modelTimingRecorded) {
                const elapsed = latency.now() - modelCallStarted;
                latency.add('finalModelMs', elapsed);
                if (enableGoogleSearch) latency.add('groundingMs', elapsed);
            }
            const msg = (error.message || "").toString();
            const timeoutSource = getTimeoutSource(error);
            console.warn(`  ${modelName} thất bại:`, msg.split('\n')[0]);
            if (enableGoogleSearch) {
                const safeError = safeGenerationError(error);
                log.error('GROUNDING ERROR', { type: safeError.type || classifyGenerationFailure(error), source: timeoutSource, elapsedMs: Date.now() - startedAt.getTime(), limitMs: timeoutLimitMs });
            }
            console.log('[GEMINI GENERATION FAILURE]');
            console.log({
                model: modelName,
                grounded: enableGoogleSearch,
                type: classifyGenerationFailure(error)
            });

            // A Grounding request gets exactly one attempt. Only after that
            // attempt fails (quota, API error, or timeout) may internal model
            // knowledge be used by the existing controlled fallback.
            if (enableGoogleSearch) {
                progress?.degraded('GROUNDING', 'Không thể kiểm tra nguồn trực tuyến, đang tiếp tục với dữ liệu hiện có…');
                try {
                    console.warn(
                        "Google Search Grounding gặp lỗi API/quota/timeout. " +
                        "Chuyển sang LLM fallback..."
                    );

                    const fallbackModel = genAI.getGenerativeModel({
                        model: normalizeModelName("models/gemini-2.5-flash"),
                        systemInstruction: getSystemLawInstruction(),
                        tools: []
                    });

                    const fallbackGenerationConfig = {
                        temperature: temp
                    };

                    // Giữ Structured Citation khi fallback về LLM.
                    if (isJson) {
                        fallbackGenerationConfig.responseMimeType = "application/json";

                        if (responseSchema) {
                            fallbackGenerationConfig.responseSchema = responseSchema;
                        }
                    }



                    const fallbackPrompt = `
[CHẾ ĐỘ LLM FALLBACK]

Google Search Grounding hiện không khả dụng do lỗi hệ thống
hoặc quá tải.

Bạn được phép sử dụng kiến thức nội tại của model để cố gắng
trả lời phần nội dung câu hỏi.
TUYỆT ĐỐI KHÔNG:

- tự tạo URL pháp luật;
- tự suy đoán URL vbpl.vn;
- tự suy đoán URL thuvienphapluat.vn;
- tự suy đoán URL xaydungchinhsach.chinhphu.vn;
- tự tạo UUID hoặc ID ở cuối URL;
- giả vờ rằng URL đã được xác minh bởi Google Search.

Nếu không có URL chi tiết/toàn văn đã được xác minh từ RAG
hoặc Google Search Grounding, sourceUrl phải là chuỗi rỗng.

[YÊU CẦU BẢO TOÀN RAG KHI FALLBACK]
- Câu hỏi gốc: ${rawUserQuestion || '(không có)'}
- Trạng thái bao phủ: ${JSON.stringify(groundingContext)}
- Trả lời đầy đủ mọi vấn đề có thể xác minh từ RAG bên dưới.
- Không rút gọn thành câu trả lời chung chung chỉ vì Grounding thất bại.
- Vấn đề chưa có bằng chứng hoặc chưa khớp đúng phiên bản phải được ghi rõ là chưa thể xác minh từ nguồn hiện có.
- Không dùng phiên bản luật cũ làm căn cứ chính thay cho phiên bản người dùng yêu cầu.
${buildGroundingGapHint(groundingContext)}

${compiledPrompt}
`;

                    progress?.started('SYNTHESIZING', 'Đang tiếp tục tổng hợp câu trả lời…');
                    const fallbackResult = await generateContentStreaming(fallbackModel, {
                        contents: [
                            {
                                role: "user",
                                parts: [{ text: fallbackPrompt }]
                            }
                        ],
                        generationConfig: fallbackGenerationConfig
                    }, {
                        grounded: false,
                        onStart: () => progress?.streamStart(),
                        onDelta: delta => progress?.streamChunk(delta),
                        onError: () => progress?.streamError('STREAM_INTERRUPTED', 'Mất kết nối truyền trực tiếp; vẫn đang xử lý…', true)
                    });
                    const fallbackFinishReason = fallbackResult.response.candidates?.[0]?.finishReason;
                    if (fallbackFinishReason === 'RECITATION') {
                        const recitationError = new Error('RECITATION');
                        recitationError.code = 'RECITATION';
                        throw recitationError;
                    }
                    const fallbackText = fallbackResult.response.text();
                    progress?.completed('SYNTHESIZING', 'Đã tổng hợp câu trả lời');
                    console.log('[GEMINI RESPONSE MODE]');
                    console.log({
                        grounded: false,
                        expectedFormat: isJson ? 'json' : 'text'
                    });
                    return returnResponseDetails
                        ? {
                            text: fallbackText,
                            grounded: false,
                            groundingMetadata: null,
                            model: 'gemini-2.5-flash',
                            groundingRescue: groundingRescue ? { ...groundingRescue, rescuedIssueIds: [] } : null
                        }
                        : fallbackText;

                } catch (fbErr) {
                    console.log('[GEMINI GENERATION FAILURE]');
                    console.log({
                        model: 'gemini-2.5-flash',
                        grounded: false,
                        type: classifyGenerationFailure(fbErr)
                    });
                    console.error(
                        " Lỗi hệ thống AI :",
                        fbErr.message
                    );
                    throw fbErr;
                }
            }

            if (msg.includes("400") || msg.toLowerCase().includes("response mime type")) throw error;
            continue;
        }
    }
    throw new Error("Tất cả model đều từ chối hoặc hết hạn mức.");
}
const CITATION_SCHEMA = {
    type: "OBJECT",
    properties: {
        answer: {
            type: "STRING",
            description: "Câu trả lời đầy đủ tuân thủ ngặt nghèo các kịch bản pháp lý và rules của LegAI"
        },
        citations: {
            type: "ARRAY",
            description: "Mảng trích dẫn nguồn luật chính xác",
            items: {
                type: "OBJECT",
                properties: {
                    lawName: { type: "STRING" },
                    dieu: { type: "STRING" },
                    khoan: { type: "STRING" },
                    quoteSnippet: { type: "STRING" },
                    sourceUrl: {
                        type: "STRING",
                        description: `
URL NGUỒN ĐÃ ĐƯỢC XÁC MINH CỦA VĂN BẢN PHÁP LUẬT ĐƯỢC TRÍCH DẪN.

THỨ TỰ ƯU TIÊN:

1. URL detail từ RAG <protected_url>.
2. URL detail chính thức từ vbpl.vn được Google Search Grounding xác minh.
3. URL văn bản từ thuvienphapluat.vn được Google Search Grounding xác minh.
4. URL TOÀN VĂN từ xaydungchinhsach.chinhphu.vn được Google Search Grounding xác minh.

DOMAIN ĐƯỢC PHÉP:

- https://vbpl.vn/
- https://thuvienphapluat.vn/
- https://xaydungchinhsach.chinhphu.vn/

ĐỐI VỚI xaydungchinhsach.chinhphu.vn:

Chỉ được sử dụng khi trang thực sự chứa TOÀN VĂN hoặc nội dung
pháp luật tương ứng với văn bản đang được trích dẫn.

Ví dụ hợp lệ:

https://xaydungchinhsach.chinhphu.vn/toan-van-luat-thu-do-so-02-2026-qh16-11926052309491329.htm

URL phải được Google Search Grounding xác minh.

KHÔNG ĐƯỢC:

- tự tạo URL;
- tự tạo UUID hoặc ID;
- sửa đổi URL tìm được;
- sử dụng homepage;
- sử dụng trang tìm kiếm;
- sử dụng URL không được Grounding xác minh.

Nếu không tìm thấy URL hợp lệ đã được xác minh:
trả về chuỗi rỗng.
`
                    }
                },
                required: ["lawName", "dieu", "sourceUrl"]
            }
        }
    },
    required: ["answer", "citations"]
};


function isAllowedLegalSourceUrl(sourceUrl) {
    if (!sourceUrl || typeof sourceUrl !== "string") {
        return false;
    }

    try {
        const url = new URL(sourceUrl);
        const hostname = url.hostname.toLowerCase();
        const pathname = url.pathname.toLowerCase();

        const allowedHosts = [
            "vbpl.vn",
            "www.vbpl.vn",
            "thuvienphapluat.vn",
            "www.thuvienphapluat.vn",
            "xaydungchinhsach.chinhphu.vn"
        ];

        if (!allowedHosts.includes(hostname)) {
            return false;
        }

        // Không cho homepage
        if (pathname === "/" || pathname === "") {
            return false;
        }

        // Không cho URL tìm kiếm
        if (
            pathname.includes("/tim-kiem") ||
            pathname.includes("/search")
        ) {
            return false;
        }

        return true;

    } catch {
        return false;
    }
}

function sanitizeCitations(citations = []) {
    if (!Array.isArray(citations)) {
        return [];
    }

    const seen = new Set();
    return citations.map(citation => {
        if (!citation || typeof citation !== "object") {
            return citation;
        }

        return {
            ...citation,
            sourceUrl: isAllowedLegalSourceUrl(citation.sourceUrl) ? citation.sourceUrl : ""
        };
    }).filter(citation => {
        if (!citation || typeof citation !== 'object') return true;
        const key = [citation.lawName, citation.dieu, citation.khoan, citation.sourceUrl]
            .map(value => normalizeAnswerText(value).toLocaleLowerCase('vi-VN').trim())
            .join('\u0000');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function classifyGenerationFailure(error) {
    const message = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
    if (message.includes('TIMEOUT')) return 'TIMEOUT';
    if (message.includes('RECITATION')) return 'RECITATION';
    if (message.includes('429') || message.includes('QUOTA') || message.includes('DEMAND')) return 'QUOTA';
    return 'API';
}

function normalizeAnswerText(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\\r?\n/g, '\n');
}

function cleanStructuredJsonResponse(value) {
    return String(value || '')
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function extractGroundingCitations(groundingMetadata) {
    const chunks = Array.isArray(groundingMetadata?.groundingChunks)
        ? groundingMetadata.groundingChunks
        : [];
    const supports = Array.isArray(groundingMetadata?.groundingSupports)
        ? groundingMetadata.groundingSupports
        : [];
    const supportTextByChunk = new Map();

    for (const support of supports) {
        const quoteSnippet = normalizeAnswerText(support?.segment?.text || '');
        for (const chunkIndex of support?.groundingChunkIndices || []) {
            if (!supportTextByChunk.has(chunkIndex) && quoteSnippet) {
                supportTextByChunk.set(chunkIndex, quoteSnippet);
            }
        }
    }

    const seenUrls = new Set();
    const citations = [];
    chunks.forEach((chunk, index) => {
        const web = chunk && chunk.web;
        const sourceUrl = normalizeAnswerText(web?.uri || '').trim();
        if (!sourceUrl || seenUrls.has(sourceUrl)) return;
        seenUrls.add(sourceUrl);
        citations.push({
            lawName: normalizeAnswerText(web?.title || 'Nguồn Google Search Grounding'),
            dieu: '',
            khoan: '',
            quoteSnippet: supportTextByChunk.get(index) || '',
            sourceUrl
        });
    });
    return citations;
}

function normalizeGeminiResponse(responseDetails, expectsStructuredJson = true) {
    const details = typeof responseDetails === 'string'
        ? { text: responseDetails, grounded: false, groundingMetadata: null }
        : (responseDetails || {});
    const mode = details.grounded ? 'grounded-text' : (expectsStructuredJson ? 'structured-json' : 'plain-text');
    let normalized;

    if (details.grounded) {
        normalized = {
            answer: normalizeAnswerText(details.text),
            citations: extractGroundingCitations(details.groundingMetadata).map(citation => ({
                ...citation,
                supportedIssueIds: details.groundingRescue?.issueIds || []
            }))
        };
    } else if (expectsStructuredJson) {
        try {
            const parsed = JSON.parse(cleanStructuredJsonResponse(details.text));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Structured response is not a JSON object');
            }
            normalized = {
                answer: normalizeAnswerText(parsed.answer),
                citations: sanitizeCitations(parsed.citations)
            };
        } catch (error) {
            console.warn('[RESPONSE NORMALIZATION FAILURE]', {
                mode,
                type: 'PARSE',
                reason: error.message
            });
            normalized = {
                answer: normalizeAnswerText(details.text),
                citations: []
            };
        }
    } else {
        normalized = {
            answer: normalizeAnswerText(details.text),
            citations: []
        };
    }

    console.log('[RESPONSE NORMALIZATION]');
    console.log({
        mode,
        answerLength: normalized.answer.length,
        citationCount: normalized.citations.length
    });
    return normalized;
}

/**
 * Utility function to convert standard Markdown legal citations 
 * into internal Proxy Redirect URLs for Lazy Resolve mechanism.
 *
 * @param {string} responseText - The raw string generated by the Gemini model.
 * @returns {string} The formatted string containing proxy redirect links.
 */
function formatProxyCitations(responseText) {
    if (!responseText || typeof responseText !== 'string') {
        return responseText;
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:8000';

    return responseText.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
        (match, text) => {
            const lawMatch = text.match(/\d+[\/\-_]\d+[\/\-_]?[a-zA-Z0-9]*/g);
            if (lawMatch) {
                const lawNum = lawMatch[0];
                const proxyUrl = `${baseUrl}/api/source/resolve?lawNum=${encodeURIComponent(lawNum)}&lawName=${encodeURIComponent(text)}`;
                return `[${text}](${proxyUrl})`;
            }
            return match;
        }
    );
}


// ==============================================================================
//  1.CHAT BOT AI
// ==============================================================================
async function generateAnswerWithGemini(userQuestion, documents = [], chatHistory = [], useStructuredCitations = true, options = {}) {
    try {
        const targetLawInstruction = options.targetLaw
            ? `\n# VĂN BẢN ĐƯỢC NGƯỜI DÙNG CHỈ ĐỊNH\nTên: ${options.targetLaw.name || '(không nêu)'}\nNăm/phiên bản: ${options.targetLaw.year || '(không nêu)'}\nSố hiệu: ${options.targetLaw.number || '(không nêu)'}\nPhải trả lời chủ yếu theo đúng văn bản này. Văn bản phiên bản khác chỉ được nhắc như so sánh lịch sử và phải ghi rõ. Nếu Search cũng không xác minh được văn bản được chỉ định, phải nói rõ chưa thể xác minh; không được âm thầm thay bằng phiên bản cũ.\n`
            : '';
        const historyText = chatHistory.length > 0
            ? chatHistory.map(msg => `${msg.role === 'user' ? 'NGƯỜI DÙNG' : 'LEGAI'}: ${msg.content}`).join("\n\n")
            : "Chưa có lịch sử trò chuyện.";

        const prompt = `
# VAI TRÒ: 
Bạn là LegAI - Hệ thống Trí tuệ Nhân tạo Pháp luật cao cấp tại Việt Nam. 

Bạn được kết nối với hệ thống dữ liệu pháp luật của LegAI.

# SIÊU CHỈ THỊ TUYỆT ĐỐI KHÔNG ẢO GIÁC (STRICT RAG BOUNDARY):
1. Bạn CHỈ ĐƯỢC PHÉP sử dụng thông tin từ các nguồn
được hệ thống cung cấp trong request hiện tại:

1.1 Nội dung RAG từ Pinecone.
1.2 Kết quả Google Search Grounding nếu hệ thống đã kích hoạt Search.

Không sử dụng kiến thức nội tại để bổ sung dữ liệu pháp luật
mà RAG hoặc Grounding không cung cấp.
2. NẾU một Điều luật xuất hiện trong dữ liệu nhưng bị khuyết các Khoản/Điểm (Ví dụ: dữ liệu chỉ hiển thị Khoản 1 và Khoản 2, hoàn toàn không nhắc gì tới Khoản 3, Khoản 4), bạn BẮT BUỘC phải coi như các Khoản/Điểm thiếu đó CHƯA TỒN TẠI trên hệ thống. 
3. NGHIÊM CẤM tuyệt đối việc tự ý sử dụng trí nhớ nội tại hoặc kiến thức nền của bạn để tự động bổ sung, điền thêm, hoặc hoàn thiện các Khoản/Điểm/Mức hình phạt bị khuyết từ RAG.
4. Nếu câu hỏi của người dùng hỏi trúng vào phần dữ liệu bị khuyết hoặc không có trong ranh giới xác thực,
"LUÔN ƯU TIÊN TRÍCH DẪN ĐIỀU LUẬT CỤ THỂ. NẾU CÂU TRẢ LỜI CỦA BẠN KHÔNG CÓ TRÍCH DẪN ĐIỀU KHOẠN, HỆ THỐNG SẼ ĐÁNH GIÁ LÀ CHẤT LƯỢNG KÉM."
.

# LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:
${historyText}

# YÊU CẦU TRẢ LỜI CÂU HỎI MỚI NHẤT: "${userQuestion}"
${targetLawInstruction}

# QUY TẮC TRUY XUẤT KIẾN THỨC PHÁP LÝ (Áp dụng NGHIÊM NGẶT theo thứ tự sau):

=================================================
[ƯU TIÊN 1: RAG NỘI BỘ LEGAI]
Nếu dữ liệu RAG chứa thông tin liên quan trực tiếp đến câu hỏi.
THÌ:
- Chỉ trích xuất đúng nội dung có trong ranh giới.
- Không suy diễn thêm khung phạt hoặc tình tiết tăng nặng ngoài dữ liệu.

=================================================
[ƯU TIÊN 2: GOOGLE SEARCH GROUNDING]
Trường hợp dữ liệu RAG nội bộ bị khuyết hoặc thiếu thông tin chi tiết về số Điều/Khoản người dùng hỏi, và hệ thống đã kích hoạt mở cổng kết nối mạng:
- Hãy sử dụng công cụ Tìm kiếm để càn quét văn bản pháp luật gốc.
- CHỈ được lấy dữ liệu từ các nguồn pháp lý được phép:

  1. https://vbpl.vn/
  2. https://thuvienphapluat.vn/
  3. https://xaydungchinhsach.chinhphu.vn/

- Ưu tiên tuyệt đối vbpl.vn.

- Nếu vbpl.vn không có kết quả phù hợp, thử thuvienphapluat.vn.

- Nếu hai nguồn trên không có kết quả phù hợp, được phép sử dụng
  xaydungchinhsach.chinhphu.vn nếu tìm thấy trang TOÀN VĂN chính thức
  của đúng văn bản.

- Khi sử dụng xaydungchinhsach.chinhphu.vn, phải xác minh:
  + đúng tên văn bản;
  + đúng số hiệu;
  + đúng nội dung Điều/Khoản đang được hỏi;
  + trang thực sự chứa toàn văn hoặc nội dung chính thức của văn bản.

- Không được sử dụng các trang tin tức, blog hoặc website khác.
- Nếu tìm thấy, phải trích xuất rõ ràng: Tên văn bản, Số hiệu văn bản, nội dung chi tiết của Điều, Khoản,link URL Điểm đó.
=================================================
[ƯU TIÊN 3: TRI THỨC NỘI TẠI CÓ KIỂM SOÁT]
Nếu: RAG không có VÀ Search grounding không có.
Được phép dùng tri thức nội tại CHỈ ĐỂ dẫn dắt đến các nguyên tắc pháp lý hoặc điều luật phổ biến (ví dụ: Luật Dân sự, Luật SHTT).
ĐƯỢC PHÉP: Trích dẫn các điều luật cơ bản, nổi tiếng nếu chắc chắn đúng 100%.
TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý TẠO RA: Số hiệu văn bản giả lập, các Khoản/Điểm bị khuyết, mức phạt bằng tiền cụ thể hoặc số năm tù cụ thể.

=================================================
[ƯU TIÊN 4: THIẾU THÔNG TIN]
Nói rõ người dùng cần cung cấp thêm hồ sơ thực tế hoặc tình huống cụ thể.

# KIỂM TRA PHÁP LÝ TRƯỚC KHI TRẢ LỜI (SELF-CHECK NỘI BỘ)
Hãy đối chiếu câu trả lời dự định của bạn với phần dữ liệu thô:
- Phần mức phạt, số năm tù này có nằm trong chữ nghĩa của RAG cung cấp không? -> Nếu không có: BẮT BUỘC loại bỏ, không đưa vào câu trả lời như một sự thật.

# QUY TẮC XỬ LÝ NGỮ CẢNH:
- Nếu người dùng dùng các từ thay thế như "luật đó", "ông ấy", "quy định này", hãy nhìn vào LỊCH SỬ TRÒ CHUYỆN để biết họ đang nói về cái gì.
- Tuyệt đối không được hỏi lại "Luật nào?" nếu lịch sử đã có tên luật.

# QUY TẮC PHÂN LOẠI & TRẢ LỜI (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):
- CẤM BỊA ĐẶT SỐ LIỆU: Tuyệt đối KHÔNG tự ý đưa ra một con số cụ thể về số lượng văn bản trên hệ thống. 
- NGUYÊN TẮC ƯU TIÊN: Nếu người dùng vừa chào hỏi, vừa đưa ra tình huống pháp lý => BẮT BUỘC PHẢI CHỌN [KỊCH BẢN 3].
Hãy tự động phân tích "YÊU CẦU TỪ NGƯỜI DÙNG" để xếp vào ĐÚNG MỘT TRONG BA kịch bản dưới đây:

**[KỊCH BẢN 1]: GIAO TIẾP & HỎI THÔNG TIN VỀ AI**
- Áp dụng khi: Hỏi thăm, chào hỏi, hoặc hỏi về chức năng của LegAI.
- Phản hồi: Trả lời tự nhiên, thân thiện nhưng ngắn gọn và khiêm tốn. Không dài dòng.
- Cấu trúc: Dùng văn xuôi bình thường. TUYỆT ĐỐI KHÔNG dùng cấu trúc 4 phần pháp lý.

**[KỊCH BẢN 2]: CÂU HỎI NGOÀI CHUYÊN MÔN / VI PHẠM ĐẠO ĐỨC**
- Áp dụng khi: Hỏi code, toán học, giải trí, hoặc nhờ hướng dẫn lách luật, trốn thuế...
- Phản hồi: Lịch sự từ chối bằng 1 đoạn ngắn gọn.
- Cấu trúc: TUYỆT ĐỐI KHÔNG dùng cấu trúc 4 phần pháp lý.

**[KỊCH BẢN 3]: CÂU HỎI TƯ VẤN PHÁP LÝ CỤ THỂ**
- Áp dụng khi: Dữ liệu RAG có đầy đủ thông tin để trả lời chắc chắn (tình huống pháp lý, tra cứu luật, điều kiện, thủ tục...).
- Quy tắc:
  1. KHÔNG chào hỏi dư thừa. ĐI THẲNG VÀO PHẦN KẾT LUẬN.
  2. QUY TẮC ĐỊNH DẠNG OUTPUT : Nếu hệ thống yêu cầu Structured Citation hoặc cung cấp
response schema:
- BẮT BUỘC trả về đúng JSON schema được cung cấp.
- Không trả Markdown bên ngoài JSON.
  - Không thêm giải thích bên ngoài JSON.
  - Không tự thêm hoặc bỏ field khỏi schema.

Nếu hệ thống KHÔNG yêu cầu Structured Citation:

- Trả lời bằng Markdown theo format thông thường.
   
  .
  3. KHÔNG dùng cụm "Dựa trên tài liệu". Trả lời tự tin.
- Cấu trúc bắt buộc:
   **Kết luận:** (Ngắn gọn 1-2 câu).
   **Phân tích:** (Giải thích logic bằng các đoạn văn/gạch đầu dòng).
   **Cơ sở pháp lý:** (Trình bày liền mạch. Tuân thủ ngặt nghèo QUY TẮC TRUY XUẤT KIẾN THỨC PHÁP LÝ ở trên.
  Trình bày rõ ràng: "Theo [Điều X - Tên Luật](URL_Source), Khoản Y quy định rằng: [Nội dung trích dẫn]".
URL_Source phải tuân thủ QUY TẮC NGUỒN VÀ URL ở trên.
- Nếu RAG có URL chi tiết hợp lệ:
  sử dụng URL từ <protected_url>.

- Nếu RAG không có URL:
  sử dụng URL đã được Google Search Grounding xác minh theo thứ tự:

  1. vbpl.vn
  2. thuvienphapluat.vn
  3. xaydungchinhsach.chinhphu.vn

- Đối với xaydungchinhsach.chinhphu.vn:
  chỉ sử dụng nếu đó là trang TOÀN VĂN hoặc trang chính thức
  chứa nội dung của đúng văn bản đang được trích dẫn.

- Nếu không tìm thấy URL đã xác minh:
  sourceUrl phải để trống.

- Không được tự tạo hoặc suy đoán URL.


Tuyệt đối không được nói chung chung "theo luật hiện hành".
    TUYỆT ĐỐI KHÔNG ghi chú nguồn gốc như "Từ RAG" hay "Từ tri thức nội tại" vào câu trả lời).

[CHỈ THỊ CHỐNG HALLUCINATION ÉP BUỘC CHO KỊCH BẢN 3]:
1. BẢNG TOÀN SỐ KHOẢN NGUYÊN VĂN - CHỈ LẤY TỪ <content_verbatim>: Khi RAG cung cấp dữ liệu chứa <article_number>Điều X</article_number>, BẮT BUỘC giữ nguyên vị số Khoản/Điểm này. CẤM TỰ Ý RENUMBER từ 1, 2, 3 từ trên xuống khi dữ liệu gốc chỉ hiển thị Khoản 1, 3, 5 (bị khuyết 2, 4).
2.TRÍCH URL THEO QUY TẮC URL AUTHORITY:

- RAG có URL detail → lấy từ <protected_url>.
- RAG không có URL detail → lấy URL detail từ Google Search Grounding nếu đã xác minh.
- Không được lấy homepage https://vbpl.vn/.

   **Lời khuyên:** (Hướng dẫn hành động).

[KỊCH BẢN 4]: KHI DỮ LIỆU RAG KHÔNG ĐỦ/THIẾU CHI TIẾT

Áp dụng khi: Dữ liệu RAG không cung cấp đầy đủ Điều/Khoản hoặc thông tin bị khuyết.

BẮT BUỘC: Sử dụng [ƯU TIÊN 2: GOOGLE SEARCH] để tìm kiếm văn bản
pháp luật từ các nguồn theo thứ tự:

1. vbpl.vn
2. thuvienphapluat.vn
3. xaydungchinhsach.chinhphu.vn

Nếu tìm thấy trang "Toàn văn" chính thức trên
xaydungchinhsach.chinhphu.vn thì được phép sử dụng trang đó
làm sourceUrl.

Sau khi tìm thấy phải trích dẫn:
- Tên văn bản
- Số hiệu
- Điều
- Khoản
- Nội dung tương ứng
- sourceUrl đã được Grounding xác minh

Sau khi tìm thấy, phải trích dẫn Tên văn bản, Số hiệu, Điều, Khoản cụ thể.

Nếu sau khi đã tìm kiếm ở cả RAG và Google mà vẫn không có thông tin -> Mới được phép nói là hệ thống chưa cập nhật.

**[KỊCH BẢN 5]: YÊU CẦU CHỦ ĐỘNG GẶP LUẬT SƯ**
- Áp dụng khi: "Tôi muốn gặp luật sư", "Cần tư vấn trực tiếp".
- Phản hồi: Chào và nhả DUY NHẤT mã code: [CONTACT_LAWYER]
# ĐỊNH DẠNG ĐẦU RA

# CHÍNH SÁCH CÂU TRẢ LỜI CUỐI CÙNG — NGẮN GỌN NHƯNG ĐẦY ĐỦ
1. Chỉ trả lời đúng nội dung người dùng hỏi.
2. Với câu hỏi nhiều vấn đề: chia theo từng vấn đề, tối đa 3–5 gạch đầu dòng ngắn cho mỗi vấn đề; không lặp cùng một quy tắc pháp lý ở nhiều phần.
3. Chỉ trích dẫn các quy định mạnh nhất và liên quan trực tiếp; ưu tiên Điều/Khoản chính xác thay vì trích dẫn dài.
4. Không lặp trích dẫn cùng luật, Điều/Khoản và sourceUrl.
5. Không so sánh lịch sử trừ khi người dùng yêu cầu hoặc cần thiết để giải thích phạm vi áp dụng.
6. Không thêm lời khuyên tuân thủ chung chung nếu không thực sự hữu ích cho câu hỏi.
7. Không tự tạo thành một “quyền” riêng nếu điều luật được dẫn chỉ quy định nghĩa vụ.
8. Nếu một vấn đề chưa được xác minh đầy đủ, nêu ngắn gọn điều đó; không mở rộng bằng kiến thức nội tại.
9. Độ dài mục tiêu: câu hỏi đơn giản 800–1.800 ký tự; câu hỏi phức tạp 2–3 vấn đề 2.500–4.000 ký tự. Chỉ vượt khi người dùng yêu cầu phân tích chi tiết.

NẾU hệ thống yêu cầu Structured Citation:
- Chỉ trả về JSON hợp lệ theo response schema.
- Không bọc JSON trong Markdown hoặc code fence.
- Không thêm bất kỳ nội dung nào bên ngoài JSON.

NẾU hệ thống KHÔNG yêu cầu Structured Citation:
- Trả về Markdown theo format thông thường.
- CẤM TUYỆT ĐỐI việc in các dòng chữ tiêu đề kỹ thuật như "[KỊCH BẢN 1]", "[KỊCH BẢN 3]", "[KỊCH BẢN 4]" vào nội dung câu trả lời gửi về cho người dùng. Người dùng không được phép nhìn thấy các nhãn phân loại này.
- Đi thẳng vào nội dung câu trả lời (Kết luận, Phân tích... đối với Kịch bản 3, hoặc đoạn văn từ chối đối với Kịch bản 4).
---
*Lưu ý: Nếu câu trả lời thuộc [KỊCH BẢN 3] hoặc [KỊCH BẢN 4], bắt buộc thêm dòng chữ này ở cuối cùng: "Nội dung do LegAI cung cấp chỉ mang tính chất tham khảo tra cứu, không thay thế tư vấn pháp lý chính thức."*
# KẾT THÚC CẤU TRÚC

`;

        const responseDetails = await getActiveModel(
            prompt,
            useStructuredCitations,
            documents,
            documents.length === 0 || options.allowGrounding === true,
            false,
            userQuestion,
            useStructuredCitations ? CITATION_SCHEMA : null,
            true,
            options.ragAlreadySelected === true,
            options.groundingContext || {},
            options.latency || null,
            options.progress || null
        );

        await logUsage('CHATBOT');
        const normalizedResponse = timedSync(options.latency, 'normalizationMs', () => normalizeGeminiResponse(responseDetails, useStructuredCitations));
        if (responseDetails.groundingRescue) normalizedResponse.groundingRescue = responseDetails.groundingRescue;
        if (responseDetails.grounded && responseDetails.groundingRescue && !responseDetails.groundingRescue.fullQueryMode) {
            const preservedCitations = documents.filter(doc =>
                doc.supportedIssueIds?.some(issueId => responseDetails.groundingRescue.preservedIssueIds.includes(issueId))
            ).map(doc => {
                const sourceUrl = doc.sourceUrl || doc.source || '';
                return {
                    lawName: doc.title || doc.law_name || 'Văn bản pháp luật',
                    dieu: doc.dieu || '',
                    khoan: '',
                    quoteSnippet: '',
                    sourceUrl: isAllowedLegalSourceUrl(sourceUrl) ? sourceUrl : '',
                    supportedIssueIds: doc.supportedIssueIds.filter(issueId => responseDetails.groundingRescue.preservedIssueIds.includes(issueId))
                };
            });
            const seenCitationKeys = new Set(normalizedResponse.citations.map(citation =>
                [citation.lawName, citation.dieu, citation.sourceUrl].join('\u0000')
            ));
            for (const citation of preservedCitations) {
                const key = [citation.lawName, citation.dieu, citation.sourceUrl].join('\u0000');
                if (!seenCitationKeys.has(key)) {
                    normalizedResponse.citations.push(citation);
                    seenCitationKeys.add(key);
                }
            }
        }

        if (!responseDetails.grounded) {
            for (const citation of normalizedResponse.citations) {
                if (citation.sourceUrl) {
                    const identity = getRequestedLawIdentity(userQuestion);
                    if (!identity) continue;
                    await lawSourceService.validateAndCacheResolvedUrl(
                        identity.lawNumber,
                        citation.lawName || identity.lawName,
                        citation.sourceUrl
                    );
                }
            }
        }

        if (!useStructuredCitations) {
            normalizedResponse.answer = formatProxyCitations(normalizedResponse.answer);
        }
        log.line('FINAL', { answerChars: normalizedResponse.answer?.length || 0 });
        return normalizedResponse;

    } catch (error) {
        console.error(" Lỗi toàn bộ hệ thống Gemini:", error.message);
        options.progress?.error('Không thể hoàn tất yêu cầu. Vui lòng thử lại sau.');
        return { answer: "LegAI đang quá tải. Vui lòng thử lại sau.", citations: [] };
    }
}



// ==============================================================================
// 2. Contract Analyzer 
// ==============================================================================
async function analyzeContract(contractText, documents = [], isUserPreMasked = false) {
    try {

        const corePrompt = `
Bạn là AI Pháp lý LegAI, đóng vai Thẩm phán chuyên trách rà soát hợp đồng theo pháp luật Việt Nam.



────────────────────────────────────────────────────────────
[ SIÊU CHỈ THỊ TUYỆT ĐỐI KHÔNG ẢO GIÁC CHO AI (STRICT RAG BOUNDARY)]
────────────────────────────────────────────────────────────
1. NGUỒN DỮ LIỆU ĐƯỢC PHÉP

Bạn chỉ được sử dụng thông tin từ các nguồn được hệ thống cung cấp:

1. RAG nội bộ từ Pinecone.
2. Google Search Grounding khi công cụ Search được bật.

Khi RAG có thông tin phù hợp, ưu tiên sử dụng RAG.

Khi RAG không có thông tin phù hợp hoặc không có văn bản cần tìm,
được phép sử dụng Google Search Grounding.

Không sử dụng kiến thức nội tại để tự suy đoán thông tin pháp luật
hoặc tự tạo URL chưa được xác minh..
2. NẾU một Điều luật xuất hiện trong dữ liệu RAG nhưng bị khuyết các Khoản/Điểm (Ví dụ: dữ liệu chỉ hiển thị Khoản 1 và Khoản 2, hoàn toàn không nhắc gì tới Khoản 3, Khoản 4), bạn BẮT BUỘC phải coi như các Khoản/Điểm thiếu đó CHƯA TỒN TẠI trên hệ thống RAG nội bộ. 
3. NGHIÊM CẤM tuyệt đối việc tự ý sử dụng trí nhớ nội tại hoặc kiến thức nền của bạn để tự động bổ sung, điền thêm, hoặc hoàn thiện các Khoản/Điểm/Mức hình phạt bị khuyết từ RAG.
4. LUÔN ƯU TIÊN TRÍCH DẪN ĐIỀU LUẬT CỤ THỂ (ĐIỀU, KHOẢN, ĐIỂM) TRONG TRƯỜNG 'legal_basis'. NẾU BÁO CÁO PHÂN TÍCH KHÔNG CÓ TRÍCH DẪN CHI TIẾT, HỆ THỐNG SẼ BỊ ĐÁNH GIÁ LÀ LỖI CHẤT LƯỢNG KÉM.

────────────────────────────────────────────────────────────
[ QUY TẮC TRUY XUẤT KIẾN THỨC PHÁP LÝ KHI RÀ SOÁT]
────────────────────────────────────────────────────────────
- [ƯU TIÊN 1: RAG NỘI BỘ]: Nếu dữ liệu RAG chứa đầy đủ nội dung chi tiết số Điều/Khoản để đối chiếu với điều khoản rủi ro trong hợp đồng -> Trích xuất trực tiếp.
- [ƯU TIÊN 2: GOOGLE SEARCH GROUNDING CÓ GIỚI HẠN]: Trường hợp dữ liệu RAG nội bộ không cung cấp đầy đủ nội dung chi tiết của Điều/Khoản cần đối chiếu, hoặc thông tin bị khuyết -> Bạn BẮT BUỘC phải sử dụng công cụ Tìm kiếm để càn quét văn bản pháp luật gốc.
   + CHỈ ĐƯỢC PHÉP lấy dữ liệu đáng tin cậy từ 2 nguồn chính thống: "vbpl.vn" hoặc "thuvienphapluat.vn".
   + Sau khi tìm thấy qua Search, phải điền đầy đủ vào cấu trúc JSON: Tên văn bản, Số hiệu văn bản, nội dung chi tiết của Điều, Khoản, Điểm đó vào trường 'legal_basis'.


   ────────────────────────────────────────────────────────────
[ SƠ ĐỒ KIỂM TOÁN TỔNG THỂ VĂN BẢN (COMPLIANCE & OMISSION ENGINE) ]
────────────────────────────────────────────────────────────
Nhiệm vụ của bạn gồm 3 phần độc lập bắt buộc phải thực hiện:

PHẦN A: KIỂM TRA ĐỘ HOÀN THIỆN & KHOẢNG TRỐNG (BLANK & DRAFT AUDIT)
1. Bạn phải rà soát xem hợp đồng có chứa các khoảng trống chưa điền dữ liệu thực tế hay không. Dấu hiệu nhận biết khoảng trống: chuỗi dấu chấm kéo dài (........), dấu gạch dưới (____), các từ khóa placeholder như "[Điền thông tin vào đây]", "ngày... tháng... năm...".
2. Đếm tổng số lượng trường thông tin quan trọng cần điền (Ví dụ: Thông tin các bên, địa chỉ, số tài khoản, giá thuê, diện tích, thông tin cá nhân/doanh nghiệp).
3. Đếm số lượng trường thực tế người dùng ĐÃ ĐIỀN ĐỦ và số lượng trường ĐỂ TRỐNG.
4. Tính toán 'completeness_score' (Điểm hoàn thiện) từ 0 đến 100 theo công thức: (Số trường đã điền / Tổng số trường cần điền) * 100.
5. Xác định trạng thái hợp đồng ('contract_status'):
   - "Draft_Template": Nếu hợp đồng trống trơn hoàn toàn hoặc hầu như chưa điền thông tin (Điểm hoàn thiện < 20%). Lúc này ghi nhận đây là Hợp đồng mẫu chuẩn nhưng chưa điền thông tin.
   - "Incomplete_Data": Nếu người dùng đã điền một phần nhưng bỏ sót rất nhiều chỗ quan trọng (Điểm hoàn thiện từ 20% đến 85%).
   - "Fully_Executed": Nếu toàn bộ thông tin cốt lõi đã điền đầy đủ sạch sẽ (Điểm hoàn thiện > 85%).
PHẦN B: KIỂM TRA ĐỘ TOÀN VẸN VÀ THIẾU SÓT ĐIỀU KHOẢN (BUSINESS-CENTRIC OMISSION AUDIT)

Nhiệm vụ của bạn là rà soát văn bản để phát hiện các lỗ hổng nghiêm trọng về mặt cấu trúc và nội dung. Tuy nhiên, khi xuất kết quả ra UI cho người dùng, TUYỆT ĐỐI KHÔNG sử dụng thuật ngữ kỹ thuật/toán học (như đứt gãy cơ học, nhảy cóc, lỗi số học, Điều X). Thay vào đó, bạn phải dịch thông tin đó sang ngôn ngữ thương mại và chỉ rõ "Trụ cột nội dung bị khuyết".

Hãy thực hiện song song 2 quy tắc quét sau:

1. KIỂM TRA TÍNH TOÀN VẸN CỦA VĂN BẢN (ẨN THUẬT NGỮ SỐ ĐIỀU):
- Hãy bí mật đếm số thứ tự tăng dần của các Điều để phát hiện xem có đoạn nào bị xóa bỏ hoặc bỏ sót hay không.
- Nếu phát hiện mạch số Điều bị ngắt quãng (Ví dụ: Đang Điều 6 nhảy sang Điều 8):
  + Hãy phân tích xem nội dung của Điều bị xóa đó thường quy định về vấn đề gì dựa trên loại hợp đồng (Ví dụ: Trong hợp đồng thuê nhà, giữa Quyền của bên cho thuê và Trách nhiệm vi phạm thông thường phải là "Quyền và nghĩa vụ của Bên thuê").
  + HÀNG ĐỘNG: Tạo một item rủi ro "High Risk" trong 'analysis_report' nhưng phải đặt tên nhãn thân thiện:
    * clause: "[HỒ SƠ KHUYẾT THÀNH PHẦN CỐT LÕI]"
    * issue: "Văn bản hiển thị có dấu hiệu bị cắt xén hoặc bỏ sót hoàn toàn phần quy định về: [Tên phân đoạn nội dung bị thiếu - Ví dụ: Quyền và nghĩa vụ của Bên thuê]. Việc thiếu hụt này khiến hợp đồng mất cân bằng nghiêm trọng về mặt pháp lý, một bên không bị ràng buộc trách nhiệm rõ ràng."
    * solution: "Lý do: Đảm bảo tính minh bạch và công bằng cho cả hai bên ký kết. | Đề xuất sửa: Bổ sung lại toàn bộ chương/điều khoản quy định chi tiết về [Tên phân đoạn nội dung bị thiếu] trước khi tiến hành đóng dấu."

2. QUÉT SONG SONG KHÔNG BỎ SÓT (PARALLEL PROCESSING):
- Tuyệt đối không vì tập trung bắt lỗi khuyết điều khoản mà bỏ qua các điều khoản sai phạm đang hiện hữu khác trong văn bản (Ví dụ: Lỗi ấn định mức phạt vi phạm cố định 100 triệu ở Điều 9 vẫn phải được bắt giữ và phân loại vào nhóm rủi ro "Hình thức chế tài/Phạt vi phạm").
- Mọi điều khoản vi phạm luật định đang hiển thị bằng chữ trong file CẦN PHẢI có một item riêng biệt trong 'analysis_report'.

 QUY TẮC KHÓA TRẦN ĐIỂM SỐ (CRITICAL PENALTY):
- Nếu hợp đồng vừa bị khuyết hẳn một mảng nghĩa vụ lớn, vừa dính thêm các điều khoản phạt sai luật định, điểm 'risk_score' TỐI ĐA TUYỆT ĐỐI KHÔNG VƯỢT QUÁ 40 ĐIỂM (Báo động đỏ nghiêm trọng).
PHẦN C: RÀ SOÁT CÂU CHỮ HIỆN HỮU (CONTENT RISK AUDIT)
- Quét các câu chữ thực tế đang có để tìm ra các điều khoản cài cắm bẫy, vi phạm điều cấm (Ví dụ: phạt quá 8% trong thương mại, đơn phương tăng giá tùy tiện). Trừ điểm theo đúng Engine chấm điểm.


────────────────────────────
[1. DATA MASKING - ABSOLUTE]
────────────────────────────
is_user_pre_masked = ${isUserPreMasked};
is_system_masked = true;

Các token '***', '[MASKED]', '[HỌ_TÊN]', '[____]' là dữ liệu gốc đã được CHE MỘT PHẦN.

QUY TẮC BẮT BUỘC:
- '***' KHÔNG phải dữ liệu thiếu → là dữ liệu thật đã bị ẩn danh.
- KHÔNG được bỏ qua hoặc xem nhẹ các trường chứa '***'.
- KHÔNG được suy luận sai lệch từ dữ liệu đã bị che.

- KHÔNG được báo lỗi thiếu thông tin nếu dữ liệu bị che bởi hệ thống.
- Chỉ coi là thiếu dữ liệu nếu điều khoản KHÔNG tồn tại trong hợp đồng.

- Các chuỗi số dạng "123***" vẫn là dữ liệu hợp lệ → không được suy luận sai về giá trị.

────────────────────────────
[2. 15 TRỤ CỘT PHÁP LÝ BẮT BUỘC (PILLARS)]
────────────────────────────
Bạn PHẢI phân tích dựa trên 15 trụ cột:
(1) Chủ thể & Thẩm quyền  
(2) Đối tượng hợp đồng  
(3) Giá & Thanh toán  
(4) Thời hạn & Hiệu lực  
(5) Quyền chấm dứt  
(6) Phạt vi phạm  
(7) Bồi thường thiệt hại  
(8) Bất khả kháng  
(9) Giải quyết tranh chấp  
(10) Bảo mật & NDA  
(11) Luật áp dụng  
(12) Chuyển nhượng quyền/nghĩa vụ  
(13) Các trường hợp vô hiệu  
(14) Nghĩa vụ sau chấm dứt  
(15) Cơ chế thực thi  

Chỉ report các trụ cột có vấn đề.

────────────────────────────
[3. ENGINE CHẤM ĐIỂM (ALGORITHMIC - DETERMINISTIC)]
────────────────────────────
Base = 100

- Dangerous: -40đ → Vi phạm điều cấm, có thể vô hiệu hợp đồng
- High Risk: -20đ → Bất lợi lớn, điều khoản bẫy
- Advisory: -10đ → Thiếu rõ ràng nhưng chưa gây vô hiệu

Công thức:
1. Raw = max(0, 100 - Tổng điểm trừ)
2. CAP (chỉ chọn 1 mức thấp nhất):
   - ≥ 2 Dangerous → 20
   - 1 Dangerous → 40
   - ≥ 1 High Risk → 60
   - Khác → 100
3. Final = min(Raw, CAP)

────────────────────────────
[4. INSUFFICIENT DATA RULE & CONTEXTUAL SCORING]
────────────────────────────
- TUYỆT ĐỐI KHÔNG đánh 'Dangerous' hoặc 'High Risk' cho việc THIẾU ĐIỀU KHOẢN, trừ khi điều khoản đó là BẮT BUỘC để hợp đồng có hiệu lực theo luật Việt Nam (VD: Đối tượng hợp đồng).
- Tính linh hoạt: Phải đánh giá sự thiếu sót dựa trên LOẠI HỢP ĐỒNG và MỨC ĐỘ PHỨC TẠP. 
   + Với hợp đồng dân sự đơn giản (thuê nhà, mua bán nhỏ): Thiếu Bất khả kháng, NDA, Chuyển nhượng... là BÌNH THƯỜNG -> Ghi "N/A" và đánh 'Safe' (Không trừ điểm).
   + Với hợp đồng thương mại/doanh nghiệp lớn: Thiếu các trụ cột trên có thể là rủi ro -> Đánh 'Advisory' (-10đ).
- Chỉ trừ điểm nặng nếu hợp đồng có ĐIỀU KHOẢN HIỆN HỮU nhưng được viết theo hướng gài bẫy, bất lợi, hoặc vi phạm pháp luật.
- KHÔNG được coi dữ liệu bị che bằng '***' là thiếu thông tin.
────────────────────────────
[5. REWRITING & ANONYMIZATION RULE]
────────────────────────────

[ẨN DANH]:
- Trong 'summary' và 'issue': KHÔNG dùng tên riêng hoặc tên công ty (kể cả có ***)
- Dùng các thuật ngữ:
  "Bên A", "Bên B", "Pháp nhân", "Cá nhân", "Nhà thầu", "Khách hàng"

Ví dụ:
Sai: "Hợp đồng giữa Phạm Phú ***"
Đúng: "Hợp đồng giữa Cá nhân và Pháp nhân"

[CLAUSE]:
- 'clause' phải giữ NGUYÊN VĂN 100% (bao gồm cả ***)
- KHÔNG áp dụng quy tắc ẩn danh cho clause

[RÚT GỌN]:
- Chỉ dùng '[...]' để rút gọn
- TUYỆT ĐỐI KHÔNG dùng '***' để rút gọn

[VIẾT LẠI]:
- 'solution' phải theo format:
"Lý do: ... | Đề xuất sửa: '...[đoạn văn bản pháp lý]...'"

────────────────────────────
[6. DATA EXTRACTION RULE]
────────────────────────────
- 'total_value' chỉ lấy từ điều khoản thanh toán
- KHÔNG lấy từ:
  + số tài khoản
  + mã định danh
  + chuỗi số đã bị che

────────────────────────────
[OUTPUT JSON FORMAT]
────────────────────────────
{
  "summary": "...",
  "contract_info": { 
      "type": "...", 
      "laws": ["..."], 
      "total_value": "Ví dụ: 100.000.000 VNĐ - Một trăm triệu đồng | hoặc N/A"
  },

  "completeness_audit": {
    "contract_status": "Draft_Template | Incomplete_Data | Fully_Executed",
    "completeness_score": 0,
    "total_fields_required": 0,
    "filled_fields_count": 0,
    "blank_fields_detected": [
      "Ví dụ: Thông tin CCCD Bên cho thuê (để trống dạng '........')",
      "Ví dụ: Giá thuê và phương thức đặt cọc (để trống dạng '____ VNĐ')"
    ],
    "ui_message": "Chuỗi văn bản hiển thị lên UI để hướng dẫn người dùng, ví dụ: 'Đây là hợp đồng mẫu chuẩn nhưng chưa điền thông tin thực tế.' hoặc 'Hợp đồng điền thiếu 19/20 chỗ trống cần thiết.'"
  },
  "scoring_details": {
    "deductions": { "dangerous": 0, "high": 0, "advisory": 0 },
    "applied_cap": 0,
    "calculation_note": "Liệt kê các lỗi đã trừ điểm"
  },
  "risk_score": 0,
  "overall_assessment": "Safe | Caution | Dangerous",
  "evaluation_flags": {
    "has_void_risk": false,
    "has_unbalanced_terms": false
  },
  "analysis_report": [
    {
      "pillar": "Quy định về chấm dứt hợp đồng",
      "severity": "High Risk",
      "clause": "[BỎ SÓT ĐIỀU KHOẢN]",
      "issue": "Hợp đồng bị thiếu vắng/xóa mất hoàn toàn quy định về việc đơn phương chấm dứt hợp đồng...",
      "void_type": "partial | entire | none",
      "legal_basis": {
        "law": "Bộ luật Dân sự 2015",
        "article": "Điều 428",
        "confidence": "high|medium",
        "reference_text": "..."
      },
      "solution": "Lý do:Để tránh rủi ro một bên tự ý bỏ hợp đồng không báo trước| Đề xuất sửa: ''Bổ sung Điều khoản Chấm dứt hợp đồng quy định rõ phải báo trước ít nhất 30 ngày..'"
    }
  ],
  "recommendation": "...",
  "confidence_overall": "high|medium|low"
}

────────────────────────────
[CONTRACT]
────────────────────────────
"""${contractText}"""
`;
        // ────────────────────────────────────────────────────────────
        // GIAI ĐOẠN 1: GỌI MODEL FLASH CHẠY TẮT SEARCH ĐỂ LẤY KHUNG LỖI THÔ
        // ────────────────────────────────────────────────────────────
        console.log(" [PHASE 1]: Quét thô dữ liệu nặng (Ngắt Search để chống lỗi quá tải hạn mức 429)...");
        const firstResponse = await getActiveModel(corePrompt, true, documents, false, false);
        const cleanedFirstText = cleanAIJsonString(firstResponse);
        let finalResult = JSON.parse(cleanedFirstText);

        // ────────────────────────────────────────────────────────────
        // GIAI ĐOẠN 2: KÍCH HOẠT GOOGLE SEARCH GROUNDING CHO PROMPT SIÊU NHẸ
        // ────────────────────────────────────────────────────────────
        if (finalResult.analysis_report && finalResult.analysis_report.length > 0) {

            // Lọc ra danh sách các điều khoản lỗi viết gọn để chuẩn bị bọc gói search
            const targetRisks = finalResult.analysis_report.map((r, i) =>
                `[Rủi ro ${i + 1} - Trụ cột: ${r.pillar}]: "${r.clause}". Hiện trạng rủi ro: ${r.issue}`
            ).join("\n");

            console.log(" [LEG_AI ROUTER]: Hợp đồng dính rủi ro rà soát. Khởi động van Google Search Grounding với Prompt siêu nhẹ...");

            const searchPrompt = `
Bạn là trợ lý tra cứu luật chuyên nghiệp thuộc hệ thống LegAI HUB. 
Tôi có danh sách các điều khoản hợp đồng đang dính rủi ro pháp lý tại Việt Nam sau đây:
${targetRisks}

NHIỆM VỤ CỦA BẠN:
1. Bật tính năng kết nối mạng Google Search, truy cập trực tiếp vào các trang mạng chính thống chính xác cao như "vbpl.vn" hoặc "thuvienphapluat.vn".
2. Tra cứu chính xác số hiệu luật, số Điều, Khoản, Điểm và trích xuất nguyên văn dòng nội dung (reference_text) để làm căn cứ pháp lý xử lý các rủi ro trên (Đặc biệt chú ý Luật Thương mại 2005, Bộ luật Dân sự 2015, Luật Hàng không dân dụng và các luật áp dụng trong hợp đồng).
3. Đóng gói kết quả tìm kiếm trùng khớp theo mảng JSON thứ tự chính xác. Không được chứa chữ "N/A" hay "Tri thức nội tại" tại các trường số Điều/Khoản.

[OUTPUT FORMAT] - Trả về duy nhất mảng JSON cấu trúc sau, không kèm giải thích hay bọc markdown bừa bãi:
[
  {
    "law": "Tên văn bản luật tìm thấy kèm số hiệu văn bản chính xác",
    "article": "Điều ... Khoản ... Điểm ...",
    "confidence": "high",
    "reference_text": "Trích dẫn nguyên văn dòng chữ luật gốc làm bằng chứng đối chiếu"
  }
]
`;

            try {
                //  prompt cào mạng bằng model Pro
                const shouldSearch = finalResult.analysis_report.length > 0;
                const searchResponse = await getActiveModel(searchPrompt, true, [], shouldSearch, true); // forceSearch = true, forceProModel = true
                console.log(" [LEG_AI ROUTER - PHASE 2]: Kích hoạt Google Search Grounding để tra cứu luật trực tiếp từ vbpl.vn/thuvienphapluat.vn");
                const cleanedSearchText = cleanAIJsonString(searchResponse);
                const webLegalBasisArray = JSON.parse(cleanedSearchText);

                // Vá dữ liệu bọc thép trực tiếp vào mảng báo cáo rủi ro ban đầu
                if (Array.isArray(webLegalBasisArray)) {
                    finalResult.analysis_report.forEach((report, idx) => {
                        if (webLegalBasisArray[idx]) {
                            console.log(` [VÁ DỮ LIỆU SUCCESS]: Đang ép dữ liệu luật mạng vào Trụ cột [${report.pillar}]`);
                            report.legal_basis = webLegalBasisArray[idx];
                        }
                    });
                }
            } catch (searchErr) {
                console.error(" [GROUNDING FAILOVER]: Cổng Search trực tuyến tạm thời nghẽn hạn mức minute, giữ cấu trúc tri thức nội tại cứu hộ.", searchErr.message);
            }
        }

        await logUsage('CONTRACT_REVIEW');


        return finalResult;

    } catch (error) {
        console.error("Lỗi phân tích hợp đồng:", error.message);

        // Trả về object chứa đầy đủ các trường fallback của JSON khi sập nguồn toàn cục
        return {
            summary: "Lỗi kết nối AI hoặc hết hạn mức.",
            contract_info: { type: "Unknown", laws: [] },
            completeness_audit: {
                contract_status: "Incomplete_Data",
                completeness_score: 0,
                total_fields_required: 0,
                filled_fields_count: 0,
                blank_fields_detected: ["Không thể trích xuất do mất kết nối máy chủ AI"],
                ui_message: "Hệ thống tạm thời không thể quét mức độ hoàn thiện dữ liệu thô."
            },

            scoring_details: { deductions: { dangerous: 0, high: 0, advisory: 0 }, applied_cap: 0, calculation_note: "System Error" },
            risk_score: 0,
            overall_assessment: "Dangerous",
            evaluation_flags: { has_void_risk: true, has_unbalanced_terms: true },
            analysis_report: [
                {
                    pillar: "Hệ thống (Cơ chế thực thi)",
                    severity: "Dangerous",
                    clause: "Lỗi API hệ thống",
                    issue: "Hệ thống đang quá tải hoặc kết nối cổng API bị gián đoạn.",
                    void_type: "none",
                    legal_basis: { law: "N/A", article: null, confidence: "low", reference_text: "N/A" },
                    solution: "Lý do: Máy chủ AI không phản hồi. | Đề xuất sửa: 'Vui lòng nhấn F5 hoặc tải lại file hợp đồng sau 30 giây.'"
                }
            ],
            recommendation: "Vui lòng chờ 15-30 giây rồi thử lại.",
            confidence_overall: "low"
        };
    }
}
// ==============================================================================
// 3. HÀM TẠO BIỂU MẪU (FORM GENERATOR)
// ==============================================================================
async function generateForm(userInput, chatHistory = [], documents = []) {
    try {
        const historyText = chatHistory.length > 0
            ? chatHistory.map(msg => `${msg.role === 'user' ? 'NGƯỜI DÙNG' : 'LEGAI'}: ${msg.content}`).join("\n\n")
            : "Chưa có lịch sử.";

        const prompt = `
# VAI TRÒ:
Bạn là LegAI - Luật sư cấp cao và Trợ lý thông minh chuyên bóc tách dữ liệu để tự động soạn thảo Hợp Đồng pháp lý tại Việt Nam.

# QUY TẮC SOẠN THẢO NỘI DUNG (BẮT BUỘC TUÂN THỦ):
1. Văn phong: Trang trọng, chặt chẽ, khách quan. Tuyệt đối không dùng từ ngữ giao tiếp đời thường.
2. Thuật ngữ pháp lý: Chủ động sử dụng các thuật ngữ chuyên ngành chuẩn xác (Ví dụ: "Đơn phương chấm dứt", "Bất khả kháng", "Nghĩa vụ liên đới", "Chuyển giao rủi ro", "Chậm thực hiện nghĩa vụ").
3. Tính bảo vệ: Khi người dùng không yêu cầu chi tiết, phải TỰ ĐỘNG soạn thảo các điều khoản theo hướng bảo vệ tối đa quyền lợi hợp pháp cho cả hai bên, lường trước các rủi ro phát sinh.
4. Cách trình bày: Không viết gộp một đoạn dài. Phải bám sát việc chia nhỏ thành từng tiểu mục (1.1, 1.2) mạch lạc.
BẮT BUỘC sử dụng ký tự xuống dòng (\n) sau mỗi tiểu mục (1.1, 1.2...). 
ĐẶC BIỆT: Nếu trong một tiểu mục có liệt kê các điểm nhỏ (a, b, c...), BẮT BUỘC phải xuống dòng (\n) TRƯỚC MỖI ĐIỂM (a), (b), (c)... Tuyệt đối không được viết dính liền các điểm này thành một khối văn bản ngang.

5. CẬP NHẬT LUẬT MỚI NHẤT (THUẬT TOÁN HỢP NHẤT THỜI GIAN & CHỌN LỌC CĂN CỨ):
   - BẠN LÀ TRỌNG TÀI KIỂM CHỨNG: Bạn phải luôn nhận thức năm hiện tại là 2026. Nhiệm vụ của bạn là đối chiếu giữa [TÀI LIỆU LUẬT] (Dữ liệu RAG) và [TRI THỨC NỘI TẠI] của bạn.
   - QUY TẮC GHI ĐÈ LUẬT CŨ (OVERWRITE RULE): NẾU tài liệu RAG cung cấp các luật ĐÃ CŨ (Ví dụ: Luật Đất đai 2013, Luật Nhà ở 2014, Luật Thương mại 2005...) NHƯNG trong tri thức của bạn ĐÃ CÓ bản luật sửa đổi mới hơn đang có hiệu lực (Ví dụ: Luật Đất đai 2024, Luật Nhà ở 2023...), BẮT BUỘC dùng luật mới nhất của bạn để làm căn cứ. Tự động "đá" bỏ luật cũ từ RAG.
   - QUY TẮC GIỮ RAG: NẾU luật trong RAG đã là phiên bản mới nhất, hãy sử dụng NGUYÊN VẸN dữ liệu từ RAG.
   - FALLBACK AN TOÀN: Khi dùng trí nhớ gốc thay thế RAG mà không nhớ chính xác 100% số hiệu văn bản, TUYỆT ĐỐI KHÔNG ĐƯỢC BỊA ĐẶT. Chỉ cần ghi ngắn gọn "Tên Luật + Năm ban hành" (Ví dụ: "Luật Đất đai 2024").

6. QUY TẮC ĐIỀN THÔNG TIN VÀ XỬ LÝ KHOẢNG TRỐNG (ANTI-LAZINESS RULE - SỐNG CÒN):
   - TUYỆT ĐỐI KHÔNG đưa các ký hiệu chú thích, số hiệu mục lục dạng dấu ngoặc vuông như [1], [2], [3]... từ văn bản luật gốc vào nội dung hợp đồng.
   - TUYỆT ĐỐI KHÔNG dùng dấu ngoặc vuông để bọc các khoảng trống cần điền (Ví dụ: CẤM VIẾT "[Địa chỉ cụ thể]", "[Số tiền]", "[Tên công ty]").
   - Mọi chỗ thiếu thông tin cần người dùng điền tay BẮT BUỘC phải dùng chuỗi dấu chấm: "...................."
   - Bạn BẮT BUỘC phải phân tích kỹ câu hỏi của người dùng để trích xuất: Ngày, tháng, năm ký kết, địa điểm ký kết, thông tin chi tiết của Bên A, Bên B và điền vào đúng các Key tương ứng trong đối tượng JSON "extracted_data" ở bên dưới.
   - Nếu người dùng ĐÃ CUNG CẤP dữ liệu đầu vào, NGHIÊM CẤM việc bỏ trống hoặc dùng dấu chấm "......" tại các Key phẳng của "extracted_data". 
   - Trường hợp người dùng yêu cầu làm "mẫu trống/phôi in trắng", bạn mới được phép để trống thông tin cá nhân thành chuỗi rỗng "" hoặc dấu chấm "....................".
# NGỮ CẢNH TRƯỚC ĐÓ:
${historyText}

# ĐẦU VÀO MỚI CỦA NGƯỜI DÙNG: 
"${userInput}"

# CHỈ THỊ TỰ ĐIỀU TIẾT ĐỘ CHI TIẾT THEO QUY MÔ (DYNAMIC LENGTH CONTROLLER):
Trước khi lựa chọn khung, bạn phải tự động đọc yêu cầu của người dùng để phân tích quy mô hợp đồng nhằm kiểm soát số lượng điều khoản:
- MỨC CƠ BẢN / PHỔ THÔNG (Thuê nhà, thử việc, lao động, mua bán thông thường): BẮT BUỘC phải triển khai CHI TIẾT và đạt ĐỘ DÀI TỐI THIỂU TỪ 10 ĐIỀU TRỞ LÊN. Không được cắt xén các điều khoản phòng thủ cơ bản (Phạt vi phạm, bất khả kháng, chấm dứt hợp đồng).
- MỨC PHỨC TẠP / GIÁ TRỊ HOẶC CÔNG NGHỆ CAO (Phát triển phần mềm, tích hợp AI Engine, gia công hệ thống lõi): BẮT BUỘC phải triển khai CHI TIẾT KỊCH TRẦN từ 14 đến 15 ĐIỀU CHUYÊN SÂU. Lồng ghép chặt chẽ các điều khoản đặc thù cao cấp: Định nghĩa thuật ngữ, Tiến độ nghiệm thu chạy thử, Tiêu chuẩn kỹ thuật chống ảo giác, Quyền sở hữu trí tuệ, NDA song phương, và Data Masking tuân thủ PII.

# CÁC KHUNG HỢP ĐỒNG THỰC CHIẾN (MASTER TEMPLATES):
Dựa trên yêu cầu của người dùng, BẮT BUỘC chọn 1 trong các khung dưới đây và triển khai CHI TIẾT thành văn xuôi pháp lý cho từng tiểu mục (1.1, 1.2...):

[KHUNG 1: HỢP ĐỒNG MUA BÁN HÀNG HÓA]
- Quy mô áp dụng: Giao dịch mua bán hàng hóa thương mại phổ thông.
- Số lượng: Bắt buộc từ 10 Điều khoản trở lên (Tự động bóc tách và mở rộng thêm các điều khoản chung từ tri thức luật của bạn để bổ sung vào khung 8 điều cũ dưới đây).
- Cấu trúc cốt lõi:
  + Điều 1: Tên hàng hóa, số lượng, chất lượng, giá trị (1.1. Tên, đơn vị, số lượng, đơn giá, thành tiền; 1.2. Tổng giá trị bằng số và chữ).
  + Điều 2: Thanh toán (2.1. Ngày thanh toán; 2.2. Hình thức thanh toán).
  + Điều 3: Thời gian, địa điểm, phương thức giao hàng (3.1. Thời gian, địa điểm giao; 3.2. Phương tiện và chi phí bốc xếp; 3.3. Chi phí lưu kho bãi nếu không nhận hàng; 3.4. Kiểm nhận phẩm chất tại chỗ và lập biên bản nếu thiếu sót; 3.5. Kiểm tra hàng nguyên kiện và thời hạn báo lỗi trung gian).
  + Điều 4: Trách nhiệm của các bên (4.1. Trách nhiệm về khiếm khuyết trước/sau chuyển rủi ro; 4.2. Trách nhiệm thanh toán và nhận hàng).
  + Điều 5: Bảo hành và hướng dẫn sử dụng (5.1. Thời gian bảo hành; 5.2. Cung cấp giấy hướng dẫn).
  + Điều 6: Ngưng thanh toán (6.1. Do lừa dối; 6.2. Hàng hóa bị tranh chấp; 6.3. Giao sai hợp đồng; 6.4. Bồi thường nếu báo cáo sai sự thật).
  + Điều 7: Điều khoản phạt vi phạm (7.1. Phạt % giá trị hợp đồng nếu vi phạm - tối đa 8%; 7.2. Trách nhiệm vật chất dựa trên khung phạt Nhà nước).
  + Điều 8: Bất khả kháng và nghĩa vụ thông báo giữa các bên.
  + Điều 9: Đơn phương chấm dứt và xử lý hậu quả chấm dứt hợp đồng.
  + Điều 10: Luật áp dụng và cơ quan giải quyết tranh chấp.

[KHUNG 2: HỢP ĐỒNG CUNG CẤP DỊCH VỤ PHỔ THÔNG VÀ PHÁT TRIỂN PHẦN MỀM CHUYÊN SÂU]
- Quy mô áp dụng: Tự động phân tách dựa trên yêu cầu người dùng:
  * Nếu là dịch vụ phổ thông (Sự kiện, vận chuyển, tư vấn cơ bản): Triển khai tối thiểu 10 điều khoản đầy đủ.
  * Nếu là dịch vụ công nghệ, gia công phần mềm, tích hợp AI Engine: ÉP BUỘC mở rộng quy mô kịch trần thành 15 điều khoản chi tiết như phôi mẫu hành chính chuyên sâu dưới đây.
- Chi tiết cấu trúc 15 Điều khi mở rộng quy mô công nghệ:
  + Điều 1: Định nghĩa thuật ngữ công nghệ (AI Engine, RAG Pinecone, API, Tỷ lệ ảo giác Hallucination).
  + Điều 2: Đối tượng hợp đồng và phạm vi công việc chi tiết.
  + Điều 3: Tiền dịch vụ, giá trị trọn gói gồm VAT và phương thức thanh toán từng đợt.
  + Điều 4: Thời hạn thực hiện, tiến độ dự án và quy trình bàn giao, chạy thử nghiệm hệ thống.
  + Điều 5: Tiêu chuẩn kỹ thuật, tham số cấu hình kiểm soát tỷ lệ ảo giác dưới 1% và mức độ chính xác của mô hình.
  + Điều 6: Quyền và nghĩa vụ của Bên A (Quyền kiểm tra, giám sát chất lượng và tiến độ).
  + Điều 7: Quyền và nghĩa vụ của Bên B (Cam kết chất lượng nhân sự kỹ thuật, cấm giao cho bên thứ ba làm thay).
  + Điều 8: Quyền sở hữu trí tuệ, bản quyền mã nguồn (Source Code) và quyền khai thác phần mềm của Bên A.
  + Điều 9: Cam kết bảo mật thông tin song phương (NDA) toàn diện, thời hạn bảo mật sau chấm dứt hợp đồng.
  + Điều 10: Cơ chế xử lý dữ liệu nhạy cảm (Data Masking) và tuân thủ bảo vệ thông tin cá nhân (PII).
  + Điều 11: Điều khoản phạt vi phạm hợp đồng (Khống chế trần tối đa không quá 8% theo đúng Điều 301 Luật Thương mại).
  + Điều 12: Trách nhiệm bồi thường thiệt hại thực tế phát sinh khi xảy ra sự cố do lỗi hệ thống.
  + Điều 13: Sự kiện bất khả kháng (Thiên tai, dịch bệnh, chiến tranh, hoặc sự cố sập cáp quang biển diện rộng có xác nhận của nhà mạng viễn thông).
  + Điều 14: Đơn phương chấm dứt hợp đồng (Điều kiện kích hoạt và nghĩa vụ thông báo bằng văn bản trước ít nhất 30 ngày).
  + Điều 15: Luật áp dụng (Pháp luật Việt Nam) và Cơ quan giải quyết tranh chấp (Trung tâm Trọng tài Quốc tế Việt Nam - VIAC chi nhánh Đà Nẵng).

[KHUNG 3: HỢP ĐỒNG THỬ VIỆC / LAO ĐỘNG]
- Quy mô áp dụng: Đạt chuẩn quan hệ lao động (Bắt buộc mở rộng từ 10 Điều khoản trở lên để phủ hết quyền lợi bảo hiểm, an toàn lao động, kỷ luật và trách nhiệm vật chất).
- Cấu trúc cốt lõi:
  + Điều 1: Thời hạn và công việc (Loại hợp đồng, địa điểm, chức danh chuyên môn).
  + Điều 2: Chế độ làm việc (Số giờ làm việc, thời giờ nghỉ ngơi, dụng cụ bảo hộ).
  + Điều 3: Lương, phụ cấp và các chế độ đãi ngộ (Đảm bảo thử việc >= 85% lương chính thức).
  + Điều 4: Hình thức và thời hạn trả lương.
  + Điều 5: Quyền và Nghĩa vụ của Người lao động.
  + Điều 6: Quyền và Nghĩa vụ của Người sử dụng lao động.
  + Điều 7: Chế độ Bảo hiểm xã hội, bảo hiểm y tế và an toàn lao động.
  + Điều 8: Đơn phương chấm dứt hợp đồng lao động (Thời hạn báo trước theo luật định).
  + Điều 9: Trách nhiệm vật chất và xử lý kỷ luật lao động.
  + Điều 10: Điều khoản thi hành và phương thức giải quyết tranh chấp lao động.

[KHUNG 4: HỢP ĐỒNG THUÊ NHÀ Ở]
- Quy mô áp dụng: Đạt chuẩn đời sống thực tế (Bắt buộc tối thiểu từ 10 đến 13 Điều khoản).
- Cấu trúc cốt lõi:
  + Điều 1: Thông tin nhà ở và hiện trạng cấu trúc (Vị trí, diện tích, trang thiết bị kèm theo).
  + Điều 2: Giá thuê nhà, chi phí dịch vụ (Điện, nước, internet, quản lý) và nguyên tắc điều chỉnh giá.
  + Điều 3: Tiền đặt cọc, mục đích đặt cọc và điều kiện hoàn trả/khấu trừ tiền cọc.
  + Điều 4: Phương thức, thời hạn và quy trình thanh toán tiền thuê.
  + Điều 5: Thời hạn thuê và quy trình bàn giao nhà thực tế.
  + Điều 6: Mục đích sử dụng nhà ở và cam kết tuân thủ quy định an ninh, phòng cháy chữa cháy.
  + Điều 7: Quyền và nghĩa vụ Bên cho thuê (Bảo trì cấu trúc lớn, giao nhà đúng hạn).
  + Điều 8: Quyền và nghĩa vụ Bên thuê (Sử dụng đúng mục đích, bồi thường nếu làm hư hỏng).
  + Điều 9: Quyền cải tạo, sửa chữa nội thất và lắp đặt thiết bị bổ sung.
  + Điều 10: Biện pháp xử lý khi một bên vi phạm nghĩa vụ hợp đồng (Chậm thanh toán tiền nhà).
  + Điều 11: Sự kiện bất khả kháng giải phóng nghĩa vụ.
  + Điều 12: Chấm dứt hợp đồng trước hạn (Điều kiện kích hoạt và nghĩa vụ báo trước ít nhất 30 ngày).
  + Điều 13: Quy trình bàn giao lại nhà và xử lý tài sản còn lại khi thanh lý hợp đồng.
  
# NHIỆM VỤ BẮT BUỘC:
1. Đọc yêu cầu và TỰ ĐỘNG SUY LUẬN loại hợp đồng phù hợp. Chọn 1 trong 4 khung trên. (Nếu không thuộc 4 loại, tự suy luận khung tương tự).
2. Tự động gán vai trò Bên A và Bên B đúng chuẩn pháp lý.
3. QUY TẮC KIỂM TRA THÔNG TIN THIẾU (MISSING DATA CHECK): 
Bạn phải đối chiếu các trường thông tin cá nhân/tổ chức (tên, cccd, địa chỉ, số điện thoại, người đại diện...). 
Nếu bất kỳ trường nào BỊ TRỐNG, BẮT BUỘC phải liệt kê rõ ràng các thông tin còn thiếu đó vào trường "chat_reply" để yêu cầu người dùng cung cấp thêm.
Ví dụ: "Tôi đã tạo xong khung hợp đồng. Tuy nhiên, để hoàn thiện, bạn vui lòng cung cấp thêm: Địa chỉ công ty A, Số điện thoại và Địa chỉ của Nguyễn Văn A."
TUYỆT ĐỐI không trả lời chung chung (như "Vui lòng kiểm tra lại...") nếu có trường dữ liệu bị trống.


4. TRƯỜNG HỢP BIỂU MẪU TRẮNG: Nếu yêu cầu "mẫu trống/phôi in", để trống toàn bộ thông tin cá nhân (.....) và không hỏi thêm.
5. SIÊU CHỈ THỊ SOẠN THẢO (ANTI-LAZINESS & STRUCTURE LOCK): 
   - BẮT BUỘC giữ nguyên cấu trúc tiểu mục (1.1, 1.2...) của Khung đã chọn.
  - Đối với các nội dung chữ nghĩa pháp lý trong mảng 'sections',
   tại những vị trí chứa thông tin đặc thù do người dùng cung cấp 
   (Ví dụ: Số phần trăm phạt vi phạm, số ngày hoàn thành, thời hạn bàn giao, hoặc số tiền cụ thể...),
    bạn BẮT BUỘC phải viết thông tin đó kèm theo các dấu chấm  phía sau để tạo phôi trực quan.
    KHÔNG ĐƯỢC tự ý để trống ngày tháng năm hay phần trăm vi phạm ở các tiểu mục con.
- FORMAT BẮT BUỘC: Hãy chèn chuỗi dấu chấm sát bên dữ liệu. Ví dụ: Nếu phạt 15%, viết là "....15%.....". Nếu thời hạn là 30 ngày, viết là ".....30 ngày.....".
 Nếu giá trị là 50.000.000 VNĐ, viết là "....50.000.000 VNĐ.....".
   - Quy tắc này giúp người dùng phân biệt rõ ràng vị trí được điền tự động trên nền phôi văn bản mà không làm thay đổi màu mực đen trang trọng của hợp đồng hành chính.
   - Với MỖI Điều khoản, bạn phải soạn thảo tối thiểu 3-5 tiểu mục con. 
   - Mỗi tiểu mục con phải là văn xuôi pháp lý dài, chặt chẽ (ít nhất 2-3 câu). 
   - Lồng ghép chi tiết các con số, thời hạn, mức phạt cụ thể mà người dùng đã cung cấp vào nội dung văn bản. 
   - TUYỆT ĐỐI KHÔNG viết tóm tắt hoặc chỉ liệt kê tiêu đề.
    -- TỰ ĐIỀU TIẾT CHI TIẾT (DYNAMIC LENGTH CONTROL): Bạn phải tự phân tích quy mô của yêu cầu. 
    Nếu yêu cầu là dịch vụ công nghệ, phần mềm, hoặc giá trị lớn, bạn phải kích hoạt tư duy pháp lý sâu, 
    soạn thảo văn bản dài kịch trần, chặt chẽ đủ 14-15 điều khoản, 
    không được viết tóm tắt. Nếu yêu cầu là thuê nhà, mua bán nhỏ, hãy giữ văn bản cô đọng từ 7-10 điều để phù hợp với thực tế đời sống.

6. CONTEXT RESET: Nếu đổi loại hợp đồng đột ngột, BẮT BUỘC reset mọi thông tin cá nhân về chuỗi rỗng "".

# YÊU CẦU ĐẦU RA JSON (TUYỆT ĐỐI TUÂN THỦ):
{
  "chat_reply": "Câu trả lời báo cáo kết quả soạn thảo ngắn gọn cho người dùng.",
  "template_type": "Loại hợp đồng (Ví dụ: hop_dong_mua_ban, hop_dong_dich_vu, hop_dong_lao_dong, hop_dong_thue_nha)",
  "extracted_data": {
    "ten_hop_dong": "TÊN HỢP ĐỒNG IN HOA (Ví dụ: HỢP ĐỒNG CUNG CẤP DỊCH VỤ CÔNG NGHỆ)",
    "benA_role": "VAI TRÒ PHÁP LÝ BÊN A IN HOA (Ví dụ: BÊN THUÊ DỊCH VỤ / BÊN CHO THUÊ)",
    "benB_role": "VAI TRÒ PHÁP LÝ BÊN B IN HOA (Ví dụ: BÊN CUNG CẤP DỊCH VỤ / BÊN THUÊ LẠI)",
    
    "can_cu_luat": [
      "QUY TẮC FLEXIBLE CĂN CỨ ĐÍCH DANH (BẮT BUỘC): Bạn phải tự động tra cứu, tùy cơ ứng biến theo loại hợp đồng để đưa ra chuỗi văn bản trích dẫn chính xác số Điều, số Khoản và tên văn bản luật điều tiết trực tiếp giao dịch này. Không ghi tên luật trơ trọi.",
      "Ví dụ 1 (Dịch vụ/Thương mại): 'Căn cứ Luật Thương mại số 36/2005/QH11 ban hành ngày 14/06/2005 và các văn bản hướng dẫn thi hành;'",
      "Ví dụ 2 (Dân sự/Thuê nhà): 'Căn cứ các quy định về Hợp đồng thuê tài sản tại Mục 5 Chương XVI Bộ luật Dân sự số 91/2015/QH13;'",
      "Ví dụ 3 (Lao động): 'Căn cứ Điều 20 và Điều 24 Bộ luật Lao động số 45/2019/QH14 về xác lập quan hệ lao động và hợp đồng thử việc;'"
    ],
    
    "ngay_ky": "Chỉ điền số ngày ký kết lấy từ yêu cầu người dùng (Ví dụ: 22). Tuyệt đối không để trống nếu đã có thông tin",
    "thang_ky": "Chỉ điền số tháng ký kết lấy từ yêu cầu người dùng (Ví dụ: 05). Tuyệt đối không để trống nếu đã có thông tin",
    "nam_ky": "Chỉ điền số năm ký kết lấy từ yêu cầu người dùng (Ví dụ: 2026). Tuyệt đối không để trống nếu đã có thông tin",
    "dia_diem_ky": "Ghi rõ địa chỉ nơi ký kết hợp đồng (Ví dụ: Văn phòng Công ty... hoặc Đà Nẵng)",

    "benA_name": "Tên đầy đủ của tổ chức doanh nghiệp hoặc cá nhân Bên A",
    "benA_mst": "Mã số thuế của doanh nghiệp Bên A (Nếu là công ty, bắt buộc điền vào đây, còn CCCD ghi 'N/A')",
    "benA_cccd": "Số Căn cước công dân của Bên A (Nếu là cá nhân, bắt buộc điền vào đây, còn MST ghi 'N/A')",
    "benA_address": "Địa chỉ trụ sở chính hoặc địa chỉ thường trú của Bên A",
    "benA_phone": "Số điện thoại liên hệ của Bên A",
    "benA_rep": "Họ tên và chức vụ người đại diện pháp luật của Bên A (Ví dụ: Ông Phạm Phú Hoàng Duy - Chức vụ: Giám đốc điều hành)",

    "benB_name": "Tên đầy đủ của tổ chức doanh nghiệp hoặc cá nhân Bên B",
    "benB_mst": "Mã số thuế của doanh nghiệp Bên B (Nếu là công ty, bắt buộc điền vào đây, còn CCCD ghi 'N/A')",
    "benB_cccd": "Số Căn cước công dân của Bên B (Nếu là cá nhân, bắt buộc điền vào đây, còn MST ghi 'N/A')",
    "benB_address": "Địa chỉ trụ sở chính hoặc địa chỉ thường trú của Bên B",
    "benB_phone": "Số điện thoại liên hệ của Bên B",
    "benB_rep": "Họ tên và chức vụ người đại diện pháp luật của Bên B (Ví dụ: Ông Nguyễn Văn B - Chức vụ: Giám đốc kỹ thuật)",

    "sections": [
      {
        "title": "Tên Điều (Ví dụ: Điều 11: Điều khoản phạt vi phạm hợp đồng)",
        "content": "11.1. Nội dung chi tiết khoản 1 của điều này viết bằng văn xuôi dài chặt chẽ... \\\n11.2. Nội dung chi tiết khoản 2 của điều này viết bằng văn xuôi dài chặt chẽ..."
      }
    ]
  }
}
# CẢNH BÁO :
CHỈ trả về JSON thuần túy. KHÔNG chào hỏi rườm rà bên ngoài. Nếu không tuân thủ cấu trúc JSON này, hệ thống sẽ lỗi.\`;
`;

        const responseText = await getActiveModel(prompt, true, documents, false, false);

        // Làm sạch JSON
        const cleanedText = cleanAIJsonString(responseText);
        const result = JSON.parse(cleanedText);

        // Log usage
        await logUsage('FORM_GENERATOR');

        return result;

    } catch (error) {
        console.error(" Lỗi tạo form:", error.message);
        throw new Error("Không thể bóc tách dữ liệu lúc này.");
    }
}

// ==============================================================================
// HÀM LẬP KẾ HOẠCH (PLANNING) - VER PROMPT ENGINEERED
// ==============================================================================
async function generatePlan(combinedText, documents = []) {
    try {
        // Lấy ngày hiện tại format DD/MM/YYYY để AI có mốc thời gian suy luận
        const currentDate = new Date();
        const today = `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/2026`;
        const prompt = `
Bạn là LegAI — Luật sư AI chuyên sâu kết hợp Chuyên gia Quản trị Dự án Pháp lý.
Nhiệm vụ duy nhất của bạn: PHÂN TÍCH HỒ SƠ và TẠO RA KẾ HOẠCH HÀNH ĐỘNG PHÁP LÝ (LEGAL ACTION PLAN) CHI TIẾT DƯỚI DẠNG JSON.
Hôm nay là ngày: ${today}

Dữ liệu đầu vào:
"""${combinedText}"""

I. NGUYÊN TẮC BẮT BUỘC (KHÔNG TUÂN THỦ = OUTPUT KHÔNG HỢP LỆ)
1. CẤU TRÚC GIAI ĐOẠN LINH HOẠT (DYNAMIC PHASES)
- BẮT BUỘC phải có TỐI THIỂU 3 giai đoạn lớn để đảm bảo lộ trình mạch lạc, không làm quá sơ sài khiến người dùng không hiểu cấu trúc tổng thể.
- Số lượng giai đoạn có thể linh hoạt tăng thêm theo độ phức tạp của hồ sơ nhưng KHÔNG vượt quá 6 giai đoạn để tối ưu hiển thị giao diện.
- Tên giai đoạn phải ngắn gọn, mang tính hành động (VD: "Chuẩn bị", "Nộp hồ sơ", "Giải quyết", "Thi hành"). NGHIÊM CẤM đặt tên kiểu: "Giai đoạn 1", "Phase 2",...

2. SỐ LƯỢNG VÀ ĐỘ CHI TIẾT TASKS (FLEXIBLE BOUNDARY ENGINE)
- Số lượng nhiệm vụ (TASKS) phải được sinh ra một cách LINH HOẠT và PHÙ HỢP với độ phức tạp của hồ sơ đầu vào hoặc theo yêu cầu cụ thể của người dùng.
- QUY TẮC GIỚI HẠN AN TOÀN (SAFE BOUNDARY): 
  + TỐI THIỂU phải đạt 12 TASKS vi mô để tránh trường hợp kế hoạch quá sơ sài, chung chung, mất đi tính thực thi.
  + TỐI ĐA nghiêm ngặt là 30 TASKS để kiểm soát tài nguyên hệ thống, tránh việc sinh ra quá nhiều nhiệm vụ tràn lan (nhuy 50-100 tasks) gây xáo trộn, loãng thông tin và quá tải giao diện.
- Mỗi TASK phải là hành động vi mô, cụ thể, có thể thực thi ngay và phân vai rõ ràng. NGHIÊM CẤM gom nhiều hành động lớn vào 1 task hoặc dùng mô tả chung chung (VD: "Xử lý hồ sơ").

3. CƠ CHẾ TỰ KIỂM TRA BIÊN ĐỘ (DYNAMIC SELF-VALIDATION)
- TRƯỚC KHI XUẤT OUTPUT JSON, bạn BẮT BUỘC phải chạy thuật toán đếm tổng số TASK đã sinh ra:
  + Nếu tổng số TASK < 12 ➔ BẮT BUỘC phải tự động phân rã các hành động lớn thành các bước vi mô nhỏ hơn để đạt tối thiểu 12 tasks.
  + Nếu tổng số TASK > 30 ➔ BẮT BUỘC phải tự động gộp các hành động nhỏ có cùng bản chất hoặc lược bỏ các bước dư thừa để ép tổng số lượng task nằm gọn gàng trong biên độ an toàn [12–30].
- CHỈ ĐƯỢC TRẢ OUTPUT khi số lượng TASK thỏa mãn điều kiện linh hoạt: 12 <= Số Task <= 30.
4. LOGIC THỜI GIAN (TEMPORAL ENGINE)
- Nếu user cung cấp mốc thời gian (VD: "bắt đầu từ ngày mai") → PHẢI suy luận thành ngày cụ thể.
- Nếu KHÔNG có mốc → MẶC ĐỊNH bắt đầu từ ngày hiện tại (${today}).
- Deadline phải tuân theo: TASK sau KHÔNG ĐƯỢC có deadline trước TASK trước. Các TASK cách nhau hợp lý (1–5 ngày tùy độ phức tạp).
- Định dạng ngày: DD/MM/YYYY

5. PHÂN VAI ĐỘNG VÀ QUY TẮC CHỐNG MƠ HỒ TRONG KẾ HOẠCH (CRITICAL CHỈ THỊ MỚI)
- PHẢI phân tích hồ sơ đầu vào để tự động trích xuất các vai trò, cá nhân thực tế liên quan (Ví dụ: Dự án CNTT ➔ "Phòng Kỹ thuật", "Phòng Pháp chế", "Dev thuật toán"; Vụ án Tòa án ➔ "Thẩm phán", "Luật sư", "Nguyên đơn", "Bị đơn"; Giao dịch Doanh nghiệp ➔ "Hội đồng quản trị", "Kế toán trưởng", "Giám đốc").
- BẮT BUỘC phải biết ứng biến linh hoạt theo từng tính chất kế hoạch riêng biệt, tuyệt đối KHÔNG rập khuôn máy móc kế hoạch nào cũng gán cho bộ phận "Phỹ thuật" hay "Pháp chế".
- NÊU RÕ HÀNH ĐỘNG THỰC THI CHI TIẾT: Tại mỗi Task, nội dung hành động của cá nhân/bộ phận được gán phải cụ thể đến mức thao tác được ngay (Ví dụ kỹ thuật ➔ "Viết mã Regex lọc chuỗi nhạy cảm trước khi gọi API"; Ví dụ pháp lý ➔ "Soạn thảo hồ sơ đánh giá tác động theo Mẫu số 04 tại Phụ lục Nghị định 13").
- Nếu xác định được: Gán đúng người phù hợp với nhiệm vụ vào trường "assignee".
- Nếu KHÔNG rõ: Ghi: "Chưa phân công"
- NGHIÊM CẤM: Gán bừa các vai trò ảo hoặc không liên quan trực tiếp đến ngữ cảnh của kế hoạch.

6. LEGAL NOTES (PHÂN TÍCH PHÁP LÝ)
- Mỗi TASK BẮT BUỘC có: Căn cứ pháp luật (VD: BLDS 2015, Nghị định 13/2023…) và Rủi ro pháp lý nếu không thực hiện đúng.

- BẠN LÀ TRỌNG TÀI KIỂM CHỨNG DÒNG THỜI GIAN THỰC TẾ NĂM 2026: 
Hãy đối chiếu thông tin pháp lý giữa [TÀI LIỆU QUY CHIẾU PHÁP LÝ BỔ TRỢ] (RAG) và [TRI THỨC NỘI TẠI] của bạn.
- QUY TẮC GHI ĐÈ LUẬT CŨ (OVERWRITE RULE): NẾU tài liệu RAG cung cấp các luật ĐÃ CŨ và
 lỗi thời tính đến năm 2026 (Ví dụ: Luật Đất đai 2013, Luật Nhà ở 2014, Luật Thương mại 2005...) 
 NHƯNG trong tri thức nội tại của bạn ĐÃ CÓ bản luật sửa đổi mới hơn đang có hiệu lực 
 (Ví dụ: Luật Đất đai 2024, Luật Nhà ở 2023...), BẮT BUỘC sử dụng tên bộ luật mới nhất trong 
 tri thức của bạn để làm căn cứ pháp lý trong các "legal_notes". Tự động bỏ qua văn bản cũ của RAG.
- QUY TẮC GIỮ RAG: Nếu văn bản trong RAG đã là phiên bản mới nhất, tuân thủ nguyên vẹn dữ liệu RAG.
- FALLBACK AN TOÀN: Khi thay thế luật cũ, nếu không nhớ chính xác 100% số hiệu điều khoản cụ thể, TUYỆT ĐỐI KHÔNG BỊA ĐẶT, chỉ ghi ngắn gọn "Tên Luật + Năm ban hành" (Ví dụ: "Luật Đất đai 2024").
- ANTI-BRACKET WARNING: Tuyệt đối KHÔNG sử dụng các dấu ngoặc vuông [] trong nội dung văn bản chữ của các trường "title" hay "legal_notes" để tránh làm hỏng cấu trúc hiển thị (Ví dụ: Không viết "[Luật Lao động 2019]", hãy viết trực tiếp "Luật Lao động 2019").

II. FORMAT OUTPUT (KHÓA CỨNG)
CHỈ TRẢ VỀ JSON THUẦN. KHÔNG markdown, KHÔNG giải thích, KHÔNG text ngoài JSON.
Cấu trúc:
[
  {
    "id": 1,
    "phase": "Chuẩn bị",
    "title": "Tên hành động vi mô cụ thể",
    "legal_notes": "Căn cứ pháp lý + rủi ro",
    "assignee": "Vai trò hoặc Chưa phân công",
    "deadline": "DD/MM/YYYY",
    "status": "pending"
  }
]

III. THỨ TỰ THỰC HIỆN NỘI BỘ (CHAIN-OF-REASONING – KHÔNG IN RA)
Phân tích hồ sơ -> Đối chiếu RAG và Tri thức nội tại cập nhật luật 2026 -> Trích xuất vai trò -> Xây dựng timeline -> Đếm dữ liệu để tự động co giãn số Phase (>=3) và số Task (12-30) -> Sinh task vi mô -> Gán deadline -> Gán assignee -> Thêm legal_notes sạch ngoặc vuông -> SELF-CHECK biên độ -> Xuất JSON.


`;

        const responseText = await getActiveModel(prompt, true, documents, false, false);
        const cleanedText = cleanAIJsonString(responseText);
        const planningResult = JSON.parse(cleanedText);

        await logUsage('PLANNING');
        return planningResult;

    } catch (error) {
        console.error("Lỗi lập kế hoạch:", error);
        return [
            {
                "id": 1,
                "phase": "Thông báo",
                "title": "Không thể khởi tạo lộ trình",
                "legal_notes": "Hệ thống AI đang bận hoặc hồ sơ phân tích quá phức tạp. Vui lòng thử lại với yêu cầu ngắn gọn hơn.",
                "assignee": "Hệ thống",
                "deadline": "N/A",
                "status": "pending"
            }
        ];
    }
}
// ==============================================================================
//  XỬ LÝ ĐIỂM SỐ & ĐỒNG BỘ DỮ LIỆU (POST-PROCESSING)

// ==============================================================================

function adaptAndScoreV7(aiParsedResult) {
    // 1. Chặn đứng nếu là video giải trí
    if (aiParsedResult.context_type === 'NON_LEGAL') {
        return {
            ...aiParsedResult,
            trustScore: -1,
            scoring_details: {
                detected_issues: { dangerous: 0, high: 0, advisory: 0 },
                raw_score: 100,
                applied_cap: 100,
                final_score: -1,
                calculation_note: "Video không chứa nội dung pháp lý để kiểm toán."
            }
        };
    }

    // 2. Đếm lỗi từ critical_analysis
    let dangerous = 0;
    let high = 0;
    let advisory = 0;

    if (aiParsedResult.critical_analysis && Array.isArray(aiParsedResult.critical_analysis)) {
        aiParsedResult.critical_analysis.forEach(issue => {
            const severity = (issue.severity || '').toUpperCase();
            if (severity === 'DANGEROUS') dangerous++;
            if (severity === 'HIGH_RISK') high++;
            if (severity === 'ADVISORY') advisory++;
        });
    }

    // 3. Thuật toán tính điểm (Base = 100)
    const baseScore = 100;
    const penalty = (dangerous * 40) + (high * 20) + (advisory * 10);
    const rawScore = Math.max(0, baseScore - penalty);

    // 4. Thuật toán áp Trần điểm (CAP)
    let appliedCap = 100;
    if (dangerous >= 2) appliedCap = 20;
    else if (dangerous === 1) appliedCap = 40;
    else if (high >= 1) appliedCap = 60;

    const finalTrustScore = Math.min(rawScore, appliedCap);

    // 5. (Calculation Note)
    let noteParts = [];
    if (dangerous > 0) noteParts.push(`${dangerous} rủi ro nghiêm trọng (DANGEROUS)`);
    if (high > 0) noteParts.push(`${high} sai lệch cốt lõi (HIGH_RISK)`);
    if (advisory > 0) noteParts.push(`${advisory} điểm cần lưu ý (ADVISORY)`);

    const calculationNote = noteParts.length > 0
        ? `Hệ thống ghi nhận ${noteParts.join(', ')}. Điểm số được điều chỉnh dựa trên mức độ vi phạm thực tế.`
        : "Nội dung video tuân thủ tốt, không phát hiện sai lệch pháp lý đáng kể.";

    // 6. Return Object for Frontend
    return {
        ...aiParsedResult,
        trustScore: finalTrustScore,
        legalBases: aiParsedResult.legal_map || [],
        scoring_details: {
            detected_issues: { dangerous, high, advisory },
            raw_score: rawScore,
            applied_cap: appliedCap,
            final_score: finalTrustScore,
            calculation_note: calculationNote
        }
    };
}

// ==============================================================================
// (VIDEO ANALYSIS) 
// ==============================================================================

async function analyzeVideo(videoUrl) {
    let transcript = '';

    try {
        // 1. CHUẨN HÓA URL & FETCH TRANSCRIPT
        const standardUrl = normalizeYouTubeUrl(videoUrl);
        if (!standardUrl) throw new Error('URL video không hợp lệ.');

        let transcriptItems = await YoutubeTranscript.fetchTranscript(standardUrl);
        if (!transcriptItems || transcriptItems.length === 0) {
            throw new Error('Không tìm thấy phụ đề cho video này.');
        }

        transcript = transcriptItems.map(item => item.text).join(' ').trim();
        const currentYear = new Date().getFullYear();

        // Khai báo các biến phục vụ RAG và Prompt
        let ragContext = '';
        let ragStatus = 'EMPTY';
        let relatedDocs = [];
        let legalClaims = '';

        // 2. RAG GROUNDING 
        try {
            const keywordPrompt = `Bạn là một chuyên gia trích xuất dữ liệu hệ thống (Data Extractor). Hãy đọc đoạn văn bản sau và trích xuất ra từ 3-5 từ khóa hoặc cụm từ pháp lý cốt lõi bằng tiếng Việt để làm chuỗi tìm kiếm dữ liệu (Search Query).
    
    QUY TẮC ÉP BUỘC :
    1. CHỈ trả về các từ khóa/cụm từ cách nhau bằng dấu phẩy (Ví dụ: quy chế thi, đề thi mẫu, bộ giáo dục và đào tạo).
    2. TUYỆT ĐỐI KHÔNG có lời mở đầu, không có số thứ tự (1, 2, 3), không giải thích trong ngoặc, không bọc dấu markdown.
    3. Chủ động sửa các lỗi chính tả nghe từ tai tiếng sang từ ngữ pháp lý chuẩn (Ví dụ: 'sở giục đo tạ' -> 'Sở Giáo dục và Đào tạo', 'quy chế thi vào tháng 11' -> 'Quy chế thi tốt nghiệp THPT').
    
    Đoạn văn bản cần trích xuất: "${transcript.substring(0, 1000)}"`;
            const refinedKeywords = await getActiveModel(keywordPrompt, false);
            console.log(" Từ khóa đã lọc cho RAG:", refinedKeywords.trim());

            relatedDocs = await ragService.query(refinedKeywords.trim());

            if (relatedDocs && relatedDocs.length > 0) {
                ragStatus = 'SUCCESS';
                console.log(` [NGUỒN DATA]: DÙNG PINECONE (Lấy được ${relatedDocs.length} tài liệu luật để audit video).`)
            } else {
                ragStatus = 'EMPTY';
                console.log(` [NGUỒN DATA]: PINECONE TRỐNG -> Đã cấp quyền dùng Google Search Grounding để fact-check pháp lý video.`);
            }
        }

        catch (rErr) {
            ragStatus = 'FAILED';
            console.warn(" Lỗi của RAG:", rErr.message);
        }

        // 3.  PROMPT 
        const prompt = `
[CRITICAL SYSTEM RULES - HIGHEST PRIORITY]

Bạn là AI Pháp lý LegAI, hoạt động như Hệ thống Kiểm toán Pháp lý Nội dung số theo pháp luật Việt Nam.

MỤC TIÊU:
- Kiểm toán độ tin cậy pháp lý của nội dung video.
- Đánh giá dựa trên dữ liệu xác minh và nguyên tắc pháp lý.
- Xuất dữ liệu tóm tắt luật chi tiết, dễ hiểu, hướng đến đối tượng người dùng không am hiểu sâu về luật (người mù luật).

━━━━━━━━━━━━━━━━━━━━━━━━━━
[0. FLEXIBLE FALLBACK EXECUTION MODE]
━━━━━━━━━━━━━━━━━━━━━━━━━━

Năm hiện tại: ${currentYear}
RAG_STATUS: ${ragStatus}

GROUNDING_MODE:
- VERIFIED
- PARTIAL
- DEGRADED

QUY TẮC PHÒNG THỦ & TRÍ THỨC NỀN 2026:
1. Nếu RAG_STATUS thuộc ["FAILED", "TIMEOUT", "EMPTY"], kích hoạt chế độ GROUNDING_MODE = "DEGRADED".
2. Khi chạy ở chế độ "DEGRADED" hoặc khi RAG không chứa văn bản luật cụ thể: NGHIÊM CẤM bịa đặt số hiệu văn bản giả. Tuy nhiên, BẮT BUỘC phải sử dụng [TRI THỨC NỘI TẠI CẬP NHẬT ĐẾN NĂM 2026] để trích xuất và tóm tắt các quy định pháp lý hiện hành hoặc các Đề án chỉ đạo cốt lõi của Nhà nước liên quan đến chủ đề (Ví dụ về Tiền điện tử/Tiền ảo: Phải liên kết được với Quyết định 1255/QĐ-TTg của Thủ tướng Chính phủ về đề án hoàn thiện khung pháp lý tài sản ảo; các Chỉ thị của Ngân hàng Nhà nước và Luật Thuế hiện hành).
3. Tuyệt đối không để trống hoặc ghi "Chưa xác minh cụ thể" ở phần tóm tắt luật hiện hành nếu tri thức nền của bạn có thể cung cấp tổng quan quy định pháp lý tương ứng.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[1. SYSTEM PRIORITY & INSTRUCTION ISOLATION]
━━━━━━━━━━━━━━━━━━━━━━━━━━
THỨ TỰ ƯU TIÊN CHỈ DẪN:
1. SYSTEM RULES
2. OUTPUT RULES
3. JSON SCHEMA
4. LEGAL_DIGEST
5. LEGAL_REFERENCE_DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━
[2. CONTEXT GATE & NOISE BLOCKING - NÂNG CẤP CHỐNG BẪY DRAMA / CẮT GHÉP]
━━━━━━━━━━━━━━━━━━━━━━━━━━
context_type CHỈ được là: "LEGAL" | "PARTIAL_LEGAL" | "NON_LEGAL"

QUY TẮC NHẬN DIỆN Ý ĐỒ VIDEO (TONE & INTENT AUDIT):
1. BẮT BẪY CHÂM BIẾM / CẮT GHÉP CHÍNH TRỊ (ANTI-PROPAGANDA & DRAMA):
- Bạn phải đặc biệt cảnh giác với các transcript chứa các câu phát ngôn nhại lại, câu nói cắt ghép của các nhân vật lịch sử, chính trị, hoặc các câu nói trending mang tính kích động tranh cãi giữa "Nhà nước" và "Người dân" (Ví dụ các câu kiểu: "Chúng tôi nhận lỗi trước dân...", "Nếu dân sai dân chịu trách nhiệm trước pháp luật...", "Tôi năm nay 90 tuổi rồi chưa gặp...").
- Tuyệt đối KHÔNG ĐƯỢC chỉ nhìn vào câu chữ bề mặt để khen ngợi là "đúng đắn theo Hiến pháp". Bạn phải phân tích xem ngữ cảnh video có phải là đang: Châm biếm, đả kích chính quyền, định hướng dư luận tiêu cực, hoặc dùng ngôn từ thù hằn, bậy bạ hay không.

2. HÀNH ĐỘNG HẠ ĐIỂM SÀN (STRICT TRUST SCORE PENALTY):
- Nếu transcript có chứa các phát ngôn bậy bạ, câu nói nhại mang tính đả kích chế độ, hoặc cắt ghép lời nói của cán bộ/công dân nhằm mục đích tạo drama bôi nhọ:
  + BẮT BUỘC phải chuyển trạng thái severity thành "DANGEROUS" hoặc "HIGH_RISK".
  + Đánh tụt điểm Trust Score xuống dưới 40% (Cảnh báo đỏ).
  + Tại phần "conclusion" (Kết luận), phải ghi rõ: "Nội dung mang tính chất cắt ghép, lấy ngữ cảnh châm biếm, bóp méo phát ngôn hoặc kích động dư luận, có dấu hiệu vi phạm quy định về thuần phong mỹ tục hoặc an ninh mạng, không có giá trị phổ biến pháp luật chuẩn mực."

3. CẬP NHẬT CƠ SỞ ĐỐI CHIẾU THỰC TẾ:
- Đối với các phát ngôn thù hằn, bậy bạ, cắt ghép trên không gian mạng, bạn BẮT BUỘC phải lôi các quy định sau của Nhà nước ra để đối chiếu ở mục "law_fact":
  + Luật An ninh mạng 2018 (Điều 8 về các hành vi bị nghiêm cấm trên không gian mạng, bao gồm thông tin sai sự thật, xuyên tạc, xúc phạm uy tín của cơ quan, tổ chức, cá nhân).
  + Nghị định 15/2020/NĐ-CP (Điều 101 về vi phạm quy định về trách nhiệm sử dụng dịch vụ mạng xã hội; hành vi cung cấp, chia sẻ thông tin giả mạo, thông tin sai sự thật, xuyên tạc, vu khống, xúc phạm uy tín của cơ quan, tổ chức, danh dự, nhân phẩm của cá nhân).

  ━━━━━━━━━━━━━━━━━━━━━━━━━━
[3. PASSIVE RAG GROUNDING]
━━━━━━━━━━━━━━━━━━━━━━━━━━
<LEGAL_REFERENCE_DATA>
${relatedDocs && relatedDocs.length > 0 ? buildStrictContextText(relatedDocs) : 'Không có dữ liệu RAG hỗ trợ.'}
</LEGAL_REFERENCE_DATA>

━━━━━━━━━━━━━━━━━━━━━━━━━━
[4. SEVERITY CLASSIFICATION]
━━━━━━━━━━━━━━━━━━━━━━━━━━
severity CHỈ được là: "DANGEROUS" | "HIGH_RISK" | "ADVISORY"
LƯU Ý: Backend Node.js sẽ tự tính điểm. KHÔNG được tự tính trustScore hoặc đưa công thức điểm số vào output text.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[5. CONFIDENCE ENGINE]
━━━━━━━━━━━━━━━━━━━━━━━━━━
confidence.level CHỈ được là: "HIGH" | "MEDIUM" | "LOW"

━━━━━━━━━━━━━━━━━━━━━━━━━━
[6. OUTPUT JSON STRICT SCHEMA - CẢI TIẾN CHUẨN USER-FRIENDLY]
━━━━━━━━━━━━━━━━━━━━━━━━━━
QUY TẮC OUTPUT BẮT BUỘC:
- CHỈ trả về JSON thuần. KHÔNG markdown, KHÔNG \`\`\`.

JSON SCHEMA:
{
  "summary": "string",
  "grounding": {
    "rag_used": true,
    "grounding_mode": "VERIFIED | PARTIAL | DEGRADED",
    "retrieval_status": "SUCCESS | EMPTY | FAILED | TIMEOUT"
  },
  "context_type": "LEGAL | PARTIAL_LEGAL | NON_LEGAL",
  "confidence": {
    "level": "HIGH | MEDIUM | LOW",
    "reason": "string"
  },
  "legal_summary_card": {
    "title_vong_luat": "Tên văn bản/Luật/Nghị định điều tiết chung chủ đề này tính đến năm 2026",
    "brief_content": "Tóm tắt ngắn gọn quy định của pháp luật Việt Nam hiện hành về vấn đề này bằng ngôn ngữ bình dân, dễ hiểu (Ví dụ: Việt Nam chưa công nhận tiền số là tiền tệ, đang nghiên cứu khung thuế...)"
  },
  "critical_analysis_cards": [
    {
      "id": 1,
      "severity": "DANGEROUS | HIGH_RISK | ADVISORY",
      "video_claim": "Lời thoại/Nhận định cụ thể trích từ video cần rà soát",
      "law_fact": "Sự thật pháp lý: Số hiệu Điều, Khoản chi tiết và nội dung luật quy định đối chiếu thực tế tính đến năm 2026",
      "conclusion": "Kết luận ngắn gọn cho người xem biết thông tin này Đúng, Sai, hoặc chỉ là Tin đồn/Dự thảo chưa có hiệu lực thi hành"
    }
  ],
  "action_plan": [
    {
      "step": 1,
      "action": "Hành động khuyến nghị cụ thể cho người xem video"
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━
[7. CONSISTENCY & HALLUCINATION CONTROL]
━━━━━━━━━━━━━━━━━━━━━━━━━━
- Đảm bảo các trường video_claim, law_fact, conclusion ánh xạ khớp nhau tạo thành bộ thẻ so sánh trực quan cho người dùng.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[8. FINAL OUTPUT REMINDER]
━━━━━━━━━━━━━━━━━━━━━━━━━━
Kiểm tra tính hợp lệ của JSON trước khi xuất.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[9. LEGAL DIGEST INPUT]
━━━━━━━━━━━━━━━━━━━━━━━━━━
LEGAL_DIGEST:
"""${legalClaims || transcript}"""
`;

        // 4. GỌI AI & PARSE KẾT QUẢ THÔ
        let responseText = await getActiveModel(prompt, true, relatedDocs, false, false);
        let rawResult = JSON.parse(cleanAIJsonString(responseText));

        // 5. POST-PROCESSING (Gọi hàm xử lý dữ liệu và tính điểm)
        let result = adaptAndScoreV7(rawResult);

        // 6. MAPPING DỮ LIỆU BỔ SUNG
        result.transcript = transcript;
        result.raw_transcript = transcript;

        // 7. GHI LOG
        await logUsage(result.trustScore === -1 ? 'VIDEO_ANALYSIS_NON_LEGAL' : 'VIDEO_ANALYSIS').catch(console.error);

        return result;

    } catch (error) {
        console.error(" Lỗi Video Analysis:", error.message);
        throw new Error(error.message || "Không thể phân tích video.");
    }
}

// ==============================================================================
// DANH MỤC PHÂN LOẠI & HÀM CLASSIFY 
// ==============================================================================
async function classifyCategoryWithAI(title) {
    const prompt = `
    Bạn là một chuyên gia pháp luật Việt Nam cấp cao. 
    Nhiệm vụ: Phân loại văn bản dựa trên tiêu đề vào MỘT TRONG các nhóm sau: [${CANONICAL_CATEGORIES.join(", ")}].
    
    Quy tắc:
    1. Chỉ trả về đúng tên nhóm trong danh sách trên.
    2. Phân loại theo lĩnh vực điều chỉnh chính, không phân loại theo loại chế tài như "xử phạt".
    3. Nếu không chắc chắn, chọn "Lĩnh vực khác".
    
    Tiêu đề văn bản: "${title}"
    Kết quả:`;

    try {

        const rawResponse = await getActiveModel(prompt, false, [], false, false, "");
        const category = rawResponse.trim().replace(/[".*]/g, "");
        return normalizeLegalCategory(category) || "Lĩnh vực khác";
    } catch (error) {
        return "Lĩnh vực khác";
    }
}
module.exports = {
    getActiveModel,
    generateAnswerWithGemini,
    selectRagChunks,
    getGroundingTimeoutMs,
    getTimeoutSource,
    buildGroundingGapHint,
    buildGroundingRescuePlan,
    buildGroundingRescueInstruction,
    filterGroundingContextDocuments,
    cacheGroundedLawSource,
    scheduleGroundedSourceCache,
    normalizeGeminiResponse,
    isRagOutdated,

    analyzeContract,
    generateForm,
    generatePlan,
    analyzeVideo,
    classifyCategoryWithAI
};
