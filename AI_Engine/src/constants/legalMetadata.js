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
        return value.toISOString().slice(0, 10);
    }
    const raw = String(value).normalize('NFC').trim();
    let year;
    let month;
    let day;
    let match = raw.match(/(?:^|[,\s])ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})(?:\D|$)/iu);
    if (match) [, day, month, year] = match;
    if (!match) {
        match = raw.match(/(?:^|\D)(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})(?:\D|$)/u);
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

module.exports = {
    DOCUMENT_TYPES,
    LEGAL_STATUSES,
    normalizeLegalStatus,
    normalizeDocumentType,
    inferDocumentTypeFromNumber,
    inferDocumentType,
    parseIssueDateString: toSqlDate,
    normalizeSqlDate: toSqlDate
};
