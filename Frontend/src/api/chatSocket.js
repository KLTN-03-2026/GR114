import { io } from 'socket.io-client';
import { createChatSocketRegistration } from './chatSocketRegistration';

const apiUrl = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000/api';
const socketUrl = apiUrl.replace(/\/api\/?$/, '');

export const chatSocket = io(socketUrl, {
    autoConnect: false,
    reconnection: true
});

const registration = createChatSocketRegistration({
    socket: chatSocket,
    storage: sessionStorage,
    randomUUID: () => crypto.randomUUID(),
    debug: import.meta.env.DEV
});

export const getChatTabId = registration.getTabId;
export const ensureChatSocketRegistered = registration.ensureRegistered;

export function connectChatSocket() {
    const handleDisconnect = () => registration.invalidate();
    chatSocket.off('disconnect', handleDisconnect);
    chatSocket.on('disconnect', handleDisconnect);
    void registration.ensureRegistered();
    return handleDisconnect;
}

export function disconnectChatSocket(handleDisconnect) {
    if (handleDisconnect) chatSocket.off('disconnect', handleDisconnect);
    registration.invalidate();
    chatSocket.disconnect();
}
