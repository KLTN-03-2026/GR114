import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatSocketRegistration } from './chatSocketRegistration.js';

const TAB_ONE = 'd94f4e2a-7f7a-4f31-9c6c-df72fd338761';
const TAB_TWO = '21a5020f-dd8d-4727-a39b-1124fb2b8110';

class FakeSocket {
    constructor({ connected = false, connectDelay = 0, acknowledge = true, assignedTabId = null } = {}) {
        this.connected = connected;
        this.id = connected ? 'socket-1' : undefined;
        this.connectDelay = connectDelay;
        this.acknowledge = acknowledge;
        this.assignedTabId = assignedTabId;
        this.handlers = new Map();
        this.registrationCount = 0;
    }
    on(event, handler) { this.handlers.set(event, [...(this.handlers.get(event) || []), handler]); }
    off(event, handler) { this.handlers.set(event, (this.handlers.get(event) || []).filter(item => item !== handler)); }
    fire(event, value) { for (const handler of this.handlers.get(event) || []) handler(value); }
    connect() {
        setTimeout(() => {
            this.connected = true;
            this.id = `socket-${Date.now()}`;
            this.fire('connect');
        }, this.connectDelay);
    }
    emit(event, payload, callback) {
        if (event !== 'chat_register') return;
        this.registrationCount += 1;
        if (this.acknowledge) {
            const tabId = this.assignedTabId || payload.tabId;
            queueMicrotask(() => callback({ ok: true, tabId, room: `chat:${tabId}` }));
        }
    }
    disconnect() { this.connected = false; this.fire('disconnect'); }
}

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

const createRegistration = (socket, storage = memoryStorage(), timeoutMs = 30) => createChatSocketRegistration({
    socket, storage, randomUUID: () => TAB_ONE, timeoutMs
});

test('fresh first tab connects and receives room ACK', async () => {
    const result = await createRegistration(new FakeSocket()).ensureRegistered();
    assert.deepEqual(result, { ok: true, tabId: TAB_ONE, room: `chat:${TAB_ONE}` });
});

test('duplicated second tab stores the collision-safe ID returned by server ACK', async () => {
    const storage = memoryStorage({ legai_chat_tab_id: TAB_ONE });
    const socket = new FakeSocket({ connected: true, assignedTabId: TAB_TWO });
    const result = await createRegistration(socket, storage).ensureRegistered();
    assert.equal(result.tabId, TAB_TWO);
    assert.equal(storage.getItem('legai_chat_tab_id'), TAB_TWO);
});

test('two simultaneous sends share one connection and registration flight', async () => {
    const socket = new FakeSocket({ connectDelay: 5 });
    const registration = createRegistration(socket);
    const [first, second] = await Promise.all([registration.ensureRegistered(), registration.ensureRegistered()]);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(socket.registrationCount, 1);
});

test('slow socket connection is awaited before registration resolves', async () => {
    const socket = new FakeSocket({ connectDelay: 15 });
    const result = await createRegistration(socket, memoryStorage(), 40).ensureRegistered();
    assert.equal(result.ok, true);
    assert.equal(socket.connected, true);
});

test('reconnect invalidates old membership and re-registers new socket ID', async () => {
    const socket = new FakeSocket({ connected: true });
    const registration = createRegistration(socket);
    await registration.ensureRegistered();
    registration.invalidate();
    socket.id = 'socket-2';
    await registration.ensureRegistered();
    assert.equal(socket.registrationCount, 2);
});

test('registration ACK timeout degrades safely', async () => {
    const socket = new FakeSocket({ connected: true, acknowledge: false });
    const result = await createRegistration(socket, memoryStorage(), 5).ensureRegistered();
    assert.equal(result.ok, false);
    assert.equal(result.code, 'ACK_TIMEOUT');
    assert.equal(result.tabId, TAB_ONE);
});
