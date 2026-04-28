const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const extractPdfText = async (dataBuffer) => {
    const renderPage = async (pageData) => {
        const textContent = await pageData.getTextContent({
            normalizeWhitespace: false,
            disableCombineTextItems: false
        });

        const items = (textContent.items || [])
            .filter((it) => it && typeof it.str === 'string' && it.str.trim().length > 0)
            .map((it) => ({
                str: it.str,
                x: Array.isArray(it.transform) ? Number(it.transform[4] || 0) : 0,
                y: Array.isArray(it.transform) ? Number(it.transform[5] || 0) : 0,
                w: Number(it.width || 0)
            }))
            .sort((a, b) => (b.y - a.y) || (a.x - b.x));

        const lines = [];
        let lineParts = [];
        let lastY = null;
        let lastX = null;
        let lastW = 0;
        const yThreshold = 2.0;

        const flushLine = () => {
            if (!lineParts.length) return;
            const line = lineParts.join('')
                .replace(/[ \t]+/g, ' ')
                .replace(/\u00a0/g, ' ')
                .trimEnd();
            if (line) lines.push(line);
            lineParts = [];
            lastX = null;
            lastW = 0;
        };

        for (const it of items) {
            if (lastY === null) {
                lastY = it.y;
            }

            const sameLine = Math.abs(it.y - lastY) <= yThreshold;
            if (!sameLine) {
                flushLine();
                lastY = it.y;
            }

            if (lineParts.length > 0 && lastX !== null) {
                const gap = it.x - (lastX + lastW);
                if (gap > 1.5) lineParts.push(' ');
            }
            lineParts.push(it.str);
            lastX = it.x;
            lastW = it.w;
        }

        flushLine();
        return lines.join('\n') + '\n';
    };

    const normalizeText = (raw) => String(raw || '')
        .normalize('NFC')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u0000/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    try {
        const data = await pdf(dataBuffer, { pagerender: renderPage });
        const next = normalizeText(data?.text || '');
        if (next && next.length >= 10) return next;
    } catch {
    }

    const fallback = await pdf(dataBuffer);
    return normalizeText(fallback?.text || '');
};

const ensureGeminiKeyLoaded = () => {
    if (process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim()) return;
    try {
        const envPath = path.join(__dirname, '../../.env');
        if (!fs.existsSync(envPath)) return;
        const text = fs.readFileSync(envPath, 'utf-8');
        const m = text.match(/^\s*GEMINI_API_KEY\s*=\s*(.*)\s*$/m);
        if (!m) return;
        const raw = String(m[1] || '').trim();
        const val = raw.replace(/^['"]|['"]$/g, '').trim();
        if (!val) return;
        process.env.GEMINI_API_KEY = val;
    } catch {
    }
};

const pickLibreOfficePath = () => {
    const candidates = [
        process.env.LEGAI_LIBREOFFICE_PATH,
        'C:\\\\Program Files\\\\LibreOffice\\\\program\\\\soffice.exe',
        'C:\\\\Program Files\\\\LibreOffice\\\\program\\\\soffice.com',
        'C:\\\\Program Files (x86)\\\\LibreOffice\\\\program\\\\soffice.exe',
        'C:\\\\Program Files (x86)\\\\LibreOffice\\\\program\\\\soffice.com',
        '/usr/bin/soffice',
        '/usr/local/bin/soffice'
    ].filter(Boolean);

    for (const exePath of candidates) {
        try {
            if (fs.existsSync(exePath)) return exePath;
        } catch {
        }
    }
    return null;
};

const convertDocFileToDocxPath = async (docPath, sofficePath) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legai-doc-'));
    const userProfileDir = path.join(tmpDir, 'lo-profile');
    const inputPath = path.join(tmpDir, 'input.doc');
    const outputPath = path.join(tmpDir, 'input.docx');

    try {
        fs.mkdirSync(userProfileDir, { recursive: true });
        fs.copyFileSync(docPath, inputPath);
        const userInstallation = pathToFileURL(`${userProfileDir}${path.sep}`).toString();
        await new Promise((resolve, reject) => {
            const p = spawn(sofficePath, [
                '--headless',
                '--nologo',
                '--nofirststartwizard',
                '--invisible',
                `-env:UserInstallation=${userInstallation}`,
                '--convert-to',
                'docx',
                '--outdir',
                tmpDir,
                inputPath
            ], {
                windowsHide: true
            });
            let stderr = '';
            p.stderr.on('data', (d) => {
                stderr += String(d);
            });
            p.on('error', reject);
            p.on('exit', (code) => {
                if (code === 0) return resolve();
                reject(new Error(stderr || `LibreOffice convert failed (${code})`));
            });
        });
        if (!fs.existsSync(outputPath)) throw new Error('Chuyển đổi DOC -> DOCX thất bại.');
        return { docxPath: outputPath, tmpDir };
    } catch (e) {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
        }
        throw e;
    }
};

let localOcrPromise = null;
const getLocalOcr = async () => {
    if (localOcrPromise) return localOcrPromise;
    localOcrPromise = (async () => {
        const { pipeline, RawImage, env } = await import('@xenova/transformers');
        if (env) {
            env.allowRemoteModels = true;
        }
        const ocr = await pipeline('image-to-text', 'Xenova/trocr-base-printed');
        return { ocr, RawImage };
    })();
    return localOcrPromise;
};

const tryLocalOcrFromPath = async (imagePath) => {
    try {
        const { ocr, RawImage } = await getLocalOcr();
        const image = await RawImage.read(imagePath);
        const output = await ocr(image);
        const text = Array.isArray(output) && output[0] && typeof output[0].generated_text === 'string'
            ? output[0].generated_text
            : '';
        return text;
    } catch (err) {
        console.error('Local OCR error:', err?.message || err);
        return '';
    }
};

const createLocalFallback = (contractText) => {
    const normalized = (contractText || '').toLowerCase();
    const risks = [];

    if (normalized.includes('phạt')) {
        risks.push({
            clause: 'Điều khoản phạt vi phạm',
            issue: 'Cần kiểm tra mức phạt có vượt giới hạn pháp luật hoặc gây bất lợi quá mức cho một bên hay không.',
            severity: 'Medium'
        });
    }

    if (normalized.includes('đơn phương chấm dứt')) {
        risks.push({
            clause: 'Điều khoản đơn phương chấm dứt',
            issue: 'Cần rà soát điều kiện chấm dứt, nghĩa vụ báo trước và bồi thường để tránh tranh chấp.',
            severity: 'High'
        });
    }

    if (normalized.includes('đặt cọc') || normalized.includes('thanh toán')) {
        risks.push({
            clause: 'Điều khoản đặt cọc/thanh toán',
            issue: 'Nên làm rõ thời hạn, phương thức thanh toán và điều kiện hoàn trả để hạn chế rủi ro.',
            severity: 'Medium'
        });
    }

    return {
        summary: 'Hệ thống đang dùng chế độ phân tích tạm thời do chưa kết nối được dịch vụ AI hoặc khóa Gemini. Kết quả này chỉ mang tính tham khảo để bạn tiếp tục thao tác giao diện.',
        risk_score: risks.length === 0 ? 82 : Math.max(45, 82 - risks.length * 12),
        risks: risks.length > 0 ? risks : [
            {
                clause: 'Tổng quan hợp đồng',
                issue: 'Chưa phát hiện điều khoản rủi ro nổi bật bằng bộ phân tích tạm thời. Nên kiểm tra thêm điều khoản thanh toán, chấm dứt, phạt vi phạm và bồi thường.',
                severity: 'Low'
            }
        ],
        recommendation: 'Khi cấu hình xong Gemini và cơ sở dữ liệu, bạn nên chạy phân tích lại để có kết quả pháp lý chi tiết hơn.'
    };
};

const createImageFallback = () => {
    return {
        summary: 'Không thể trích xuất nội dung hợp đồng từ ảnh. Gemini chưa được cấu hình và OCR cục bộ không sẵn sàng trên máy chủ hiện tại.',
        risk_score: 50,
        risks: [
            {
                clause: 'Tài liệu dạng ảnh',
                issue: 'Vui lòng cấu hình GEMINI_API_KEY để OCR + phân tích chính xác; hoặc cài đặt môi trường để OCR cục bộ (Transformers.js) có thể tải model.',
                severity: 'Medium'
            }
        ],
        recommendation: 'Nếu cần kết quả ngay, hãy tải lên file PDF/DOCX/TXT; hoặc cấu hình Gemini để hỗ trợ OCR ảnh.'
    };
};

const getModel = () => {
    ensureGeminiKeyLoaded();
    if (!process.env.GEMINI_API_KEY) return null;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
};

exports.analyzeContract = async (req, res) => {
    let filePath = null;
    let uploadedPaths = [];
    let contractText = "";
    let isImage = false;
    let isMultiImage = false;

    try {
        const singleFile = req.file || (req.files?.file && req.files.file[0]) || null;
        const multiFiles = Array.isArray(req.files?.files) ? req.files.files : [];

        // 1. Kiểm tra xem có file gửi lên không
        if (!singleFile && multiFiles.length === 0) {
            return res.status(400).json({ error: "Vui lòng upload file hợp đồng!" });
        }

        if (multiFiles.length > 0) {
            isMultiImage = true;
            const allImage = multiFiles.every((f) => Boolean(f?.mimetype) && f.mimetype.startsWith('image/'));
            if (!allImage) {
                return res.status(400).json({ error: "Khi upload nhiều file, chỉ hỗ trợ nhiều ảnh (png/jpg/jpeg/webp)." });
            }
            isImage = true;
            uploadedPaths = multiFiles.map((f) => f.path).filter(Boolean);
        } else {
            filePath = singleFile.path;
            uploadedPaths = filePath ? [filePath] : [];
            const mimeType = singleFile.mimetype;
            isImage = Boolean(mimeType && mimeType.startsWith('image/'));
        }

        // 2. Phân loại và Đọc file
        if (isMultiImage) {
            console.log(`🕵️‍♂️ Đang đọc ${multiFiles.length} ảnh: ${multiFiles.map((f) => f.originalname).join(', ')}`);
        } else {
            console.log(`🕵️‍♂️ Đang đọc file: ${singleFile.originalname} (${singleFile.mimetype})`);
        }

        if (!isMultiImage) {
            const mimeType = singleFile.mimetype;
            const ext = path.extname(singleFile.originalname || filePath || '').toLowerCase();
            const isPdf = mimeType === 'application/pdf' || ext === '.pdf';
            const isDoc = mimeType === 'application/msword' || ext === '.doc';
            const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx';
            const isTxt = mimeType === 'text/plain' || ext === '.txt';

            if (isPdf) {
                const dataBuffer = fs.readFileSync(filePath);
                contractText = await extractPdfText(dataBuffer);
            } else if (isDoc) {
                const sofficePath = pickLibreOfficePath();
                if (!sofficePath) {
                    return res.status(409).json({ error: "Không tìm thấy LibreOffice (soffice). Cài LibreOffice hoặc chuyển file .doc sang .docx/.pdf trước khi upload." });
                }
                let tmp = null;
                try {
                    tmp = await convertDocFileToDocxPath(filePath, sofficePath);
                    const result = await mammoth.extractRawText({ path: tmp.docxPath });
                    contractText = String(result.value || '')
                        .normalize('NFC')
                        .replace(/\r\n/g, '\n')
                        .replace(/\r/g, '\n')
                        .replace(/\u0000/g, '')
                        .trim();
                } finally {
                    if (tmp?.tmpDir) {
                        try {
                            fs.rmSync(tmp.tmpDir, { recursive: true, force: true });
                        } catch {
                        }
                    }
                }
            } else if (isDocx) {
                const result = await mammoth.extractRawText({ path: filePath });
                contractText = String(result.value || '')
                    .normalize('NFC')
                    .replace(/\r\n/g, '\n')
                    .replace(/\r/g, '\n')
                    .replace(/\u0000/g, '')
                    .trim();
            } else if (isImage) {
                contractText = "";
            } else if (isTxt) {
                contractText = String(fs.readFileSync(filePath, 'utf-8') || '')
                    .normalize('NFC')
                    .replace(/\r\n/g, '\n')
                    .replace(/\r/g, '\n')
                    .replace(/\u0000/g, '')
                    .trim();
            } else {
                return res.status(400).json({ error: "Định dạng file không được hỗ trợ. Vui lòng upload PDF, DOC, DOCX, TXT hoặc ảnh." });
            }
        }

        if (!isImage && (!contractText || contractText.trim().length < 10)) {
            return res.status(400).json({ error: "Không đọc được nội dung file hoặc file quá ngắn." });
        }

        console.log("🤖 Đang gửi nội dung cho Gemini phân tích...");
        const model = getModel();
        let analysisResult = null;

        if (isMultiImage) {
            if (model) {
                const multiImagePrompt = `
                Bạn là một Luật sư AI chuyên nghiệp (LegAI). Hãy đọc nội dung hợp đồng trong NHIỀU ẢNH đính kèm theo đúng thứ tự (OCR) và phân tích hợp đồng đó theo luật Việt Nam.
                Trả về kết quả dưới dạng JSON (chỉ JSON, không có markdown). Ngoài các trường phân tích, hãy trả thêm trường "contract_text" là toàn bộ nội dung OCR được (chuỗi) theo đúng thứ tự trang.

                Yêu cầu output JSON format:
                {
                    "contract_text": "Toàn bộ văn bản OCR được từ các ảnh theo thứ tự",
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

                const parts = [multiImagePrompt, ...multiFiles.map((f) => {
                    const dataBuffer = fs.readFileSync(f.path);
                    return {
                        inlineData: {
                            data: dataBuffer.toString('base64'),
                            mimeType: f.mimetype
                        }
                    };
                })];

                const result = await model.generateContent(parts);
                const responseText = result.response.text();
                analysisResult = JSON.parse(responseText);
                contractText = typeof analysisResult?.contract_text === 'string' ? analysisResult.contract_text : "";
            } else {
                const texts = [];
                for (const f of multiFiles) {
                    const t = await tryLocalOcrFromPath(f.path);
                    if (t && t.trim()) texts.push(t.trim());
                }
                contractText = texts.join('\n\n');
                analysisResult = contractText.trim().length >= 10 ? createLocalFallback(contractText) : createImageFallback();
            }
        } else if (isImage) {
            if (model) {
                const mimeType = singleFile.mimetype;
                const imagePrompt = `
                Bạn là một Luật sư AI chuyên nghiệp (LegAI). Hãy đọc nội dung hợp đồng trong ảnh đính kèm (OCR) và phân tích hợp đồng đó theo luật Việt Nam.
                Trả về kết quả dưới dạng JSON (chỉ JSON, không có markdown). Ngoài các trường phân tích, hãy trả thêm trường "contract_text" là toàn bộ nội dung OCR được (chuỗi).

                Yêu cầu output JSON format:
                {
                    "contract_text": "Toàn bộ văn bản OCR được từ ảnh",
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

                const dataBuffer = fs.readFileSync(filePath);
                const imagePart = {
                    inlineData: {
                        data: dataBuffer.toString('base64'),
                        mimeType
                    }
                };
                const result = await model.generateContent([imagePrompt, imagePart]);
                const responseText = result.response.text();
                analysisResult = JSON.parse(responseText);
                contractText = typeof analysisResult?.contract_text === 'string' ? analysisResult.contract_text : "";
            } else {
                contractText = await tryLocalOcrFromPath(filePath);
                analysisResult = contractText && contractText.trim().length >= 10 ? createLocalFallback(contractText) : createImageFallback();
            }
        } else {
            const prompt = `
            Bạn là một Luật sư AI chuyên nghiệp (LegAI). Hãy phân tích hợp đồng dưới đây và trả về kết quả dưới dạng JSON (chỉ JSON, không có markdown).
            
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

            if (model) {
                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                analysisResult = JSON.parse(responseText);
            } else {
                analysisResult = createLocalFallback(contractText);
            }
        }

        console.log("✅ Phân tích xong!");
        res.json({ ...analysisResult, contract_text: contractText });

    } catch (error) {
        console.error("❌ Lỗi phân tích:", error);
        const fallbackResult = isImage ? createImageFallback() : createLocalFallback(contractText);
        res.json({ ...fallbackResult, contract_text: contractText });
    } finally {
        // Luôn dọn rác ổ cứng dù thành công hay thất bại
        uploadedPaths.forEach((p) => {
            if (p && fs.existsSync(p)) {
                try {
                    fs.unlinkSync(p);
                } catch {
                }
            }
        });
        if (uploadedPaths.length > 0) {
            console.log("🧹 Đã dọn dẹp file tạm.");
        }
    }
};
