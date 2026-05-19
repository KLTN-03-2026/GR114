const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;

const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("❌ LỖI: Chưa cấu hình GEMINI_API_KEY trong file .env!");
}

const genAI = API_KEY && String(API_KEY).trim()
    ? new GoogleGenerativeAI(API_KEY)
    : null;

// ✅ ĐÃ SỬA: Danh sách các model xịn nhất của bạn, loại bỏ các model cũ gây lỗi 404
const AVAILABLE_MODELS = [
    "gemini-2.5-flash",        // Ưu tiên 1: Bản cực nhanh, ổn định nhất (Đã test thành công)
    "gemini-2.0-flash"         // Ưu tiên 2: Bản dự phòng
];

const MAX_CONTRACT_CHARS = 30000;

const PROMPT_LIBRARY = {
    buildChatPrompt: (userQuestion, documents = []) => {
        const contextText = documents.length > 0
            ? documents.map((doc, index) => `[TÀI LIỆU ${index + 1}]: ${doc.title}\nNội dung: ${doc.content}`).join("\n\n")
            : "Không có dữ liệu văn bản cụ thể. Hãy trả lời dựa trên kiến thức pháp luật chung.";

        return `
        BẠN LÀ "LEGAI" - TRỢ LÝ PHÁP LÝ AI CHUYÊN NGHIỆP CỦA VIỆT NAM.
        NHIỆM VỤ: Trả lời câu hỏi dựa trên DỮ LIỆU THAM KHẢO và Kiến thức Luật Việt Nam hiện hành.

        📚 DỮ LIỆU THAM KHẢO:
        ${contextText}

        ❓ CÂU HỎI: "${userQuestion}"

        QUY TẮC:
        - Ngắn gọn, súc tích, dễ hiểu.
        - Nếu có thể, trích dẫn Điều/Luật và nêu căn cứ.
        - Nêu rõ giới hạn: chỉ hỗ trợ tra cứu, không thay thế tư vấn pháp lý chính thức.
        `;
    },
    buildLaborContractAnalysisPrompt: (contractText) => `
        Bạn là Luật sư AI chuyên rà soát HỢP ĐỒNG LAO ĐỘNG Việt Nam theo pháp luật hiện hành.

        MỤC TIÊU:
        - Tóm tắt 2-3 câu.
        - Chấm điểm an toàn 0-100 (càng cao càng an toàn).
        - Nêu rủi ro quan trọng nhất, ưu tiên: lương & phụ cấp, BHXH/BHYT/BHTN, thử việc, thời giờ làm việc/làm thêm, chấm dứt/kỷ luật, bồi thường/phạt, giữ giấy tờ gốc.
        - Mỗi rủi ro: trích điều khoản gốc (nếu có) + giải thích ngắn gọn theo quy định pháp luật lao động VN.

        HỢP ĐỒNG (cắt tối đa ${MAX_CONTRACT_CHARS} ký tự):
        """${String(contractText || '').slice(0, MAX_CONTRACT_CHARS)}"""

        TRẢ VỀ JSON ONLY (không markdown):
        {
          "summary": "",
          "risk_score": 0,
          "risks": [
            { "clause": "", "issue": "", "severity": "High" | "Medium" | "Low" }
          ],
          "recommendation": ""
        }
    `
};

async function getActiveModel(prompt, opts = {}) {
    if (!genAI) {
        throw new Error("Missing GEMINI_API_KEY");
    }
    const mode = String(opts.mode || 'chat');
    for (const modelName of AVAILABLE_MODELS) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: mode === 'json'
                    ? { temperature: 0.1, topP: 0.8, topK: 40, responseMimeType: "application/json" }
                    : { temperature: 0.3, topP: 0.8, topK: 40 }
            });
            const result = await model.generateContent(prompt);
            return result.response.text(); 
        } catch (error) {
            console.warn(`⚠️ Model ${modelName} gặp sự cố. Đang chuyển sang dự phòng...`);
            continue; 
        }
    }
    throw new Error("Tất cả các Model đều đang bận hoặc hết hạn mức.");
}

// ==============================================================================
// 1. HÀM CHAT 
// ==============================================================================
async function generateAnswerWithGemini(userQuestion, documents = []) {
    try {
        if (!genAI) {
            return "LegAI chưa được cấu hình GEMINI_API_KEY nên chỉ có thể trả lời ở mức hạn chế. Vui lòng cấu hình GEMINI_API_KEY để chat chính xác hơn.";
        }
        const prompt = PROMPT_LIBRARY.buildChatPrompt(userQuestion, documents);
        return await getActiveModel(prompt, { mode: 'chat' });

    } catch (error) {
        console.error("❌ Lỗi toàn bộ hệ thống Gemini:", error.message);
        return "LegAI đang quá tải hoặc hết hạn mức sử dụng miễn phí hôm nay. Vui lòng thử lại sau một lát.";
    }
}

// ==============================================================================
// 2. HÀM PHÂN TÍCH HỢP ĐỒNG 
// ==============================================================================
async function analyzeContractWithGemini(contractText) {
    try {
        if (!genAI) {
            return {
                summary: "Chưa cấu hình AI.",
                risk_score: 0,
                risks: [{ clause: "Hệ thống", issue: "Chưa cấu hình GEMINI_API_KEY.", severity: "High" }],
                recommendation: "Nếu bạn chỉ upload file Word/PDF thì vẫn có thể trích xuất text. Để phân tích bằng AI, vui lòng cấu hình GEMINI_API_KEY."
            };
        }
        const prompt = PROMPT_LIBRARY.buildLaborContractAnalysisPrompt(contractText);
        const responseText = await getActiveModel(prompt, { mode: 'json' });

        // Làm sạch JSON
        let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');
        return JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));

    } catch (error) {
        return {
            summary: "Lỗi kết nối AI.",
            risk_score: 0,
            risks: [{ clause: "Hệ thống", issue: "Hết hạn mức API miễn phí hoặc đang quá tải.", severity: "High" }],
            recommendation: "Vui lòng chờ 15 giây rồi kiểm tra lại."
        };
    }
}

module.exports = { PROMPT_LIBRARY, generateAnswerWithGemini, analyzeContractWithGemini };
