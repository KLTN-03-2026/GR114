function chunkText(text = '', chunkSize = 1500, overlap = 200) {
    if (!text || typeof text !== 'string') return [];
    if (text.length <= chunkSize) return [text.trim()];

    const chunks = [];
    let start = 0;

    while (start < text.length) {
        let end = start + chunkSize;

        if (end < text.length) {
            const slice = text.slice(start, end);
            const delimiters = ['. ', '; ', '\n', '。', '؟'];
            let bestPos = -1;

            for (const delimiter of delimiters) {
                const pos = slice.lastIndexOf(delimiter);
                if (pos > bestPos) {
                    bestPos = pos;
                }
            }

            if (bestPos > Math.floor(chunkSize * 0.5)) {
                end = start + bestPos + 1;
            }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        start = end - overlap;
        if (start < 0) start = 0;
    }

    return chunks.filter(chunk => chunk.length >= 50);
}

module.exports = { chunkText };