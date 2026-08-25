const test = require('node:test');
const assert = require('node:assert/strict');

const { retrieveForIssues, extractLegalTarget, documentSatisfiesIssueCoverage } = require('../src/services/multiQueryRagService');
const { analyzeQuery } = require('../src/services/queryDecompositionService');

const issues = [
    { id: 'Q1', query: 'nghỉ việc không báo trước' },
    { id: 'Q2', query: 'công ty nợ lương' },
    { id: 'Q3', query: 'nghĩa vụ theo thỏa thuận bảo mật' }
];

function passThroughSelector(_query, docs) {
    return {
        selectedDocs: docs,
        scores: docs.map(doc => ({ id: doc.id, finalScore: doc.score })),
        fallbackAll: true,
        reason: 'test'
    };
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('controlled retrieval never exceeds two active issues and preserves decomposition order', async () => {
    const scheduledIssues = [
        { id: 'Q1', query: 'one', delayMs: 120 },
        { id: 'Q2', query: 'two', delayMs: 20 },
        { id: 'Q3', query: 'three', delayMs: 80 },
        { id: 'Q4', query: 'four', delayMs: 10 },
        { id: 'Q5', query: 'five', delayMs: 30 },
        { id: 'Q6', query: 'six', delayMs: 5 }
    ];
    let active = 0;
    let maxActive = 0;
    const completionOrder = [];
    const result = await retrieveForIssues(scheduledIssues, {
        ragService: { query: async query => {
            const issue = scheduledIssues.find(item => item.query === query);
            active += 1;
            maxActive = Math.max(maxActive, active);
            await delay(issue.delayMs);
            completionOrder.push(issue.id);
            active -= 1;
            return [{ id: `doc-${issue.id}`, score: 1 }];
        } },
        selectRagChunks: passThroughSelector
    });

    assert.equal(maxActive, 2);
    assert.notDeepEqual(completionOrder, scheduledIssues.map(issue => issue.id));
    assert.deepEqual(result.documents.map(doc => doc.id), scheduledIssues.map(issue => `doc-${issue.id}`));
    assert.deepEqual(result.documents.map(doc => doc.supportedIssueIds), scheduledIssues.map(issue => [issue.id]));
});

test('one issue uses one retrieval chain', async () => {
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const result = await retrieveForIssues([{ id: 'Q1', query: 'one' }], {
        ragService: { query: async () => { calls += 1; active += 1; maxActive = Math.max(maxActive, active); await delay(5); active -= 1; return [{ id: 'one', score: 1 }]; } },
        selectRagChunks: passThroughSelector
    });
    assert.equal(calls, 1);
    assert.equal(maxActive, 1);
    assert.deepEqual(result.documents.map(doc => doc.id), ['one']);
});

test('concurrency two executes three issues in two waves', async () => {
    const starts = [];
    let releaseFirstWave;
    const firstWave = new Promise(resolve => { releaseFirstWave = resolve; });
    const threeIssues = [{ id:'Q1',query:'one' },{ id:'Q2',query:'two' },{ id:'Q3',query:'three' }];
    const pending = retrieveForIssues(threeIssues, {
        ragService: { query: async query => { starts.push(query); if (query !== 'three') await firstWave; return [{ id: query, score: 1 }]; } },
        selectRagChunks: passThroughSelector
    });
    await delay(10);
    assert.deepEqual(starts, ['one', 'two']);
    releaseFirstWave();
    const result = await pending;
    assert.deepEqual(starts, ['one', 'two', 'three']);
    assert.deepEqual(result.documents.map(doc => doc.id), ['one', 'two', 'three']);
});

test('parallel and sequential fixture execution are behavior-equivalent', async () => {
    const fixtureIssues = [{ id:'Q1',query:'one' },{ id:'Q2',query:'two' },{ id:'Q3',query:'three' },{ id:'Q4',query:'four' }];
    const fixtures = {
        one: [{ id:'shared',score:.9 },{ id:'one',score:.8 }],
        two: [{ id:'two',score:.95 },{ id:'shared',score:.9 }],
        three: [],
        four: [{ id:'four',score:.7 }]
    };
    const execute = concurrency => retrieveForIssues(fixtureIssues, {
        concurrency,
        cap: 6,
        ragService: { query: async query => { await delay({ one:20,two:5,three:10,four:1 }[query]); return fixtures[query]; } },
        selectRagChunks: passThroughSelector
    });
    const [sequential, parallel] = await Promise.all([execute(1), execute(2)]);
    assert.deepEqual(parallel, sequential);
});

test('first issue and selector failures remain isolated under concurrency', async () => {
    const failureIssues = [{ id:'Q1',query:'fail-retrieval' },{ id:'Q2',query:'fail-selector' },{ id:'Q3',query:'ok' }];
    const result = await retrieveForIssues(failureIssues, {
        ragService: { query: async query => {
            if (query === 'fail-retrieval') throw new Error('fixture retrieval failure');
            return [{ id: query, score: 1 }];
        } },
        selectRagChunks: (query, docs) => {
            if (query === 'fail-selector') throw new Error('fixture selector failure');
            return passThroughSelector(query, docs);
        }
    });
    assert.equal(result.failedIssueCount, 2);
    assert.equal(result.successfulIssueCount, 1);
    assert.deepEqual(result.documents.map(doc => doc.id), ['ok']);
    assert.deepEqual(result.coverageCounts, { Q1:0, Q2:0, Q3:1 });
});

test('complex regression decomposes into multiple legal issues', async () => {
    const question = 'Người lao động nghỉ việc không báo trước, công ty còn nợ lương và người lao động đã ký thỏa thuận bảo mật thì quyền và nghĩa vụ của các bên thế nào?';
    const result = await analyzeQuery(question, {
        generate: async () => ({
            isComplex: true,
            issueCount: 3,
            issues
        })
    });
    assert.equal(result.isComplex, true);
    assert.equal(result.issues.length, 3);
});

test('simple regression stays on the no-fan-out decomposition result', async () => {
    const result = await analyzeQuery('Theo Luật Điện ảnh, những hoạt động nào được xem là hoạt động điện ảnh?', {
        generate: async () => { throw new Error('decomposition model must not be called'); }
    });
    assert.equal(result.isComplex, false);
    assert.deepEqual(result.issues, []);
});

test('queries every complex issue, deduplicates stable chunks, and preserves issue coverage', async () => {
    const calls = [];
    const shared = { id: 'shared', doc_id: 'law-1', content: 'shared', score: 0.95, sourceUrl: 'https://vbpl.vn/detail' };
    const result = await retrieveForIssues(issues, {
        cap: 3,
        ragService: {
            query: async query => {
                calls.push(query);
                const index = calls.length;
                return [shared, { id: `unique-${index}`, doc_id: `law-${index + 1}`, content: query, score: 0.9 - index / 100 }];
            }
        },
        selectRagChunks: passThroughSelector
    });

    assert.deepEqual(calls, issues.map(issue => issue.query));
    assert.equal(result.documents.length, 3);
    const mergedShared = result.documents.find(doc => doc.id === 'shared');
    assert.deepEqual(mergedShared.supportedIssueIds, ['Q1', 'Q2', 'Q3']);
    for (const issue of issues) {
        assert.ok(result.documents.some(doc => doc.supportedIssueIds.includes(issue.id)));
    }
});

test('isolates one issue retrieval failure and merges the remaining issues', async () => {
    let callCount = 0;
    const result = await retrieveForIssues(issues, {
        ragService: {
            query: async query => {
                callCount += 1;
                if (query === issues[1].query) throw new Error('simulated Pinecone failure');
                return [{ id: `chunk-${callCount}`, content: query, score: 0.8 }];
            }
        },
        selectRagChunks: passThroughSelector
    });

    assert.equal(callCount, 3);
    assert.equal(result.failedIssueCount, 1);
    assert.equal(result.successfulIssueCount, 2);
    assert.deepEqual(result.documents.flatMap(doc => doc.supportedIssueIds), ['Q1', 'Q3']);
});

test('all Phase 3B issue retrieval failures produce an empty merge without per-issue fallback', async () => {
    let retrievalCalls = 0;
    let perIssueGroundingCalls = 0;
    const result = await retrieveForIssues(issues, {
        ragService: {
            query: async () => {
                retrievalCalls += 1;
                throw new Error('embedding quota exhausted');
            },
            ground: async () => {
                perIssueGroundingCalls += 1;
            }
        },
        selectRagChunks: passThroughSelector
    });

    assert.equal(retrievalCalls, 3);
    assert.equal(result.documents.length, 0);
    assert.equal(result.failedIssueCount, 3);
    assert.equal(perIssueGroundingCalls, 0);
});

test('explicit law year prefers matching-version evidence from Top 5', async () => {
    const target = extractLegalTarget('Theo Luật An ninh mạng 2025, các bên có nghĩa vụ gì?');
    const oldDoc = { id: 'old', title: 'Luật An ninh mạng 2018', content: 'bản cũ', score: 0.99 };
    const targetDoc = { id: 'target', title: 'Luật An ninh mạng 2025', content: 'bản yêu cầu', score: 0.9 };
    const result = await retrieveForIssues([issues[0]], {
        target,
        ragService: { query: async () => [oldDoc, targetDoc] },
        selectRagChunks: passThroughSelector
    });
    assert.deepEqual(result.documents.map(doc => doc.id), ['target']);
    assert.equal(result.targetVersionSatisfied, true);
});

test('explicit document number wins over an older same-name law', async () => {
    const target = extractLegalTarget('Theo Luật An ninh mạng số 116/2025/QH15, quy định ra sao?');
    const result = await retrieveForIssues([issues[0]], {
        target,
        ragService: { query: async () => [
            { id: 'old', title: 'Luật An ninh mạng 2018', score: 0.99 },
            { id: 'numbered', title: 'Luật An ninh mạng', lawNumber: '116/2025/QH15', score: 0.85 }
        ] },
        selectRagChunks: passThroughSelector
    });
    assert.deepEqual(result.documents.map(doc => doc.id), ['numbered']);
});

test('target version must be satisfied for every required issue', async () => {
    const target = extractLegalTarget('Theo Luật An ninh mạng 2025, xử lý Q1 và Q2 thế nào?');
    let call = 0;
    const result = await retrieveForIssues(issues.slice(0, 2), {
        target,
        ragService: { query: async () => ++call === 1
            ? [{ id: 'target-q1', title: 'Luật An ninh mạng 2025', score: 0.9 }]
            : [{ id: 'old-q2', title: 'Luật An ninh mạng 2018', score: 0.9 }] },
        selectRagChunks: passThroughSelector
    });
    assert.equal(result.coverageComplete, false);
    assert.deepEqual(result.coverageCounts, { Q1: 1, Q2: 0 });
    assert.equal(result.targetVersionSatisfied, false);
});

test('matching explicit document target still satisfies coverage', () => {
    const issue = { id: 'Q1', query: 'Theo Luật 116/2025/QH15, quy định ra sao?' };
    const doc = { title: 'Luật An ninh mạng số 116/2025/QH15', supportedIssueIds: ['Q1'] };
    assert.equal(documentSatisfiesIssueCoverage(doc, issue, null, issue.query), true);
});

test('exact document number takes precedence over comparison-derived target name', () => {
    const issue = { id:'Q1',query:'So sánh luật cũ với Luật Phòng cháy, chữa cháy số 55/2024/QH15' };
    const doc = { title:'Luật Phòng cháy, chữa cháy và cứu nạn, cứu hộ số 55/2024/QH15',supportedIssueIds:['Q1'] };
    assert.equal(documentSatisfiesIssueCoverage(doc,issue,null,issue.query),true);
});

test('mismatching explicit document target does not satisfy coverage', () => {
    const issue = { id: 'Q1', query: 'Theo Luật 116/2025/QH15, quy định ra sao?' };
    const doc = { title: 'Luật An ninh mạng số 24/2018/QH14', supportedIssueIds: ['Q1'] };
    assert.equal(documentSatisfiesIssueCoverage(doc, issue, null, issue.query), false);
});

test('no explicit target preserves tag-based baseline coverage', () => {
    const issue = { id: 'Q1', query: 'người lao động có quyền gì?' };
    const doc = { title: 'Văn bản lân cận', supportedIssueIds: ['Q1'] };
    assert.equal(documentSatisfiesIssueCoverage(doc, issue, null, issue.query), true);
});

test('CASE_039 shape rejects unrelated evidence for nonexistent requested number', async () => {
    const issue = { id: 'Q1', query: 'Văn bản số 999/2099/QH99 quy định gì?' };
    const result = await retrieveForIssues([issue], {
        statusQuery: issue.query,
        target: extractLegalTarget(issue.query),
        ragService: { query: async () => [{ id: 'wrong', title: 'Luật số 64/2025/QH15', score: 0.9 }] },
        selectRagChunks: passThroughSelector
    });
    assert.deepEqual(result.coverageCounts, { Q1: 0 });
    assert.equal(result.coverageComplete, false);
});

test('CASE_019 comparison applies exact targets per issue', () => {
    const q1 = { id: 'Q1', query: 'Phạm vi Luật Chứng khoán 54/2019/QH14' };
    const q2 = { id: 'Q2', query: 'Phạm vi Luật sửa đổi 62/2010/QH12' };
    const law2019 = { title: 'Luật Chứng khoán số 54/2019/QH14', supportedIssueIds: ['Q1','Q2'] };
    const law2010 = { title: 'Luật sửa đổi số 62/2010/QH12', supportedIssueIds: ['Q2'] };
    assert.equal(documentSatisfiesIssueCoverage(law2019, q1, null, ''), true);
    assert.equal(documentSatisfiesIssueCoverage(law2019, q2, null, ''), false);
    assert.equal(documentSatisfiesIssueCoverage(law2010, q2, null, ''), true);
});

test('a chunk mentioning another law number does not acquire that document identity', () => {
    const issue={id:'Q2',query:'Phạm vi Luật sửa đổi 62/2010/QH12'};
    const doc={id:'54-2019-qh14_chunk_179',title:'Luật Chứng khoán số 54/2019/QH14',content:'Luật 62/2010/QH12 hết hiệu lực',supportedIssueIds:['Q2']};
    assert.equal(documentSatisfiesIssueCoverage(doc,issue,null,issue.query),false);
});

test('explicit expired historical target remains eligible and target-compatible', async () => {
    const issue = { id: 'Q1', query: 'Năm 2012, Luật 12/2012/QH13 quy định gì?' };
    const result = await retrieveForIssues([issue], {
        target: extractLegalTarget(issue.query), statusQuery: issue.query,
        ragService: { query: async () => [{ id:'old',title:'Luật số 12/2012/QH13',status:'Hết hiệu lực',score:.8 }] },
        selectRagChunks: passThroughSelector
    });
    assert.equal(result.coverageComplete, true);
});

test('partial-effect evidence remains covered without an explicit target', async () => {
    const issue = { id:'Q1',query:'phần còn hiệu lực được áp dụng thế nào?' };
    const result = await retrieveForIssues([issue], {statusQuery:issue.query,ragService:{query:async()=>[{id:'partial',status:'Hết hiệu lực một phần',score:.8}]},selectRagChunks:passThroughSelector});
    assert.equal(result.coverageComplete,true);
});

test('partial complex coverage is explicitly incomplete', async () => {
    const result = await retrieveForIssues(issues, {
        ragService: { query: async query => query.includes('công ty') ? [{ id: 'q2', content: query, score: 0.8 }] : [] },
        selectRagChunks: passThroughSelector
    });
    assert.deepEqual(result.coverageCounts, { Q1: 0, Q2: 1, Q3: 0 });
    assert.equal(result.coverageComplete, false);
});

test('complete complex coverage preserves normal sufficiency eligibility', async () => {
    let index = 0;
    const result = await retrieveForIssues(issues, {
        ragService: { query: async query => [{ id: `doc-${++index}`, content: query, score: 0.8 }] },
        selectRagChunks: passThroughSelector
    });
    assert.equal(result.coverageComplete, true);
});

test('a law name without explicit year or number does not force a version target', () => {
    assert.equal(extractLegalTarget('Luật An ninh mạng quy định thế nào?'), null);
});

test('Phase 3B applies status eligibility before the unchanged selector and preserves coverage', async () => {
    let selectorInput;
    const result = await retrieveForIssues([issues[0]], {
        statusQuery: 'Hiện nay quy định thế nào?',
        ragService: { query: async () => [
            { id: 'expired', status: 'Hết hiệu lực', score: 0.99 },
            { id: 'effective', status: 'Còn hiệu lực', score: 0.8 }
        ] },
        selectRagChunks: (_query, docs) => {
            selectorInput = docs;
            return passThroughSelector(_query, docs);
        }
    });
    assert.deepEqual(selectorInput.map(doc => doc.id), ['effective']);
    assert.deepEqual(result.documents.map(doc => doc.id), ['effective']);
    assert.equal(result.coverageComplete, true);
});
