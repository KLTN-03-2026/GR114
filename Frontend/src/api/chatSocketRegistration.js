const DEFAULT_TIMEOUT_MS = 1500;

export function createChatSocketRegistration({ socket, storage, randomUUID, timeoutMs = DEFAULT_TIMEOUT_MS, debug = false }) {
    const storageKey = 'legai_chat_tab_id';
    let registeredSocketId = null;
    let registeredTabId = null;
    let inFlight = null;

    const getTabId = () => {
        let tabId = storage.getItem(storageKey);
        if (!tabId) {
            tabId = randomUUID();
            storage.setItem(storageKey, tabId);
        }
        return tabId;
    };

    const waitForConnection = () => new Promise(resolve => {
        if (socket.connected) return resolve(true);
        let settled = false;
        const finish = connected => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            socket.off('connect', handleConnect);
            socket.off('connect_error', handleError);
            resolve(connected);
        };
        const handleConnect = () => finish(true);
        const handleError = () => finish(false);
        const timer = setTimeout(() => finish(false), timeoutMs);
        socket.on('connect', handleConnect);
        socket.on('connect_error', handleError);
        socket.connect();
    });

    const registerWithAck = tabId => new Promise(resolve => {
        let settled = false;
        const finish = result => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(result);
        };
        const timer = setTimeout(() => finish({ ok: false, tabId, code: 'ACK_TIMEOUT' }), timeoutMs);
        socket.emit('chat_register', { tabId }, response => {
            if (settled) return;
            if (!response?.ok) return finish({ ok: false, tabId, code: response?.code || 'REGISTRATION_FAILED' });
            const assignedTabId = response.tabId || tabId;
            storage.setItem(storageKey, assignedTabId);
            registeredSocketId = socket.id;
            registeredTabId = assignedTabId;
            finish({ ok: true, tabId: assignedTabId, room: response.room });
        });
    });

    const ensureRegistered = async () => {
        const tabId = getTabId();
        if (socket.connected && registeredSocketId === socket.id && registeredTabId === tabId) {
            return { ok: true, tabId, room: `chat:${tabId}` };
        }
        if (inFlight) return inFlight;
        inFlight = (async () => {
            const connected = await waitForConnection();
            if (!connected) return { ok: false, tabId: getTabId(), code: 'CONNECT_TIMEOUT' };
            const result = await registerWithAck(getTabId());
            if (debug) {
                console.debug('[CHAT SOCKET]');
                console.debug({ tabId: result.tabId, connected: socket.connected, registered: result.ok });
            }
            return result;
        })().catch(() => ({ ok: false, tabId: getTabId(), code: 'REGISTRATION_FAILED' }))
            .finally(() => { inFlight = null; });
        return inFlight;
    };

    const invalidate = () => {
        registeredSocketId = null;
        registeredTabId = null;
    };

    return { ensureRegistered, getTabId, invalidate };
}
