//const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');

// Helper: Decode double-encoded UTF-8 filenames (fix garbled Vietnamese)
function decodeFilename(str) {
    if (!str) return str;
    try {
        // If string is double-encoded (UTF-8 → Latin1), fix it
        const fixed = Buffer.from(str, 'latin1').toString('utf8');
        // If the result still has garbage, try direct buffer conversion
        if (fixed.includes('�') || fixed.includes('Ã') || fixed.includes('Ä')) {
            return Buffer.from(str).toString('utf8');
        }
        return fixed;
    } catch (e) {
        return str;
    }
}


// Cấu hình Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Dùng bản 2.5-flash và bật chế độ ép trả về JSON 100%
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" }
});

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
        console.log(`🕵️‍♂️ Đang đọc file: ${decodeFilename(req.file.originalname)} (${mimeType})`);

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

        // Parse thẳng vì API đã đảm bảo format JSON
        const analysisResult = JSON.parse(responseText);

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
// API PHÂN TÍCH HÀNG LOẠT NHIỀU HỢP ĐỒNG
// ==============================================================================
exports.analyzeContractsBatch = async (req, res) => {
    try {
        const files = req.files || [];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: "Vui lòng upload ít nhất 1 file!" });
        }

        const results = [];

        for (const f of files) {
            let filePath = f.path;
            const mimeType = f.mimetype;
            let contractText = "";

            try {
                console.log(`🕵️‍♂️ Đang đọc file (batch): ${decodeFilename(f.originalname)} (${mimeType})`);

                if (mimeType === 'application/pdf') {
                    const dataBuffer = fs.readFileSync(filePath);
                    const data = await pdf(dataBuffer);
                    contractText = data.text;
                } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const r = await mammoth.extractRawText({ path: filePath });
                    contractText = r.value;
                } else {
                    contractText = fs.readFileSync(filePath, 'utf-8');
                }

                if (!contractText || contractText.trim().length < 10) {
                    results.push({ fileName: f.originalname, error: "Không đọc được nội dung file hoặc file quá ngắn." });
                    continue;
                }

                const prompt = `
            Bạn là một Luật sư AI chuyên nghiệp (LegAI). Hãy phân tích hợp đồng dưới đây và trả về kết quả dưới dạng JSON.
            (File name: ${f.originalname})
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

                let analysisResult = null;
                try {
                    analysisResult = JSON.parse(responseText);
                } catch (parseErr) {
                    analysisResult = { parseError: true, raw: responseText };
                }

                results.push({ fileName: decodeFilename(f.originalname), analysis: analysisResult });

            } catch (errFile) {
                console.error('❌ Lỗi xử lý file batch:', decodeFilename(f.originalname), errFile);
                results.push({ fileName: decodeFilename(f.originalname), error: errFile.message || 'Lỗi xử lý file.' });
            } finally {
                if (filePath && fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
                }
            }
        }

        // Tính toán báo cáo tổng hợp
        const total = results.length;
        const valid = results.filter(r => r.analysis && (typeof (r.analysis.risk_score ?? r.analysis.riskScore) === 'number'));
        const sum = valid.reduce((s, r) => s + ((r.analysis.risk_score ?? r.analysis.riskScore) || 0), 0);
        const average = total > 0 ? Math.round(sum / total) : 0;

        const aggregated = {
            average_risk_score: average,
            total_files: total,
            summary: `Phân tích ${total} file - điểm an toàn trung bình ${average}`
        };

        res.json({ aggregated, files: results });

    } catch (error) {
        console.error('❌ Lỗi batch analyze:', error);
        res.status(500).json({ error: 'Lỗi hệ thống khi phân tích batch: ' + (error.message || error) });
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
        const aiData = JSON.parse(responseText);

        console.log("📤 AI đã bóc tách xong, chuẩn bị gửi về Frontend!");
        res.json(aiData);

    } catch (error) {
        console.error("❌ Lỗi API Generate Form:", error);
        res.status(500).json({ error: "Lỗi hệ thống LegAI khi tạo Form" });
    }
};

// SO SÁNH HAI PHIÊN BẢN HỢP ĐỒNG
exports.compareContracts = async (req, res) => {
    let filePathA = null; // Khai báo biến để giữ đường dẫn file tạm thời A
    let filePathB = null; 

    try {
        // 1. Kiểm tra xem có đủ 2 file gửi lên không
        // req.files sẽ là một đối tượng khi dùng upload.fields
        if (!req.files || !req.files['fileA'] || !req.files['fileB'] || req.files['fileA'].length === 0 || req.files['fileB'].length === 0) {
            return res.status(400).json({ error: "Vui lòng upload cả hai file hợp đồng để so sánh!" });
        }

        const fileA = req.files['fileA'][0]; // Lấy đối tượng file A đầu tiên
        const fileB = req.files['fileB'][0]; 

        filePathA = fileA.path; // Lấy đường dẫn file tạm thời
        filePathB = fileB.path; 

        let contractTextA = "";
        let contractTextB = "";

        // Helper function để đọc nội dung file từ đường dẫn và mimeType
        const readContractFile = async (path, mimeType) => {
            if (mimeType === 'application/pdf') {
                const dataBuffer = fs.readFileSync(path);
                const data = await pdf(dataBuffer);
                return data.text;
            } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
                const result = await mammoth.extractRawText({ path: path });
                return result.value;
            } else { // text/plain hoặc các loại khác mà fs.readFileSync có thể xử lý
                return fs.readFileSync(path, 'utf-8');
            }
        };

        // 2. Đọc nội dung của cả hai file
        console.log(`🕵️‍♂️ Đang đọc file A: ${decodeFilename(fileA.originalname)} (${fileA.mimetype})`);
        contractTextA = await readContractFile(filePathA, fileA.mimetype);

        console.log(`🕵️‍♂️ Đang đọc file B: ${decodeFilename(fileB.originalname)} (${fileB.mimetype})`);
        contractTextB = await readContractFile(filePathB, fileB.mimetype);

        // Kiểm tra nội dung file có đủ dài không
        if (!contractTextA || contractTextA.trim().length < 50 || !contractTextB || contractTextB.trim().length < 50) {
            return res.status(400).json({ error: "Không đọc được nội dung đầy đủ từ một hoặc cả hai file, hoặc file quá ngắn. Cần ít nhất 50 ký tự." });
        }

        // 3. Xây dựng Prompt cho Gemini
        console.log("🤖 Đang gửi nội dung hai hợp đồng cho Gemini so sánh...");

        const prompt = `
        Bạn là một Luật sư AI chuyên nghiệp, có nhiệm vụ so sánh hai phiên bản của một hợp đồng và chỉ ra các điểm khác biệt.
        Hãy chú ý đến các điều khoản, số liệu, thời gian, tên các bên, và bất kỳ thay đổi nào về ngôn ngữ hoặc cấu trúc.

        Phiên bản Hợp đồng CŨ (A - Tên file: ${decodeFilename(fileA.originalname)}):
        """
        ${contractTextA}
        """

        Phiên bản Hợp đồng MỚI (B - Tên file: ${decodeFilename(fileB.originalname)}):
        """
        ${contractTextB}
        """

        Hãy phân tích và trả về kết quả dưới dạng JSON.
        Các điểm khác biệt phải được chỉ rõ: THÊM MỚI, SỬA ĐỔI, hoặc BỊ XÓA.
        Đối với "SỬA ĐỔI", cần cung cấp cả nội dung cũ và mới.
        Cố gắng trích dẫn chính xác các đoạn văn bản liên quan để dễ dàng đối chiếu.

        Yêu cầu output JSON format:
        {
            "overall_summary": "Tóm tắt ngắn gọn các điểm khác biệt chính và ý nghĩa của chúng (2-4 câu).",
            "differences": [
                {
                    "type": "added" | "modified" | "removed", // Loại thay đổi
                    "section_identifier": "Điều, khoản hoặc đoạn văn bản bị ảnh hưởng (ví dụ: 'Điều 3 Khoản 2', 'Đoạn mở đầu', 'Phụ lục 1'). Nếu không xác định được chính xác, có thể bỏ trống hoặc mô tả chung.",
                    "old_text": "Đoạn văn bản từ phiên bản CŨ (chỉ nếu type là 'modified' hoặc 'removed'). Giới hạn 200-300 ký tự.",
                    "new_text": "Đoạn văn bản từ phiên bản MỚI (chỉ nếu type là 'modified' hoặc 'added'). Giới hạn 200-300 ký tự.",
                    "explanation": "Giải thích ngắn gọn (1-2 câu) về sự thay đổi này và tác động tiềm năng của nó theo pháp luật Việt Nam (nếu có thể)."
                }
            ],
            "recommendations": "Lời khuyên tổng quan của luật sư về các thay đổi được phát hiện (ví dụ: cần xem xét kỹ điều khoản nào, có rủi ro pháp lý tiềm ẩn không)."
        }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse thẳng vì API đã đảm bảo format JSON
        // Thêm một khối try-catch để bắt lỗi nếu Gemini trả về non-JSON bất ngờ
        let comparisonResult;
        try {
            comparisonResult = JSON.parse(responseText);
        } catch (parseError) {
            console.error("❌ Lỗi parse JSON từ Gemini:", parseError);
            console.error("Phản hồi gốc từ Gemini:", responseText);
            return res.status(500).json({ error: "Gemini trả về phản hồi không đúng định dạng JSON. Vui lòng thử lại.", rawResponse: responseText });
        }
        

        console.log("✅ So sánh hợp đồng xong!");
        res.json({
            ...comparisonResult, // Bao gồm overall_summary, differences, recommendations từ Gemini
            originalContractA: contractTextA, // Thêm nội dung gốc của file A
            originalContractB: contractTextB, // Thêm nội dung gốc của file B
            fileNameA: decodeFilename(fileA.originalname), // Thêm tên file A
            fileNameB: decodeFilename(fileB.originalname)  // Thêm tên file B
        });

    } catch (error) {
        console.error("❌ Lỗi hệ thống khi so sánh hợp đồng:", error);
        res.status(500).json({ error: "Lỗi hệ thống khi so sánh hợp đồng. Chi tiết: " + error.message });
    } finally {
        // Luôn dọn dẹp các file tạm đã upload dù thành công hay thất bại
        if (filePathA && fs.existsSync(filePathA)) {
            fs.unlinkSync(filePathA);
            console.log(`🧹 Đã dọn dẹp file tạm A: ${filePathA}`);
        }
        if (filePathB && fs.existsSync(filePathB)) {
            fs.unlinkSync(filePathB);
            console.log(`🧹 Đã dọn dẹp file tạm B: ${filePathB}`);
        }
    }
};