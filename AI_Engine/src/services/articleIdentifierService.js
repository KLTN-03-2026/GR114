function normalizeArticleIdentifier(value) {
    return String(value || '')
        .normalize('NFC')
        .toLocaleLowerCase('vi-VN')
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isValidArticleIdentifier(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    const normalized = normalizeArticleIdentifier(raw);
    if (!normalized || /^(unknown|null|undefined|n a|na|không rõ|không xác định|chưa xác định|placeholder)$/u.test(normalized)) return false;
    if (/\b(unknown|null|undefined|placeholder)\b/u.test(normalized)) return false;
    return /[\p{L}\p{N}]/u.test(raw);
}

function getArticleIdentifier(document = {}) {
    return document.dieu ?? document.article ?? document.article_number ?? '';
}

function hasValidArticleMetadata(document = {}) {
    return isValidArticleIdentifier(getArticleIdentifier(document));
}

module.exports = { isValidArticleIdentifier, getArticleIdentifier, hasValidArticleMetadata };
