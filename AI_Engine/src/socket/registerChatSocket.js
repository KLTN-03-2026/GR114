const { getChatRoom, isValidChatIdentifier } = require('../utils/aiProgressReporter');
const { randomUUID } = require('node:crypto');

const debugChatSocket = details => {
    if (process.env.NODE_ENV !== 'production' && process.env.LEGAI_CHAT_SOCKET_DEBUG === 'true') {
        console.debug('[CHAT SOCKET]');
        console.debug(details);
    }
};

function createChatRegistrationHandler(io, socket, options = {}) {
    const generateId = options.generateId || randomUUID;
    const claims = options.claims || new Map();
    return async (payload, acknowledge = () => {}) => {
        let claimedTabId = null;
        try {
            let tabId = payload?.tabId;
            if (!isValidChatIdentifier(tabId)) {
                acknowledge({ ok: false, code: 'INVALID_TAB_ID' });
                return;
            }

            let room = getChatRoom(tabId);
            if (claims.has(tabId) && claims.get(tabId) !== socket.id) {
                tabId = generateId();
                room = getChatRoom(tabId);
            }
            claims.set(tabId, socket.id);
            claimedTabId = tabId;
            const occupants = await io.in(room).allSockets();
            if ([...occupants].some(socketId => socketId !== socket.id)) {
                if (claims.get(tabId) === socket.id) claims.delete(tabId);
                tabId = generateId();
                room = getChatRoom(tabId);
                claims.set(tabId, socket.id);
                claimedTabId = tabId;
            }

            const previousTabId = socket.data.chatTabId;
            if (socket.data.chatRoom && socket.data.chatRoom !== room) await socket.leave(socket.data.chatRoom);
            await socket.join(room);
            if (previousTabId && previousTabId !== tabId && claims.get(previousTabId) === socket.id) claims.delete(previousTabId);
            socket.data.chatRoom = room;
            socket.data.chatTabId = tabId;
            debugChatSocket({ tabId, connected: socket.connected, registered: true });
            acknowledge({ ok: true, room, tabId });
        } catch (error) {
            if (claimedTabId && claims.get(claimedTabId) === socket.id) claims.delete(claimedTabId);
            acknowledge({ ok: false, code: 'REGISTRATION_FAILED' });
        }
    };
}

function registerChatSocket(io) {
    const claims = new Map();
    io.on('connection', socket => {
        socket.on('chat_register', createChatRegistrationHandler(io, socket, { claims }));
        socket.on('disconnect', () => {
            const tabId = socket.data.chatTabId;
            if (tabId && claims.get(tabId) === socket.id) claims.delete(tabId);
        });
    });
}

module.exports = { createChatRegistrationHandler, registerChatSocket };
