const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const geminiService = require('../services/geminiService');

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

const MAX_CONTRACT_CHARS = 30000;

const createOutOfScopeResult = () => ({
    summary: 'Theo phạm vi và giới hạn của đề tài, hệ thống hiện CHỦ YẾU phân tích HỢP ĐỒNG LAO ĐỘNG tại Việt Nam. Tài liệu bạn tải lên có thể không phải hợp đồng lao động nên hệ thống không đánh giá rủi ro chi tiết.',
    risk_score: 0,
    risks: [
        {
            clause: '3.2 Giới hạn của đề tài',
            issue: 'Phiên bản prototype chưa mở rộng sang tất cả các loại văn bản/hợp đồng khác.',
            severity: 'Low'
        }
    ],
    recommendation: 'Vui lòng tải lên hợp đồng lao động (có các cụm như “Hợp đồng lao động”, “Người lao động”, “Người sử dụng lao động”) để hệ thống phân tích và đưa ra điểm rủi ro/khuyến nghị.'
});

const createLocalFallback = (contractText) => {
    const raw = String(contractText || '').slice(0, MAX_CONTRACT_CHARS);
    const normalized = raw.toLowerCase();
    const risks = [];

    const has = (s) => normalized.includes(s);

    if (has('giữ') && (has('bằng') || has('cmnd') || has('cccd') || has('hộ chiếu'))) {
        risks.push({
            clause: 'Giữ giấy tờ gốc',
            issue: 'Cần kiểm tra điều khoản về việc giữ giấy tờ gốc của người lao động (dễ phát sinh tranh chấp/quy định hạn chế).',
            severity: 'High'
        });
    }

    if (has('lương tối thiểu') || has('mức lương') || has('tiền lương')) {
        risks.push({
            clause: 'Tiền lương',
            issue: 'Cần đối chiếu mức lương, phụ cấp và hình thức trả lương với quy định hiện hành (đặc biệt mức lương tối thiểu vùng nếu áp dụng).',
            severity: 'Medium'
        });
    }

    if (has('thử việc')) {
        risks.push({
            clause: 'Thử việc',
            issue: 'Cần rà soát thời gian thử việc, mức lương thử việc và điều kiện chấm dứt thử việc theo quy định.',
            severity: 'Medium'
        });
    }

    if (has('làm thêm') || has('tăng ca') || has('overtime')) {
        risks.push({
            clause: 'Làm thêm giờ',
            issue: 'Cần kiểm tra giới hạn làm thêm, cách tính tiền làm thêm giờ, và điều kiện thỏa thuận làm thêm.',
            severity: 'Medium'
        });
    }

    if (has('bảo hiểm') || has('bhxh') || has('bhyt') || has('bhtn')) {
        risks.push({
            clause: 'Bảo hiểm',
            issue: 'Cần kiểm tra nghĩa vụ tham gia BHXH/BHYT/BHTN, mức đóng và căn cứ đóng theo quy định.',
            severity: 'Medium'
        });
    }

    if (has('đơn phương chấm dứt') || has('chấm dứt hợp đồng') || has('sa thải') || has('kỷ luật')) {
        risks.push({
            clause: 'Chấm dứt/Kỷ luật',
            issue: 'Cần rà soát căn cứ chấm dứt, báo trước, xử lý kỷ luật lao động để tránh điều khoản bất lợi hoặc trái quy định.',
            severity: 'High'
        });
    }

    if (has('phạt') || has('bồi thường') || has('đền bù')) {
        risks.push({
            clause: 'Phạt/Bồi thường',
            issue: 'Cần kiểm tra điều khoản phạt, bồi thường có hợp lý và phù hợp quy định pháp luật lao động hay không.',
            severity: 'Medium'
        });
    }

    const base = 78;
    const riskScore = Math.max(35, base - risks.length * 9);

    return {
        summary: 'Hệ thống đang chạy ở chế độ prototype và phân tích tạm thời (không dùng LLM). Kết quả dựa trên rà soát từ khóa thường gặp trong hợp đồng lao động và chỉ mang tính tham khảo.',
        risk_score: risks.length === 0 ? Math.min(90, base + 7) : riskScore,
        risks: risks.length > 0 ? risks : [
            {
                clause: 'Tổng quan hợp đồng lao động',
                issue: 'Chưa phát hiện từ khóa rủi ro nổi bật bằng bộ kiểm tra tạm thời. Nên kiểm tra thêm: lương, bảo hiểm, thử việc, làm thêm giờ, chấm dứt, phạt/bồi thường.',
                severity: 'Low'
            }
        ],
        recommendation: 'Nếu cần kết quả chi tiết (trích điều khoản + viện dẫn điều luật), cần cấu hình dịch vụ LLM (API bên thứ ba) và phân tích lại.'
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

const CLASSIFIER_MODEL_PATH = path.join(__dirname, '../data/contract_classifier_model.json');

const tokenizeForClassifier = (text) => String(text || '')
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length >= 2 && t.length <= 32);

const looksLikeRtf = (bufferOrText) => {
    try {
        if (Buffer.isBuffer(bufferOrText)) {
            const head = bufferOrText.slice(0, 16).toString('utf8');
            return head.startsWith('{\\rtf');
        }
        const head = String(bufferOrText || '').slice(0, 16);
        return head.startsWith('{\\rtf');
    } catch {
        return false;
    }
};

const decodeRtfUnicodeEscapes = (text) => String(text || '')
    .replace(/\\u(-?\d+)\??/g, (_, n) => {
        const code = Number(n);
        if (!Number.isFinite(code)) return '';
        const fixed = code < 0 ? (code + 65536) : code;
        try {
            return String.fromCharCode(fixed);
        } catch {
            return '';
        }
    });

const decodeRtfHexEscapes = (text) => String(text || '')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hh) => {
        try {
            return Buffer.from([parseInt(hh, 16)]).toString('latin1');
        } catch {
            return '';
        }
    });

const extractTextFromRtf = (rtfText) => {
    let t = String(rtfText || '');
    t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    t = t.replace(/\{\\\*[^}]*\}/g, ' ');
    t = decodeRtfHexEscapes(t);
    t = decodeRtfUnicodeEscapes(t);
    t = t.replace(/\\par[d]?/g, '\n');
    t = t.replace(/\\tab/g, '\t');
    t = t.replace(/\\line/g, '\n');
    t = t.replace(/\\[a-zA-Z]+-?\d* ?/g, ' ');
    t = t.replace(/[{}]/g, ' ');
    t = t.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
    t = t.replace(/\n{3,}/g, '\n\n');
    t = t.replace(/[ \t]{2,}/g, ' ');
    return t.trim();
};

const htmlToText = (html) => {
    let t = String(html || '');
    t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    t = t.replace(/<!--[\s\S]*?-->/g, ' ');
    t = t.replace(/<\/(p|div|br|tr|li|h\d)>/gi, '\n');
    t = t.replace(/<[^>]+>/g, ' ');
    t = t.replace(/&nbsp;/gi, ' ');
    t = t.replace(/&amp;/gi, '&');
    t = t.replace(/&lt;/gi, '<');
    t = t.replace(/&gt;/gi, '>');
    t = t.replace(/&#39;/gi, "'");
    t = t.replace(/&quot;/gi, '"');
    t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    t = t.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
    t = t.replace(/\n{3,}/g, '\n\n');
    t = t.replace(/[ \t]{2,}/g, ' ');
    return t.trim();
};

const downloadTextFromUrl = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'LegAI-DevTrainer/1.0 (educational; contact: local)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.1'
            },
            signal: controller.signal
        });
        const ct = String(res.headers.get('content-type') || '').toLowerCase();
        const buf = Buffer.from(await res.arrayBuffer());
        if (ct.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
            const r = await pdf(buf);
            return String(r?.text || '').trim();
        }
        const raw = buf.toString('utf8');
        if (ct.includes('text/html') || /<\/html>/i.test(raw)) return htmlToText(raw);
        return raw.trim();
    } finally {
        clearTimeout(timer);
    }
};

const loadClassifierModel = () => {
    try {
        if (!fs.existsSync(CLASSIFIER_MODEL_PATH)) return null;
        const raw = fs.readFileSync(CLASSIFIER_MODEL_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (!Array.isArray(parsed.labels) || !parsed.labels.length) return null;
        return parsed;
    } catch {
        return null;
    }
};

const saveClassifierModel = (model) => {
    fs.mkdirSync(path.dirname(CLASSIFIER_MODEL_PATH), { recursive: true });
    fs.writeFileSync(CLASSIFIER_MODEL_PATH, JSON.stringify(model, null, 2), 'utf-8');
};

const trainNaiveBayesModel = (samples, alpha = 1) => {
    const safeSamples = Array.isArray(samples) ? samples : [];
    const normalized = safeSamples
        .map((s) => ({
            label: String(s?.label ?? '').trim(),
            text: String(s?.text ?? '').trim()
        }))
        .filter((s) => s.label && s.text && s.text.length >= 5);

    if (!normalized.length) {
        throw new Error('Training samples rỗng hoặc sai định dạng. Cần [{ "label": "...", "text": "..." }]');
    }

    const labels = Array.from(new Set(normalized.map((s) => s.label)));
    if (labels.length < 2) {
        throw new Error('Cần ít nhất 2 nhãn (label) khác nhau để train.');
    }

    const docCountByLabel = {};
    const totalTokensByLabel = {};
    const tokenCountByLabel = {};
    const vocab = new Set();

    for (const label of labels) {
        docCountByLabel[label] = 0;
        totalTokensByLabel[label] = 0;
        tokenCountByLabel[label] = {};
    }

    for (const sample of normalized) {
        const label = sample.label;
        docCountByLabel[label] += 1;
        const tokens = tokenizeForClassifier(sample.text);
        for (const token of tokens) {
            vocab.add(token);
            tokenCountByLabel[label][token] = (tokenCountByLabel[label][token] || 0) + 1;
            totalTokensByLabel[label] += 1;
        }
    }

    const totalDocs = Object.values(docCountByLabel).reduce((a, b) => a + b, 0);
    const vocabSize = vocab.size || 1;

    return {
        version: 1,
        trainedAt: new Date().toISOString(),
        alpha,
        labels,
        totalDocs,
        vocabSize,
        docCountByLabel,
        totalTokensByLabel,
        tokenCountByLabel
    };
};

const getDefaultDevTrainingSamples = () => ([
    {
        label: 'rental',
        text: 'HỢP ĐỒNG THUÊ NHÀ/THUÊ NHÀ Ở. Bên cho thuê (bên A) và bên thuê (bên B). Tiền thuê, đặt cọc, thời hạn thuê, bàn giao nhà, phí điện nước, chấm dứt hợp đồng.'
    },
    {
        label: 'rental',
        text: 'Bên thuê thanh toán tiền thuê hàng tháng, đặt cọc một tháng tiền thuê. Quy định sử dụng nhà, sửa chữa, bồi thường thiệt hại, trả nhà khi hết hạn.'
    },
    {
        label: 'labor',
        text: 'HỢP ĐỒNG LAO ĐỘNG. Người sử dụng lao động và người lao động. Vị trí công việc, thời hạn, mức lương, phụ cấp, thời giờ làm việc, bảo hiểm xã hội, chấm dứt hợp đồng.'
    },
    {
        label: 'labor',
        text: 'Thử việc, thời hạn báo trước, kỷ luật lao động, nghỉ phép, overtime, quyền và nghĩa vụ của người lao động và người sử dụng lao động.'
    },
    {
        label: 'sale',
        text: 'HỢP ĐỒNG MUA BÁN. Bên bán và bên mua. Đối tượng mua bán, số lượng, chất lượng, giá bán, giao nhận hàng, thanh toán, bảo hành, phạt vi phạm.'
    },
    {
        label: 'sale',
        text: 'Điều khoản giao hàng, nghiệm thu, chuyển quyền sở hữu, hóa đơn chứng từ, giải quyết tranh chấp, phạt chậm thanh toán.'
    },
    {
        label: 'service',
        text: 'HỢP ĐỒNG DỊCH VỤ. Bên cung cấp dịch vụ và bên sử dụng dịch vụ. Phạm vi công việc, phí dịch vụ, thời hạn, nghiệm thu, trách nhiệm, bảo mật thông tin.'
    },
    {
        label: 'service',
        text: 'Cam kết chất lượng dịch vụ, SLA, điều khoản thanh toán phí dịch vụ, chấm dứt hợp đồng, bồi thường thiệt hại.'
    }
]);

const devTrainDefaultContractClassifierNow = () => {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new Error('Dev training disabled in production.');
    }
    const model = trainNaiveBayesModel(getDefaultDevTrainingSamples(), 1);
    saveClassifierModel(model);
    return model;
};

const classifyWithNaiveBayesModel = (model, text) => {
    const tokens = tokenizeForClassifier(text);
    if (!tokens.length) {
        return { label: 'unknown', confidence: 0.0, engine: 'local-nb' };
    }

    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

    const labels = Array.isArray(model?.labels) ? model.labels : [];
    const alpha = Number(model?.alpha ?? 1) || 1;
    const totalDocs = Number(model?.totalDocs ?? 0) || 0;
    const vocabSize = Number(model?.vocabSize ?? 0) || 1;
    const docCountByLabel = model?.docCountByLabel || {};
    const totalTokensByLabel = model?.totalTokensByLabel || {};
    const tokenCountByLabel = model?.tokenCountByLabel || {};

    if (!labels.length || totalDocs <= 0) {
        return { label: 'unknown', confidence: 0.0, engine: 'local-nb' };
    }

    const scores = {};
    for (const label of labels) {
        const docCount = Number(docCountByLabel[label] ?? 0) || 0;
        const prior = Math.log((docCount + 1e-9) / (totalDocs + 1e-9));
        const totalTokens = Number(totalTokensByLabel[label] ?? 0) || 0;
        const denom = totalTokens + alpha * vocabSize;
        let score = prior;

        const tokenCounts = tokenCountByLabel[label] || {};
        for (const [token, count] of Object.entries(tf)) {
            const c = Number(tokenCounts[token] ?? 0) || 0;
            score += Number(count) * Math.log((c + alpha) / denom);
        }
        scores[label] = score;
    }

    let bestLabel = labels[0];
    for (const label of labels) {
        if (scores[label] > scores[bestLabel]) bestLabel = label;
    }

    const maxScore = Math.max(...labels.map((l) => scores[l]));
    const expScores = labels.map((l) => Math.exp(scores[l] - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0) || 1;
    const bestExp = Math.exp(scores[bestLabel] - maxScore);
    const confidence = Math.max(0, Math.min(1, bestExp / sumExp));

    return { label: bestLabel, confidence, engine: 'local-nb' };
};

const heuristicClassifyContract = (text) => {
    const t = String(text || '').toLowerCase();
    const has = (s) => t.includes(s);

    if (has('hợp đồng thuê') || has('thuê nhà') || has('bên cho thuê') || has('bên thuê')) {
        return { label: 'rental', confidence: 0.55, engine: 'heuristic' };
    }
    if (has('hợp đồng lao động') || has('người lao động') || has('người sử dụng lao động')) {
        return { label: 'labor', confidence: 0.55, engine: 'heuristic' };
    }
    if (has('hợp đồng mua bán') || has('bên mua') || has('bên bán')) {
        return { label: 'sale', confidence: 0.52, engine: 'heuristic' };
    }
    if (has('hợp đồng dịch vụ') || has('bên cung cấp') || has('phí dịch vụ')) {
        return { label: 'service', confidence: 0.5, engine: 'heuristic' };
    }
    return { label: 'unknown', confidence: 0.3, engine: 'heuristic' };
};

const classifyContractText = (text) => {
    const model = loadClassifierModel();
    if (model) {
        const out = classifyWithNaiveBayesModel(model, text);
        return { ...out, model: { trainedAt: model.trainedAt, labels: model.labels } };
    }
    return heuristicClassifyContract(text);
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
                try {
                    const result = await mammoth.extractRawText({ path: filePath });
                    contractText = String(result.value || '')
                        .normalize('NFC')
                        .replace(/\r\n/g, '\n')
                        .replace(/\r/g, '\n')
                        .replace(/\u0000/g, '')
                        .trim();
                } catch {
                    const raw = fs.readFileSync(filePath);
                    if (looksLikeRtf(raw)) {
                        contractText = extractTextFromRtf(raw.toString('utf8'));
                    } else {
                        throw new Error('DOCX không hợp lệ hoặc bị hỏng.');
                    }
                }
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

        if (!isImage) {
            contractText = String(contractText || '').slice(0, MAX_CONTRACT_CHARS);
            const normalized = contractText.toLowerCase();
            const isLabor = normalized.includes('hợp đồng lao động')
                || (normalized.includes('người lao động') && normalized.includes('người sử dụng lao động'));
            if (!isLabor) {
                const out = createOutOfScopeResult();
                return res.json({ ...out, contract_text: contractText });
            }
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
            const prompt = geminiService?.PROMPT_LIBRARY?.buildLaborContractAnalysisPrompt
                ? geminiService.PROMPT_LIBRARY.buildLaborContractAnalysisPrompt(contractText)
                : String(contractText || '').slice(0, MAX_CONTRACT_CHARS);

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

exports.trainContractClassifier = async (req, res) => {
    try {
        const samples = req?.body?.samples;
        const alpha = req?.body?.alpha;
        const model = trainNaiveBayesModel(samples, alpha);
        saveClassifierModel(model);
        return res.json({
            success: true,
            model: { trainedAt: model.trainedAt, labels: model.labels, vocabSize: model.vocabSize, totalDocs: model.totalDocs }
        });
    } catch (error) {
        return res.status(400).json({ success: false, error: error?.message || String(error) });
    }
};

exports.devTrainContractClassifierDefault = async (req, res) => {
    try {
        const model = devTrainDefaultContractClassifierNow();
        return res.json({
            success: true,
            model: { trainedAt: model.trainedAt, labels: model.labels, vocabSize: model.vocabSize, totalDocs: model.totalDocs }
        });
    } catch (error) {
        return res.status(400).json({ success: false, error: error?.message || String(error) });
    }
};

exports.devTrainDefaultContractClassifierNow = devTrainDefaultContractClassifierNow;

exports.devTrainContractClassifierFromUrls = async (req, res) => {
    try {
        const rawItems = Array.isArray(req?.body?.items) ? req.body.items : null;
        const items = rawItems && rawItems.length ? rawItems : [
            { label: 'labor', url: 'https://www.sec.gov/Archives/edgar/data/1334978/000119312522274906/d367172dex101.htm' },
            { label: 'labor', url: 'https://www.sec.gov/Archives/edgar/data/867773/000119312521093489/d27814dex101.htm' },
            { label: 'rental', url: 'https://www.sec.gov/Archives/edgar/data/1488934/000110807812000321/exhibit10-01.htm' },
            { label: 'rental', url: 'https://www.sec.gov/Archives/edgar/data/1409012/000119312507224861/dex108.htm' },
            { label: 'service', url: 'https://www.sec.gov/Archives/edgar/data/1141197/000110313204000018/exhibit1014.htm' },
            { label: 'service', url: 'https://www.sec.gov/Archives/edgar/data/277375/000027737510000047/exhibit10g.htm' },
            { label: 'sale', url: 'https://www.sec.gov/Archives/edgar/data/1195933/000119593315000003/exhibit10-purchaseagreement.htm' },
            { label: 'sale', url: 'https://www.sec.gov/Archives/edgar/data/930245/000147237524000054/exhibit10-1.htm' }
        ];

        const maxChars = Math.max(5000, Number(req?.body?.maxChars ?? 200000) || 200000);
        const samples = [];
        const errors = [];

        for (const it of items) {
            const label = String(it?.label || '').trim();
            const url = String(it?.url || '').trim();
            if (!label || !url) continue;
            try {
                const text = await downloadTextFromUrl(url);
                const clipped = String(text || '').slice(0, maxChars);
                if (clipped.trim().length >= 50) {
                    samples.push({ label, text: clipped });
                } else {
                    errors.push({ label, url, error: 'empty_or_too_short' });
                }
            } catch (e) {
                errors.push({ label, url, error: e?.message || String(e) });
            }
        }

        const model = trainNaiveBayesModel(samples, 1);
        saveClassifierModel(model);

        return res.json({
            success: true,
            model: { trainedAt: model.trainedAt, labels: model.labels, vocabSize: model.vocabSize, totalDocs: model.totalDocs },
            used: samples.length,
            failed: errors.length,
            errors
        });
    } catch (error) {
        return res.status(400).json({ success: false, error: error?.message || String(error) });
    }
};

exports.devSelfTestContractClassifier = async (req, res) => {
    try {
        const model = loadClassifierModel();
        if (!model) return res.status(409).json({ success: false, error: 'Chưa có model. Hãy train trước.' });
        const labels = model.labels;
        const items = [
            { expect: 'labor', url: 'https://www.sec.gov/Archives/edgar/data/1334978/000119312522274906/d367172dex101.htm' },
            { expect: 'rental', url: 'https://www.sec.gov/Archives/edgar/data/1488934/000110807812000321/exhibit10-01.htm' },
            { expect: 'service', url: 'https://www.sec.gov/Archives/edgar/data/1141197/000110313204000018/exhibit1014.htm' },
            { expect: 'sale', url: 'https://www.sec.gov/Archives/edgar/data/1195933/000119593315000003/exhibit10-purchaseagreement.htm' }
        ];

        let correct = 0;
        const results = [];
        for (const it of items) {
            const text = await downloadTextFromUrl(it.url);
            const out = classifyWithNaiveBayesModel(model, String(text || '').slice(0, 200000));
            const ok = out.label === it.expect;
            if (ok) correct += 1;
            results.push({ expect: it.expect, got: out.label, confidence: out.confidence, url: it.url });
        }

        return res.json({
            success: true,
            labels,
            total: items.length,
            correct,
            accuracy: items.length ? correct / items.length : 0,
            results
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error?.message || String(error) });
    }
};

exports.classifyContract = async (req, res) => {
    let filePath = null;
    let uploadedPaths = [];
    let contractText = "";
    let isImage = false;
    let isMultiImage = false;

    try {
        const singleFile = req.file || (req.files?.file && req.files.file[0]) || null;
        const multiFiles = Array.isArray(req.files?.files) ? req.files.files : [];

        if (!singleFile && multiFiles.length === 0) {
            return res.status(400).json({ success: false, error: "Vui lòng upload file hợp đồng!" });
        }

        if (multiFiles.length > 0) {
            isMultiImage = true;
            const allImage = multiFiles.every((f) => Boolean(f?.mimetype) && f.mimetype.startsWith('image/'));
            if (!allImage) {
                return res.status(400).json({ success: false, error: "Khi upload nhiều file, chỉ hỗ trợ nhiều ảnh (png/jpg/jpeg/webp)." });
            }
            isImage = true;
            uploadedPaths = multiFiles.map((f) => f.path).filter(Boolean);
        } else {
            filePath = singleFile.path;
            uploadedPaths = filePath ? [filePath] : [];
            const mimeType = singleFile.mimetype;
            isImage = Boolean(mimeType && mimeType.startsWith('image/'));
        }

        if (isMultiImage) {
            const texts = [];
            for (const f of multiFiles) {
                const t = await tryLocalOcrFromPath(f.path);
                if (t && t.trim()) texts.push(t.trim());
            }
            contractText = texts.join('\n\n');
        } else if (isImage) {
            contractText = await tryLocalOcrFromPath(filePath);
        } else {
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
                    return res.status(409).json({ success: false, error: "Không tìm thấy LibreOffice (soffice). Cài LibreOffice hoặc chuyển file .doc sang .docx/.pdf trước khi upload." });
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
                try {
                    const result = await mammoth.extractRawText({ path: filePath });
                    contractText = String(result.value || '')
                        .normalize('NFC')
                        .replace(/\r\n/g, '\n')
                        .replace(/\r/g, '\n')
                        .replace(/\u0000/g, '')
                        .trim();
                } catch {
                    const raw = fs.readFileSync(filePath);
                    if (looksLikeRtf(raw)) {
                        contractText = extractTextFromRtf(raw.toString('utf8'));
                    } else {
                        throw new Error('DOCX không hợp lệ hoặc bị hỏng.');
                    }
                }
            } else if (isTxt) {
                contractText = String(fs.readFileSync(filePath, 'utf-8') || '')
                    .normalize('NFC')
                    .replace(/\r\n/g, '\n')
                    .replace(/\r/g, '\n')
                    .replace(/\u0000/g, '')
                    .trim();
            } else {
                return res.status(400).json({ success: false, error: "Định dạng file không được hỗ trợ. Vui lòng upload PDF, DOC, DOCX, TXT hoặc ảnh." });
            }
        }

        if (!contractText || contractText.trim().length < 10) {
            return res.status(400).json({ success: false, error: isImage ? "Không OCR được nội dung ảnh." : "Không đọc được nội dung file hoặc file quá ngắn." });
        }

        const out = classifyContractText(contractText);
        return res.json({
            success: true,
            label: out.label,
            confidence: out.confidence,
            engine: out.engine,
            model: out.model || null,
            textLength: contractText.length
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error?.message || String(error) });
    } finally {
        uploadedPaths.forEach((p) => {
            if (p && fs.existsSync(p)) {
                try {
                    fs.unlinkSync(p);
                } catch {
                }
            }
        });
    }
};
