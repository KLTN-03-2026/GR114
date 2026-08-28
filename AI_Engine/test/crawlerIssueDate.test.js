const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    parseIssueDateString,
    extractIssueDateMetadata,
    resolveIssueDatePersistence
} = require('../src/constants/legalMetadata');
const { buildLegalVectorMetadata } = require('../src/services/legalIngestionContract');

const root = path.join(__dirname, '..');
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Vietnamese word dates normalize deterministically', () => {
    assert.equal(parseIssueDateString('Ngày 4 tháng 8 năm 2007'), '2007-08-04');
    assert.equal(parseIssueDateString('Hà Nội, ngày 27 tháng 11 năm 2015'), '2015-11-27');
});

test('explicit VBPL issue-date labels support slash and hyphen dates', () => {
    assert.deepEqual(extractIssueDateMetadata({
        explicitIssueDateTexts: ['Ngày ban hành: 27/11/2015'],
        rightHeaderText: 'Hà Nội, ngày 01 tháng 01 năm 2010'
    }), { raw: 'Ngày ban hành: 27/11/2015', iso: '2015-11-27' });
    assert.deepEqual(extractIssueDateMetadata({
        explicitIssueDateTexts: ['Ngày ký: 27-11-2015']
    }), { raw: 'Ngày ký: 27-11-2015', iso: '2015-11-27' });
});

test('effective, expiry, and update labels never establish IssueDate', () => {
    assert.equal(extractIssueDateMetadata({
        explicitIssueDateTexts: ['Ngày có hiệu lực: 01/01/2018', 'Ngày cập nhật: 08/05/2026'],
        bodyText: 'Ngày có hiệu lực: 01/01/2018\nNgày cập nhật: 08/05/2026'
    }), null);
    assert.equal(extractIssueDateMetadata({
        rightHeaderText: 'Ngày có hiệu lực\n01/01/2018\nNgày cập nhật\n2026-05-08',
        bodyText: 'Ngày hết hiệu lực\n01-01-2027'
    }), null);
});

test('body fallback stops before substantive legal content and cited-law dates', () => {
    assert.equal(extractIssueDateMetadata({
        bodyText: 'QUỐC HỘI\nLUẬT MẪU\nCăn cứ Luật ngày 20 tháng 6 năm 2012;\nĐiều 1. Nội dung'
    }), null);
    assert.equal(extractIssueDateMetadata({
        bodyText: 'QUỐC HỘI\nLUẬT MẪU\nĐiều 1. Văn bản viện dẫn ngày 20 tháng 6 năm 2012'
    }), null);
});

test('invalid calendar dates and incomplete dates return null', () => {
    assert.equal(parseIssueDateString('Ngày ban hành: 31/02/2015'), null);
    assert.equal(parseIssueDateString('Ngày 27 tháng 11'), null);
});

test('failed extraction preserves an existing SQL date and audit string', () => {
    assert.deepEqual(resolveIssueDatePersistence(
        { issueDate: null, issueDateString: '' },
        { IssueDate: '2015-11-27', IssueDateString: 'Hà Nội, ngày 27 tháng 11 năm 2015' }
    ), {
        issueDate: '2015-11-27',
        issueDateString: 'Hà Nội, ngày 27 tháng 11 năm 2015'
    });
});

test('successful issue date reaches canonical Pinecone metadata', () => {
    const extracted = extractIssueDateMetadata({ rightHeaderText: 'Hà Nội, ngày 27 tháng 11 năm 2015' });
    const metadata = buildLegalVectorMetadata({
        document: { doc_id: 'law-1', title: 'Luật mẫu', issueDate: extracted.iso },
        chunk: { text: 'Điều 10. Nội dung', dieu: 'Điều 10' },
        chunkIndex: 0
    });
    assert.equal(metadata.issueDate, '2015-11-27');
});

test('full legal dateline is accepted but generic bare date lines are not', () => {
    assert.deepEqual(extractIssueDateMetadata({
        bodyText: 'QUỐC HỘI\nHà Nội, ngày 27 tháng 11 năm 2015\nLUẬT MẪU\nĐiều 1. Nội dung'
    }), { raw: 'Hà Nội, ngày 27 tháng 11 năm 2015', iso: '2015-11-27' });
    assert.equal(extractIssueDateMetadata({ rightHeaderText: '27/11/2015\n2015-11-27' }), null);
});

test('crawler persistence remains parameterized and offline tests import no clients', () => {
    const persistence = source('src/services/legalDataService.js');
    assert.match(persistence, /\.input\('issueDate', sql\.Date, incoming\.issueDate\)/u);
    assert.match(persistence, /IssueDateString = @issueDateString/u);
    const localUtilities = source('src/constants/legalMetadata.js') + source('src/services/legalIngestionContract.js');
    assert.doesNotMatch(localUtilities, /puppeteer|@google\/generative-ai|@pinecone-database|axios|fetch\(/u);
});
