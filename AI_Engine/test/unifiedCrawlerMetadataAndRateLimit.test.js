const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { normalizeCrawlerMetadata } = require('../src/services/legalCrawlerMetadataService');
const {
    createRollingItemLimiter,
    embedChunkBatches,
    getRetryAfterMs
} = require('../src/services/legalEmbeddingBatchService');
const { resolveIssueDatePersistence } = require('../src/constants/legalMetadata');
const { classifyLegalDocumentChange, requiresPineconeResync } = require('../src/services/legalDocumentChangeService');

const root = path.join(__dirname, '..');
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('VBPL structured metadata maps through the normalized contract', () => {
    const metadata = normalizeCrawlerMetadata({
        structuredPayloads: [JSON.stringify({ payload: {
            docNum: '101/2015/QH13', title: 'Bộ luật Hình sự', issueDate: '27/11/2015',
            effFrom: '01/01/2018', effTo: null,
            effStatus: { name: 'Hết hiệu lực một phần' },
            agencyName: 'Quốc hội', organization: { name: 'Không được sử dụng' },
            docType: { name: 'Bộ luật' }, documentContent: { content: '$2' }
        } })]
    });
    assert.deepEqual(metadata, {
        documentNumber: '101/2015/QH13', title: 'Bộ luật Hình sự',
        issueDate: '2015-11-27', issueDateString: '27/11/2015',
        effectiveDate: '2018-01-01', expirationDate: null,
        status: 'Hết hiệu lực một phần', agency: 'Quốc hội', documentType: 'Bộ luật'
    });
});

test('VBPL stable DOM fallback maps status/effective date without promoting update date', () => {
    const metadata = normalizeCrawlerMetadata({
        dom: {
            statusText: 'Hết hiệu lực một phần',
            dateItems: [
                { label: 'Ngày có hiệu lực', value: '01/01/2018' },
                { label: 'Ngày cập nhật', value: '08/05/2026' }
            ]
        },
        legacy: { title: 'Bộ luật mẫu', agency: 'Quốc hội', bodyText: 'Ngày cập nhật: 08/05/2026\nĐiều 1. Nội dung' }
    });
    assert.equal(metadata.issueDate, null);
    assert.equal(metadata.effectiveDate, '2018-01-01');
    assert.equal(metadata.status, 'Hết hiệu lực một phần');
});

test('TVPL legacy extraction remains the final normalized fallback', () => {
    const metadata = normalizeCrawlerMetadata({ legacy: {
        title: 'Luật mẫu số 12/2020/QH14', agency: 'QUỐC HỘI',
        rightHeaderText: 'Hà Nội, ngày 17 tháng 6 năm 2020',
        effectiveDateText: '01/01/2021', statusText: 'Còn hiệu lực'
    } });
    assert.equal(metadata.title, 'Luật mẫu số 12/2020/QH14');
    assert.equal(metadata.agency, 'QUỐC HỘI');
    assert.equal(metadata.issueDate, '2020-06-17');
    assert.equal(metadata.effectiveDate, '2021-01-01');
    assert.equal(metadata.status, 'Còn hiệu lực');
});

test('strong structured IssueDate corrects an existing wrong non-null value', () => {
    assert.deepEqual(resolveIssueDatePersistence(
        { issueDate: '2015-11-27', issueDateString: '27/11/2015' },
        { IssueDate: '2018-01-01', IssueDateString: 'Ngày có hiệu lực: 01/01/2018' }
    ), { issueDate: '2015-11-27', issueDateString: '27/11/2015' });
});

test('rolling limiter counts embedded content items across token batches', async () => {
    let clock = 0;
    const sleeps = [];
    const limiter = createRollingItemLimiter({
        itemLimit: 3, windowMs: 60000, now: () => clock,
        sleep: async milliseconds => { sleeps.push(milliseconds); clock += milliseconds; }
    });
    const chunks = Array.from({ length: 5 }, (_, index) => ({
        text: `Điều 10. Nội dung ${index}`, chuong: 'Chương I', dieu: 'Điều 10', articleTitle: 'Nội dung'
    }));
    const seen = [];
    await embedChunkBatches(chunks, async batch => {
        seen.push(...batch);
        return batch.map(() => [0.1]);
    }, { maxItemsPerBatch: 2, maxTokens: 7000, itemLimiter: limiter, maxRetries: 0 });
    assert.deepEqual(seen, chunks);
    assert.deepEqual(sleeps, [60000]);
});

test('429 structured RetryInfo delay is honored before bounded retry', async () => {
    const error = Object.assign(new Error('quota'), {
        status: 429,
        errorDetails: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '59s' }]
    });
    assert.equal(getRetryAfterMs(error), 59000);
    const sleeps = [];
    let calls = 0;
    const result = await embedChunkBatches([{ text: 'Điều 10', chuong: 'I', dieu: 'Điều 10', articleTitle: 'Mẫu' }], async () => {
        calls += 1;
        if (calls === 1) throw error;
        return [[0.1]];
    }, {
        itemLimiter: { acquire: async () => {} }, maxRetries: 1,
        sleep: async milliseconds => sleeps.push(milliseconds), random: () => 0
    });
    assert.deepEqual(result, [[0.1]]);
    assert.deepEqual(sleeps, [59000]);
});

test('failed Pinecone status permits same-row resync without NEW classification', () => {
    const stored = {
        Id: '101-2015-qh13', Title: 'Bộ luật Hình sự', DocumentNumber: '101/2015/QH13',
        Content: 'Điều 10. Nội dung', ContentHash: null,
        IssueDate: '2015-11-27', Status: 'Hết hiệu lực một phần', SyncStatusPinecone: 'failed'
    };
    const incoming = {
        title: stored.Title, documentNumber: stored.DocumentNumber, content: stored.Content,
        issueDate: '2015-11-28', status: stored.Status
    };
    const classification = classifyLegalDocumentChange(stored, incoming);
    assert.notEqual(classification.state, 'NEW');
    assert.equal(classification.state, 'METADATA_CHANGED');
    assert.equal(requiresPineconeResync(stored, classification), true);
    const service = source('src/services/legalDataService.js');
    assert.match(service, /SELECT Id, Title, DocumentNumber/u);
    assert.match(service, /if \(isNew\)[\s\S]*INSERT INTO dbo\.LegalDocuments[\s\S]*else \{/u);
    assert.match(service, /METADATA_CHANGED && !shouldResyncPinecone/u);
});

test('crawler remains one offline flow with stable selectors and 768 dimensions', () => {
    const crawler = source('src/services/crawlService.js');
    assert.match(crawler, /\[class\*="effStatus_detailStatusTag"\]/u);
    assert.match(crawler, /\[class\*="lawDocumentHeader_dateItem"\]/u);
    assert.match(crawler, /concurrency:\s*1/u);
    assert.match(crawler, /outputDimensionality:\s*768/u);
    assert.doesNotMatch(source('src/services/legalCrawlerMetadataService.js'), /puppeteer|axios|fetch\(|generateContent/u);
});
