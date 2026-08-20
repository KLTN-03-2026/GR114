const DOCUMENT_TYPE_PATTERN = /^(BỘ\s+LUẬT|LUẬT|PHÁP\s+LỆNH|NGHỊ\s+ĐỊNH|NGHỊ\s+QUYẾT|QUYẾT\s+ĐỊNH|THÔNG\s+TƯ|CHỈ\s+THỊ|LỆNH)(?:\s*:)?$/i;
const PREAMBLE_PATTERN = /^(Căn cứ|Theo đề nghị|Xét đề nghị|Quốc hội ban hành|Chính phủ ban hành|Ủy ban thường vụ Quốc hội ban hành|Bộ trưởng .* ban hành)/i;
const UPPERCASE_PATTERN = /^[A-ZÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÍÌỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰÝỲỶỸỴĐ\d\s,./()–—-]+$/;
const VIETNAMESE_UPPER = 'A-ZÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÍÌỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰÝỲỶỸỴĐ';
const SIGNATURE_TITLE_PATTERN = /^(?:KT\.\s*)?(?:CHỦ TỊCH QUỐC HỘI|CHỦ TỊCH NƯỚC|THỦ TƯỚNG CHÍNH PHỦ|THỦ TƯỚNG|PHÓ THỦ TƯỚNG|BỘ TRƯỞNG|THỨ TRƯỞNG|CHỦ TỊCH|CHỦ NHIỆM|PHÓ CHỦ NHIỆM)$/i;
const SIGNATURE_NOTE_PATTERN = /^\(?đã ký\)?\s*:?$/i;
const CERTIFICATION_HEADING_PATTERN = /^(?:VĂN PHÒNG(?: CHỦ TỊCH NƯỚC)?|SAO Y BẢN CHÍNH)$/i;

export const normalizeComparableText = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

const cleanSourceLine = (line) => String(line || '')
    .replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/gi, ' ')
    .replace(/\*{2,}/g, '').replace(/\s+/g, ' ').trim();

// Recover semantic boundaries lost by scrapers without altering stored Content.
const recoverCollapsedStructure = (content) => String(content || '')
    .replace(/(BỘ LUẬT|LUẬT|PHÁP LỆNH|NGHỊ ĐỊNH|NGHỊ QUYẾT|QUYẾT ĐỊNH|THÔNG TƯ|CHỈ THỊ|LỆNH)(?=[A-ZÀ-Ỹ])/gu, '\n$1\n')
    .replace(new RegExp(`Chương\\s*(VIII|VII|VI|IV|V|III|II|I|\\d+)(?![IVXLCDM](?:[IVXLCDM]|\\s|$))(?=[${VIETNAMESE_UPPER}])`, 'g'), '\nChương $1\n')
    .replace(new RegExp(`(Phần|Mục|Tiểu mục)\\s*([IVXLCDM]+|\\d+)(?=[${VIETNAMESE_UPPER}])`, 'g'), '\n$1 $2\n')
    .replace(new RegExp(`(^|[\\r\\n]|[${VIETNAMESE_UPPER}])Điều\\s+(\\d+[a-z]?)\\.\\s*`, 'gmu'), '$1\nĐiều $2. ')
    .replace(/(?<!Điều)(?<!Mục)(?<!Phần)\s+(?=(?:\d+\.|[a-zđ]\))\s+)/gi, '\n')
    .replace(/([a-zà-ỹ])(?=(?:Trong\s+(?:Luật|Nghị định|Quyết định|Thông tư)\s+này|Luật này|Nghị định này|Quyết định này|Thông tư này|Việc)\b)/g, '$1\n')
    .replace(/(Căn cứ|Theo đề nghị|Xét đề nghị|Quốc hội ban hành|Chính phủ ban hành)/gi, '\n$1');

const recoverTerminalSignatures = (content) => {
    const source = String(content || '');
    const terminalStart = Math.max(0, source.length - 6000);
    const prefix = source.slice(0, terminalStart);
    let terminal = source.slice(terminalStart);
    terminal = terminal
        .replace(/VĂN\s*PHÒNG\s*CHỦ\s*TỊCH\s*NƯỚC/g, '\n§CERTIFICATION_OFFICE§\n')
        .replace(/((?:KT\.\s*)?(?:CHỦ\s*TỊCH\s*QUỐC\s*HỘI|CHỦ\s*TỊCH\s*NƯỚC|THỦ\s*TƯỚNG\s*CHÍNH\s*PHỦ|THỦ\s*TƯỚNG|BỘ\s*TRƯỞNG|CHỦ\s*NHIỆM)|PHÓ\s*THỦ\s*TƯỚNG|PHÓ\s*CHỦ\s*NHIỆM|THỨ\s*TRƯỞNG|CHỦ\s*TỊCH)/g,
            match => `\n${match.replace(/\s+/g, ' ').trim()}\n`)
        .replace(/§CERTIFICATION_OFFICE§/g, 'VĂN PHÒNG CHỦ TỊCH NƯỚC')
        .replace(/(SAO Y BẢN CHÍNH)/g, '\n$1\n')
        .replace(/\(?đã ký\)?\s*:\s*([^\n]+)/gi, (_, name) => `\nĐã ký:\n${name.trim()}\n`)
        .replace(/\(đã ký\)/gi, '\n(đã ký)\n');
    return prefix + terminal;
};

const isStructuralStart = (line) => (
    DOCUMENT_TYPE_PATTERN.test(line) ||
    PREAMBLE_PATTERN.test(line) ||
    /^(Chương|Phần|Mục|Tiểu mục)\s+/i.test(line) ||
    /^Điều\s+\d+[a-z]?\s*[.:-]/i.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^[a-zđ]\)\s+/i.test(line) ||
    SIGNATURE_TITLE_PATTERN.test(line) || SIGNATURE_NOTE_PATTERN.test(line) ||
    CERTIFICATION_HEADING_PATTERN.test(line)
);

const isContentStart = (line) => DOCUMENT_TYPE_PATTERN.test(line) ||
    PREAMBLE_PATTERN.test(line) ||
    /^(Chương|Phần|Mục|Tiểu mục)\s+[IVXLCDM\d]+\b/i.test(line) ||
    /^Điều\s+1[a-z]?\s*[.:-]/i.test(line);

const recombineWrappedArticleHeadings = (lines) => {
    const recombined = [];
    for (let index = 0; index < lines.length; index += 1) {
        let line = lines[index];
        if (/^\s*Điều\s+\d+[a-z]?\s*[.:-]/i.test(line)) {
            const hasHeadingText = /^\s*Điều\s+\d+[a-z]?\s*[.:-]\s*\S/i.test(line);
            while (index + 1 < lines.length) {
                const continuation = cleanSourceLine(lines[index + 1]);
                if (!continuation) { index += 1; continue; }
                if (hasHeadingText && !/^[a-zà-ỹđ]/u.test(continuation)) break;
                line = `${cleanSourceLine(line)} ${continuation}`;
                index += 1;
                if (!/^[a-zà-ỹđ]/u.test(continuation)) break;
            }
        }
        recombined.push(line);
    }
    return recombined;
};

const normalizeHierarchyHeadings = (lines) => {
    const normalized = [];
    for (let index = 0; index < lines.length; index += 1) {
        const line = cleanSourceLine(lines[index]);
        const match = line.match(/^(Chương|Phần|Mục|Tiểu mục)\s+([IVXLCDM]+|\d+)[.:-]?\s*(.*)$/i);
        if (!match) { normalized.push(lines[index]); continue; }

        normalized.push(`${match[1]} ${match[2]}`);
        const titleParts = match[3] ? [match[3]] : [];
        while (index + 1 < lines.length) {
            const candidate = cleanSourceLine(lines[index + 1]);
            if (!candidate) { index += 1; continue; }
            if (isStructuralStart(candidate) || !UPPERCASE_PATTERN.test(candidate)) break;
            titleParts.push(candidate);
            index += 1;
        }
        if (titleParts.length) normalized.push(titleParts.join(' '));
    }
    return normalized;
};

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
        const currentText = current.join(' ');
        const currentIsStandaloneHeading = DOCUMENT_TYPE_PATTERN.test(currentText) ||
            /^(Chương|Phần|Mục|Tiểu mục)\s+[IVXLCDM\d]+\b/i.test(currentText) ||
            /^Điều\s+\d+[a-z]?\s*[.:-]/i.test(currentText) ||
            SIGNATURE_TITLE_PATTERN.test(currentText) || SIGNATURE_NOTE_PATTERN.test(currentText) ||
            CERTIFICATION_HEADING_PATTERN.test(currentText);
        const lineIsUppercaseHeading = UPPERCASE_PATTERN.test(line) && line.length > 2;

        if (current.length && (
            isStructuralStart(line) ||
            currentIsStandaloneHeading ||
            (lineIsUppercaseHeading && !/[.;:]$/.test(currentText))
        )) flush();
        current.push(line);
    }
    flush();
    return groups;
};

const classifyBlock = (text, beforeFirstArticle, previousType) => {
    if (/^(Chương|Phần)\s+[IVXLCDM\d]+\b/i.test(text)) return 'chapter';
    if (/^(Mục|Tiểu mục)\s+[IVXLCDM\d]+\b/i.test(text)) return 'section';
    if (/^Điều\s+\d+[a-z]?\s*[.:-]/i.test(text)) return 'article';
    if (/^\d+\.\s+/.test(text)) return 'clause';
    if (/^[a-zđ]\)\s+/i.test(text)) return 'point';
    if (DOCUMENT_TYPE_PATTERN.test(text)) return 'document-type';
    if (PREAMBLE_PATTERN.test(text)) return 'preamble';
    if ((beforeFirstArticle || previousType === 'chapter' || previousType === 'section') && UPPERCASE_PATTERN.test(text) && text.length > 2) return 'center-heading';
    return 'paragraph';
};

export const parseLegalDocument = (content, metadataTitle = '') => {
    const sourceLines = normalizeHierarchyHeadings(
        recombineWrappedArticleHeadings(
            recoverCollapsedStructure(
                recoverTerminalSignatures(String(content || '').replace(/\\n/g, '\n'))
            ).split(/\r?\n/)
        )
    );
    const startIndex = sourceLines.findIndex(line => isContentStart(cleanSourceLine(line)));
    const paragraphs = groupParagraphs(startIndex >= 0 ? sourceLines.slice(startIndex) : sourceLines)
        .filter(text => text && !/^[-–—_.\s]{3,}$/.test(text));
    let beforeFirstArticle = true;
    let signatureContext = '';
    const terminalSignatureIndex = paragraphs.findIndex((text, index) =>
        index >= paragraphs.length - 40 && SIGNATURE_TITLE_PATTERN.test(text)
    );
    const blocks = paragraphs.map((text, index) => {
        const previousType = index > 0 ? classifyBlock(paragraphs[index - 1], beforeFirstArticle) : '';
        let type;
        const inSignatureRegion = terminalSignatureIndex >= 0 && index >= terminalSignatureIndex;
        if (inSignatureRegion && CERTIFICATION_HEADING_PATTERN.test(text)) {
            signatureContext = 'certification';
            type = /^VĂN PHÒNG/i.test(text) ? 'certification-office' : 'certification-heading';
        } else if (inSignatureRegion && (SIGNATURE_TITLE_PATTERN.test(text) ||
            (signatureContext === 'certification' && /^(?:KT\.|PHÓ)\s+/i.test(text)))) {
            if (!signatureContext) signatureContext = 'primary';
            type = signatureContext === 'certification' ? 'certification-title' : 'signature-title';
        } else if (inSignatureRegion && SIGNATURE_NOTE_PATTERN.test(text)) {
            type = signatureContext === 'certification' ? 'certification-note' : 'signature-note';
        } else if (signatureContext === 'certification') {
            type = /^(?:Số:|.+,\s*ngày\s+\d+)/i.test(text) ? 'certification-meta' : 'certification-name';
        } else if (signatureContext === 'primary') {
            type = 'signature-name';
        } else {
            type = classifyBlock(text, beforeFirstArticle, previousType);
        }
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
