const DEFAULT_MAX_CHARS = 1500;

const CHAPTER_HEADING = /^\s*(Chương\s+(?:[IVXLCDM]+|\d+)(?:\s*[:.\-–—]?\s*.*)?)\s*$/iu;
const ARTICLE_HEADING = /^\s*(Điều\s+(\d+[a-zA-ZđĐ]?))(?:\s*([.:\-–—])?\s*(.*))?\s*$/iu;
const STRUCTURAL_HEADING = /^\s*(?:Chương|Điều|Mục|Phần)\b/iu;
const CLAUSE_START = /^\s*(?:\d+[.)]|[a-zđ][.)])\s+/iu;

function normalizeInput(content) {
    return String(content || '').normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

function normalizeLabel(value, fallback = 'Unknown') {
    const normalized = String(value || '').replace(/\s+/gu, ' ').trim();
    return normalized || fallback;
}

function isSafeLineBrokenTitle(lines, headingIndex) {
    for (let index = headingIndex + 1; index < lines.length; index += 1) {
        const candidate = lines[index].trim();
        if (!candidate) continue;
        if (candidate.length > 300 || STRUCTURAL_HEADING.test(candidate) || CLAUSE_START.test(candidate)) return '';
        return candidate;
    }
    return '';
}

function splitSection(text, maxChars) {
    const source = String(text || '').trim();
    if (!source) return [];
    if (source.length <= maxChars) return [source];

    const parts = [];
    let offset = 0;
    while (offset < source.length) {
        let end = Math.min(source.length, offset + maxChars);
        if (end < source.length) {
            const candidate = source.slice(offset, end);
            const boundary = Math.max(candidate.lastIndexOf('\n'), candidate.lastIndexOf(' '));
            if (boundary >= Math.floor(maxChars * 0.6)) end = offset + boundary;
        }
        const part = source.slice(offset, end).trim();
        if (part) parts.push(part);
        offset = end;
        while (offset < source.length && /\s/u.test(source[offset])) offset += 1;
    }
    return parts;
}

function chunkLegalArticles(content, options = {}) {
    const source = normalizeInput(content);
    if (!source) return [];
    const maxChars = Number(options.maxChars) > 0 ? Number(options.maxChars) : DEFAULT_MAX_CHARS;
    const lines = source.split('\n');
    const sections = [];
    let currentChapter = 'Unknown';
    let section = { lines: [], chuong: currentChapter, dieu: 'Unknown', articleTitle: '' };

    const flush = () => {
        const text = section.lines.join('\n').trim();
        if (text) sections.push({ ...section, text });
    };

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const chapterMatch = line.match(CHAPTER_HEADING);
        if (chapterMatch) {
            currentChapter = normalizeLabel(chapterMatch[1]);
            section.lines.push(line);
            if (section.dieu === 'Unknown') section.chuong = currentChapter;
            continue;
        }

        const articleMatch = line.match(ARTICLE_HEADING);
        if (articleMatch) {
            flush();
            const articleLabel = `Điều ${articleMatch[2]}`;
            const inlineTitle = normalizeLabel(articleMatch[4], '');
            section = {
                lines: [line],
                chuong: currentChapter,
                dieu: articleLabel,
                articleTitle: inlineTitle || isSafeLineBrokenTitle(lines, index)
            };
            continue;
        }
        section.lines.push(line);
    }
    flush();

    return sections.flatMap(item => splitSection(item.text, maxChars).map(text => ({
        text,
        chuong: item.chuong,
        dieu: item.dieu,
        articleTitle: item.articleTitle
    })));
}

module.exports = {
    DEFAULT_MAX_CHARS,
    chunkLegalArticles,
    _test: { ARTICLE_HEADING, CHAPTER_HEADING, splitSection }
};
