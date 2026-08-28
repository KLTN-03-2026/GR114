const DOCUMENT_TYPES = Object.freeze([
    'Hiến pháp', 'Bộ luật', 'Luật', 'Pháp lệnh', 'Nghị định', 'Thông tư',
    'Thông tư liên tịch', 'Quyết định', 'Lệnh', 'Nghị quyết',
    'Nghị quyết liên tịch', 'Văn bản hợp nhất', 'Văn bản hành chính liên quan',
    'Bản dịch văn bản', 'Chỉ thị', 'Văn bản hệ thống hóa', 'Chưa xác định',
    'Công văn', 'Quy định', 'Sắc luật', 'Thông báo', 'Công ước',
    'Văn bản khác', 'Văn bản liên quan', 'Thông tư liên bộ', 'Sắc lệnh'
]);

const LEGAL_STATUSES = Object.freeze([
    'Chưa có hiệu lực', 'Còn hiệu lực', 'Còn hiệu lực một phần',
    'Hết hiệu lực một phần', 'Hết hiệu lực', 'Không xác định'
]);

function comparisonKey(value) {
    return String(value || '')
        .normalize('NFC')
        .toLocaleLowerCase('vi-VN')
        .replace(/[.,;:!?()[\]{}"'“”‘’_-]+/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
}

function normalizeLegalStatus(value) {
    const key = comparisonKey(value);
    return LEGAL_STATUSES.find(status => comparisonKey(status) === key) || 'Không xác định';
}

function normalizeDocumentType(value) {
    const key = comparisonKey(value);
    return DOCUMENT_TYPES.find(type => comparisonKey(type) === key) || 'Chưa xác định';
}

const TYPE_PREFIXES = Object.freeze([
    'Thông tư liên tịch', 'Nghị quyết liên tịch', 'Văn bản hành chính liên quan',
    'Văn bản hệ thống hóa', 'Văn bản hợp nhất', 'Văn bản liên quan',
    'Thông tư liên bộ', 'Bản dịch văn bản', 'Bộ luật', 'Hiến pháp',
    'Pháp lệnh', 'Nghị định', 'Thông tư', 'Quyết định', 'Nghị quyết',
    'Công văn', 'Quy định', 'Sắc luật', 'Thông báo', 'Công ước',
    'Chỉ thị', 'Sắc lệnh', 'Lệnh', 'Luật'
]);

// Official document-number form markers are stronger evidence than a title,
// which may begin with the name of a document being consolidated or amended.
const DOCUMENT_NUMBER_TYPE_RULES = Object.freeze([
    [/((^|[\/-])VBHN(?=$|[\/-]))/u, 'Văn bản hợp nhất'],
    [/((^|[\/-])TTLT(?=$|[\/-]))/u, 'Thông tư liên tịch'],
    [/((^|[\/-])NQLT(?=$|[\/-]))/u, 'Nghị quyết liên tịch'],
    [/((^|[\/-])QĐ(?=$|[\/-]))/u, 'Quyết định'],
    [/((^|[\/-])TB(?=$|[\/-]))/u, 'Thông báo'],
    [/((^|[\/-])NĐ(?=$|[\/-]))/u, 'Nghị định'],
    [/((^|[\/-])NQ(?=$|[\/-]))/u, 'Nghị quyết'],
    [/((^|[\/-])TT(?=$|[\/-]))/u, 'Thông tư'],
    [/((^|[\/-])CT(?=$|[\/-]))/u, 'Chỉ thị'],
    [/((^|[\/-])CV(?=$|[\/-]))/u, 'Công văn'],
    [/((^|[\/-])PL(?=$|[\/-]))/u, 'Pháp lệnh']
]);

function inferDocumentTypeFromNumber(documentNumber) {
    const signature = String(documentNumber || '')
        .normalize('NFC')
        .toLocaleUpperCase('vi-VN')
        .replace(/\s+/gu, '');
    const match = DOCUMENT_NUMBER_TYPE_RULES.find(([pattern]) => pattern.test(signature));
    return match?.[1] || null;
}

function inferDocumentType(document = {}) {
    const documentType = document.documentType ?? document.DocumentType;
    const title = document.title ?? document.Title;
    const documentNumber = document.documentNumber ?? document.DocumentNumber;
    const explicit = normalizeDocumentType(documentType);
    if (explicit !== 'Chưa xác định') return explicit;
    const numberType = inferDocumentTypeFromNumber(documentNumber);
    if (numberType) return numberType;
    const candidate = comparisonKey(title).replace(/^toàn văn\s+/u, '');
    const match = TYPE_PREFIXES.find(type => {
        const typeKey = comparisonKey(type);
        return candidate === typeKey || candidate.startsWith(`${typeKey} `);
    });
    return match || 'Chưa xác định';
}

function toSqlDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    const raw = String(value).normalize('NFC').trim();
    let year;
    let month;
    let day;
    let match = raw.match(/(?:^|[,\s])ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})(?:\D|$)/iu);
    if (match) [, day, month, year] = match;
    if (!match) {
        match = raw.match(/(?:^|\D)(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{4})(?:\D|$)/u);
        if (match) [, day, month, year] = match;
    }
    if (!match) {
        match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
        if (match) [, year, month, day] = match;
    }
    if (!match) return null;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const EXCLUDED_ISSUE_DATE_LABEL = /^\s*Ngày\s+(?:có\s+hiệu\s+lực|hiệu\s+lực|hết\s+hiệu\s+lực|cập\s+nhật)\s*:/iu;
const EXPLICIT_ISSUE_DATE_LABEL = /^\s*Ngày\s+(?:ban\s+hành|ký)\s*:/iu;
const HEADER_END = /^\s*(?:Căn\s+cứ(?:\s|[.:,;]|$)|Điều\s+1(?:\s|[.:\-–—]|$))/iu;

function extractDateLine(text, { explicitLabelRequired = false } = {}) {
    for (const value of String(text || '').normalize('NFC').split(/\n+/u)) {
        const line = value.replace(/\s+/gu, ' ').trim();
        if (!line || EXCLUDED_ISSUE_DATE_LABEL.test(line)) continue;
        if (explicitLabelRequired && !EXPLICIT_ISSUE_DATE_LABEL.test(line)) continue;
        const iso = toSqlDate(line);
        if (iso) return { raw: line, iso };
    }
    return null;
}

function extractLegalDateline(text) {
    for (const value of String(text || '').normalize('NFC').split(/\n+/u)) {
        const line = value.replace(/\s+/gu, ' ').trim();
        if (!/^\p{L}[\p{L}\s.-]{0,100},\s*ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}(?:\D|$)/iu.test(line)) continue;
        const iso = toSqlDate(line);
        if (iso) return { raw: line, iso };
    }
    return null;
}

function getScopedDocumentHeader(bodyText) {
    const lines = String(bodyText || '').normalize('NFC').split('\n');
    const header = [];
    for (const line of lines) {
        if (HEADER_END.test(line)) break;
        header.push(line);
        if (header.length >= 120 || header.join('\n').length >= 6000) break;
    }
    return header.join('\n');
}

function extractIssueDateMetadata({ explicitIssueDateTexts = [], rightHeaderText = '', bodyText = '' } = {}) {
    for (const fieldText of explicitIssueDateTexts || []) {
        const explicit = extractDateLine(fieldText, { explicitLabelRequired: true });
        if (explicit) return explicit;
    }
    const rightHeader = extractLegalDateline(rightHeaderText);
    if (rightHeader) return rightHeader;
    return extractLegalDateline(getScopedDocumentHeader(bodyText));
}

function resolveIssueDatePersistence(data = {}, existing = null) {
    const incomingRaw = String(data.issueDateString || '').normalize('NFC').trim();
    const existingRaw = String(existing?.IssueDateString ?? existing?.issueDateString ?? '').normalize('NFC').trim();
    const incomingDate = toSqlDate(data.issueDate) || toSqlDate(incomingRaw);
    const existingDate = toSqlDate(existing?.IssueDate ?? existing?.issueDate);
    return {
        issueDateString: incomingRaw || existingRaw || null,
        issueDate: incomingDate || existingDate || null
    };
}

module.exports = {
    DOCUMENT_TYPES,
    LEGAL_STATUSES,
    normalizeLegalStatus,
    normalizeDocumentType,
    inferDocumentTypeFromNumber,
    inferDocumentType,
    parseIssueDateString: toSqlDate,
    normalizeSqlDate: toSqlDate,
    extractIssueDateMetadata,
    extractLegalDateline,
    resolveIssueDatePersistence,
    getScopedDocumentHeader
};
