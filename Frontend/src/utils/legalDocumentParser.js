const DOCUMENT_TYPE_PATTERN = /^(BỘ\s+LUẬT|LUẬT|PHÁP\s+LỆNH|NGHỊ\s+ĐỊNH|NGHỊ\s+QUYẾT|QUYẾT\s+ĐỊNH|THÔNG\s+TƯ|CHỈ\s+THỊ|LỆNH)(?:\s*:)?$/i;
const CONTENT_START_PATTERN = /^(BỘ\s+LUẬT|LUẬT|PHÁP\s+LỆNH|NGHỊ\s+ĐỊNH|NGHỊ\s+QUYẾT|QUYẾT\s+ĐỊNH|THÔNG\s+TƯ|CHỈ\s+THỊ|LỆNH|CĂN CỨ|THEO ĐỀ NGHỊ|CHƯƠNG\s+|PHẦN\s+|ĐIỀU\s+1\b)/i;
const PREAMBLE_PATTERN = /^(Căn cứ|Theo đề nghị|Xét đề nghị|Quốc hội ban hành|Chính phủ ban hành|Ủy ban thường vụ Quốc hội ban hành|Bộ trưởng .* ban hành)/i;
const UPPERCASE_PATTERN = /^[A-ZÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÍÌỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰÝỲỶỸỴĐ\d\s,./()–—-]+$/;

export const normalizeComparableText = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

const cleanSourceLine = (line) => String(line || '')
    .replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/gi, ' ')
    .replace(/\*{2,}/g, '').replace(/\s+/g, ' ').trim();

const groupParagraphs = (lines) => {
    const groups = [];
    let current = [];
    const flush = () => {
        if (current.length) groups.push(current.join(' ').replace(/\s+/g, ' ').trim());
        current = [];
    };
    for (const rawLine of lines) {
        const line = cleanSourceLine(rawLine);
        if (!line) { flush(); continue; }
        if (current.length && /^(Chương|Phần|Mục|Tiểu mục|Điều)\s+|^\d+\.\s+|^[a-zđ]\)\s+/i.test(line)) flush();
        current.push(line);
    }
    flush();
    return groups;
};

const classifyBlock = (text, beforeFirstArticle) => {
    if (/^(Chương|Phần)\s+[IVXLCDM\d]+\b/i.test(text)) return 'chapter';
    if (/^(Mục|Tiểu mục)\s+[IVXLCDM\d]+\b/i.test(text)) return 'section';
    if (/^Điều\s+\d+[a-z]?\s*[.:-]?/i.test(text)) return 'article';
    if (/^\d+\.\s+/.test(text)) return 'clause';
    if (/^[a-zđ]\)\s+/i.test(text)) return 'point';
    if (DOCUMENT_TYPE_PATTERN.test(text)) return 'document-type';
    if (PREAMBLE_PATTERN.test(text)) return 'preamble';
    if (beforeFirstArticle && UPPERCASE_PATTERN.test(text) && text.length > 2) return 'center-heading';
    return 'paragraph';
};

export const parseLegalDocument = (content, metadataTitle = '') => {
    const sourceLines = String(content || '').replace(/\\n/g, '\n').split(/\r?\n/);
    const startIndex = sourceLines.findIndex(line => CONTENT_START_PATTERN.test(cleanSourceLine(line)));
    const paragraphs = groupParagraphs(startIndex >= 0 ? sourceLines.slice(startIndex) : sourceLines)
        .filter(text => text && !/^[-–—_.\s]{3,}$/.test(text));
    let beforeFirstArticle = true;
    const blocks = paragraphs.map((text, index) => {
        const type = classifyBlock(text, beforeFirstArticle);
        if (type === 'article') beforeFirstArticle = false;
        return { id: `${index}-${type}`, type, text };
    });
    const headingText = blocks.filter(block => ['document-type', 'center-heading'].includes(block.type))
        .slice(0, 4).map(block => block.text).join(' ');
    const comparableHeading = normalizeComparableText(headingText);
    const comparableTitle = normalizeComparableText(metadataTitle);
    return {
        blocks,
        hasDocumentHeading: blocks.some(block => block.type === 'document-type'),
        contentRepresentsTitle: Boolean(comparableHeading && comparableTitle &&
            (comparableHeading.includes(comparableTitle) || comparableTitle.includes(comparableHeading)))
    };
};
