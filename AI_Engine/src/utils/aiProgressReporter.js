const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_STAGES = new Set([
    'ANALYZING', 'DECOMPOSING', 'RAG_SEARCH', 'RAG_SELECT',
    'COVERAGE_CHECK', 'GROUNDING', 'SYNTHESIZING', 'COMPLETE', 'ERROR'
]);
const ALLOWED_STATUSES = new Set(['started', 'completed', 'skipped', 'degraded']);

function isValidChatIdentifier(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value);
}

function getChatRoom(tabId) {
    return isValidChatIdentifier(tabId) ? `chat:${tabId}` : null;
}

function createAiProgressReporter({ io, tabId, requestId } = {}) {
    const room = getChatRoom(tabId);
    const enabled = Boolean(io && room && isValidChatIdentifier(requestId));
    let seq = 0;
    let terminal = false;
    let streamStarted = false;
    let streamTerminal = false;
    let chunkId = 0;

    const emitScoped = (eventName, payload) => {
        if (!enabled) return null;
        io.to(room).emit(eventName, payload);
        return payload;
    };

    const report = (stage, status, message) => {
        if (!enabled || terminal || !ALLOWED_STAGES.has(stage) || !ALLOWED_STATUSES.has(status)) return null;
        const payload = {
            requestId,
            seq: ++seq,
            stage,
            status,
            message: String(message || ''),
            timestamp: new Date().toISOString()
        };
        if (process.env.NODE_ENV !== 'production' && process.env.LEGAI_CHAT_SOCKET_DEBUG === 'true') {
            console.debug('[AI PROGRESS ROUTE]');
            console.debug({ requestId, tabId, room, stage });
        }
        emitScoped('ai_progress', payload);
        if (stage === 'COMPLETE' || stage === 'ERROR') terminal = true;
        return payload;
    };

    return {
        enabled,
        started: (stage, message) => report(stage, 'started', message),
        completed: (stage, message) => report(stage, 'completed', message),
        skipped: (stage, message) => report(stage, 'skipped', message),
        degraded: (stage, message) => report(stage, 'degraded', message),
        error: message => report('ERROR', 'completed', message),
        streamStart: () => {
            if (!enabled || terminal || streamStarted) return null;
            streamStarted = true;
            return emitScoped('ai_stream_start', { requestId, seq: ++seq });
        },
        streamChunk: delta => {
            if (!enabled || terminal || streamTerminal || !delta) return null;
            if (!streamStarted) {
                streamStarted = true;
                emitScoped('ai_stream_start', { requestId, seq: ++seq });
            }
            return emitScoped('ai_stream_chunk', { requestId, seq: ++seq, chunkId: ++chunkId, delta: String(delta) });
        },
        streamComplete: ({ answer, citations, sources }) => {
            if (!enabled || terminal || streamTerminal) return null;
            streamTerminal = true;
            return emitScoped('ai_stream_complete', { requestId, seq: ++seq, answer, citations, sources });
        },
        streamError: (code, message, recoverable = true) => {
            if (!enabled || terminal || streamTerminal) return null;
            streamTerminal = true;
            return emitScoped('ai_stream_error', { requestId, seq: ++seq, code, message, recoverable });
        }
    };
}

module.exports = {
    ALLOWED_STAGES,
    ALLOWED_STATUSES,
    isValidChatIdentifier,
    getChatRoom,
    createAiProgressReporter
};
