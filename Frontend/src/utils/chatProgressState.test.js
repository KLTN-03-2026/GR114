import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyProgressEvent, applyStreamChunk, applyStreamComplete, applyStreamError, applyStreamStart,
    finalizeProgressMessage, setProgressConnectionState
} from './chatProgressState.js';

const requestId = '02cb92cc-49c6-4d1b-97bf-5f5151068165';
const pending = () => [{ id: `ai-${requestId}`, requestId, isBot: true, state: 'progress', progress: [], lastSeq: 0 }];

test('unknown requests and stale sequence numbers are ignored', () => {
    const initial = pending();
    assert.equal(applyProgressEvent(initial, { requestId: 'unknown', seq: 1, stage: 'ANALYZING', status: 'started' }), initial);
    const once = applyProgressEvent(initial, { requestId, seq: 2, stage: 'ANALYZING', status: 'started' });
    assert.equal(applyProgressEvent(once, { requestId, seq: 2, stage: 'RAG_SEARCH', status: 'started' }), once);
    assert.equal(applyProgressEvent(once, { requestId, seq: 1, stage: 'RAG_SEARCH', status: 'started' }), once);
});

test('stage updates replace their earlier status without duplicating rows', () => {
    const started = applyProgressEvent(pending(), { requestId, seq: 1, stage: 'RAG_SEARCH', status: 'started', message: 'searching' });
    const completed = applyProgressEvent(started, { requestId, seq: 2, stage: 'RAG_SEARCH', status: 'completed', message: 'done' });
    assert.equal(completed[0].progress.length, 1);
    assert.equal(completed[0].progress[0].status, 'completed');
});

test('terminal progress blocks late socket events', () => {
    const terminal = applyProgressEvent(pending(), { requestId, seq: 4, stage: 'COMPLETE', status: 'completed' });
    assert.equal(applyProgressEvent(terminal, { requestId, seq: 5, stage: 'RAG_SEARCH', status: 'completed' }), terminal);
});

test('terminal ERROR becomes a safe assistant error state', () => {
    const terminal = applyProgressEvent(pending(), { requestId, seq: 4, stage: 'ERROR', status: 'completed', message: 'Không thể hoàn tất yêu cầu.' });
    assert.equal(terminal[0].state, 'error');
    assert.equal(terminal[0].text, 'Không thể hoàn tất yêu cầu.');
});

test('HTTP finalization updates one pending bubble and is idempotent', () => {
    const result = { answer: 'Final', citations: [{ lawName: 'Law' }], sources: [{ title: 'Law' }] };
    const finalized = finalizeProgressMessage(pending(), requestId, result);
    assert.equal(finalized.length, 1);
    assert.equal(finalized[0].state, 'complete');
    assert.equal(finalized[0].text, 'Final');
    assert.equal(finalizeProgressMessage(finalized, requestId, result), finalized);
});

test('HTTP finalization still succeeds after socket COMPLETE', () => {
    const socketComplete = applyProgressEvent(pending(), { requestId, seq: 9, stage: 'COMPLETE', status: 'completed' });
    const finalized = finalizeProgressMessage(socketComplete, requestId, { answer: 'Canonical HTTP answer' });
    assert.equal(finalized[0].state, 'complete');
    assert.equal(finalized[0].text, 'Canonical HTTP answer');
});

test('socket disconnect degrades only pending progress and HTTP still finalizes it', () => {
    const disconnected = setProgressConnectionState(pending(), true);
    assert.equal(disconnected[0].connectionDegraded, true);
    const finalized = finalizeProgressMessage(disconnected, requestId, { answer: 'HTTP survived disconnect' });
    assert.equal(finalized[0].state, 'complete');
    assert.equal(finalized[0].connectionDegraded, false);
});

test('stream transitions one pending bubble and appends ordered chunks', () => {
    const started = applyStreamStart(pending(), { requestId, seq: 1 });
    const first = applyStreamChunk(started, { requestId, seq: 2, chunkId: 1, delta: 'Theo ' });
    const second = applyStreamChunk(first, { requestId, seq: 3, chunkId: 2, delta: 'Điều 1' });
    assert.equal(second.length, 1);
    assert.equal(second[0].state, 'streaming');
    assert.equal(second[0].text, 'Theo Điều 1');
    assert.equal(second[0].progress.length, 0);
});

test('duplicate and out-of-order chunks are ignored', () => {
    const started = applyStreamStart(pending(), { requestId, seq: 1 });
    const accepted = applyStreamChunk(started, { requestId, seq: 3, chunkId: 7, delta: 'A' });
    assert.equal(applyStreamChunk(accepted, { requestId, seq: 4, chunkId: 7, delta: 'duplicate' }), accepted);
    assert.equal(applyStreamChunk(accepted, { requestId, seq: 2, chunkId: 8, delta: 'stale' }), accepted);
});

test('citations remain absent during chunks and attach only on stream complete', () => {
    const started = applyStreamStart(pending(), { requestId, seq: 1 });
    const chunked = applyStreamChunk(started, { requestId, seq: 2, chunkId: 1, delta: 'Draft' });
    assert.equal(chunked[0].citations, undefined);
    const complete = applyStreamComplete(chunked, { requestId, seq: 3, answer: 'Canonical', citations: [{ lawName: 'Law' }], sources: [{ title: 'Law' }] });
    assert.equal(complete[0].text, 'Canonical');
    assert.equal(complete[0].citations.length, 1);
});

test('HTTP canonical answer wins after differing streamed completion', () => {
    const streamed = applyStreamComplete(applyStreamStart(pending(), { requestId, seq: 1 }), { requestId, seq: 2, answer: 'Socket draft' });
    const http = finalizeProgressMessage(streamed, requestId, { answer: 'Canonical HTTP', citations: [], sources: [] });
    assert.equal(http[0].text, 'Canonical HTTP');
    assert.equal(http[0].state, 'complete');
    assert.equal(http[0].progressSummary, '');
});

test('stream start and stream completion leave no permanent completion label', () => {
    const started = applyStreamStart(pending(), { requestId, seq: 1 });
    assert.equal(started[0].progressSummary, '');
    const completed = applyStreamComplete(started, {
        requestId,
        seq: 2,
        answer: 'Canonical streamed answer',
        citations: [],
        sources: []
    });
    assert.equal(completed[0].progressSummary, '');
    assert.equal(completed[0].text, 'Canonical streamed answer');
    assert.deepEqual(completed[0].progress, []);
});

test('deterministic intent bypass finalizes without a completion label', () => {
    const finalized = finalizeProgressMessage(pending(), requestId, {
        answer: 'Chào bạn!',
        citations: [],
        sources: [],
        retrievalBypassed: true
    });
    assert.equal(finalized[0].state, 'complete');
    assert.equal(finalized[0].progressSummary, '');
});

test('recoverable stream error preserves text for HTTP fallback', () => {
    const chunked = applyStreamChunk(applyStreamStart(pending(), { requestId, seq: 1 }), { requestId, seq: 2, chunkId: 1, delta: 'Partial' });
    const degraded = applyStreamError(chunked, { requestId, seq: 3, recoverable: true, message: 'Realtime unavailable' });
    assert.equal(degraded[0].text, 'Partial');
    assert.equal(degraded[0].connectionDegraded, true);
    assert.equal(finalizeProgressMessage(degraded, requestId, { answer: 'HTTP final' })[0].text, 'HTTP final');
});
