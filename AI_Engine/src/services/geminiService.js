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
    "gemini-3.0-flash",        // Bản mới nhất, nhanh và ổn định (Đã test thành công)
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
// 1. HÀM CHAT (ĐÃ NÂNG CẤP TRÍ NHỚ)
// ==============================================================================
async function generateAnswerWithGemini(userQuestion, documents = [], chatHistory = []) {
    try {
        const contextText = documents.length > 0
            ? documents.map((doc, index) => `[TÀI LIỆU ${index + 1}]: ${doc.title}\nNội dung: ${doc.content}`).join("\n\n")
            : "Không có dữ liệu văn bản cụ thể. Hãy trả lời dựa trên kiến thức pháp luật chung.";

        // XỬ LÝ LỊCH SỬ CHAT: Chuyển mảng lịch sử thành đoạn text dễ đọc cho AI
        const historyText = chatHistory.length > 0
            ? chatHistory.map(msg => `${msg.role === 'user' ? 'NGƯỜI DÙNG' : 'LEGAI'}: ${msg.content}`).join("\n\n")
            : "Đây là câu hỏi đầu tiên, chưa có lịch sử trò chuyện.";

        const prompt = `
# VAI TRÒ: 
Bạn là LegAI - Hệ thống Trí tuệ Nhân tạo Pháp luật cao cấp tại Việt Nam. Bạn đang sở hữu kiến thức từ 486 văn bản pháp luật hiện hành.

# DỮ LIỆU ĐƯỢC CUNG CẤP:
${contextText}

# LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:
(Sử dụng thông tin này để hiểu ngữ cảnh nếu câu hỏi mới bị thiếu chủ ngữ hoặc đang hỏi tiếp ý cũ)
${historyText}

# YÊU CẦU TRẢ LỜI CÂU HỎI MỚI NHẤT: "${userQuestion}"


# QUY TẮC PHÂN LOẠI & TRẢ LỜI (BẮT BUỘC TUÂN THỦ):

Hãy tự động phân tích "YÊU CẦU TỪ NGƯỜI DÙNG" thuộc loại nào dưới đây và trả lời theo đúng kịch bản đó:

**Trường hợp 1: Giao tiếp thông thường (Chào hỏi, cảm ơn, hỏi thăm sức khỏe...)**
- Phản hồi: Lịch sự, tự nhiên, thân thiện và ngắn gọn (1-2 câu).
- Cấu trúc: KHÔNG dùng cấu trúc phân tích pháp lý. Chỉ chào hỏi và gợi ý người dùng đặt câu hỏi về luật.
- Ví dụ: "Chào bạn! Tôi là LegAI. Tôi có thể giúp bạn tra cứu hoặc tư vấn vấn đề pháp lý nào hôm nay?"

**Trường hợp 2: Câu hỏi ngoài chuyên môn (Toán học, lập trình, nấu ăn, thời tiết...)**
- Phản hồi: Lịch sự từ chối và nhắc nhở giới hạn chuyên môn của bạn.
- Cấu trúc: KHÔNG dùng cấu trúc phân tích pháp lý. 
- Ví dụ: "Xin lỗi, tôi là trợ lý chuyên trách về Pháp luật Việt Nam nên không thể hỗ trợ bạn vấn đề này. Bạn có câu hỏi nào về luật cần tôi giải đáp không?"

**Trường hợp 3: Câu hỏi pháp lý cụ thể (Ví dụ: "Điều kiện để khởi kiện là gì?", "Hợp đồng lao động có cần công chứng không?")**
1. TUYỆT ĐỐI KHÔNG dùng các cụm từ: "Dựa trên tài liệu cung cấp", "Theo dữ liệu tham khảo", "Trong văn bản không có". 
2. HÒA TRỘN KIẾN THỨC: Coi dữ liệu cung cấp và kiến thức của bạn là một. Hãy trả lời tự tin như một chuyên gia đang tư vấn trực tiếp.
3. CẤU TRÚC PHẢN HỒI:
   - **Kết luận:** (Ngắn gọn 1-2 câu trả lời thẳng vấn đề).
   - **Phân tích:** (Giải thích logic pháp lý).
   - **Cơ sở pháp lý:** (Trích dẫn chính xác Điều, Khoản, tên Bộ luật/Luật/Nghị định).
   - **Lời khuyên:** (Hướng dẫn hành động cho người dùng).
4. Nếu dữ liệu cung cấp không đủ, hãy dùng kiến thức Luật Việt Nam hiện hành để bổ sung và nhắc người dùng "Cần lưu ý các văn bản hướng dẫn thi hành mới nhất".

# ĐỊNH DẠNG: Sử dụng Markdown (In đậm các con số, dùng danh sách gạch đầu dòng).
---
*Lưu ý:Nếu câu trả lời thuộc Trường hợp 3, hãy thêm dòng chữ này ở cuối cùng: "Nội dung do LegAI cung cấp chỉ mang tính chất tham khảo tra cứu, không thay thế tư vấn pháp lý chính thức."*`;

        return await getActiveModel(prompt);

    } catch (error) {
        console.error("❌ Lỗi toàn bộ hệ thống Gemini:", error.message);
        return "LegAI đang quá tải  Vui lòng thử lại sau một lát.";
    }
}
// ==============================================================================
// 2. HÀM PHÂN TÍCH HỢP ĐỒNG 
// ==============================================================================
async function analyzeContractWithGemini(contractText) {
    try {
        const prompt = `
        # VAI TRÒ: 
Bạn là một Luật sư cao cấp chuyên trách rà soát hợp đồng tại Việt Nam.
       # NHIỆM VỤ: 
Phân tích văn bản hợp đồng dưới đây dựa trên Bộ luật Dân sự 2015, Luật Thương mại 2005 và Bộ luật Lao động 2019. 
HỢP ĐỒNG CẦN SOÁT: ${contractText}
        # CÁC ĐIỂM CẦN QUÉT (SCAN POINTS):
1. Kiểm tra mức lương (không được thấp hơn lương tối thiểu vùng).
2. Kiểm tra thời giờ làm việc, nghỉ ngơi và chế độ tăng ca.
3. Phát hiện các điều khoản "bẫy": giữ giấy tờ gốc, phạt tiền thay cho kỷ luật, bồi thường đào tạo vô lý.
4. Đánh giá tính công bằng trong việc đơn phương chấm dứt hợp đồng.

# QUY TẮC CHẤM ĐIỂM TIN CẬY (TRUST SCORE):
Hãy trả về con số từ 0 đến 100 thể hiện độ AN TOÀN cho người ký:
- 81 - 100: **Rất an toàn (Good)** - Quyền lợi được bảo vệ tốt.
- 51 - 80: **Ổn định (Fair)** - Hợp pháp nhưng cần đàm phán thêm vài chi tiết.
- 21 - 50: **Rủi ro (Risk)** - Nhiều điều khoản ép buộc, bất lợi.
- 0 - 20: **Nguy hiểm (Dangerous)** - Vi phạm pháp luật nghiêm trọng.

# YÊU CẦU ĐẦU RA (JSON ONLY):
{
  "summary": "Tóm tắt ngắn gọn tình trạng pháp lý của hợp đồng",
  "risk_score": (Số nguyên 0-100, ĐIỂM CAO LÀ TỐT),
  "risks": [
    {
      "clause": "Trích dẫn điều khoản gây lo ngại",
      "issue": "Giải thích tại sao điều khoản này làm giảm điểm an toàn",
      "severity": "High/Medium/Low"
    }
  ],
  "recommendation": "Lời khuyên cụ thể để cải thiện độ an toàn"
}

LƯU Ý: Trả về JSON thuần túy, không có văn bản giải thích thừa bên ngoài.`;

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
            risks: [{ clause: "Hệ thống", issue: " API  đang quá tải.", severity: "High" }],
            recommendation: "Vui lòng chờ 15 giây rồi kiểm tra lại."
        };
    }
}
// ==============================================================================
// 3. HÀM TẠO BIỂU MẪU (AI FORM GENERATOR)
// ==============================================================================
async function generateFormWithGemini(userInput, chatHistory = []) {
    try {
        const historyText = chatHistory.length > 0
            ? chatHistory.map(msg => `${msg.role === 'user' ? 'NGƯỜI DÙNG' : 'LEGAI'}: ${msg.content}`).join("\n\n")
            : "Chưa có lịch sử.";

        const prompt = `
# VAI TRÒ:
Bạn là LegAI - Trợ lý thông minh chuyên bóc tách dữ liệu để tự động điền Form Hợp Đồng pháp lý tại Việt Nam.

# NGỮ CẢNH TRƯỚC ĐÓ:
${historyText}

# ĐẦU VÀO MỚI CỦA NGƯỜI DÙNG: 
"${userInput}"

# NHIỆM VỤ:
1. Đọc và bóc tách các thông tin (Tên, CCCD/MST, địa chỉ, sđt, giá trị hợp đồng...) từ tin nhắn của người dùng.
2. Nếu thông tin nào không được nhắc đến, hãy để chuỗi rỗng "".
3. Viết một câu phản hồi (chat_reply) tự nhiên để báo cho người dùng biết bạn đã điền được gì và yêu cầu họ cung cấp thêm những gì còn thiếu.

# YÊU CẦU ĐẦU RA (JSON ONLY - TUYỆT ĐỐI KHÔNG CÓ MARKDOWN HAY TEXT THỪA):
{
  "chat_reply": "Câu trả lời của bạn gửi cho người dùng (ngắn gọn, thân thiện)",
  "template_type": "hop_dong_tieu_chuan",
  "extracted_data": {
    "can_cu_luat": ["Bộ luật Dân sự 2015", "Luật Thương mại 2005 (nếu liên quan thương mại)"],
    "benA_name": "",
    "benA_id": "",
    "benA_address": "",
    "benA_phone": "",
    "benA_rep": "",
    "benB_name": "",
    "benB_id": "",
    "benB_address": "",
    "benB_phone": "",
    "benB_rep": "",
    "noi_dung_chinh": "",
    "gia_tri_hop_dong": "",
    "thoi_han": ""
  }
}`;

        const responseText = await getActiveModel(prompt);

        // Làm sạch JSON giống như hàm phân tích hợp đồng
        let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');
        return JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));

    } catch (error) {
        console.error("❌ Lỗi AI Form Generator:", error.message);
        throw new Error("Không thể bóc tách dữ liệu lúc này.");
    }
}


module.exports = { generateAnswerWithGemini, analyzeContractWithGemini, generateFormWithGemini };