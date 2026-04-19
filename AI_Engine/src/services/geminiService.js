const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;

const SystemConfig = require('../config/SystemConfig');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const sql = require('mssql');
const { pool, poolConnect } = require('../config/db');

// ==============================================================================
// HÀM LOGGING THỐNG KÊ (CENTRALIZED)
// ==============================================================================
async function logUsage(featureName) {
    try {
        await poolConnect;
        const logRequest = pool.request();

        const upsertQuery = `
            IF EXISTS (SELECT 1 FROM [LegalBotDB].[dbo].[AIFeatureUsage] 
                       WHERE FeatureName = '${featureName}' 
                       AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE))
            BEGIN
                UPDATE [LegalBotDB].[dbo].[AIFeatureUsage]
                SET UsageCount = UsageCount + 1,
                    LastUsed = GETDATE()
                WHERE FeatureName = '${featureName}'
                       AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
            END
            ELSE
            BEGIN
                INSERT INTO [LegalBotDB].[dbo].[AIFeatureUsage] (FeatureName, UsageCount, LastUsed, CreatedAt)
                VALUES ('${featureName}', 1, GETDATE(), GETDATE())
            END
        `;

        await logRequest.query(upsertQuery);

        // Bắn tín hiệu Socket cho Admin Dashboard
        if (global.io) {
            global.io.emit('new_activity', { type: featureName });
        }
    } catch (err) {
        console.error(`⚠️ Lỗi lưu thống kê ${featureName}:`, err.message);
    }
}

// ==============================================================================
// HÀM HELPER LÀM SẠCH JSON TỪ AI
// ==============================================================================
function cleanAIJsonString(rawString) {
    if (!rawString) return "{}";
    return rawString.replace(/```json/gi, '')
        .replace(/```html/gi, '')
        .replace(/```/g, '')
        .trim();
}

async function getActiveModel(prompt) {
    const apiKey = SystemConfig.geminiApiKey;
    const preferredModel = SystemConfig.geminiModel;
    const temp = SystemConfig.temperature || 0.3;

    if (!apiKey) throw new Error("Chưa có API Key! Vui lòng cập nhật trong Cài đặt.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const shortPrompt = typeof prompt === 'string' ? prompt.substring(0, 10000) : prompt;

    // ==========================================
    // TẦNG 1 & 2: DÙNG MODEL CHỈ ĐỊNH VÀ DỰ PHÒNG CƠ BẢN
    // ==========================================
    const fastQueue = [...new Set([preferredModel, "gemini-1.5-flash-latest", "gemini-2.5-flash", "gemini-flash-latest"])];

    for (const modelName of fastQueue) {
        try {
            console.log(`📡 Đang gọi: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: shortPrompt }] }],
                generationConfig: { temperature: temp }
            });

            const text = (await result.response).text();
            if (text) return text;

        } catch (error) {
            console.warn(`⚠️ ${modelName} thất bại:`, error.message.split('\n')[0]);
            if (error.message.includes("429")) await new Promise(r => setTimeout(r, 2000));
            continue;
        }
    }

    // ==========================================
    // TẦNG 3 (TỐI THƯỢNG): TỰ ĐỘNG QUÉT MODEL KHẢ DỤNG (Như check_model.js)
    // ==========================================
    console.log("🚨 Các model chính đều xịt. Đang kích hoạt radar dò tìm model khả dụng...");

    try {
        // Gửi request hỏi Google xem Key này được xài những con nào
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            // Lọc ra các model có khả năng tạo text (generateContent)
            const availableModels = data.models
                .filter(m => m.supportedGenerationMethods.includes("generateContent"))
                .map(m => m.name.replace('models/', ''));

            console.log(`✅ Radar tìm thấy ${availableModels.length} model. Đang gọi viện binh...`);

            // Chỉ thử tối đa 3 con đầu tiên quét được để tránh treo máy  quá lâu
            for (const autoModel of availableModels.slice(0, 3)) {
                try {
                    console.log(`🚁 Đang thử model viện binh: ${autoModel}...`);
                    const model = genAI.getGenerativeModel({ model: autoModel });

                    const result = await model.generateContent({
                        contents: [{ role: "user", parts: [{ text: shortPrompt }] }],
                        generationConfig: { temperature: temp }
                    });

                    const text = (await result.response).text();
                    if (text) {
                        console.log(`🎉 Viện binh ${autoModel} đã cứu giá thành công!`);
                        return text;
                    }
                } catch (err) {
                    continue; // Viện binh này chết thì gọi viện binh khác
                }
            }
        }
    } catch (fetchError) {
        console.error(" Radar dò tìm bị nhiễu:", fetchError.message);
    }

    throw new Error(" Hãy kiểm tra lại API Key.");
}

// ==============================================================================
// HÀM PHÂN TÍCH HỢP ĐỒNG (CONTRACT ANALYSIS)
// ==============================================================================
async function analyzeContract(contractText) {
    try {
        const prompt = `
        Bạn là một Luật sư AI chuyên nghiệp (LegAI). Hãy phân tích hợp đồng dưới đây và trả về kết quả dưới dạng JSON.
        
        Nội dung hợp đồng:
        """${contractText}"""

        Yêu cầu output JSON format:
        {
            "summary": "Tóm tắt ngắn gọn nội dung hợp đồng (2-3 câu)",
            "risk_score": (Số nguyên từ 0-100, càng cao càng an toàn),
            "risks": [
                {
                    "clause": "Trích dẫn điều khoản gốc gây rủi ro",
                    "issue": "Giải thích tại sao rủi ro theo luật Việt Nam",
                    "severity": "High" | "Medium" | "Low"
                }
            ],
            "recommendation": "Lời khuyên tổng quan của luật sư"
        }
        `;

        const responseText = await getActiveModel(prompt);

        // Làm sạch JSON
        const cleanedText = cleanAIJsonString(responseText);
        const result = JSON.parse(cleanedText);

        // Log usage
        await logUsage('CONTRACT_REVIEW');

        return result;

    } catch (error) {
        console.error("❌ Lỗi phân tích hợp đồng:", error.message);
        return {
            summary: "Lỗi kết nối AI.",
            risk_score: 0,
            risks: [{ clause: "Hệ thống", issue: "API đang quá tải.", severity: "High" }],
            recommendation: "Vui lòng chờ 15 giây rồi kiểm tra lại."
        };
    }
}

// ==============================================================================
// HÀM TẠO BIỂU MẪU (FORM GENERATOR)
// ==============================================================================
async function generateForm(userInput, chatHistory = []) {
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

# NHIỆM VỤ BẮT BUỘC:
1. Đọc yêu cầu và TỰ ĐỘNG SUY LUẬN loại hợp đồng phù hợp nhất dựa trên mục đích giao dịch của người dùng.
2. Tự động gán vai trò Bên A và Bên B sao cho đúng chuẩn thuật ngữ pháp lý với loại hợp đồng đó.
    - BÊN A (Bên xuất tiền / Nhận quyền lợi): BÊN MUA, BÊN THUÊ, BÊN SỬ DỤNG DỊCH VỤ, BÊN NHẬN CHUYỂN NHƯỢNG, BÊN VAY...
   - BÊN B (Bên nhận tiền / Cung cấp): BÊN BÁN, BÊN CHO THUÊ, BÊN CUNG CẤP DỊCH VỤ, BÊN CHUYỂN NHƯỢNG, BÊN CHO VAY...
   Hãy phân tích kỹ ai là ai để gán tên, sđt, địa chỉ vào đúng benA_ hay benB_ theo quy tắc này.
3. QUAN TRỌNG NHẤT: Nếu người dùng cung cấp tên cá nhân/tổ chức nhưng KHÔNG nói rõ họ đóng vai trò gì 
 (Ví dụ: "Tôi là Khánh" nhưng chưa rõ là đi thuê hay cho thuê, mua hay bán),
 TUYỆT ĐỐI KHÔNG ĐOÁN MÒ. Hãy để trống phần tên và BẮT BUỘC hỏi lại trong "chat_reply"
  (VD: "Chào Khánh, bạn là Bên Mua hay Bên Bán?"). 
  Chỉ điền khi chắc chắn 100% ngữ cảnh.
4. Bóc tách các thông tin còn lại. Thông tin nào thiếu để chuỗi rỗng "".
5. TRƯỜNG HỢP YÊU CẦU BIỂU MẪU TRẮNG (BLANK FORM): Nếu người dùng nói rõ chỉ cần "hợp đồng trắng", "mẫu trống", "phôi để in", "tự điền"... thì TUYỆT ĐỐI KHÔNG HỎI THÊM THÔNG TIN CÁ NHÂN.
 Hãy lập tức xuất ra các trường cấu trúc (ten_hop_dong, benA_role, benB_role, can_cu_luat), để trống ("") toàn bộ các trường thông tin còn lại, và trả lời:
 "Tôi đã tạo xong biểu mẫu trắng cho Hợp đồng [...]. Bạn có thể in ra hoặc lưu PDF để tự điền tay nhé!"
# YÊU CẦU ĐẦU RA JSON (TUYỆT ĐỐI TUÂN THỦ CẤU TRÚC NÀY):
6. TỰ ĐỘNG XÓA NGỮ CẢNH CŨ (CONTEXT RESET): Nếu người dùng yêu cầu một loại hợp đồng MỚI KHÁC HOÀN TOÀN với chủ đề đang chat ở trên (Ví dụ: đang làm Hợp đồng Mua bán, đột ngột chuyển sang Hợp đồng Lao động), 
HOẶC yêu cầu "mẫu trắng", thì BẮT BUỘC PHẢI QUÊN SẠCH toàn bộ thông tin cá nhân cũ 
(tên, sđt, địa chỉ...). Tuyệt đối không được lấy thông tin của hợp đồng cũ đắp vào hợp đồng mới.
 Hãy reset các trường thông tin cá nhân về chuỗi rỗng "".
{
  "chat_reply": "Câu trả lời thân thiện báo cho người dùng biết bạn đã lập hợp đồng gì và yêu cầu cung cấp thêm thông tin (nhớ hỏi rõ vai trò nếu chưa chắc chắn).",
  "template_type": "hop_dong_tieu_chuan (CHÚ Ý: Nếu người dùng chỉ chào hỏi, hãy trả về chữ 'none')",
  "extracted_data": {
    "ten_hop_dong": "Tên hợp đồng IN HOA bao quát mọi lĩnh vực (VD: HỢP ĐỒNG LAO ĐỘNG, HỢP ĐỒNG MUA BÁN HÀNG HÓA, HỢP ĐỒNG ỦY QUYỀN, HỢP ĐỒNG DỊCH VỤ...).",
    "benA_role": "Vai trò Bên A IN HOA tương ứng với loại hợp đồng (VD: BÊN MUA, BÊN SỬ DỤNG LAO ĐỘNG, BÊN ỦY QUYỀN, BÊN CHO THUÊ...).",
    "benB_role": "Vai trò Bên B IN HOA tương ứng với loại hợp đồng (VD: BÊN BÁN, NGƯỜI LAO ĐỘNG, BÊN ĐƯỢC ỦY QUYỀN, BÊN THUÊ...).",
    "can_cu_luat": ["Tự động tìm và liệt kê các Bộ luật, Luật Việt Nam MỚI NHẤT đang có hiệu lực và CHUYÊN SÂU NHẤT điều chỉnh loại hợp đồng này (VD: ['Bộ luật Lao động 2019'], hoặc ['Luật Thương mại 2005', 'Bộ luật Dân sự 2015']...)"],
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

        // Làm sạch JSON
        const cleanedText = cleanAIJsonString(responseText);
        const result = JSON.parse(cleanedText);

        // Log usage
        await logUsage('FORM_GENERATOR');

        return result;

    } catch (error) {
        console.error("❌ Lỗi tạo form:", error.message);
        throw new Error("Không thể bóc tách dữ liệu lúc này.");
    }
}

// ==============================================================================
// 1. HÀM CHAT 
// ==============================================================================
async function generateAnswerWithGemini(userQuestion, documents = [], chatHistory = []) {
    try {
        const contextText = documents.length > 0
            ? documents.map((doc, index) => {
                const title = doc.title || doc.van_ban || "Tài liệu chưa rõ tiêu đề";
                const detail = doc.dieu ? `(Điều ${doc.dieu})` : "";
                const content = doc.content || doc.noi_dung_tom_tat || "Không có nội dung chi tiết";
                return `[TÀI LIỆU ${index + 1}]: ${title} ${detail}\nNội dung: ${content}`;
            }).join("\n\n")
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


# QUY TẮC PHÂN LOẠI & TRẢ LỜI (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):

Hãy tự động phân tích "YÊU CẦU TỪ NGƯỜI DÙNG" để xếp vào ĐÚNG MỘT TRONG BA trường hợp dưới đây và CHỈ trả lời theo kịch bản của trường hợp đó (Tuyệt đối không trộn lẫn):

**Trường hợp 1: Giao tiếp thông thường (CHỈ MANG TÍNH CHẤT Chào hỏi, cảm ơn, hỏi thăm...)**
- Phản hồi: Lịch sự, tự nhiên, thân thiện và ngắn gọn (1-2 câu).
- Cấu trúc: KHÔNG dùng cấu trúc phân tích pháp lý. Chỉ chào hỏi và gợi ý người dùng đặt câu hỏi về luật.
- Ví dụ: "Chào bạn! Tôi là LegAI. Tôi có thể giúp bạn tra cứu hoặc tư vấn vấn đề pháp lý nào hôm nay?"

**Trường hợp 2: Câu hỏi ngoài chuyên môn (Toán học, lập trình, nấu ăn, thời tiết...)**
- Phản hồi: Lịch sự từ chối và nhắc nhở giới hạn chuyên môn của bạn.
- Cấu trúc: KHÔNG dùng cấu trúc phân tích pháp lý. 
- Ví dụ: "Xin lỗi, tôi là trợ lý chuyên trách về Pháp luật Việt Nam nên không thể hỗ trợ bạn vấn đề này. Bạn có câu hỏi nào về luật cần tôi giải đáp không?"

**Trường hợp 3: Câu hỏi pháp lý cụ thể (Ví dụ: "Điều kiện khởi kiện?", "Hợp đồng lao động...")**
1. CẤM CHÀO HỎI DƯ THỪA: Tuyệt đối không thêm các câu như "Chào bạn", "Tôi là LegAI", "Chào bạn, để trả lời câu hỏi này...". PHẢI ĐI THẲNG NGAY VÀO PHẦN KẾT LUẬN.
2. TUYỆT ĐỐI KHÔNG dùng các cụm từ: "Dựa trên tài liệu cung cấp", "Theo dữ liệu tham khảo", "Trong văn bản không có". 
3. HÒA TRỘN KIẾN THỨC: Coi dữ liệu cung cấp và kiến thức của bạn là một. Hãy trả lời tự tin như một chuyên gia đang tư vấn trực tiếp.
4. CẤU TRÚC PHẢN HỒI:
   - **Kết luận:** (Ngắn gọn 1-2 câu trả lời thẳng vấn đề).
   - **Phân tích:** (Giải thích logic pháp lý).
   - **Cơ sở pháp lý:** (Trích dẫn chính xác Điều, Khoản, tên Bộ luật/Luật/Nghị định).
   - **Lời khuyên:** (Hướng dẫn hành động cho người dùng).
5. Nếu dữ liệu cung cấp không đủ, hãy dùng kiến thức Luật Việt Nam hiện hành để bổ sung và nhắc người dùng "Cần lưu ý các văn bản hướng dẫn thi hành mới nhất".

# ĐỊNH DẠNG: Sử dụng Markdown (In đậm các con số, dùng danh sách gạch đầu dòng).
---
*Lưu ý: Nếu câu trả lời thuộc Trường hợp 3, bắt buộc thêm dòng chữ này ở cuối cùng: "Nội dung do LegAI cung cấp chỉ mang tính chất tham khảo tra cứu, không thay thế tư vấn pháp lý chính thức."*`;

        const answer = await getActiveModel(prompt);

        // Log usage
        await logUsage('CHATBOT_QA');

        return answer;

    } catch (error) {
        console.error(" Lỗi toàn bộ hệ thống Gemini:", error.message);
        return "LegAI đang quá tải  Vui lòng thử lại sau một lát.";
    }
}

// ==============================================================================
// HÀM LẬP KẾ HOẠCH (PLANNING)
// ==============================================================================
async function generatePlan(userPrompt, context) {
    try {
        const prompt = `
        Bạn là một Luật sư AI chuyên nghiệp (LegAI). Hãy phân tích yêu cầu dưới đây và lập một kế hoạch thực thi pháp lý chi tiết (AI Legal Planning).
        
        Nội dung yêu cầu/hồ sơ:
        """${context}"""

        Yêu cầu output JSON format (Danh sách các tasks):
        [
            {
                "id": 1,
                "phase": "Giai đoạn 1",
                "title": "Tên nhiệm vụ cụ thể",
                "assignee": "Người phụ trách (Luật sư A, Trợ lý, hoặc Chờ phân công)",
                "deadline": "Thời gian dự kiến (VD: 3 ngày, 1 tuần)",
                "status": "pending" | "locked"
            }
        ]
        Lưu ý: Chỉ trả về JSON, không kèm giải thích hay markdown.
        `;

        const responseText = await getActiveModel(prompt);
        const cleanedText = cleanAIJsonString(responseText);
        const planningResult = JSON.parse(cleanedText);

        // Log usage
        await logUsage('PLANNING');

        return planningResult;

    } catch (error) {
        console.error("❌ Lỗi lập kế hoạch:", error);
        // Trả về mặc định có description để UI không bị trống
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

// ==============================================================================
// HÀM PHÂN TÍCH VIDEO (VIDEO ANALYSIS)
// ==============================================================================
async function analyzeVideo(transcript) {
    try {
        const prompt = `
            Bạn là Trợ lý Pháp lý Cao cấp (LegAI Analyst). 
            Nhiệm vụ: Thực hiện 'Legal Audit' nội dung video.
            Nội dung Transcript: """${transcript}"""
            Yêu cầu JSON format (CHỈ TRẢ VỀ JSON):
            {
              "analysis_report": "Nội dung báo cáo dạng Markdown...",
              "legal_map": [{ "law_name": "...", "article": "...", "status": "..." }],
              "action_plan": ["..."],
              "audit_metrics": { "trust_score": 95, "complexity_level": "...", "fact_check_result": "..." }
            }
        `;

        const aiResult = await getActiveModel(prompt);
        const cleanedText = cleanAIJsonString(aiResult);
        const result = JSON.parse(cleanedText);

        // Log usage
        await logUsage('VIDEO_ANALYSIS');

        return result;

    } catch (error) {
        console.error("❌ Lỗi phân tích video:", error.message);
        throw new Error("Không thể phân tích video lúc này.");
    }
}

// ==============================================================================
// 1. HÀM CHAT 
// ==============================================================================
async function generateAnswerWithGemini(userQuestion, documents = [], chatHistory = []) {
    try {
        const contextText = documents.length > 0
            ? documents.map((doc, index) => {
                const title = doc.title || doc.van_ban || "Tài liệu chưa rõ tiêu đề";
                const detail = doc.dieu ? `(Điều ${doc.dieu})` : "";
                const content = doc.content || doc.noi_dung_tom_tat || "Không có nội dung chi tiết";
                return `[TÀI LIỆU ${index + 1}]: ${title} ${detail}\nNội dung: ${content}`;
            }).join("\n\n")
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


# QUY TẮC PHÂN LOẠI & TRẢ LỜI (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):

Hãy tự động phân tích "YÊU CẦU TỪ NGƯỜI DÙNG" để xếp vào ĐÚNG MỘT TRONG BA trường hợp dưới đây và CHỈ trả lời theo kịch bản của trường hợp đó (Tuyệt đối không trộn lẫn):

**Trường hợp 1: Giao tiếp thông thường (CHỈ MANG TÍNH CHẤT Chào hỏi, cảm ơn, hỏi thăm...)**
- Phản hồi: Lịch sự, tự nhiên, thân thiện và ngắn gọn (1-2 câu).
- Cấu trúc: KHÔNG dùng cấu trúc phân tích pháp lý. Chỉ chào hỏi và gợi ý người dùng đặt câu hỏi về luật.
- Ví dụ: "Chào bạn! Tôi là LegAI. Tôi có thể giúp bạn tra cứu hoặc tư vấn vấn đề pháp lý nào hôm nay?"

**Trường hợp 2: Câu hỏi ngoài chuyên môn (Toán học, lập trình, nấu ăn, thời tiết...)**
- Phản hồi: Lịch sự từ chối và nhắc nhở giới hạn chuyên môn của bạn.
- Cấu trúc: KHÔNG dùng cấu trúc phân tích pháp lý. 
- Ví dụ: "Xin lỗi, tôi là trợ lý chuyên trách về Pháp luật Việt Nam nên không thể hỗ trợ bạn vấn đề này. Bạn có câu hỏi nào về luật cần tôi giải đáp không?"

**Trường hợp 3: Câu hỏi pháp lý cụ thể (Ví dụ: "Điều kiện khởi kiện?", "Hợp đồng lao động...")**
1. CẤM CHÀO HỎI DƯ THỪA: Tuyệt đối không thêm các câu như "Chào bạn", "Tôi là LegAI", "Chào bạn, để trả lời câu hỏi này...". PHẢI ĐI THẲNG NGAY VÀO PHẦN KẾT LUẬN.
2. TUYỆT ĐỐI KHÔNG dùng các cụm từ: "Dựa trên tài liệu cung cấp", "Theo dữ liệu tham khảo", "Trong văn bản không có". 
3. HÒA TRỘN KIẾN THỨC: Coi dữ liệu cung cấp và kiến thức của bạn là một. Hãy trả lời tự tin như một chuyên gia đang tư vấn trực tiếp.
4. CẤU TRÚC PHẢN HỒI:
   - **Kết luận:** (Ngắn gọn 1-2 câu trả lời thẳng vấn đề).
   - **Phân tích:** (Giải thích logic pháp lý).
   - **Cơ sở pháp lý:** (Trích dẫn chính xác Điều, Khoản, tên Bộ luật/Luật/Nghị định).
   - **Lời khuyên:** (Hướng dẫn hành động cho người dùng).
5. Nếu dữ liệu cung cấp không đủ, hãy dùng kiến thức Luật Việt Nam hiện hành để bổ sung và nhắc người dùng "Cần lưu ý các văn bản hướng dẫn thi hành mới nhất".

# ĐỊNH DẠNG: Sử dụng Markdown (In đậm các con số, dùng danh sách gạch đầu dòng).
---
*Lưu ý: Nếu câu trả lời thuộc Trường hợp 3, bắt buộc thêm dòng chữ này ở cuối cùng: "Nội dung do LegAI cung cấp chỉ mang tính chất tham khảo tra cứu, không thay thế tư vấn pháp lý chính thức."*`;
        return await getActiveModel(prompt);

    } catch (error) {
        console.error(" Lỗi toàn bộ hệ thống Gemini:", error.message);
        return "LegAI đang quá tải  Vui lòng thử lại sau một lát.";
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

module.exports = {
    getActiveModel,
    generateAnswerWithGemini,
    analyzeContract,
    generateForm,
    generatePlan,
    analyzeVideo
};