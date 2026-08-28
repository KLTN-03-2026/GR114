import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGAL_SECTION_HEADINGS, isExactLegalSectionHeading, splitLegalHeadingLines } from './legalAnswerHeadings.js';

test('only the four exact standalone legal section labels are headings', () => {
    assert.equal(LEGAL_SECTION_HEADINGS.length, 4);
    for (const heading of LEGAL_SECTION_HEADINGS) assert.equal(isExactLegalSectionHeading(heading), true);
    assert.equal(isExactLegalSectionHeading('Chưa đủ căn cứ để kết luận chắc chắn.'), false);
    assert.equal(isExactLegalSectionHeading('Nội dung phân tích vụ việc.'), false);
    assert.equal(isExactLegalSectionHeading('Kết luận'), false);
});

test('line splitting preserves prose, links, lists and plain heading text without markdown markers', () => {
    const input = 'Kết luận:\nChưa đủ căn cứ để kết luận chắc chắn.\n\nPhân tích:\n- Xem [nguồn](https://vbpl.vn/)';
    const lines = splitLegalHeadingLines(input);
    assert.deepEqual(lines.filter(line => line.heading).map(line => line.text), ['Kết luận:', 'Phân tích:']);
    assert.equal(lines.map(line => line.text).join('\n'), input);
    assert.equal(input.includes('**'), false);
});

test('chat renderer does not inject markdown heading markers or restore broad prose matching', async () => {
    const source = await import('node:fs').then(fs => fs.readFileSync(new URL('../components/ChatbotAI.jsx', import.meta.url), 'utf8'));
    assert.doesNotMatch(source, /\*\*(?:Kết luận|Phân tích|Cơ sở pháp lý|Lời khuyên):\*\*/u);
    assert.doesNotMatch(source, /titles\.forEach|new RegExp\([^\n]*(?:Kết luận|Phân tích)/u);
    assert.match(source, /line\.heading \? <strong className="font-bold">/u);
});
