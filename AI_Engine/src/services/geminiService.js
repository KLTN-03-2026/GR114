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

const genAI = new GoogleGenerativeAI(API_KEY);

// ✅ ĐÃ SỬA: Danh sách các model xịn nhất của bạn, loại bỏ các model cũ gây lỗi 404
const AVAILABLE_MODELS = [
    "gemini-2.5-flash",        // Ưu tiên 1: Bản cực nhanh, ổn định nhất (Đã test thành công)
    "gemini-2.0-flash"         // Ưu tiên 2: Bản dự phòng
];

// Hàm bổ trợ để lấy model và xử lý lỗi Quota/404
async function getActiveModel(prompt) {
    for (const modelName of AVAILABLE_MODELS) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                // Chatbot cần sáng tạo một chút nên để temperature 0.3 là đẹp
                generationConfig: { temperature: 0.3, topP: 0.8, topK: 40 }
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
        const contextText = documents.length > 0
            ? documents.map((doc, index) => `[TÀI LIỆU ${index + 1}]: ${doc.title}\nNội dung: ${doc.content}`).join("\n\n")
            : "Không có dữ liệu văn bản cụ thể. Hãy trả lời dựa trên kiến thức pháp luật chung.";

        const prompt = `
        BẠN LÀ "LEGAI" - TRỢ LÝ PHÁP LÝ AI CHUYÊN NGHIỆP CỦA VIỆT NAM.
        NHIỆM VỤ: Trả lời câu hỏi dựa trên DỮ LIỆU THAM KHẢO và Kiến thức Luật Việt Nam hiện hành.
        
        📚 DỮ LIỆU THAM KHẢO:
        ${contextText}

        ❓ CÂU HỎI: "${userQuestion}"

        QUY TẮC: Ngắn gọn, súc tích, in đậm con số quan trọng, trích dẫn Điều/Luật nếu có.
        ---
        Lưu ý: LegAI là trợ lý ảo hỗ trợ tra cứu. Nội dung này không thay thế tư vấn pháp lý chính thức.`;

        return await getActiveModel(prompt);

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
        const prompt = `Bạn là Luật sư Cao cấp rà soát hợp đồng lao động Việt Nam. 
        Tìm các lỗi: lương thấp hơn tối thiểu, làm quá giờ, giữ bằng gốc, phạt vi phạm vô lý.
        HỢP ĐỒNG: ${contractText}
        TRẢ VỀ JSON ONLY: { "summary": "", "risk_score": 0, "risks": [{"clause": "", "issue": "", "severity": ""}], "recommendation": "" }`;

        const responseText = await getActiveModel(prompt);

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

module.exports = { generateAnswerWithGemini, analyzeContractWithGemini };