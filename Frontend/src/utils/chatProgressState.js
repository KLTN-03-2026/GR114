export const PROGRESS_LABELS = {
    ANALYZING: 'Đang phân tích yêu cầu…',
    DECOMPOSING: 'Đang xác định các vấn đề pháp lý…',
    RAG_SEARCH: 'Đang tra cứu cơ sở pháp lý…',
    RAG_SELECT: 'Đang chọn tài liệu liên quan…',
    COVERAGE_CHECK: 'Đang kiểm tra độ đầy đủ của nguồn…',
    GROUNDING: 'Đang kiểm tra nguồn bổ sung…',
    SYNTHESIZING: 'Đang tổng hợp câu trả lời…'
};

export function applyProgressEvent(messages, event) {
    const index = messages.findIndex(message =>
        message.requestId === event?.requestId && message.isBot && message.state === 'progress'
    );
    if (index < 0) return messages;

    const current = messages[index];
    if (current.progressTerminal || !Number.isInteger(event.seq) || event.seq <= (current.lastSeq || 0)) {
        return messages;
    }

    const progress = [...(current.progress || [])];
    const stageIndex = progress.findIndex(item => item.stage === event.stage);
    const item = {
        stage: event.stage,
        status: event.status,
        message: event.message || PROGRESS_LABELS[event.stage] || 'Đang xử lý…',
        seq: event.seq
    };
    if (stageIndex >= 0) progress[stageIndex] = item;
    else progress.push(item);

    const next = [...messages];
    next[index] = {
        ...current,
        state: event.stage === 'ERROR' ? 'error' : current.state,
        text: event.stage === 'ERROR' ? item.message : current.text,
        progress,
        lastSeq: event.seq,
        progressTerminal: event.stage === 'COMPLETE' || event.stage === 'ERROR',
        connectionDegraded: false
    };
    return next;
}

export function finalizeProgressMessage(messages, requestId, result) {
    const index = messages.findIndex(message => message.requestId === requestId && message.isBot);
    if (index < 0 || messages[index].state === 'complete') return messages;

    const next = [...messages];
    next[index] = {
        ...messages[index],
        text: result.answer,
        citations: result.citations || [],
        sources: result.sources || [],
        state: 'complete',
        progress: [],
        progressTerminal: true,
        connectionDegraded: false,
        realtimeMessage: '',
        receivedChunkIds: [],
        progressSummary: ''
    };
    return next;
}

function findActiveAssistant(messages, requestId) {
    return messages.findIndex(message =>
        message.requestId === requestId && message.isBot && message.state !== 'complete' && message.state !== 'error'
    );
}

export function applyStreamStart(messages, event) {
    const index = findActiveAssistant(messages, event?.requestId);
    if (index < 0) return messages;
    const current = messages[index];
    if (!Number.isInteger(event.seq) || event.seq <= (current.lastSeq || 0)) return messages;
    const next = [...messages];
    next[index] = {
        ...current,
        state: 'streaming',
        progress: [],
        progressSummary: '',
        lastSeq: event.seq,
        receivedChunkIds: current.receivedChunkIds || [],
        connectionDegraded: false
    };
    return next;
}

export function applyStreamChunk(messages, event) {
    const index = findActiveAssistant(messages, event?.requestId);
    if (index < 0) return messages;
    const current = messages[index];
    const received = current.receivedChunkIds || [];
    if (current.state !== 'streaming' || !Number.isInteger(event.seq) || event.seq <= (current.lastSeq || 0) || received.includes(event.chunkId)) {
        return messages;
    }
    const next = [...messages];
    next[index] = {
        ...current,
        text: `${current.text || ''}${event.delta || ''}`,
        lastSeq: event.seq,
        receivedChunkIds: [...received, event.chunkId],
        connectionDegraded: false
    };
    return next;
}

export function applyStreamComplete(messages, event) {
    const index = findActiveAssistant(messages, event?.requestId);
    if (index < 0) return messages;
    const current = messages[index];
    if (!Number.isInteger(event.seq) || event.seq <= (current.lastSeq || 0)) return messages;
    const next = [...messages];
    next[index] = {
        ...current,
        state: 'streamed_complete',
        text: event.answer || current.text || '',
        citations: event.citations || [],
        sources: event.sources || [],
        lastSeq: event.seq,
        progress: [],
        progressSummary: '',
        receivedChunkIds: [],
        connectionDegraded: false
    };
    return next;
}

export function applyStreamError(messages, event) {
    const index = findActiveAssistant(messages, event?.requestId);
    if (index < 0) return messages;
    const current = messages[index];
    if (!Number.isInteger(event.seq) || event.seq <= (current.lastSeq || 0)) return messages;
    const next = [...messages];
    next[index] = event.recoverable ? {
        ...current,
        lastSeq: event.seq,
        connectionDegraded: true,
        realtimeMessage: event.message || 'Mất kết nối truyền trực tiếp; vẫn đang xử lý…'
    } : {
        ...current,
        state: 'error',
        text: event.message || 'Không thể hoàn tất yêu cầu.',
        lastSeq: event.seq,
        progressTerminal: true
    };
    return next;
}

export function setProgressConnectionState(messages, connectionDegraded) {
    return messages.map(message => ['progress', 'streaming', 'streamed_complete'].includes(message.state)
        ? { ...message, connectionDegraded }
        : message
    );
}
