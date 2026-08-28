import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
    XMarkIcon,
    PaperAirplaneIcon,
    SparklesIcon,
    CloudArrowUpIcon,
    CheckBadgeIcon,
    PlusIcon
} from '@heroicons/react/24/outline';
import aiClient from '../api/aiClient';
import LawyerCard from './LawyerCard';
import Swal from 'sweetalert2';
import { chatSocket, connectChatSocket, disconnectChatSocket, ensureChatSocketRegistered, getChatTabId } from '../api/chatSocket';
import {
    applyProgressEvent, applyStreamChunk, applyStreamComplete, applyStreamError, applyStreamStart,
    finalizeProgressMessage, PROGRESS_LABELS, PROGRESS_VISIBILITY_DELAY_MS, revealProgressMessage,
    setProgressConnectionState
} from '../utils/chatProgressState';
import { DEFAULT_NEAR_BOTTOM_PX, updateAutoFollowFromScroll } from '../utils/chatScrollState';
import { splitLegalHeadingLines } from '../utils/legalAnswerHeadings';

const renderLegalHeadingLines = children => React.Children.map(children, child => {
    if (typeof child !== 'string') return child;
    return splitLegalHeadingLines(child).map((line, index) => (
        <React.Fragment key={`${index}-${line.text}`}>
            {index > 0 && <br />}
            {line.heading ? <strong className="font-bold">{line.text}</strong> : line.text}
        </React.Fragment>
    ));
});

const ChatProgress = ({ message }) => {
    const current = message.connectionDegraded
        ? { stage: 'CONNECTION', status: 'degraded', message: 'Mất kết nối cập nhật trực tiếp; vẫn đang xử lý…' }
        : message.currentProgressStage;
    if (!message.progressVisible || !current) return null;
    return (
        <div className="min-w-[230px] min-h-5" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={`${current.stage}-${current.status}-${current.message}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={`flex items-start gap-2 text-xs ${current.status === 'degraded' ? 'text-amber-700' : 'text-zinc-600'}`}
                >
                    <span className={`mt-0.5 shrink-0 ${current.status === 'started' ? 'animate-pulse text-[#B8985D]' : ''}`}>●</span>
                    <span>{current.message || PROGRESS_LABELS[current.stage]}</span>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default function ChatbotAI({ isOpen, onClose, curretCagetory }) {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    // Kiểm tra trạng thái login và lượt chat của khách
    const [isLoggedIn] = useState(!!localStorage.getItem("accessToken"));
    const [guestCount, setGuestCount] = useState(
        parseInt(localStorage.getItem("legai_guest_count") || "0")
    );
    const textareaRef = useRef(null);
    const progressListenerAttachedRef = useRef(false);
    const chatScrollRef = useRef(null);
    const autoFollowRef = useRef(true);
    const scrollFrameRef = useRef(null);
    const progressTimersRef = useRef(new Map());
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);

    useEffect(() => {
        let active = true;
        const handleProgress = event => setMessages(previous => applyProgressEvent(previous, event));
        const handleStreamStart = event => setMessages(previous => applyStreamStart(previous, event));
        const handleStreamChunk = event => setMessages(previous => applyStreamChunk(previous, event));
        const handleStreamComplete = event => setMessages(previous => applyStreamComplete(previous, event));
        const handleStreamError = event => setMessages(previous => applyStreamError(previous, event));
        const handleDisconnect = () => setMessages(previous => setProgressConnectionState(previous, true));
        const handleConnect = async () => {
            const registration = await ensureChatSocketRegistered();
            if (active && registration.ok) setMessages(previous => setProgressConnectionState(previous, false));
        };

        chatSocket.on('ai_progress', handleProgress);
        chatSocket.on('ai_stream_start', handleStreamStart);
        chatSocket.on('ai_stream_chunk', handleStreamChunk);
        chatSocket.on('ai_stream_complete', handleStreamComplete);
        chatSocket.on('ai_stream_error', handleStreamError);
        chatSocket.on('disconnect', handleDisconnect);
        chatSocket.on('connect', handleConnect);
        progressListenerAttachedRef.current = true;
        const registrationDisconnectHandler = connectChatSocket();
        return () => {
            active = false;
            progressListenerAttachedRef.current = false;
            chatSocket.off('ai_progress', handleProgress);
            chatSocket.off('ai_stream_start', handleStreamStart);
            chatSocket.off('ai_stream_chunk', handleStreamChunk);
            chatSocket.off('ai_stream_complete', handleStreamComplete);
            chatSocket.off('ai_stream_error', handleStreamError);
            chatSocket.off('disconnect', handleDisconnect);
            chatSocket.off('connect', handleConnect);
            disconnectChatSocket(registrationDisconnectHandler);
        };
    }, []);

    useEffect(() => () => {
        for (const timer of progressTimersRef.current.values()) clearTimeout(timer);
        progressTimersRef.current.clear();
    }, []);

    // Khởi tạo tin nhắn chào mừng (Chỉ còn AI)
    useEffect(() => {
        setIsSaved(false);
        setMessages([
            { id: 'ai-init', text: "Chào bạn! Tôi là LegAI. Bạn cần tra cứu hay tư vấn vấn đề pháp lý nào?", isBot: true }
        ]);
    }, []);

    // Một scroll container ổn định: chỉ auto-follow khi người dùng đang ở gần cuối.
    useEffect(() => {
        if (!isOpen) return undefined;
        const container = chatScrollRef.current;
        if (!container) return undefined;
        const handleScroll = () => {
            const scrollState = updateAutoFollowFromScroll(container, DEFAULT_NEAR_BOTTOM_PX);
            autoFollowRef.current = scrollState.autoFollow;
            setShowScrollToBottom(previous => previous === scrollState.showScrollToBottom ? previous : scrollState.showScrollToBottom);
        };
        container.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => container.removeEventListener('scroll', handleScroll);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !autoFollowRef.current) return undefined;
        if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = requestAnimationFrame(() => {
            const container = chatScrollRef.current;
            if (container && autoFollowRef.current) container.scrollTop = container.scrollHeight;
            scrollFrameRef.current = null;
        });
        return () => {
            if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
            scrollFrameRef.current = null;
        };
    }, [messages, isOpen]);

    const scrollToBottom = () => {
        autoFollowRef.current = true;
        setShowScrollToBottom(false);
        const container = chatScrollRef.current;
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    };

    // Tự động giãn Textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    // --- HÀM TẠO CUỘC TRÒ CHUYỆN MỚI ---
    const handleNewChat = async () => {
        // Cảnh báo nếu có data mà chưa lưu
        if (messages.length > 1 && !isSaved) {
            const result = await Swal.fire({
                title: 'Phiên chat hiện tại chưa được lưu vào Hồ sơ. Bạn có chắc chắn muốn tạo cuộc trò chuyện mới?',
                showCancelButton: true,
                confirmButtonText: 'Đồng ý',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#B8985D'
            });
            if (!result.isConfirmed) return;
        }

        setMessages([
            { id: 'ai-init', text: "Chào bạn! Tôi là LegAI. Bạn cần tra cứu hay tư vấn vấn đề pháp lý nào?", isBot: true }
        ]);
        setInput("");
        setIsSaved(false);
        setIsLoading(false);
    };

    // --- HÀM LƯU HỘI THOẠI VÀO SQL ---
    const handleSaveChat = async () => {
        if (messages.length < 2) return;

        if (isSaved) {
            toast.error("Phiên chat này đã được lưu rồi!");
            return;
        }

        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 1 };
            const userId = user.id ?? user.Id ?? user.ID;

            const firstUserMsg = messages.find(m => !m.isBot)?.text || "Cuộc trò chuyện mới";
            const displayTitle = firstUserMsg.length > 35 ? firstUserMsg.substring(0, 35) + "..." : firstUserMsg;

            const payload = {
                userId: userId,
                fileName: `Chat_${Date.now()}.json`,
                title: `Thảo luận: ${displayTitle}`,
                recordType: 'CHAT',
                riskScore: null,
                content: JSON.stringify(messages)
            };

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setIsSaved(true);
                toast.success("Đã lưu phiên trò chuyện!");
            }
        } catch (err) {
            console.error("Lỗi lưu Chat:", err);
            toast.error("Không thể lưu hội thoại. Vui lòng thử lại sau.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();

        // 1. Chặn gửi nếu là khách và đã hết lượt
        if (!isLoggedIn && guestCount >= 3) return;

        if (!input.trim() || isLoading) return;

        const question = input;
        const chatHistory = messages
            .filter(message => typeof message.text === 'string' && message.text.trim() && (!message.isBot || message.state === 'complete' || !message.state))
            .slice(-6)
            .map(message => ({ role: message.isBot ? 'assistant' : 'user', content: message.text }));
        setIsLoading(true);
        const registration = progressListenerAttachedRef.current
            ? await ensureChatSocketRegistered()
            : { ok: false, tabId: getChatTabId(), code: 'LISTENER_NOT_READY' };
        const requestId = crypto.randomUUID();
        const userMsg = { id: Date.now(), text: input, isBot: false };
        const pendingMessage = {
            id: `ai-${requestId}`,
            requestId,
            isBot: true,
            state: 'progress',
            text: '',
            progress: [],
            currentProgressStage: null,
            progressVisible: false,
            lastSeq: 0,
            progressTerminal: false,
            streamStarted: false,
            receivedChunkIds: [],
            connectionDegraded: !registration.ok
        };
        setMessages(prev => [...prev, userMsg, pendingMessage]);
        const progressTimer = setTimeout(() => {
            setMessages(previous => revealProgressMessage(previous, requestId));
            progressTimersRef.current.delete(requestId);
        }, PROGRESS_VISIBILITY_DELAY_MS);
        progressTimersRef.current.set(requestId, progressTimer);
        setInput("");
        setIsSaved(false);

        try {
            const res = await aiClient.ask(question, undefined, { requestId, tabId: registration.tabId, chatHistory });
            const answer = res.answer || "Tôi đang học hỏi thêm về vấn đề này, bạn có thể nói rõ hơn không?";
            setMessages(prev => finalizeProgressMessage(prev, requestId, { ...res, answer }));

            // 2. Tăng lượt đếm sau khi AI trả lời thành công (chỉ áp dụng cho khách)
            if (!isLoggedIn) {
                const newCount = guestCount + 1;
                setGuestCount(newCount);
                localStorage.setItem("legai_guest_count", newCount.toString());
            }
        } catch (error) {
            setMessages(prev => prev.map(message => message.requestId === requestId ? {
                ...message,
                state: 'error',
                text: " Server LegAI đang bận, thử lại sau nhé bạn.",
                progress: [],
                currentProgressStage: null,
                progressVisible: false,
                progressTerminal: true,
                connectionDegraded: false,
                realtimeMessage: ''
            } : message));
        } finally {
            const progressTimer = progressTimersRef.current.get(requestId);
            if (progressTimer) clearTimeout(progressTimer);
            progressTimersRef.current.delete(requestId);
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    const formatAIMessage = (text) => {
        if (!text) return "";
        let content = text;

        // BƯỚC 1: BÓC VỎ JSON (Xử lý mọi biến thể JSON AI có thể trả về)
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed === 'string') {
                content = parsed;
            } else if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                content = parsed.join('\n');
            } else if (typeof parsed === 'object' && parsed !== null) {
                // Kiểm tra xem nó có chia thành các key JSON rời rạc không
                const ketLuan = parsed["Kết luận"] || parsed["ket_luan"] || parsed["ketLuan"] || "";
                const phanTich = parsed["Phân tích"] || parsed["phan_tich"] || parsed["phanTich"] || "";
                const coSo = parsed["Cơ sở pháp lý"] || parsed["co_so_phap_ly"] || parsed["coSoPhapLy"] || "";
                const loiKhuyen = parsed["Lời khuyên"] || parsed["loi_khuyen"] || parsed["loiKhuyen"] || "";

                if (ketLuan || phanTich || coSo || loiKhuyen) {
                    let mdText = "";
                    if (ketLuan) mdText += `Kết luận:\n${ketLuan}\n\n`;
                    if (phanTich) mdText += `Phân tích:\n${phanTich}\n\n`;
                    if (coSo) {
                        mdText += `Cơ sở pháp lý:\n`;
                        if (Array.isArray(coSo)) coSo.forEach(item => mdText += `- ${item}\n`);
                        else mdText += `${coSo}\n`;
                        mdText += `\n`;
                    }
                    if (loiKhuyen) mdText += `Lời khuyên:\n${loiKhuyen}\n\n`;
                    content = mdText.trim();
                } else {
                    // NẾU LÀ DẠNG { "answer": "Nội dung..." } -> Bóc lấy nội dung bên trong
                    content = parsed.answer || parsed.text || parsed.message || parsed.response || Object.values(parsed)[0] || text;
                }
            }
        } catch (e) {
            // Nếu không phải JSON (AI trả về Text thuần)
            content = text;
        }

        // Đảm bảo dữ liệu đầu ra là chuỗi String
        if (typeof content !== 'string') content = String(content);

        content = content.replace(/Nội dung do LegAI cung cấp.*/gi, (match) => `\n\n---\n*${match}*`);


        content = content.replace(/\n{3,}/g, '\n\n').trim();

        return content;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-4 md:right-8 w-[95vw] md:w-[420px] h-[min(600px,75vh)] z-[101] flex flex-col pointer-events-auto"
        >

            <div className="flex-grow flex flex-col overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white/95 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)]">

                {/* HEADER */}
                <div className="p-5 border-b border-zinc-100 bg-zinc-50/80 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-[#B8985D]/10 border border-[#B8985D]/20">
                                <SparklesIcon className="w-5 h-5 text-[#8E6D45]" />
                            </div>
                            <h3 className="text-[11px] font-black text-[#1A2530] tracking-[0.2em] uppercase">AI Assistant</h3>
                        </div>

                        <div className="flex items-center gap-1">
                            {/* NÚT NEW CHAT */}
                            <button
                                onClick={handleNewChat}
                                title="Tạo cuộc trò chuyện mới"
                                className="p-2 rounded-xl text-zinc-400 hover:text-[#B8985D] hover:bg-[#B8985D]/10 transition-colors"
                            >
                                <PlusIcon className="w-5 h-5 stroke-2" />
                            </button>

                            {messages.length > 1 && (
                                <button
                                    onClick={handleSaveChat}
                                    disabled={isSaving || isSaved}
                                    title={isSaved ? "Đã lưu" : "Lưu phiên chat"}
                                    className={`p-2 rounded-xl transition-all ${isSaved
                                        ? 'text-emerald-500 bg-emerald-50 cursor-not-allowed'
                                        : 'text-zinc-400 hover:text-[#B8985D] hover:bg-[#B8985D]/10'
                                        }`}
                                >
                                    {isSaved ? <CheckBadgeIcon className="w-5 h-5 stroke-2" /> : <CloudArrowUpIcon className="w-5 h-5 stroke-2" />}
                                </button>
                            )}
                            <button onClick={onClose} title="Đóng" className="p-2 hover:bg-red-50 hover:text-red-500 rounded-xl text-zinc-400 transition-colors">
                                <XMarkIcon className="w-5 h-5 stroke-2" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* CHAT BODY */}
                <div className="relative flex-1 min-h-0 bg-zinc-50/50">
                    <div ref={chatScrollRef} className="h-full p-5 overflow-y-auto space-y-5 custom-scrollbar overscroll-contain">
                        <AnimatePresence mode='popLayout'>
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'} ${msg.isBot && msg.state === 'progress' && !msg.progressVisible ? 'hidden' : ''}`}
                                >
                                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed font-medium shadow-sm ${msg.isBot
                                        ? 'bg-white text-zinc-700 border border-zinc-200 rounded-tl-none'
                                        : 'bg-[#1A2530] text-white rounded-tr-none'
                                        }`}>

                                        {msg.isBot ? (
                                            msg.state === 'progress' ? (
                                                <ChatProgress message={msg} />
                                            ) :
                                                msg.text.replace(/"/g, '').trim() === "[CONTACT_LAWYER]" ? (
                                                    <LawyerCard />
                                                ) : (
                                                    <div className="prose prose-sm max-w-none text-zinc-700 break-words prose-p:my-1.5 prose-li:my-0.5 prose-ul:my-1.5 prose-hr:my-3">
                                                        {msg.connectionDegraded && <p className="not-prose mb-2 text-xs text-amber-700">{msg.realtimeMessage || 'Mất kết nối cập nhật trực tiếp; vẫn đang xử lý…'}</p>}
                                                        <ReactMarkdown
                                                            components={{
                                                                p: ({ node, children, ...props }) => (
                                                                    <p {...props}>{renderLegalHeadingLines(children)}</p>
                                                                ),
                                                                // đường link trích dẫn pháp lý
                                                                a: ({ node, ...props }) => (
                                                                    <a
                                                                        {...props}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        title="Bấm để xem văn bản pháp luật gốc"
                                                                        className="text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 transition-colors"
                                                                    />
                                                                )
                                                            }}
                                                        >
                                                            {formatAIMessage(msg.text)}
                                                        </ReactMarkdown>
                                                    </div>
                                                )
                                        ) : (
                                            <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                    </div>
                    {showScrollToBottom && (
                        <button
                            type="button"
                            onClick={scrollToBottom}
                            aria-label="Về cuối cuộc trò chuyện"
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-zinc-600 shadow-md backdrop-blur hover:text-[#8E6D45]"
                        >
                            ↓
                        </button>
                    )}
                </div>


                {/* INPUT AREA */}
                <div className="p-4 bg-white border-t border-zinc-200 shrink-0 rounded-b-[2.5rem]">
                    {!isLoggedIn && guestCount >= 3 ? (
                        // GIAO DIỆN CHẶN 
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center p-6 bg-gradient-to-b from-zinc-50 to-white rounded-[2rem] border border-dashed border-[#B8985D]/40 shadow-inner"
                        >
                            <div className="w-12 h-12 bg-[#B8985D]/10 rounded-full flex items-center justify-center mb-3">
                                <SparklesIcon className="w-6 h-6 text-[#B8985D]" />
                            </div>
                            <p className="text-[13px] font-bold text-zinc-600 text-center mb-4 leading-relaxed">
                                Bạn đã hết lượt chat thử nghiệm. <br />
                                <span className="text-[#B8985D]">Đăng nhập</span> để tiếp tục sử dụng LegAI.
                            </p>
                            <button
                                onClick={() => navigate("/login?redirect=/chatbot")}
                                className="w-full py-3.5 bg-[#1A2530] text-white rounded-2xl text-[13px] font-black hover:bg-[#B8985D] transition-all shadow-xl shadow-zinc-200 active:scale-95"
                            >
                                ĐĂNG NHẬP NGAY
                            </button>
                            <button
                                onClick={() => navigate("/register")}
                                className="mt-3 text-[11px] font-bold text-zinc-400 hover:text-zinc-600 underline underline-offset-4"
                            >
                                Tạo tài khoản mới miễn phí
                            </button>
                        </motion.div>
                    ) : (
                        // Ô NHẬP TEXT BÌNH THƯỜNG
                        <form onSubmit={handleSend} className="relative flex items-end">
                            <textarea
                                ref={textareaRef}
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isLoggedIn ? "Nhập câu hỏi pháp lý..." : `Dùng thử (${3 - guestCount} lượt còn lại)...`}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3.5 pl-4 pr-12 text-sm font-medium focus:outline-none focus:border-[#B8985D] focus:ring-1 focus:ring-[#B8985D]/30 resize-none transition-all duration-200 custom-scrollbar placeholder:text-zinc-400 text-[#1A2530]"
                                style={{ minHeight: '48px' }}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className={`absolute right-1.5 bottom-1.5 h-[36px] w-[36px] flex items-center justify-center rounded-xl transition-all shadow-sm ${!input.trim() || isLoading
                                    ? 'bg-zinc-100 text-zinc-400'
                                    : 'bg-[#1A2530] text-white hover:bg-[#B8985D]'
                                    }`}
                            >
                                <PaperAirplaneIcon className="w-4 h-4 stroke-2 -rotate-45" />
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
