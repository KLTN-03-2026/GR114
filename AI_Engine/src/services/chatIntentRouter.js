const INTENTS = Object.freeze({
    SOCIAL: 'SOCIAL',
    CAPABILITY: 'CAPABILITY',
    NON_LEGAL: 'NON_LEGAL',
    LEGAL_OR_UNCERTAIN: 'LEGAL_OR_UNCERTAIN'
});

const STANDALONE_SOCIAL = new Set([
    'chào', 'xin chào', 'chào bạn', 'hello', 'hi', 'hey',
    'cảm ơn', 'cám ơn', 'thanks', 'thank you',
    'bye', 'goodbye', 'tạm biệt', 'hẹn gặp lại',
    'haha', 'hahaha', 'ok', 'oke', 'okay', 'ừ', 'uh', 'vâng', 'được rồi', 'hiểu rồi'
]);

const CAPABILITY_PATTERNS = Object.freeze([
    /^(?:bạn|mày|legai)\s+là\s+ai$/u,
    /^legai\s+là\s+gì$/u,
    /^(?:bạn|legai)\s+(?:có\s+thể\s+)?(?:trả\s+lời|hỗ\s+trợ|giúp|tư\s+vấn|làm)\s+(?:(?:được|về)\s+)?(?:các\s+câu\s+hỏi\s+)?(?:những\s+)?(?:câu\s+hỏi\s+)?(?:vấn\s+đề\s+)?(?:gì|lĩnh\s+vực\s+nào)(?:\s+vậy)?$/u,
    /^(?:chức\s+năng|khả\s+năng)\s+của\s+(?:bạn|legai)(?:\s+là\s+gì)?$/u,
    /^(?:bạn|legai)\s+chuyên\s+về\s+gì$/u,
    /^(?:bạn|legai)\s+có\s+hỗ\s+trợ\s+pháp\s+lý\s+không$/u
]);

const LEGAL_TERMS = Object.freeze([
    'luật', 'pháp luật', 'điều luật', 'điều khoản', 'khoản', 'nghị định', 'thông tư',
    'quyết định', 'nghị quyết', 'bộ luật', 'hiến pháp', 'hợp đồng', 'xử phạt', 'mức phạt',
    'vi phạm', 'khởi kiện', 'tranh chấp', 'thuế', 'bảo hiểm', 'lao động', 'đất đai',
    'viên chức', 'doanh nghiệp', 'quyền', 'nghĩa vụ', 'thủ tục', 'điều kiện', 'giấy phép',
    'tòa án', 'toà án', 'ly hôn', 'thừa kế', 'bồi thường', 'trách nhiệm pháp lý', 'hình sự',
    'dân sự', 'hành chính'
]);

const LEGAL_CONTEXT_REFERENCES = Object.freeze([
    'luật này', 'luật đó', 'điều này', 'điều đó', 'quy định này', 'quy định trên',
    'trường hợp này', 'trường hợp trên', 'vấn đề trên', 'cái đó có bị phạt',
    'như đã nói', 'nêu trên'
]);

const NON_LEGAL_RULES = Object.freeze([
    { reason: 'standalone_math', test: text => /^(?:\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)(?:\s*[+\-*/x×÷=]\s*(?:\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười))+(?:\s+(?:bằng|là)\s+(?:mấy|bao nhiêu))?$/u.test(text) },
    { reason: 'standalone_entertainment', test: text => /^(?:hãy\s+)?(?:kể|nói)\s+(?:cho\s+(?:tôi|mình)\s+)?(?:một\s+)?(?:câu\s+)?chuyện\s+cười(?:\s+đi)?$/u.test(text) },
    { reason: 'standalone_weather', test: text => /^(?:thời tiết|dự báo thời tiết)(?:\s+.+)?$/u.test(text) },
    { reason: 'standalone_coding', test: text => /^(?:hãy\s+)?(?:viết|tạo|code)\s+(?:cho\s+(?:tôi|mình)\s+)?(?:đoạn\s+)?(?:code|mã|chương trình)\b.+$/u.test(text) },
    { reason: 'standalone_casual', test: text => /^(?:tôi|mình)\s+(?:buồn|vui|chán|mệt)$|^hôm nay\s+(?:bạn\s+)?(?:vui|khỏe|khoẻ)\s+không$/u.test(text) },
    { reason: 'obvious_nonsense', test: text => /^[?!.…]{1,12}$/u.test(text) || /^(?:abcxyz|xyzabc|asdfgh|qwerty)$/u.test(text) }
]);

const RESPONSES = Object.freeze({
    SOCIAL: 'Chào bạn! Tôi là LegAI. Bạn cần tra cứu hay tư vấn vấn đề pháp lý nào?',
    CAPABILITY: 'Tôi là LegAI, trợ lý hỗ trợ tra cứu và giải thích thông tin pháp luật Việt Nam. Bạn có thể hỏi về quy định, thủ tục, quyền, nghĩa vụ hoặc tình huống pháp lý cụ thể.',
    NON_LEGAL: 'Tôi chuyên hỗ trợ tra cứu và giải thích các vấn đề pháp luật Việt Nam. Bạn vui lòng gửi một câu hỏi pháp lý để tôi hỗ trợ.'
});

function normalizeMessage(value) {
    return String(value || '')
        .normalize('NFC')
        .toLocaleLowerCase('vi-VN')
        .replace(/[“”"'`]/gu, '')
        .replace(/\s+/gu, ' ')
        .replace(/[.,!?:;…]+$/gu, '')
        .trim();
}

function containsPhrase(text, phrase) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'u').test(text);
}

function hasLegalVeto(text) {
    if (LEGAL_TERMS.some(term => containsPhrase(text, term))) return 'legal_signal';
    if (LEGAL_CONTEXT_REFERENCES.some(reference => text.includes(reference))) return 'legal_context_reference';
    if (/\b\d{1,3}\s*[\/_-]\s*\d{4}(?:\s*[\/_-]\s*[a-zđ0-9-]+)?\b/iu.test(text)) return 'legal_document_number';
    if (/\b(?:điều|khoản|điểm)\s*\d+[a-zđ]?\b/iu.test(text)) return 'article_clause_reference';
    if (/https?:\/\/(?:www\.)?(?:vbpl\.vn|thuvienphapluat\.vn|luatvietnam\.vn|xaydungchinhsach\.chinhphu\.vn)\b/iu.test(text)) return 'legal_source_url';
    if (/\b(?:phiên bản|hiệu lực|ban hành)\b/iu.test(text) || /\b(?:19|20)\d{2}\b/u.test(text)) return 'version_or_year_reference';
    return null;
}

function classifyChatIntent(message) {
    const rawText = String(message || '').normalize('NFC').trim();
    if (/^[?!.…]{1,12}$/u.test(rawText)) {
        return { intent: INTENTS.NON_LEGAL, bypassLegalRetrieval: true, reason: 'obvious_nonsense', confidence: 'HIGH' };
    }
    const text = normalizeMessage(message);
    if (!text) {
        return { intent: INTENTS.LEGAL_OR_UNCERTAIN, bypassLegalRetrieval: false, reason: 'empty_or_uncertain', confidence: 'DEFAULT_LEGAL' };
    }

    const vetoReason = hasLegalVeto(text);
    if (vetoReason) {
        return { intent: INTENTS.LEGAL_OR_UNCERTAIN, bypassLegalRetrieval: false, reason: vetoReason, confidence: 'DEFAULT_LEGAL' };
    }

    if (STANDALONE_SOCIAL.has(text)) {
        return { intent: INTENTS.SOCIAL, bypassLegalRetrieval: true, reason: 'standalone_social', confidence: 'HIGH' };
    }

    if (CAPABILITY_PATTERNS.some(pattern => pattern.test(text))) {
        return { intent: INTENTS.CAPABILITY, bypassLegalRetrieval: true, reason: 'standalone_capability', confidence: 'HIGH' };
    }

    const nonLegalRule = NON_LEGAL_RULES.find(rule => rule.test(text));
    if (nonLegalRule) {
        return { intent: INTENTS.NON_LEGAL, bypassLegalRetrieval: true, reason: nonLegalRule.reason, confidence: 'HIGH' };
    }

    return { intent: INTENTS.LEGAL_OR_UNCERTAIN, bypassLegalRetrieval: false, reason: 'uncertain_default_legal', confidence: 'DEFAULT_LEGAL' };
}

function getBypassResponse(intent, message = '') {
    if (intent !== INTENTS.SOCIAL) return RESPONSES[intent] || '';
    const text = normalizeMessage(message);
    if (['cảm ơn', 'cám ơn', 'thanks', 'thank you'].includes(text)) {
        return 'Rất vui được hỗ trợ bạn. Khi cần tra cứu hoặc tư vấn vấn đề pháp lý, bạn cứ gửi câu hỏi cho tôi.';
    }
    if (['bye', 'goodbye', 'tạm biệt', 'hẹn gặp lại'].includes(text)) {
        return 'Tạm biệt bạn! Khi cần hỗ trợ tra cứu pháp luật, LegAI luôn sẵn sàng.';
    }
    if (['haha', 'hahaha', 'ok', 'oke', 'okay', 'ừ', 'uh', 'vâng', 'được rồi', 'hiểu rồi'].includes(text)) {
        return 'Tôi luôn sẵn sàng hỗ trợ khi bạn có câu hỏi pháp lý.';
    }
    return RESPONSES.SOCIAL;
}

module.exports = { INTENTS, classifyChatIntent, getBypassResponse, normalizeMessage, hasLegalVeto };
