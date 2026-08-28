const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const log = require('../src/utils/legalAiLogger');
const { retrieveForIssues } = require('../src/services/multiQueryRagService');

function capture(method, fn) {
    const original = console[method];
    const output = [];
    console[method] = (...args) => output.push(args.map(String).join(' '));
    return Promise.resolve().then(fn).then(
        value => ({ value, output: output.join('\n') }),
        error => { throw error; }
    ).finally(() => { console[method] = original; });
}

test('default logging excludes forbidden large and sensitive dumps', () => {
    const sources = [
        '../src/services/geminiService.js',
        '../src/services/ragService.js'
    ].map(file => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
    assert.doesNotMatch(sources, /=== RAG CONTEXT\s+VÀO AI ===/u);
    assert.doesNotMatch(sources, /=== FULL GEMINI RESPONSE ===/u);
    assert.doesNotMatch(sources, /PINECONE TOP-K|PINECONE -> GEMINI/u);
    assert.doesNotMatch(sources, /thoughtSignature/u);
    assert.doesNotMatch(sources, /console\.table/u);
});

test('info/debug/verbose levels gate diagnostics without changing values', async () => {
    const previous = process.env.LEGAL_AI_LOG_LEVEL;
    try {
        process.env.LEGAL_AI_LOG_LEVEL = 'info';
        const info = await capture('log', () => {
            log.line('GROUNDING', { success: true, latencyMs: 12, totalTokens: 34 });
            log.debug('DETAILS', { selectedIds: 'a,b' });
            log.verbose('CONTEXT METRICS', { chars: 99 });
            return 7;
        });
        assert.equal(info.value, 7);
        assert.match(info.output, /\[GROUNDING\][\s\S]*latencyMs=12[\s\S]*totalTokens=34/u);
        assert.doesNotMatch(info.output, /selectedIds|CONTEXT METRICS/u);

        process.env.LEGAL_AI_LOG_LEVEL = 'debug';
        const debug = await capture('log', () => { log.debug('DETAILS', { selectedIds: 'a,b' }); return 7; });
        assert.equal(debug.value, info.value);
        assert.match(debug.output, /selectedIds=a,b/u);

        process.env.LEGAL_AI_LOG_LEVEL = 'verbose';
        const verbose = await capture('log', () => { log.verbose('CONTEXT METRICS', { chars: 99 }); return 7; });
        assert.equal(verbose.value, info.value);
        assert.match(verbose.output, /chars=99/u);
    } finally {
        if (previous === undefined) delete process.env.LEGAL_AI_LOG_LEVEL;
        else process.env.LEGAL_AI_LOG_LEVEL = previous;
    }
});

test('multi-RAG emits one compact summary per issue and preserves behavior', async () => {
    const issues = [{ id: 'Q1', query: 'one' }, { id: 'Q2', query: 'two' }];
    const run = await capture('log', () => retrieveForIssues(issues, {
        ragService: { query: async query => [{ id: query || 'fallback', dieu:'Điều 10', content:'Bộ luật dân sự', score: 0.7 }] },
        rerankEvidence: async payload => ({issues:payload.map(row=>({issueId:row.issueId,coreSelection:null,supportingSelection:null,confidence:'LOW'}))})
    }));
    assert.equal((run.output.match(/\[RETRIEVAL QUERY\]/g) || []).length, 2);
    assert.equal((run.output.match(/\[ISSUE EVIDENCE STATE\]/g) || []).length, 2);
    assert.deepEqual(run.value.coverageCounts, { Q1:0, Q2:0 });
});

test('errors remain visible and benchmark artifacts retain detailed results', async () => {
    const errorOutput = await capture('error', () => { log.error('GROUNDING ERROR', { type: 'TIMEOUT', elapsedMs: 90 }); });
    assert.match(errorOutput.output, /\[GROUNDING ERROR\][\s\S]*type=TIMEOUT[\s\S]*elapsedMs=90/u);

    const runner = fs.readFileSync(path.join(__dirname, '../benchmark/chatbot/runner.js'), 'utf8');
    assert.match(runner, /JSON\.stringify\(run,null,2\)/u);
    assert.match(runner, /renderMarkdown\(run\)/u);
    assert.match(runner, /results/u);
});
