export const LEGAL_SECTION_HEADINGS = Object.freeze([
    'Kết luận:',
    'Phân tích:',
    'Cơ sở pháp lý:',
    'Lời khuyên:'
]);

export function isExactLegalSectionHeading(value) {
    return LEGAL_SECTION_HEADINGS.includes(String(value || '').trim());
}

export function splitLegalHeadingLines(value) {
    return String(value ?? '').split('\n').map(text => ({ text, heading: isExactLegalSectionHeading(text) }));
}
