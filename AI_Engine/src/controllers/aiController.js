const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const { CrawlKit } = require('paparusi-crawlkit'); // Dùng để gọi CrawlKit API
const axios = require('axios');
const sql = require('mssql');
const { pool } = require('../config/db');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
// Cấu hình Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);



// Dùng bản 1.5-flash và bật chế độ ép trả về JSON 100%
const model = genAI.getGenerativeModel({
    model: "gemini-flash-lite-latest"

});
/**
 * Hàm hỗ trợ: Cạo sạch thẻ Markdown bọc ngoài JSON của AI
 */
const cleanAIJsonString = (rawString) => {
    if (!rawString) return "{}";
    return rawString.replace(/```json/gi, '')
        .replace(/```html/gi, '')
        .replace(/```/g, '')
        .trim();
};
/**
 * Hàm hỗ trợ làm sạch URL Video để tối ưu hóa Cache (Tiết kiệm 100 request CrawlKit)
 */
const cleanVideoUrl = (url) => {
    try {
        const urlObj = new URL(url);
        // YouTube Shorts/Watch
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            let videoId = urlObj.pathname.includes('/shorts/')
                ? urlObj.pathname.split('/shorts/')[1].split('/')[0]
                : urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
            return `https://www.youtube.com/watch?v=${videoId.split('?')[0]}`;
        }
        // TikTok
        if (urlObj.hostname.includes('tiktok.com')) {
            return `https://www.tiktok.com${urlObj.pathname.split('?')[0]}`;
        }
        return url;
    } catch (e) { return url; }
};
// ==============================================================================
// 1. API THẨM ĐỊNH HỢP ĐỒNG (FILE SCANNER)
// ==============================================================================
exports.analyzeContract = async (req, res) => {
    let filePath = null;

    try {
        // 1. Kiểm tra xem có file gửi lên không
        if (!req.file) {
            return res.status(400).json({ error: "Vui lòng upload file hợp đồng!" });
        }

        filePath = req.file.path;
        const mimeType = req.file.mimetype;
        let contractText = "";

        // 2. Phân loại và Đọc file
        console.log(`🕵️‍♂️ Đang đọc file: ${req.file.originalname} (${mimeType})`);

        if (mimeType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            contractText = data.text;
        }
        else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            contractText = result.value;
        }
        else {
            contractText = fs.readFileSync(filePath, 'utf-8');
        }

        if (!contractText || contractText.trim().length < 10) {
            return res.status(400).json({ error: "Không đọc được nội dung file hoặc file quá ngắn." });
        }

        // 3. Gửi cho Gemini phân tích
        console.log("🤖 Đang gửi nội dung cho Gemini phân tích...");

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

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const cleanedText = cleanAIJsonString(responseText);
        const analysisResult = JSON.parse(cleanedText);

        console.log("✅ Phân tích xong!");
        res.json(analysisResult);

    } catch (error) {
        console.error("❌ Lỗi phân tích:", error);
        res.status(500).json({ error: "Lỗi hệ thống khi phân tích hợp đồng. Chi tiết: " + error.message });
    } finally {
        // Luôn dọn rác ổ cứng dù thành công hay thất bại
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🧹 Đã dọn dẹp file tạm.");
        }
    }
};

// ==============================================================================
// 2. API TẠO BIỂU MẪU (FORM GENERATOR)
// ==============================================================================
exports.generateForm = async (req, res) => {
    try {
        const { text, history } = req.body;

        if (!text) {
            return res.status(400).json({ error: "Thiếu nội dung chat" });
        }

        console.log("📥 Đang nhận yêu cầu tạo Form từ Frontend:", text);

        // Nối lịch sử chat để AI có "trí nhớ"
        const historyText = history && history.length > 0
            ? history.map(msg => `${msg.role === 'user' ? 'NGƯỜI DÙNG' : 'LEGAI'}: ${msg.content}`).join("\n\n")
            : "Chưa có lịch sử.";

        const prompt = `
        # VAI TRÒ:
        Bạn là LegAI - Trợ lý thông minh chuyên bóc tách dữ liệu để tự động điền Form Hợp Đồng pháp lý tại Việt Nam.

        # NGỮ CẢNH TRƯỚC ĐÓ:
        ${historyText}

        # ĐẦU VÀO MỚI CỦA NGƯỜI DÙNG: 
        "${text}"

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

        // Gọi Gemini (dùng luôn model đã config JSON MimeType ở trên)
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON trả về
        // Đưa qua dao cạo trước khi parse
        const cleanedText = cleanAIJsonString(responseText);
        const aiData = JSON.parse(cleanedText);

        console.log("📤 AI đã bóc tách xong, chuẩn bị gửi về Frontend!");
        res.json(aiData);

    } catch (error) {
        console.error("❌ Lỗi API Generate Form:", error);
        res.status(500).json({ error: "Lỗi hệ thống LegAI khi tạo Form" });
    }
};

// ==========================================
// 3. TÍNH NĂNG LẬP KẾ HOẠCH (AI PLANNING)
// ==========================================
exports.generatePlanning = async (req, res) => {
    let filePaths = [];

    try {
        const { rawText } = req.body;
        let combinedText = rawText || "";

        // 1. Phân loại và Đọc các file đính kèm (nếu có)
        if (req.files && req.files.length > 0) {
            console.log(`📂 Đang xử lý ${req.files.length} file đính kèm...`);

            for (const file of req.files) {
                const filePath = file.path;
                filePaths.push(filePath);
                const mimeType = file.mimetype;

                let fileText = "";
                if (mimeType === 'application/pdf') {
                    const dataBuffer = fs.readFileSync(filePath);
                    const data = await pdf(dataBuffer);
                    fileText = data.text;
                }
                else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const result = await mammoth.extractRawText({ path: filePath });
                    fileText = result.value;
                }
                else {
                    fileText = fs.readFileSync(filePath, 'utf-8');
                }

                combinedText += `\n\n--- NỘI DUNG TỪ FILE [${file.originalname}] ---\n${fileText}`;
            }
        }

        if (!combinedText || combinedText.trim().length < 5) {
            return res.status(400).json({ error: "Vui lòng nhập nội dung hoặc upload file để lập kế hoạch!" });
        }

        // 2. Gửi cho Gemini lập kế hoạch (Prompt chuyên dụng cho Pháp lý)
        console.log("🤖 Đang gửi dữ liệu cho Gemini lập kế hoạch Agentic...");

        const prompt = `
        Bạn là một Luật sư AI chuyên nghiệp (LegAI). Hãy phân tích yêu cầu dưới đây và lập một kế hoạch thực thi pháp lý chi tiết (AI Legal Planning).
        
        Nội dung yêu cầu/hồ sơ:
        """${combinedText}"""

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

        const result = await model.generateContent(prompt);
        // 3. Parse JSON từ Gemini
        const responseText = result.response.text();
        const planningResult = JSON.parse(responseText);

        // 4. LƯU VÀO SQL SERVER (KÉT SẮT CỦA DUY)
        try {
            // Lấy userId từ token (đã qua authMiddleware)
            const userId = req.user ? req.user.id : 1; // Fallback về 1 nếu chưa login (để test)

            const request = pool.request();
            request.input('UserId', sql.Int, userId);
            request.input('RecordType', sql.NVarChar(50), 'PLANNING');
            request.input('Title', sql.NVarChar(500), `Kế hoạch: ${planningResult[0]?.title || 'Tư vấn pháp lý'}`);

            request.input('Folder', sql.NVarChar(200), 'Kế hoạch AI');
            request.input('AnalysisJson', sql.NVarChar(sql.MAX), JSON.stringify(planningResult));
            request.input('AIModel', sql.NVarChar(100), 'gemini-1.5-flash');

            const query = `
                INSERT INTO dbo.ContractHistory (UserId, RecordType, Title, Folder, AnalysisJson, AIModel, CreatedAt)
                VALUES (@UserId, @RecordType, @Title, @Folder, @AnalysisJson, @AIModel, GETDATE())
            `;

            await request.query(query);
            console.log("📂 Đã lưu kế hoạch vào Hồ sơ pháp lý thành công!");
        } catch (dbErr) {
            console.error("⚠️ Lỗi lưu DB (nhưng vẫn trả kết quả cho User):", dbErr);
        }

        console.log(`✅ Lập kế hoạch xong! Đã tạo ${planningResult.length} bước.`);
        res.json({
            success: true,
            data: planningResult,
            message: "Kế hoạch đã được tạo và lưu vào hồ sơ!"
        });
    } catch (error) {
        console.error("❌ Lỗi lập kế hoạch:", error);
        res.status(500).json({ error: "Lỗi hệ thống khi lập kế hoạch AI. Chi tiết: " + error.message });
    } finally {
        // Dọn dẹp tất cả file tạm
        filePaths.forEach(fp => {
            if (fs.existsSync(fp)) {
                fs.unlinkSync(fp);
            }
        });
        if (filePaths.length > 0) console.log("🧹 Đã dọn dẹp các file tạm.");
    }
};
// ==============================================================================
// 4. MỚI: API THẨM ĐỊNH VIDEO (CRAWLKIT + AI SCANNER) - BẢN KHỚP DATA 100%
// ==============================================================================
exports.analyzeVideo = async (req, res) => {
    const { url } = req.body;
    const userId = req.user ? req.user.id : 1;
    const apiKey = process.env.CRAWLKIT_API_KEY ? process.env.CRAWLKIT_API_KEY.trim() : null;

    if (!apiKey) return res.status(500).json({ error: "Thiếu CRAWLKIT_API_KEY trong .env" });
    if (!url) return res.status(400).json({ error: "Vui lòng dán link video!" });

    const cleanedUrl = cleanVideoUrl(url);

    try {
        // --- 1. KIỂM TRA CACHE ---
        const checkRequest = pool.request();
        checkRequest.input('Url', sql.NVarChar(500), cleanedUrl);
        const cache = await checkRequest.query("SELECT * FROM VideoHistory WHERE VideoUrl = @Url");

        if (cache.recordset.length > 0) {
            console.log("🚀 Lấy dữ liệu từ Cache SQL Server.");
            return res.json({ success: true, data: cache.recordset[0], source: 'database' });
        }

        // --- 2. GỌI API CRAWLKIT ---
        console.log("📡 Đang bóc tách video qua api.crawlkit.org...");
        const crawlResponse = await axios.post('https://api.crawlkit.org/v1/scrape',
            { url: cleanedUrl },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const rawData = crawlResponse.data.data;
        const transcript = rawData.transcript || rawData.content;
        const videoTitle = rawData.title || "Video Pháp luật";

        if (!transcript) throw new Error("Không lấy được nội dung video.");

        // --- 3. GEMINI: CHIẾN THUẬT 'LEGAL AUDITOR' ---
        console.log("🕵️‍♂️ Đang thực hiện kiểm toán pháp lý chuyên sâu...");
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

        const aiResult = await model.generateContent(prompt);
        const responseText = aiResult.response.text();
        const cleanedJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const aiData = JSON.parse(cleanedJson);

        // --- 4. LƯU DATABASE (SỬA ĐỂ KHỚP VỚI AI DATA MỚI) ---
        const saveRequest = pool.request();
        saveRequest.input('UserId', sql.Int, userId);
        saveRequest.input('Url', sql.NVarChar(500), cleanedUrl);
        saveRequest.input('Title', sql.NVarChar(500), videoTitle);
        saveRequest.input('Transcript', sql.NVarChar(sql.MAX), transcript);

        // 🟢 SỬA TẠI ĐÂY: Đọc đúng Key từ JSON của Gemini
        saveRequest.input('Summary', sql.NVarChar(sql.MAX), aiData.analysis_report);
        saveRequest.input('LegalBases', sql.NVarChar(sql.MAX), JSON.stringify(aiData.legal_map));
        saveRequest.input('TrustScore', sql.Int, aiData.audit_metrics?.trust_score || 0);
        saveRequest.input('AnalysisJson', sql.NVarChar(sql.MAX), JSON.stringify(aiData));

        // Lưu vào cả 2 bảng (Duy để nguyên tên model 'gemini-flash-lite-latest' là chuẩn rồi)
        await saveRequest.query(`
            INSERT INTO VideoHistory (UserId, VideoUrl, Title, Transcript, Summary, LegalBases, TrustScore, AIModel, CreatedAt)
            VALUES (@UserId, @Url, @Title, @Transcript, @Summary, @LegalBases, @TrustScore, 'gemini-flash-lite-latest', GETDATE())
        `);

        await saveRequest.query(`
            INSERT INTO ContractHistory (UserId, RecordType, Title, Folder, AnalysisText, AnalysisJson, RiskScore, AIModel, CreatedAt, IsFinal)
            VALUES (@UserId, 'VIDEO_ANALYSIS', @Title, N'Phân tích Video', @Summary, @AnalysisJson, @TrustScore, 'gemini-flash-lite-latest', GETDATE(), 1)
        `);

        console.log("✅ HOÀN TẤT: Dữ liệu đã nằm trong SQL Server!");
        res.json({ success: true, data: { transcript, ...aiData, Title: videoTitle } });

    } catch (error) {
        console.error("❌ Lỗi Video Analysis:", error.response?.data || error.message);
        res.status(500).json({
            error: "Lỗi hệ thống: " + (error.response?.data?.message || error.message)
        });
    }
};