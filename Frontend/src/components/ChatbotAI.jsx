import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    XMarkIcon,
    PaperAirplaneIcon,
    CpuChipIcon,
    SparklesIcon,
    UserIcon,
    ChatBubbleLeftRightIcon,
    ArrowPathIcon // Dùng làm icon loading kết nối
} from '@heroicons/react/24/outline';
import aiClient from '../api/aiClient';

export default function ChatbotAI({ isOpen, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [chatMode, setChatMode] = useState('ai'); // 'ai' hoặc 'human'

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    // ==================================================================
    useEffect(() => {
        if (chatMode === 'ai') {
            setMessages([
                { id: 'ai-init', text: "Chào bạn! Tôi là LegalAI. Bạn cần thẩm định hay tư vấn điều khoản nào?", isBot: true }
            ]);
        } else {
            setMessages([
                { id: 'human-init', text: "Chào bạn! Bạn đã kết nối với chế độ Luật sư cộng tác. Vui lòng mô tả vấn đề, chúng tôi sẽ phản hồi ngay.", isBot: true }
            ]);
        }
    }, [chatMode]);
    // 1. Auto-resize Textarea (Tối đa 5 dòng)
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const scHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scHeight, 120)}px`;
        }
    }, [input]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { id: Date.now(), text: input, isBot: false };
        setMessages(prev => [...prev, userMsg]);
        const question = input;
        setInput("");
        setIsLoading(true);

        try {
            if (chatMode === 'ai') {
                const res = await aiClient.ask(question);
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    text: res.answer || "Tôi chưa rõ ý bạn,  có thể nói cụ thể hơn không?",
                    isBot: true
                }]);
            } else {
                // MÔ PHỎNG KẾT NỐI LUẬT SƯ THẬT
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        id: Date.now() + 1,
                        text: "🔔 Hệ thống đã chuyển yêu cầu đến Luật sư trực. Vui lòng giữ kết nối, chúng tôi sẽ phản hồi Duy trong ít phút.",
                        isBot: true
                    }]);
                    setIsLoading(false);
                }, 1500);
                return; // Thoát sớm để tránh setIsLoading(false) chạy ngay
            }
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ Server LegAI đang quá tải.", isBot: true }]);
        } finally {
            if (chatMode === 'ai') setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed bottom-24 right-8 w-[400px] h-[600px] z-[101] flex flex-col"
        >
            <div className="flex-grow flex flex-col overflow-hidden rounded-[2.5rem] border border-cyan-500/30 bg-[#0a0a0a]/95 backdrop-blur-3xl shadow-[0_0_60px_rgba(34,211,238,0.2)]">

                {/* HEADER + MODE SWITCHER */}
                <div className="p-5 border-b border-white/10 bg-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                                <CpuChipIcon className="w-5 h-5 text-cyan-400" />
                            </div>
                            <h3 className="text-[10px] font-black text-white tracking-[0.3em] uppercase">LegalAI Chat</h3>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-500 transition-colors">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* TOGGLE TỐI GIẢN - FIX LỖI "ĐƠ" */}
                    <div className="flex bg-black/50 p-1 rounded-xl border border-white/5 relative h-10">
                        <motion.div
                            className="absolute bg-cyan-500/10 border border-cyan-500/40 rounded-lg shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                            animate={{ x: chatMode === 'ai' ? 0 : '100%' }}
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            style={{ top: 4, bottom: 4, left: 4, width: 'calc(50% - 8px)' }}
                        />
                        <button
                            onClick={() => setChatMode('ai')} // FIX: setChatMode thay vì setMode
                            className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black z-10 transition-all ${chatMode === 'ai' ? 'text-cyan-400' : 'text-gray-600'}`}
                        >
                            <SparklesIcon className="w-3.5 h-3.5" /> AI CHAT
                        </button>
                        <button
                            onClick={() => setChatMode('human')} // FIX: setChatMode thay vì setMode
                            className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black z-10 transition-all ${chatMode === 'human' ? 'text-cyan-400' : 'text-gray-600'}`}
                        >
                            <UserIcon className="w-3.5 h-3.5" /> LUẬT SƯ
                        </button>
                    </div>
                </div>

                {/* MESSAGES BODY */}
                <div className="flex-grow p-6 overflow-y-auto space-y-4 custom-scrollbar">
                    <AnimatePresence mode='popLayout'>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: msg.isBot ? -10 : 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
                            >
                                {msg.isBot && (
                                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mr-2 shrink-0">
                                        {/* ĐỔI ICON THEO MODE CHO CHUẨN */}
                                        {chatMode === 'ai' ? (
                                            <SparklesIcon className="w-4 h-4 text-cyan-400" />
                                        ) : (
                                            <UserIcon className="w-4 h-4 text-cyan-400" />
                                        )}
                                    </div>
                                )}
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.isBot ? 'bg-white/5 text-gray-300 rounded-tl-none border border-white/10' : 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-tr-none'
                                    }`}>
                                    {msg.text}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <div className="flex items-center gap-2 text-[10px] text-cyan-400 font-bold tracking-widest animate-pulse">
                            {chatMode === 'ai' ? "AI ĐANG TRUY XUẤT LUẬT..." : "ĐANG KẾT NỐI LUẬT SƯ..."}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* FOOTER: SMART TEXTAREA */}
                <form onSubmit={handleSend} className="p-6 bg-black/20 border-t border-white/10">
                    <div className="relative flex items-end gap-2 bg-white/5 border border-white/10 rounded-[1.5rem] px-4 py-2 focus-within:border-cyan-500/50 transition-all">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={chatMode === 'ai' ? "Hỏi LegAI về pháp luật..." : "Mô tả vấn đề cho luật sư..."}
                            className="flex-grow py-2 bg-transparent text-sm text-white outline-none resize-none scrollbar-hide max-h-[120px]"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className={`mb-1 p-2 rounded-xl transition-all ${!input.trim() || isLoading ? 'text-gray-700' : 'text-cyan-400 hover:bg-cyan-500/20 hover:text-white'
                                }`}
                        >
                            <PaperAirplaneIcon className="w-6 h-6 -rotate-45" />
                        </button>
                    </div>
                </form>
            </div>
        </motion.div>
    );
}