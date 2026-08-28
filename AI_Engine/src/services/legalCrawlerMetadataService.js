const {
    extractIssueDateMetadata,
    inferDocumentType,
    normalizeLegalStatus,
    parseIssueDateString
} = require('../constants/legalMetadata');

function clean(value) {
    return String(value || '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function validText(value) {
    const text = clean(value);
    return text && !/^(null|undefined|unknown|đang cập nhật|không tìm thấy)/iu.test(text) ? text : '';
}

function validDocumentNumber(value) {
    const text = validText(value);
    return /\d{1,4}\s*[\/-]\s*\d{4}\s*[\/-]\s*[\p{L}\d-]{2,20}/iu.test(text) ? text : '';
}

function mapStructuredDocument(document = {}) {
    const documentNumber = validDocumentNumber(document.docNum);
    const title = validText(document.title);
    if (!documentNumber && !title) return null;
    const issueDate = parseIssueDateString(document.issueDate);
    const effectiveDate = parseIssueDateString(document.effFrom);
    const expirationDate = parseIssueDateString(document.effTo);
    const rawStatus = validText(document.effStatus?.name);
    const status = rawStatus ? normalizeLegalStatus(rawStatus) : '';
    return {
        documentNumber,
        title,
        issueDate,
        issueDateString: issueDate ? clean(document.issueDate) : '',
        effectiveDate,
        expirationDate,
        status: status === 'Không xác định' ? '' : status,
        agency: validText(document.agencyName),
        documentType: validText(document.docType?.name)
    };
}

function findStructuredDocument(root) {
    const seen = new Set();
    const visit = value => {
        if (!value || typeof value !== 'object' || seen.has(value)) return null;
        seen.add(value);
        if (Object.prototype.hasOwnProperty.call(value, 'docNum') || Object.prototype.hasOwnProperty.call(value, 'issueDate')) {
            const mapped = mapStructuredDocument(value);
            if (mapped?.documentNumber) return mapped;
        }
        for (const child of Array.isArray(value) ? value : Object.values(value)) {
            const found = visit(child);
            if (found) return found;
        }
        return null;
    };
    return visit(root);
}

function readSerializedField(text, field) {
    const pattern = new RegExp(`["']${field}["']\\s*:\\s*["']([^"']+)["']`, 'iu');
    return clean(text.match(pattern)?.[1]?.replace(/\\u002F/giu, '/').replace(/\\"/gu, '"'));
}

function readNestedName(text, field) {
    const pattern = new RegExp(`["']${field}["']\\s*:\\s*\\{[^{}]{0,1000}?["']name["']\\s*:\\s*["']([^"']+)["']`, 'iu');
    return clean(text.match(pattern)?.[1]);
}

function parseSerializedCandidate(payload) {
    const text = String(payload || '');
    for (const candidate of [text, text.replace(/\\"/gu, '"')]) {
        try {
            const found = findStructuredDocument(JSON.parse(candidate));
            if (found) return found;
        } catch (_) { }
    }
    const decoded = text.replace(/\\"/gu, '"');
    const docNum = readSerializedField(decoded, 'docNum');
    const title = readSerializedField(decoded, 'title');
    if (!validDocumentNumber(docNum) || !validText(title)) return null;
    return mapStructuredDocument({
        docNum,
        title,
        issueDate: readSerializedField(decoded, 'issueDate'),
        effFrom: readSerializedField(decoded, 'effFrom'),
        effTo: readSerializedField(decoded, 'effTo'),
        agencyName: readSerializedField(decoded, 'agencyName'),
        effStatus: { name: readNestedName(decoded, 'effStatus') },
        docType: { name: readNestedName(decoded, 'docType') }
    });
}

function extractStructuredMetadata(payloads = []) {
    for (const payload of payloads || []) {
        const parsed = parseSerializedCandidate(payload);
        if (parsed) return parsed;
    }
    return null;
}

function labelValue(items, labels) {
    const wanted = labels.map(label => clean(label).toLocaleLowerCase('vi-VN'));
    for (const item of items || []) {
        const label = clean(item?.label).replace(/:$/u, '').toLocaleLowerCase('vi-VN');
        if (wanted.includes(label)) return clean(item?.value);
    }
    return '';
}

function normalizeCrawlerMetadata({ structuredPayloads = [], dom = {}, legacy = {} } = {}) {
    const structured = extractStructuredMetadata(structuredPayloads) || {};
    const items = dom.dateItems?.length ? dom.dateItems : (dom.labelValueItems || []);
    const explicitRaw = labelValue(items, ['Ngày ban hành', 'Ngày ký']);
    const effectiveRaw = labelValue(items, ['Ngày có hiệu lực', 'Ngày hiệu lực']);
    const issueFallback = extractIssueDateMetadata({
        explicitIssueDateTexts: explicitRaw ? [`Ngày ban hành: ${explicitRaw}`] : legacy.explicitIssueDateTexts,
        rightHeaderText: legacy.rightHeaderText,
        bodyText: legacy.bodyText
    });
    const legacyIssueDate = parseIssueDateString(legacy.issueDate);
    const issueDate = structured.issueDate || issueFallback?.iso || legacyIssueDate || null;
    const issueDateString = structured.issueDateString || issueFallback?.raw || (legacyIssueDate ? clean(legacy.issueDate) : '');
    const statusCandidate = validText(dom.statusText) || validText(legacy.statusText);
    const normalizedStatus = structured.status || normalizeLegalStatus(statusCandidate);
    const documentNumber = structured.documentNumber || validDocumentNumber(labelValue(dom.labelValueItems, ['Số ký hiệu', 'Số hiệu'])) || validDocumentNumber(legacy.documentNumber);
    const title = structured.title || validText(legacy.title);
    const agency = structured.agency || validText(labelValue(dom.labelValueItems, ['Cơ quan ban hành'])) || validText(legacy.agency);
    const explicitType = structured.documentType || validText(labelValue(dom.labelValueItems, ['Loại văn bản'])) || validText(legacy.documentType);
    return {
        documentNumber,
        title,
        issueDate,
        issueDateString,
        effectiveDate: structured.effectiveDate || parseIssueDateString(effectiveRaw) || parseIssueDateString(legacy.effectiveDateText),
        expirationDate: structured.expirationDate || parseIssueDateString(labelValue(items, ['Ngày hết hiệu lực'])),
        status: normalizedStatus,
        agency,
        documentType: inferDocumentType({ documentType: explicitType, title, documentNumber })
    };
}

module.exports = {
    mapStructuredDocument,
    extractStructuredMetadata,
    normalizeCrawlerMetadata
};
