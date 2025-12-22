// AI_Engine/src/services/geminiService.js

// 👇 Node 18+ trở lên đã có fetch, nhưng giữ lại dòng này để tương thích ngược nếu cần
const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ⚠️ QUAN TRỌNG: Lấy Key từ biến môi trường (.env) thay vì để lộ trong code
const API_KEY = process.env.GEMINI_API_KEY;

// Kiểm tra xem đã có Key chưa
if (!API_KEY) {
    console.error("❌ LỖI: Chưa cấu hình GEMINI_API_KEY trong file .env!");
    console.error("👉 Vui lòng mở file .env và điền key vào.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ==============================================================================
// 1. HÀM CHAT (ĐÃ KẾT HỢP: LỌC NHIỄU + HUMAN-LIZE + DISCLAIMER)
// ==============================================================================
async function generateAnswerWithGemini(userQuestion, documents) {
    try {
        // 1. Format dữ liệu đầu vào
        const contextText = documents.map((doc, index) =>
            `--- TÀI LIỆU THAM KHẢO ${index + 1} ---\nNguồn: ${doc.title} (${doc.sourceUrl || 'Nguồn nội bộ'})\nNội dung: ${doc.content}`
        ).join("\n\n");

        // 2. PROMPT "HỢP THỂ"
        const prompt = `
        Bạn là "LegAI" - Trợ lý Luật sư AI chuyên nghiệp, tận tâm và thân thiện.
        
        NHIỆM VỤ:
        Trả lời câu hỏi của người dùng dựa trên [DỮ LIỆU ĐẦU VÀO] bên dưới.

        PHONG CÁCH TRẢ LỜI (TONE & VOICE):
        - Hãy xưng hô là "LegAI" hoặc "mình/tôi", gọi người dùng là "bạn".
        - Giọng văn tự nhiên, dễ hiểu, tránh máy móc.
        - Cấu trúc mạch lạc: Mở đầu chào hỏi -> Giải quyết vấn đề -> Kết luận.

        ⚠️ QUY TẮC XỬ LÝ LOGIC (CỰC KỲ QUAN TRỌNG):
        1. ƯU TIÊN LUẬT MỚI: Nếu thông tin mâu thuẫn, BẮT BUỘC chọn văn bản có NĂM BAN HÀNH GẦN NHẤT hoặc hiệu lực cao hơn.
        2. LỌC NHIỄU THÔNG MINH: Nếu tài liệu nói về chủ đề không liên quan, hãy BỎ QUA.
        3. TRUNG THỰC: Nếu không tìm thấy thông tin khớp, hãy trả lời: "Hiện tại LegAI chưa tìm thấy thông tin chính xác về vấn đề này."
        4. TRÍCH DẪN: Luôn ghi rõ nguồn (Ví dụ: "Theo Điều 8 Luật Hôn nhân...").

        ⚠️ YÊU CẦU BẮT BUỘC VỀ ĐẦU RA (DISCLAIMER):
        - Ở cuối cùng của câu trả lời, BẮT BUỘC phải xuống dòng và thêm câu miễn trừ trách nhiệm sau:
        "\n---\n*Lưu ý: LegAI là trợ lý ảo hỗ trợ tra cứu. Nội dung này chỉ mang tính tham khảo và không thay thế tư vấn pháp lý chính thức từ Luật sư.*"

        ---
        [DỮ LIỆU ĐẦU VÀO TỪ HỆ THỐNG]:
        ${contextText}
        ---

        CÂU HỎI CỦA NGƯỜI DÙNG: "${userQuestion}"
        
        TRẢ LỜI CỦA LEGAI:
        `;

        const result = await model.generateContent(prompt);
        return result.response.text();

    } catch (error) {
        console.error("❌ Lỗi Chat Gemini:", error);
        return "LegAI đang gặp chút sự cố kết nối. Bạn vui lòng thử lại sau nhé!\n\n---\n*Lưu ý: Thông tin chỉ mang tính tham khảo.*";
    }
}

// ==============================================================================
// 2. HÀM PHÂN TÍCH HỢP ĐỒNG (GIỮ NGUYÊN LOGIC)
// ==============================================================================
async function analyzeContractWithGemini(contractText, legalContext = "") {
    try {
        console.log("🕵️‍♂️ Đang soi hợp đồng và đánh giá rủi ro...");

        const prompt = `
        Bạn là Chuyên gia Thẩm định Pháp lý Hợp đồng.
        Nhiệm vụ: Phân tích bản hợp đồng dưới đây và đối chiếu với CƠ SỞ PHÁP LÝ để tìm rủi ro.

        ---
        CƠ SỞ PHÁP LÝ:
        ${legalContext}
        ---

        NỘI DUNG HỢP ĐỒNG:
        ${contractText}

        ---
        OUTPUT FORMAT (JSON ONLY - KHÔNG MARKDOWN):
        {
            "summary": "Tóm tắt ngắn gọn...",
            "risk_score": (Số nguyên 0-100),
            "risks": [
                { 
                    "clause": "Trích dẫn điều khoản", 
                    "issue": "Giải thích rủi ro", 
                    "severity": "High/Medium/Low" 
                }
            ],
            "recommendation": "Lời khuyên..."
        }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Làm sạch JSON
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("❌ Lỗi Phân tích Gemini:", error);
        return {
            summary: "Lỗi hệ thống khi phân tích.",
            risk_score: 0,
            risks: [],
            recommendation: "Vui lòng thử lại sau."
        };
    }
}

module.exports = { generateAnswerWithGemini, analyzeContractWithGemini };