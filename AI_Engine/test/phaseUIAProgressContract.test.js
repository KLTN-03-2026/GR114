const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createChatRegistrationHandler, registerChatSocket } = require('../src/socket/registerChatSocket');

test('socket registration joins only the validated tab room and leaves the previous room', async () => {
    let connectionHandler;
    const io = {
        on: (event, handler) => { if (event === 'connection') connectionHandler = handler; },
        in: () => ({ allSockets: async () => new Set() })
    };
    registerChatSocket(io);
    const handlers = {};
    const joined = [];
    const left = [];
    const socket = {
        id: 'socket-one', data: {}, connected: true,
        on: (event, handler) => { handlers[event] = handler; },
        join: room => joined.push(room),
        leave: room => left.push(room)
    };
    connectionHandler(socket);
    const acknowledgements = [];
    await handlers.chat_register({ tabId: 'not-a-uuid' }, result => acknowledgements.push(result));
    await handlers.chat_register({ tabId: 'd94f4e2a-7f7a-4f31-9c6c-df72fd338761' }, result => acknowledgements.push(result));
    await handlers.chat_register({ tabId: '21a5020f-dd8d-4727-a39b-1124fb2b8110' }, result => acknowledgements.push(result));
    assert.deepEqual(joined, [
        'chat:d94f4e2a-7f7a-4f31-9c6c-df72fd338761',
        'chat:21a5020f-dd8d-4727-a39b-1124fb2b8110'
    ]);
    assert.deepEqual(left, ['chat:d94f4e2a-7f7a-4f31-9c6c-df72fd338761']);
    assert.equal(acknowledgements[0].ok, false);
    assert.deepEqual(acknowledgements.slice(1).map(result => result.ok), [true, true]);
});

test('duplicated tab identity is reassigned before ACK to prevent room sharing', async () => {
    const original = 'd94f4e2a-7f7a-4f31-9c6c-df72fd338761';
    const replacement = '21a5020f-dd8d-4727-a39b-1124fb2b8110';
    const joined = [];
    const io = { in: () => ({ allSockets: async () => new Set(['existing-socket']) }) };
    const socket = { id: 'duplicate-socket', data: {}, connected: true, join: async room => joined.push(room), leave: async () => {} };
    const handler = createChatRegistrationHandler(io, socket, { generateId: () => replacement });
    let acknowledgement;
    await handler({ tabId: original }, result => { acknowledgement = result; });
    assert.deepEqual(acknowledgement, { ok: true, room: `chat:${replacement}`, tabId: replacement });
    assert.deepEqual(joined, [`chat:${replacement}`]);
});

test('simultaneous duplicate-tab registrations claim distinct rooms atomically', async () => {
    const original = 'd94f4e2a-7f7a-4f31-9c6c-df72fd338761';
    const replacement = '21a5020f-dd8d-4727-a39b-1124fb2b8110';
    const claims = new Map();
    const io = { in: () => ({ allSockets: async () => new Set() }) };
    const makeSocket = id => ({ id, data: {}, connected: true, join: async () => {}, leave: async () => {} });
    const first = createChatRegistrationHandler(io, makeSocket('socket-one'), { claims, generateId: () => replacement });
    const second = createChatRegistrationHandler(io, makeSocket('socket-two'), { claims, generateId: () => replacement });
    let firstAck;
    let secondAck;
    await Promise.all([
        first({ tabId: original }, result => { firstAck = result; }),
        second({ tabId: original }, result => { secondAck = result; })
    ]);
    assert.equal(firstAck.tabId, original);
    assert.equal(secondAck.tabId, replacement);
    assert.notEqual(firstAck.room, secondAck.room);
});

test('Phase UI-B reuses Socket.IO streaming without SSE or global chat broadcasts', () => {
    const root = path.join(__dirname, '..');
    const files = [
        'src/controllers/aiController.js',
        'src/services/geminiService.js',
        'src/utils/aiProgressReporter.js'
    ].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
    assert.match(files, /ai_stream_chunk/u);
    assert.doesNotMatch(files, /EventSource/u);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/controllers/aiController.js'), 'utf8'), /global\.io\.emit\(['"]ai_progress/u);
});

test('frontend uses exact listener cleanup and one pending assistant bubble', () => {
    const frontendRoot = path.join(__dirname, '..', '..', 'Frontend', 'src');
    const chat = fs.readFileSync(path.join(frontendRoot, 'components', 'ChatbotAI.jsx'), 'utf8');
    assert.match(chat, /chatSocket\.off\('ai_progress', handleProgress\)/u);
    assert.match(chat, /chatSocket\.off\('disconnect', handleDisconnect\)/u);
    assert.match(chat, /chatSocket\.off\('connect', handleConnect\)/u);
    assert.ok(chat.indexOf("chatSocket.on('ai_progress', handleProgress)") < chat.indexOf('const registrationDisconnectHandler = connectChatSocket()'));
    assert.ok(chat.indexOf('await ensureChatSocketRegistered()') < chat.indexOf('aiClient.ask(question'));
    assert.match(chat, /id: `ai-\$\{requestId\}`/u);
    assert.doesNotMatch(chat, /animate-bounce/u);
    assert.doesNotMatch(chat, /scrollIntoView/u);
    assert.match(chat, /addEventListener\('scroll', handleScroll, \{ passive: true \}\)/u);
    assert.match(chat, /cancelAnimationFrame\(scrollFrameRef\.current\)/u);
    for (const event of ['ai_stream_start', 'ai_stream_chunk', 'ai_stream_complete', 'ai_stream_error']) {
        assert.match(chat, new RegExp(`chatSocket\\.off\\('${event}'`, 'u'));
    }
});

test('completed and streaming answers render without permanent completion-status text', () => {
    const frontendRoot = path.join(__dirname, '..', '..', 'Frontend', 'src');
    const chat = fs.readFileSync(path.join(frontendRoot, 'components', 'ChatbotAI.jsx'), 'utf8');
    const progressState = fs.readFileSync(path.join(frontendRoot, 'utils', 'chatProgressState.js'), 'utf8');
    assert.doesNotMatch(chat, /msg\.progressSummary/u);
    assert.doesNotMatch(chat, /Đang xác minh nguồn/u);
    assert.doesNotMatch(progressState, /Đã hoàn tất tra cứu|Đã hoàn tất/u);
});

test('progress UI uses delayed sequential replacement with a soft transition', () => {
    const frontendRoot = path.join(__dirname, '..', '..', 'Frontend', 'src');
    const chat = fs.readFileSync(path.join(frontendRoot, 'components', 'ChatbotAI.jsx'), 'utf8');
    assert.doesNotMatch(chat, /Đang xử lý yêu cầu/u);
    assert.doesNotMatch(chat, /message\.progress\s*\|\|\s*\[\]\)\.filter/u);
    assert.match(chat, /message\.currentProgressStage/u);
    assert.match(chat, /PROGRESS_VISIBILITY_DELAY_MS/u);
    assert.match(chat, /revealProgressMessage\(previous, requestId\)/u);
    assert.match(chat, /initial=\{\{ opacity: 0, y: 4 \}\}/u);
    assert.match(chat, /transition=\{\{ duration: 0\.2/u);
});

test('chat request sends only a bounded recent role/content history window', () => {
    const frontendRoot = path.join(__dirname, '..', '..', 'Frontend', 'src');
    const chat = fs.readFileSync(path.join(frontendRoot, 'components', 'ChatbotAI.jsx'), 'utf8');
    const client = fs.readFileSync(path.join(frontendRoot, 'api', 'aiClient.js'), 'utf8');
    assert.match(chat, /\.slice\(-6\)[\s\S]*role: message\.isBot \? 'assistant' : 'user'[\s\S]*content: message\.text/u);
    assert.match(client, /chatHistory: correlation\.chatHistory/u);
});
