const INTENTS = Object.freeze({
    SOCIAL: 'SOCIAL', CAPABILITY: 'CAPABILITY', NON_LEGAL: 'NON_LEGAL',
    CLARIFICATION: 'CLARIFICATION', LEGAL_OR_UNCERTAIN: 'LEGAL_OR_UNCERTAIN'
});

const SAFE_TOKENS = Object.freeze({ tui: 'toi', ko: 'khong', k: 'khong', hok: 'khong', ni: 'nay', cty: 'cong ty', dc: 'duoc' });
const SOCIAL = new Set(['chao','xin chao','chao ban','hello','hi','hey','cam on','thanks','thank you','bye','goodbye','tam biet','hen gap lai','haha','hahaha','hehe','huhu','ua','o','e','ok','oke','okay','u','uh','vang','duoc roi','hieu roi']);
const FILLERS = new Set(['nhi','vay','the','nha','nhe','a','ne','huhu','haha','hehe','e','ua','o','troi','oi','di','qua','ghe']);

const CAPABILITY_PATTERNS = Object.freeze([
    /^(?:ban|may|legai) la ai$/u, /^legai la gi$/u,
    /^(?:ban|legai) (?:co the )?(?:tra loi|ho tro|giup|tu van|lam) (?:(?:duoc|ve) )?(?:cac cau hoi )?(?:nhung )?(?:cau hoi )?(?:van de )?(?:gi|linh vuc nao)(?: vay)?$/u,
    /^(?:chuc nang|kha nang) cua (?:ban|legai)(?: la gi)?$/u,
    /^(?:ban|legai) chuyen ve gi$/u, /^(?:ban|legai) co ho tro phap ly khong$/u
]);

// Maintainable positive-evidence groups. All values use the accent-folded
// classification representation; the downstream question is never modified.
const LEGAL_SIGNAL_GROUPS = Object.freeze({
    explicitReferences: Object.freeze(['luat','phap luat','bo luat','hien phap','dieu luat','dieu khoan','nghi dinh','thong tu','quyet dinh','nghi quyet','quy dinh','van ban phap luat','con hieu luc','ban hanh','sua doi','ap dung van ban']),
    legalActionsAndOutcomes: Object.freeze(['bi phat','muc phat','vi pham','trai luat','khoi kien','kien','toa an','boi thuong','quyen','nghia vu','trach nhiem','khieu nai','to cao','xu phat','giay phep','thu tuc']),
    labor: Object.freeze(['khong tra luong','chua tra luong','no luong','giu luong','khong tra thang cuoi','sa thai','duoi viec','ong chu duoi','duoi toi','nghi viec khong bao truoc','khong dong bhxh','khong ky hop dong','hop dong lao dong','lao dong','vien chuc']),
    civilAndContract: Object.freeze(['nguoi vay khong tra','vay tien','khong tra coc','khong tra tien coc','tranh chap hop dong','hop dong','doi boi thuong','the chap','thua ke']),
    family: Object.freeze(['ly hon','chia tai san','quyen nuoi con','cap duong']),
    landAndProperty: Object.freeze(['tranh chap dat','so do','chuyen nhuong dat','thu hoi dat','dat dai']),
    criminalAndAdministrative: Object.freeze(['cong an giu','bi danh','bi lua','mat tai san','lap bien ban','hinh su','hanh chinh','dan su','doanh nghiep','thue','bao hiem'])
});

const CONTEXT_REFERENCES = Object.freeze(['luat nay','luat do','dieu nay','dieu do','quy dinh nay','quy dinh tren','truong hop tren','van de tren','cai do co bi phat','nhu da noi','neu tren','muc do dung khong','van ban tren','tien thang cuoi']);

const NON_LEGAL_RULES = Object.freeze([
    { reason:'standalone_math', test:t=>/^(?:\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)(?:\s*[+\-*/x×÷=]\s*(?:\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi))+(?:\s+(?:bang|la)\s+(?:may|bao nhieu))?$/u.test(t) },
    { reason:'standalone_entertainment', test:t=>/^(?:hay )?(?:ke|noi) (?:cho (?:toi|minh) )?(?:mot )?(?:cau )?chuyen cuoi$/u.test(t) },
    { reason:'standalone_weather', test:t=>/^(?:(?:hom nay|nay) )?(?:thoi tiet|du bao thoi tiet)(?: .*)?$|^thoi tiet hom nay\b.*$/u.test(t) },
    { reason:'standalone_coding', test:t=>/^(?:hay )?(?:viet|tao|code) (?:cho (?:toi|minh) )?(?:(?:doan )?(?:code|ma|chuong trinh)\b.*|hello world)$|^viet hello world$/u.test(t) },
    { reason:'standalone_math_or_science', test:t=>/^(?:giai|lam) (?:(?:bai|giup toi) )?(?:toan|bai toan|vat ly)(?: .*)?$/u.test(t) },
    { reason:'standalone_translation', test:t=>/^(?:hay )?dich .+ sang (?:tieng )?(?:anh|viet|phap|nhat|han|trung)$/u.test(t) },
    { reason:'standalone_food', test:t=>/^(?:hay )?goi y (?:cho (?:toi|minh) )?(?:mot )?mon an(?: .+)?$/u.test(t) },
    { reason:'standalone_sports', test:t=>/^(?:messi|ronaldo|neymar)\b.+\b(?:ban|tran|doi|ghi)\b.*$/u.test(t) },
    { reason:'standalone_casual', test:t=>/^(?:(?:toi|minh) )?(?:buon|vui|chan|met)(?: (?:qua|ghe))?$|^(?:nay|hom nay) (?:(?:toi|minh) )?(?:buon|vui|chan|met)(?: (?:qua|ghe))?$|^hom nay (?:ban )?(?:vui|khoe) khong$|^ban khoe khong$|^noi chuyen voi (?:toi|minh)(?: di)?$/u.test(t) },
    { reason:'obvious_nonsense', test:t=>/^[?!.…:;)=(\-]{1,12}$/u.test(t)||/^(?:abcxyz|xyzabc|asdfgh|qwerty|(?:ha){2,}|(?:he){2,})$/u.test(t) }
]);

const RESPONSES = Object.freeze({
    SOCIAL:'Chào bạn! Tôi là LegAI. Bạn cần tra cứu hay tư vấn vấn đề pháp lý nào?',
    CAPABILITY:'Tôi là LegAI, trợ lý hỗ trợ tra cứu và giải thích thông tin pháp luật Việt Nam. Bạn có thể hỏi về quy định, thủ tục, quyền, nghĩa vụ hoặc tình huống pháp lý cụ thể.',
    NON_LEGAL:'Tôi chuyên hỗ trợ tra cứu và giải thích các vấn đề pháp luật Việt Nam. Bạn vui lòng gửi một câu hỏi pháp lý để tôi hỗ trợ.',
    CLARIFICATION:'Được, bạn mô tả cụ thể tình huống hoặc vấn đề cần hỗ trợ nhé.'
});

function normalizeMessage(value) {
    const cleaned=String(value||'').normalize('NFD').toLocaleLowerCase('vi-VN').replace(/[\u0300-\u036f]/gu,'').replace(/đ/gu,'d').replace(/[“”"'`]/gu,'').replace(/[^a-z0-9\s+\-*/x×÷=/:.?！]/gu,' ').replace(/([!?.,:;])\1+/gu,'$1').replace(/[.,!?:;]+$/gu,'').replace(/\s+/gu,' ').trim();
    return cleaned.split(' ').map(token=>SAFE_TOKENS[token]||token).join(' ');
}

function stripConversationalFillers(text) {
    const tokens=text.split(' ').filter(Boolean);
    while(tokens.length&&FILLERS.has(tokens[0])) tokens.shift();
    while(tokens.length&&FILLERS.has(tokens[tokens.length-1])) tokens.pop();
    if(tokens.length>=2&&tokens.at(-2)==='vay'&&tokens.at(-1)==='ta') tokens.splice(-2);
    return tokens.join(' ');
}

function containsPhrase(text, phrase) {
    const escaped=phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`,'u').test(text);
}

function findLegalEvidence(text) {
    for(const [group,signals] of Object.entries(LEGAL_SIGNAL_GROUPS)) if(signals.some(signal=>containsPhrase(text,signal))) return `legal_${group}`;
    if(CONTEXT_REFERENCES.some(reference=>containsPhrase(text,reference))) return 'legal_context_reference';
    if(/\b\d{1,3}\s*[\/_-]\s*\d{4}(?:\s*[\/_-]\s*[a-z0-9-]+)?\b/u.test(text)) return 'legal_document_number';
    if(/\b(?:dieu|khoan|diem)\s*\d+[a-z]?\b/u.test(text)) return 'article_clause_reference';
    if(/https?:\/\/(?:www\.)?(?:vbpl\.vn|thuvienphapluat\.vn|luatvietnam\.vn|xaydungchinhsach\.chinhphu\.vn)\b/u.test(text)) return 'legal_source_url';
    return null;
}

function hasLegalVeto(value) { return findLegalEvidence(normalizeMessage(value)); }

function classifyChatIntent(message) {
    const raw=String(message||'').trim();
    if(/^[?!.…:;)=(\-]{1,12}$/u.test(raw)) return {intent:INTENTS.NON_LEGAL,bypassLegalRetrieval:true,requiresLegalRetrieval:false,reason:'obvious_nonsense',confidence:'HIGH'};
    const text=normalizeMessage(message);
    if(!text) return {intent:INTENTS.CLARIFICATION,bypassLegalRetrieval:true,requiresLegalRetrieval:false,reason:'insufficient_detail',confidence:'LOW'};
    // Evaluate the whole message first: social tone cannot suppress legal substance.
    const reason=findLegalEvidence(text);
    if(reason) return {intent:INTENTS.LEGAL_OR_UNCERTAIN,bypassLegalRetrieval:false,requiresLegalRetrieval:true,reason,confidence:'HIGH'};
    if(SOCIAL.has(text)) return {intent:INTENTS.SOCIAL,bypassLegalRetrieval:true,requiresLegalRetrieval:false,reason:'standalone_social',confidence:'HIGH'};
    const intentText=stripConversationalFillers(text);
    if(intentText&&SOCIAL.has(intentText)) return {intent:INTENTS.SOCIAL,bypassLegalRetrieval:true,requiresLegalRetrieval:false,reason:'standalone_social_with_filler',confidence:'HIGH'};
    if(CAPABILITY_PATTERNS.some(pattern=>pattern.test(intentText))) return {intent:INTENTS.CAPABILITY,bypassLegalRetrieval:true,requiresLegalRetrieval:false,reason:'standalone_capability',confidence:'HIGH'};
    const rule=NON_LEGAL_RULES.find(candidate=>candidate.test(intentText||text));
    if(rule) return {intent:INTENTS.NON_LEGAL,bypassLegalRetrieval:true,requiresLegalRetrieval:false,reason:rule.reason,confidence:'HIGH'};
    return {intent:INTENTS.CLARIFICATION,bypassLegalRetrieval:true,requiresLegalRetrieval:false,reason:'insufficient_legal_evidence',confidence:'LOW'};
}

function getBypassResponse(intent,message='') {
    const normalized=normalizeMessage(message); const text=stripConversationalFillers(normalized)||normalized;
    if(intent===INTENTS.NON_LEGAL&&/^(?:(?:toi|minh) )?(?:buon|chan|met)(?: (?:qua|ghe))?$/u.test(text)) return 'Mình rất tiếc khi nghe vậy. Nếu bạn muốn, bạn có thể chia sẻ thêm một chút nhé.';
    if(intent!==INTENTS.SOCIAL) return RESPONSES[intent]||'';
    if(['cam on','thanks','thank you'].includes(text)) return 'Rất vui được hỗ trợ bạn. Khi cần tra cứu hoặc tư vấn vấn đề pháp lý, bạn cứ gửi câu hỏi cho tôi.';
    if(['bye','goodbye','tam biet','hen gap lai'].includes(text)) return 'Tạm biệt bạn! Khi cần hỗ trợ tra cứu pháp luật, LegAI luôn sẵn sàng.';
    if(['haha','hahaha','hehe','huhu','ok','oke','okay','u','uh','vang','duoc roi','hieu roi','ua','o','e'].includes(text)) return 'Tôi luôn sẵn sàng hỗ trợ khi bạn có câu hỏi pháp lý.';
    return RESPONSES.SOCIAL;
}

module.exports={INTENTS,LEGAL_SIGNAL_GROUPS,classifyChatIntent,getBypassResponse,normalizeMessage,stripConversationalFillers,hasLegalVeto,findLegalEvidence};
