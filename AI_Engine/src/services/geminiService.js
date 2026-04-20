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
    const fastQueue = [...new Set([preferredModel,
         "gemini-2.5-flash", // Model tốt nhất, nhanh và rẻ cho RAG/Extraction
        "gemini-2.0-flash", // Phiên bản tiền nhiệm ổn định
        "gemini-pro"        // Dự phòng khi các bản flash bị lỗi
        
        ])];

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
                        console.log(`  ${autoModel} đã thành công!`);
                        return text;
                    }
                } catch (err) {
                    continue; 
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
Bạn là LegAI - Luật sư cấp cao và Trợ lý thông minh chuyên bóc tách dữ liệu để tự động soạn thảo Hợp Đồng pháp lý tại Việt Nam.

# QUY TẮC SOẠN THẢO NỘI DUNG (BẮT BUỘC TUÂN THỦ):
1. Văn phong: Trang trọng, chặt chẽ, khách quan. Tuyệt đối không dùng từ ngữ giao tiếp đời thường.
2. Thuật ngữ pháp lý: Chủ động sử dụng các thuật ngữ chuyên ngành chuẩn xác (Ví dụ: "Đơn phương chấm dứt", "Bất khả kháng", "Nghĩa vụ liên đới", "Chuyển giao rủi ro", "Chậm thực hiện nghĩa vụ").
3. Tính bảo vệ: Khi người dùng không yêu cầu chi tiết, phải TỰ ĐỘNG soạn thảo các điều khoản theo hướng bảo vệ tối đa quyền lợi hợp pháp cho cả hai bên, lường trước các rủi ro phát sinh.
4. Cách trình bày: Không viết gộp một đoạn dài. Phải bám sát việc chia nhỏ thành từng tiểu mục (1.1, 1.2) mạch lạc.
# NGỮ CẢNH TRƯỚC ĐÓ:
${historyText}

# ĐẦU VÀO MỚI CỦA NGƯỜI DÙNG: 
"${userInput}"

# CÁC KHUNG HỢP ĐỒNG THỰC CHIẾN (MASTER TEMPLATES):
Dựa trên yêu cầu của người dùng, BẮT BUỘC chọn 1 trong 4 khung dưới đây và triển khai CHI TIẾT thành văn xuôi pháp lý cho từng tiểu mục (1.1, 1.2...):

[KHUNG 1: HỢP ĐỒNG MUA BÁN HÀNG HÓA]
- Điều 1: Tên hàng hóa, số lượng, chất lượng, giá trị (1.1. Tên, đơn vị, số lượng, đơn giá, thành tiền; 1.2. Tổng giá trị bằng số và chữ).
- Điều 2: Thanh toán (2.1. Ngày thanh toán; 2.2. Hình thức thanh toán).
- Điều 3: Thời gian, địa điểm, phương thức giao hàng (3.1. Thời gian, địa điểm giao; 3.2. Phương tiện và chi phí bốc xếp; 3.3. Chi phí lưu kho bãi nếu không nhận hàng; 3.4. Kiểm nhận phẩm chất tại chỗ và lập biên bản nếu thiếu sót; 3.5. Kiểm tra hàng nguyên kiện và thời hạn báo lỗi trung gian).
- Điều 4: Trách nhiệm của các bên (4.1. Trách nhiệm về khiếm khuyết trước/sau chuyển rủi ro; 4.2. Trách nhiệm thanh toán và nhận hàng).
- Điều 5: Bảo hành và hướng dẫn sử dụng (5.1. Thời gian bảo hành; 5.2. Cung cấp giấy hướng dẫn).
- Điều 6: Ngưng thanh toán (6.1. Do lừa dối; 6.2. Hàng hóa bị tranh chấp; 6.3. Giao sai hợp đồng; 6.4. Bồi thường nếu báo cáo sai sự thật).
- Điều 7: Điều khoản phạt vi phạm (7.1. Phạt % giá trị hợp đồng nếu vi phạm - tối đa 8%; 7.2. Trách nhiệm vật chất dựa trên khung phạt Nhà nước).
- Điều 8: Bất khả kháng và giải quyết tranh chấp (8.1. Định nghĩa bất khả kháng; 8.2. Nghĩa vụ thông báo; 8.3. Đưa ra Tòa án có thẩm quyền nếu không tự giải quyết được).

[KHUNG 2: HỢP ĐỒNG CUNG CẤP DỊCH VỤ]
- Điều 1: Đối tượng hợp đồng (1.1. Chi tiết công việc Bên B thực hiện cho Bên A).
- Điều 2: Thời hạn thực hiện (2.1. Ngày bắt đầu; 2.2. Thời gian dự kiến hoàn thành).
- Điều 3: Quyền và nghĩa vụ của Bên A (3.1. Yêu cầu làm đúng chất lượng, quyền đơn phương chấm dứt nếu vi phạm; 3.2. Cung cấp tài liệu, kế hoạch và thanh toán đúng hạn).
- Điều 4: Quyền và nghĩa vụ của Bên B (4.1. Yêu cầu cung cấp thông tin, thanh toán; 4.2. Không giao người khác làm thay nếu chưa đồng ý, bảo mật thông tin, báo cáo rủi ro).
- Điều 5: Tiền dịch vụ và phương thức thanh toán (5.1. Tổng tiền gồm VAT; 5.2. Hình thức thanh toán).
- Điều 6: Đơn phương chấm dứt (6.1. Quyền chấm dứt nếu không có lợi và số ngày báo trước; 6.2. Chấm dứt do vi phạm nghiêm trọng).
- Điều 7: Giải quyết tranh chấp (7.1. Thỏa thuận kịp thời; 7.2. Khởi kiện tại Tòa án).

[KHUNG 3: HỢP ĐỒNG THỬ VIỆC / LAO ĐỘNG]
- Điều 1: Thời hạn và công việc (1.1. Loại hợp đồng; 1.2. Thời gian thử việc từ ngày... đến ngày...; 1.3. Địa điểm làm việc; 1.4. Chức danh/Nhiệm vụ chuyên môn).
- Điều 2: Chế độ làm việc (2.1. Số giờ làm việc/ngày, ngày nghỉ hàng tuần; 2.2. Dụng cụ làm việc được cấp).
- Điều 3: Lương và Phụ cấp (3.1. Mức lương thử việc - đảm bảo >= 85% lương chính thức; 3.2. Phụ cấp ăn trưa, đi lại; 3.3. Hình thức/ngày trả lương).
- Điều 4: Quyền và Nghĩa vụ NLĐ (4.1. Quyền lợi nhận lương, đánh giá ký HĐ chính thức; 4.2. Nghĩa vụ tuân thủ nội quy, bảo mật kinh doanh).
- Điều 5: Quyền và Nghĩa vụ NSDLĐ (5.1. Quyền điều hành, đánh giá đạt/không đạt; 5.2. Nghĩa vụ trả lương, bảo đảm an toàn LĐ).
- Điều 6: Đơn phương chấm dứt (6.1. Quyền hủy hợp đồng thử việc không cần báo trước, không bồi thường; 6.2. Giải quyết tranh chấp).

[KHUNG 4: HỢP ĐỒNG THUÊ NHÀ Ở]
- Điều 1: Thông tin nhà ở (1.1. Vị trí, địa điểm; 1.2. Hiện trạng chất lượng; 1.3. Diện tích sử dụng riêng/chung; 1.4. Công năng; 1.5. Trang thiết bị kèm theo).
- Điều 2: Giá thuê nhà (2.1. Giá thuê mỗi tháng/năm; 2.2. Tiền điện, nước, dịch vụ bên thuê tự thanh toán).
- Điều 3: Phương thức và thời hạn (3.1. Hình thức thanh toán; 3.2. Thời hạn thanh toán).
- Điều 4: Thời hạn và Bàn giao (4.1. Thời gian thuê; 4.2. Ngày bàn giao).
- Điều 5: Sử dụng nhà (5.1. Mục đích sử dụng; 5.2. Hạn chế sử dụng; 5.3. Tuân thủ nội quy khu nhà).
- Điều 6: Quyền và nghĩa vụ Bên cho thuê (6.1. Yêu cầu thanh toán, bảo quản nhà, bồi thường hư hỏng; 6.2. Giao nhà đúng hạn, bảo trì định kỳ, không đơn phương chấm dứt vô cớ).
- Điều 7: Quyền và nghĩa vụ Bên thuê (6.1. Nhận nhà đúng hiện trạng, yêu cầu sửa chữa lỗi cấu trúc; 6.2. Trả đủ tiền, không tự ý thay đổi cải tạo, bồi thường do lỗi sử dụng).
- Điều 8 & 9: Vi phạm và Phạt (8.1. Trách nhiệm khi vi phạm; 8.2. Mức phạt cụ thể; 8.3. Sự kiện bất khả kháng).
- Điều 10: Chấm dứt hợp đồng (10.1. Đồng ý chấm dứt, chậm thanh toán, hoặc do bất khả kháng; 10.2. Xử lý hậu quả hoàn tiền, trả cọc).

# NHIỆM VỤ BẮT BUỘC:
1. Đọc yêu cầu và TỰ ĐỘNG SUY LUẬN loại hợp đồng phù hợp nhất. Chọn 1 trong 4 khung trên. (Nếu không thuộc 4 loại này, tự suy luận một bộ khung tương tự với các tiểu mục 1.1, 1.2...).
2. Tự động gán vai trò Bên A và Bên B đúng chuẩn (VD: BÊN MUA, BÊN BÁN...). Phân bổ thông tin vào benA_ hay benB_.
3. QUAN TRỌNG: Nếu người dùng cung cấp tên nhưng KHÔNG nói rõ vai trò, TUYỆT ĐỐI KHÔNG ĐOÁN MÒ. Để trống phần tên và BẮT BUỘC hỏi lại trong "chat_reply".
4. TRƯỜNG HỢP BIỂU MẪU TRẮNG: Nếu yêu cầu "mẫu trống", "phôi in", tuyệt đối không hỏi thêm thông tin cá nhân. Trả về cấu trúc với các tiểu mục được để trống (.....).
5. SOẠN THẢO CHI TIẾT (STRUCTURE LOCKING): Trong mảng \`sections\`, bạn BẮT BUỘC phải tạo ra nội dung bằng cách giữ nguyên cấu trúc tiểu mục (1.1, 1.2, 1.3...) của Khung đã chọn. Trình bày dưới dạng văn xuôi pháp lý chặt chẽ. Đưa thông tin của người dùng vào đúng các tiểu mục đó.
6. CONTEXT RESET: Nếu người dùng đổi loại hợp đồng đột ngột, BẮT BUỘC QUÊN SẠCH thông tin cũ, reset các biến về rỗng "".

# YÊU CẦU ĐẦU RA JSON (TUYỆT ĐỐI TUÂN THỦ):
{
  "chat_reply": "Câu trả lời thân thiện báo cáo kết quả và hỏi thêm thông tin nếu thiếu.",
  "template_type": "Loại hợp đồng (VD: hop_dong_lao_dong, hop_dong_mua_ban... Trả về 'none' nếu chỉ chào hỏi)",
  "extracted_data": {
    "ten_hop_dong": "TÊN HỢP ĐỒNG IN HOA",
    "benA_role": "VAI TRÒ BÊN A IN HOA",
    "benB_role": "VAI TRÒ BÊN B IN HOA",
    "can_cu_luat": ["Liệt kê các Luật/Bộ luật mới nhất điều chỉnh giao dịch này"],
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
    "sections": [
      {
        "title": "Tên Điều (VD: Điều 1: Đối tượng hợp đồng)",
        "content": "1.1. [Nội dung pháp lý chi tiết dựa theo khung].\\n1.2. [Nội dung pháp lý chi tiết dựa theo khung]..."
      }
    ]
  }
}
`;

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