const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createAiProgressReporter,
    getChatRoom,
    isValidChatIdentifier
} = require('../src/utils/aiProgressReporter');

const TAB_A = 'd94f4e2a-7f7a-4f31-9c6c-df72fd338761';
const TAB_B = '21a5020f-dd8d-4727-a39b-1124fb2b8110';
const REQUEST = '02cb92cc-49c6-4d1b-97bf-5f5151068165';

function fakeIo() {
    const events = [];
    return {
        events,
        to(room) {
            return { emit: (name, payload) => events.push({ room, name, payload }) };
        }
    };
}

test('chat identifiers must be UUIDs and cannot inject arbitrary rooms', () => {
    assert.equal(isValidChatIdentifier(TAB_A), true);
    assert.equal(isValidChatIdentifier('../admin'), false);
    assert.equal(getChatRoom('../admin'), null);
});

test('progress is scoped to one tab and sequence is monotonic', () => {
    const io = fakeIo();
    const reporter = createAiProgressReporter({ io, tabId: TAB_A, requestId: REQUEST });
    reporter.started('ANALYZING', 'Đang phân tích yêu cầu…');
    reporter.completed('ANALYZING', 'Đã phân tích yêu cầu');
    reporter.started('RAG_SEARCH', 'Đang tra cứu cơ sở pháp lý…');
    assert.deepEqual(io.events.map(event => event.room), Array(3).fill(`chat:${TAB_A}`));
    assert.deepEqual(io.events.map(event => event.payload.seq), [1, 2, 3]);
    assert.equal(io.events.some(event => event.room === `chat:${TAB_B}`), false);
});

test('invalid correlation safely disables reporting', () => {
    const io = fakeIo();
    createAiProgressReporter({ io, tabId: 'bad', requestId: REQUEST }).started('ANALYZING', 'x');
    createAiProgressReporter({ io, tabId: TAB_A, requestId: 'bad' }).started('ANALYZING', 'x');
    assert.equal(io.events.length, 0);
});

test('terminal progress is emitted exactly once and blocks later events', () => {
    const io = fakeIo();
    const reporter = createAiProgressReporter({ io, tabId: TAB_A, requestId: REQUEST });
    reporter.started('SYNTHESIZING', 'Đang tổng hợp câu trả lời…');
    reporter.error('Không thể hoàn tất yêu cầu.');
    reporter.error('duplicate');
    reporter.completed('COMPLETE', 'late');
    assert.deepEqual(io.events.map(event => event.payload.stage), ['SYNTHESIZING', 'ERROR']);
});

test('Grounding is absent unless explicitly reported', () => {
    const io = fakeIo();
    const reporter = createAiProgressReporter({ io, tabId: TAB_A, requestId: REQUEST });
    reporter.started('ANALYZING', 'a');
    reporter.started('RAG_SEARCH', 'b');
    reporter.completed('RAG_SELECT', 'c');
    reporter.started('SYNTHESIZING', 'd');
    reporter.completed('COMPLETE', 'e');
    assert.equal(io.events.some(event => event.payload.stage === 'GROUNDING'), false);
});

test('degraded Grounding remains non-terminal so synthesis can continue', () => {
    const io = fakeIo();
    const reporter = createAiProgressReporter({ io, tabId: TAB_A, requestId: REQUEST });
    reporter.started('GROUNDING', 'a');
    reporter.degraded('GROUNDING', 'b');
    reporter.started('SYNTHESIZING', 'c');
    reporter.completed('COMPLETE', 'd');
    assert.deepEqual(io.events.map(event => event.payload.stage), ['GROUNDING', 'GROUNDING', 'SYNTHESIZING', 'COMPLETE']);
});

test('stream events are scoped, ordered, deduplicated by chunk id, and contain only answer deltas', () => {
    const io = fakeIo();
    const reporter = createAiProgressReporter({ io, tabId: TAB_A, requestId: REQUEST });
    reporter.streamStart();
    reporter.streamChunk('Visible answer');
    reporter.streamComplete({ answer: 'Visible answer', citations: [], sources: [] });
    assert.deepEqual(io.events.map(event => event.name), ['ai_stream_start', 'ai_stream_chunk', 'ai_stream_complete']);
    assert.deepEqual(io.events.map(event => event.payload.seq), [1, 2, 3]);
    assert.equal(io.events[1].payload.chunkId, 1);
    assert.equal(io.events[1].payload.delta, 'Visible answer');
    assert.equal('prompt' in io.events[1].payload, false);
    assert.equal('groundingMetadata' in io.events[2].payload, false);
    assert.deepEqual(io.events.map(event => event.room), Array(3).fill(`chat:${TAB_A}`));
});
