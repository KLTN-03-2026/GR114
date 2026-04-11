const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;

const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
<<<<<<< HEAD
=======
console.log("🔑 Đang sử dụng Key (4 ký tự cuối):", API_KEY?.slice(-4));
console.log("🔍 KEY ĐANG CHẠY:", API_KEY.substring(0, 5) + "..." + API_KEY.slice(-5));
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
if (!API_KEY) {
    console.error("❌ LỖI: Chưa cấu hình GEMINI_API_KEY trong file .env!");
}

const genAI = new GoogleGenerativeAI(API_KEY);

<<<<<<< HEAD
// ✅ ĐÃ SỬA: Danh sách các model xịn nhất của bạn, loại bỏ các model cũ gây lỗi 404
const AVAILABLE_MODELS = [
    "gemini-1.5-flash"         // Model tối ưu chi phí
=======
//  ĐÃ SỬA: Danh sách các model xịn nhất của bạn, loại bỏ các model cũ gây lỗi 404
const AVAILABLE_MODELS = [
    "gemini-3.1-flash-lite-preview", // Ưu tiên 1: Bản 3.1 Lite cực nhanh, ít tốn quota
    "gemini-flash-latest",           // Ưu tiên 2: Luôn trỏ về bản Flash ổn định nhất
    "gemini-2.0-flash-lite",         // Ưu tiên 3: Bản rút gọn của 2.0, dễ lách 429
    "gemini-3.1-pro-preview"
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
];

// Hàm bổ trợ để lấy model và xử lý lỗi Quota/404
async function getActiveModel(prompt) {
<<<<<<< HEAD
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
=======
    // 1. Cắt ngắn prompt để né lỗi 429 (Quota Token)
    const shortPrompt = typeof prompt === 'string' ? prompt.substring(0, 5000) : prompt;

    for (const modelName of AVAILABLE_MODELS) {
        try {
            console.log(`📡 Đang gọi: ${modelName}...`);
            const model = genAI.getGenerativeModel({
                model: modelName,

                generationConfig: { responseMimeType: "application/json" }
            });
            const result = await model.generateContent(shortPrompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            const msg = error.message;
            console.error(`❌ ${modelName} báo lỗi:`, msg);

            // Nếu dính 429 (Hết lượt/Spam), bắt buộc phải nghỉ lâu
            if (msg.includes("429") || msg.includes("quota")) {
                console.warn("🚫 Dính giới hạn Quota. Nghỉ 10s rồi thử con tiếp theo...");
                await new Promise(r => setTimeout(r, 10000)); // Nghỉ 10s
                continue;
            }

            // Nếu dính 404, thử con tiếp theo luôn
            if (msg.includes("404")) continue;

            // Nếu lỗi khác, nghỉ 2s
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw new Error("Không thể kết nối với bất kỳ AI Model nào.");
}
// AI_Engine/src/services/geminiService.js

async function classifyCategoryWithAI(title) {
    const VALID_CATEGORIES = [
        "Bộ máy hành chính", "Tài chính nhà nước", "Văn hóa - Xã hội", "Tài nguyên - Môi trường",
        "Bất động sản", "Xây dựng - Đô thị", "Thương mại", "Thể thao - Y tế", "Giáo dục",
        "Thuế - Phí - Lệ phí", "Giao thông - Vận tải", "Lao động - Tiền lương", "Công nghệ thông tin",
        "Đầu tư", "Doanh nghiệp", "Xuất nhập khẩu", "Sở hữu trí tuệ", "Tiền tệ - Ngân hàng",
        "Bảo hiểm", "Thủ tục Tố tụng", "Hình sự", "Dân sự", "Chứng khoán", "Lĩnh vực khác"
    ];

    const upperTitle = title.toUpperCase();

    try {
        const prompt = `Bạn là chuyên gia pháp luật. Phân loại tiêu đề văn bản sau vào MỘT nhóm duy nhất từ danh sách: [${VALID_CATEGORIES.join(", ")}]. 
        Tiêu đề: "${title}"
        Chỉ trả về đúng tên nhóm trong danh sách, không giải thích gì thêm.`;

        // 🟢 Cố gắng gọi AI trước (tận dụng vòng lặp model Duy đã viết)
        const response = await getActiveModel(prompt);
        const categoryResult = response.trim().replace(/[".*]/g, "");

        if (VALID_CATEGORIES.includes(categoryResult)) {
            return categoryResult;
        }

        // Nếu AI trả về kết quả không nằm trong list, ném lỗi để xuống phần Keyword xử lý
        throw new Error("AI trả về danh mục không hợp lệ");

    } catch (aiErr) {
        // 🆘 PHẦN CỨU HỘ: Khi AI sập hoặc bận, Logic Keyword của Duy sẽ ra tay
        console.warn("🆘 AI đang bận, kích hoạt bộ lọc Keyword 'Siêu cấp' của Duy để cứu dữ liệu...");

        if (upperTitle.includes("HÌNH SỰ") || upperTitle.includes("TỘI PHẠM")) return "Hình sự";
        if (upperTitle.includes("DÂN SỰ") || upperTitle.includes("HÔN NHÂN") || upperTitle.includes("GIA ĐÌNH") || upperTitle.includes("THỪA KẾ")) return "Dân sự";
        if (upperTitle.includes("ĐẤT ĐAI") || upperTitle.includes("NHÀ Ở") || upperTitle.includes("BẤT ĐỘNG SẢN")) return "Bất động sản";
        if (upperTitle.includes("LAO ĐỘNG") || upperTitle.includes("TIỀN LƯƠNG") || upperTitle.includes("BHXH") || upperTitle.includes("BẢO HIỂM XÃ HỘI")) return "Lao động - Tiền lương";
        if (upperTitle.includes("THUẾ") || upperTitle.includes("PHÍ") || upperTitle.includes("LỆ PHÍ")) return "Thuế - Phí - Lệ phí";
        if (upperTitle.includes("XUẤT KHẨU") || upperTitle.includes("NHẬP KHẨU") || upperTitle.includes("HẢI QUAN")) return "Xuất nhập khẩu";
        if (upperTitle.includes("DOANH NGHIỆP") || upperTitle.includes("CÔNG TY") || upperTitle.includes("HỢP TÁC XÃ")) return "Doanh nghiệp";
        if (upperTitle.includes("ĐẦU TƯ") || upperTitle.includes("DỰ ÁN") || upperTitle.includes("ĐẤU THẦU")) return "Đầu tư";
        if (upperTitle.includes("TÀI CHÍNH") || upperTitle.includes("NGÂN SÁCH") || upperTitle.includes("KẾ TOÁN") || upperTitle.includes("KIỂM TOÁN")) return "Tài chính nhà nước";
        if (upperTitle.includes("GIAO THÔNG") || upperTitle.includes("VẬN TẢI") || upperTitle.includes("XE CỘ") || upperTitle.includes("BẰNG LÁI")) return "Giao thông - Vận tải";
        if (upperTitle.includes("NGÂN HÀNG") || upperTitle.includes("TÍN DỤNG") || upperTitle.includes("LÃI SUẤT") || upperTitle.includes("TIỀN TỆ")) return "Tiền tệ - Ngân hàng";
        if (upperTitle.includes("SỞ HỮU TRÍ TUỆ") || upperTitle.includes("BẢN QUYỀN") || upperTitle.includes("TÁC GIẢ") || upperTitle.includes("NHÃN HIỆU")) return "Sở hữu trí tuệ";
        if (upperTitle.includes("Y TẾ") || upperTitle.includes("SỨC KHỎE") || upperTitle.includes("BỆNH VIỆN") || upperTitle.includes("DƯỢC")) return "Thể thao - Y tế";
        if (upperTitle.includes("GIÁO DỤC") || upperTitle.includes("HỌC SINH") || upperTitle.includes("SINH VIÊN") || upperTitle.includes("TRƯỜNG HỌC") || upperTitle.includes("ĐÀO TẠO")) return "Giáo dục";
        if (upperTitle.includes("CÔNG NGHỆ THÔNG TIN") || upperTitle.includes("CNTT") || upperTitle.includes("INTERNET") || upperTitle.includes("MẠNG") || upperTitle.includes("DỮ LIỆU")) return "Công nghệ thông tin";
        if (upperTitle.includes("HÀNH CHÍNH") || upperTitle.includes("CÁN BỘ") || upperTitle.includes("CÔNG CHỨC") || upperTitle.includes("UBND") || upperTitle.includes("HĐND")) return "Bộ máy hành chính";
        if (upperTitle.includes("MÔI TRƯỜNG") || upperTitle.includes("TÀI NGUYÊN") || upperTitle.includes("RÁC THẢI") || upperTitle.includes("KHOÁNG SẢN")) return "Tài nguyên - Môi trường";
        if (upperTitle.includes("XÂY DỰNG") || upperTitle.includes("ĐÔ THỊ") || upperTitle.includes("CÔNG TRÌNH") || upperTitle.includes("KIẾN TRÚC")) return "Xây dựng - Đô thị";
        if (upperTitle.includes("THƯƠNG MẠI") || upperTitle.includes("KINH DOANH") || upperTitle.includes("CẠNH TRANH")) return "Thương mại";
        if (upperTitle.includes("CHỨNG KHOÁN") || upperTitle.includes("CỔ PHIẾU")) return "Chứng khoán";
        if (upperTitle.includes("TỐ TỤNG") || upperTitle.includes("XỬ PHẠT") || upperTitle.includes("THI HÀNH ÁN")) return "Thủ tục Tố tụng";
        if (upperTitle.includes("BẢO HIỂM")) return "Bảo hiểm";
        if (upperTitle.includes("VĂN HÓA") || upperTitle.includes("XÃ HỘI") || upperTitle.includes("DU LỊCH") || upperTitle.includes("THỂ THAO")) return "Văn hóa - Xã hội";

        return "Lĩnh vực khác"; // Phao cứu sinh cuối cùng
    }
}

// ==============================================================================
// 1. HÀM CHAT 
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
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

<<<<<<< HEAD

module.exports = { generateAnswerWithGemini, analyzeContractWithGemini, generateFormWithGemini };
=======
/**
 * Chức năng: Lập kế hoạch thực thi pháp lý dựa trên yêu cầu và hồ sơ
 * @param {string} userPrompt - Yêu cầu từ người dùng
 * @param {string} context - Nội dung bóc tách từ hồ sơ (PDF/Word)
 * 
 */
async function generatePlanWithGemini(userPrompt, context) {
    try {
        const systemInstruction = `
            Bạn là một Legal Architect cao cấp của hệ thống LegAI.
            NHIỆM VỤ: Lập lộ trình thực thi pháp lý DỰA TRÊN NỘI DUNG VĂN BẢN PHÁP LUẬT ĐƯỢC CUNG CẤP.

            QUY TẮC XỬ LÝ DỮ LIỆU:
            1. Trích xuất các ĐIỀU, KHOẢN cụ thể để đưa vào 'title'.
            2. 'assignee' phải xác định dựa trên thực tế pháp lý.
            3. 'deadline' phải dựa trên thời hạn tố tụng thực tế.
            
            YÊU CẦU ĐỘ CHI TIẾT:
            - Phải chia ít nhất 8-12 bước nếu vụ việc phức tạp.
            - Trường 'description' phải chứa ít nhất 2-3 câu mô tả chi tiết quy trình và giấy tờ cần thiết.

            CẤU TRÚC JSON BẮT BUỘC:
            [
              {
                "id": number,
                "phase": "Tên giai đoạn",
                "title": "Tên công việc",
                "description": "Mô tả chi tiết và trích dẫn luật...", 
                "assignee": "Chủ thể thực hiện",
                "deadline": "Thời hạn"
              }
            ]
            - CẤM: Không giải thích, không Markdown, không "Chào bạn".
        `;

        const finalPrompt = `
            HỒ SƠ PHÁP LÝ: "${context.substring(0, 10000)}" 
            YÊU CẦU: "${userPrompt}"
            Hãy lập lộ trình chi tiết.
        `;

        let text = await getActiveModel(systemInstruction + finalPrompt);

        // Làm sạch và Parse
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const planArray = JSON.parse(text);
        return planArray;

    } catch (error) {
        console.error("❌ Lỗi tại generatePlanWithGemini:", error);
        // VỊ TRÍ CẦN THÊM: Trả về mặc định có description để UI không bị trống
        return [
            {
                id: 1,
                phase: 'Thông báo',
                title: 'Không thể khởi tạo lộ trình',
                description: 'Hệ thống AI đang bận hoặc hồ sơ quá phức tạp. Vui lòng thử lại với yêu cầu ngắn gọn hơn.',
                assignee: 'Hệ thống',
                deadline: 'N/A'
            }
        ];
    }
}
module.exports = { generateAnswerWithGemini, analyzeContractWithGemini, generateFormWithGemini, classifyCategoryWithAI, generatePlanWithGemini };
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
