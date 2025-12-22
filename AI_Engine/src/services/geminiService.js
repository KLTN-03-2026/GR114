// 👇 Node 18+ trở lên đã có fetch, nhưng giữ lại dòng này để tương thích ngược
const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;

const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config(); 

// ⚠️ QUAN TRỌNG: Lấy Key từ biến môi trường
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ LỖI: Chưa cấu hình GEMINI_API_KEY trong file .env!");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Cấu hình Model
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
});

// ==============================================================================
// 1. HÀM CHAT (GIỮ NGUYÊN)
// ==============================================================================
async function generateAnswerWithGemini(userQuestion, documents) {
    try {
        const contextText = documents.map((doc, index) =>
            `--- TÀI LIỆU ${index + 1} ---\nNguồn: ${doc.title}\nNội dung: ${doc.content}`
        ).join("\n\n");

        const prompt = `
        Bạn là "LegAI" - Trợ lý Luật sư AI chuyên nghiệp.
        
        DỮ LIỆU THAM KHẢO:
        ${contextText}

        CÂU HỎI: "${userQuestion}"
        
        YÊU CẦU:
        1. Trả lời dựa trên dữ liệu tham khảo. Nếu không có, hãy dùng kiến thức Luật Việt Nam chuẩn.
        2. Cuối câu trả lời BẮT BUỘC thêm dòng: 
        "\n---\n*Lưu ý: LegAI là trợ lý ảo hỗ trợ tra cứu. Nội dung này chỉ mang tính tham khảo và không thay thế tư vấn pháp lý chính thức từ Luật sư.*"
        `;

        const result = await model.generateContent(prompt);
        return result.response.text();

    } catch (error) {
        console.error("❌ Lỗi Chat Gemini:", error);
        return "LegAI đang bận, vui lòng thử lại sau.";
    }
}

// ==============================================================================
// 2. HÀM PHÂN TÍCH HỢP ĐỒNG (ĐÃ FIX LỖI SYNTAX)
// ==============================================================================
async function analyzeContractWithGemini(contractText) {
    try {
        console.log("🕵️‍♂️ LegAI Service: Đang gửi hợp đồng sang Google Gemini...");

        // 👇 ĐÃ SỬA LỖI Ở DÒNG DƯỚI (Xóa 3 dấu huyền đi)
        const prompt = `
        Bạn là Chuyên gia Thẩm định Pháp lý Hợp đồng cao cấp tại Việt Nam.
        
        NHIỆM VỤ: 
        Phân tích bản hợp đồng dưới đây dựa trên CÁC BỘ LUẬT HIỆN HÀNH CỦA VIỆT NAM.

        NỘI DUNG HỢP ĐỒNG CẦN SOI:
        """
        ${contractText}
        """

        YÊU CẦU ĐẦU RA (QUAN TRỌNG - CHỈ TRẢ VỀ JSON):
        Hãy trả về một JSON object duy nhất. TUYỆT ĐỐI KHÔNG dùng markdown block (không dùng dấu ba dấu huyền), không có lời dẫn.
        
        Cấu trúc mẫu:
        {
            "summary": "Tóm tắt ngắn gọn hợp đồng trong 2-3 câu.",
            "risk_score": (Số nguyên từ 0 đến 100, 100 là an toàn nhất),
            "risks": [
                { 
                    "clause": "Trích dẫn nguyên văn điều khoản trong hợp đồng gây rủi ro", 
                    "issue": "Giải thích ngắn gọn tại sao điều khoản này vi phạm luật hoặc gây bất lợi cho người dùng", 
                    "severity": "High"
                }
            ],
            "recommendation": "Lời khuyên tổng quan của luật sư dành cho người dùng."
        }
        `;

        // Gọi AI
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Xử lý chuỗi JSON trả về
        let cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Tìm điểm bắt đầu { và kết thúc } để cắt chính xác
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
        }

        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("❌ Lỗi Phân tích Gemini:", error);
        return {
            summary: "Hệ thống đang quá tải, chưa thể phân tích chi tiết lúc này.",
            risk_score: 50,
            risks: [
                {
                    clause: "Lỗi hệ thống",
                    issue: "Không thể kết nối đến AI Server. Vui lòng thử lại.",
                    severity: "High"
                }
            ],
            recommendation: "Vui lòng kiểm tra kết nối mạng và thử lại sau ít phút."
        };
    }
}

module.exports = { generateAnswerWithGemini, analyzeContractWithGemini };