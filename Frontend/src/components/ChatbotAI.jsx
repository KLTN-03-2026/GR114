import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
    XMarkIcon,
    PaperAirplaneIcon,
    CpuChipIcon,
    SparklesIcon,
    UserIcon,
    ArrowPathIcon,
    CloudArrowUpIcon,
    CheckBadgeIcon
} from '@heroicons/react/24/outline';
import aiClient from '../api/aiClient';

export default function ChatbotAI({ isOpen, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [chatMode, setChatMode] = useState('ai');
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Khởi tạo tin nhắn chào mừng
    useEffect(() => {
        setIsSaved(false);
        if (chatMode === 'ai') {
            setMessages([
                { id: 'ai-init', text: "Chào bạn! Tôi là LegalAI. Bạn cần thẩm định hay tư vấn điều khoản nào?", isBot: true }
            ]);
        } else {
            setMessages([
                { id: 'human-init', text: "Chào bạn! Bạn đã kết nối với chế độ Luật sư. Vui lòng mô tả vấn đề của bạn.", isBot: true }
            ]);
        }
    }, [chatMode]);

    // Tự động cuộn xuống tin nhắn mới
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    // Tự động giãn Textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    // --- HÀM LƯU HỘI THOẠI VÀO SQL ---
    const handleSaveChat = async () => {
        if (messages.length < 2) return;
        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 1 };
            const userId = user.id ?? user.Id ?? user.ID;

            // Lấy tin nhắn đầu tiên của User làm tiêu đề
            const firstUserMsg = messages.find(m => !m.isBot)?.text || "Cuộc trò chuyện mới";
            const displayTitle = firstUserMsg.length > 35 ? firstUserMsg.substring(0, 35) + "..." : firstUserMsg;

            const payload = {
                userId: userId,
                fileName: `Chat_${Date.now()}.json`,
                title: `Thảo luận: ${displayTitle}`,
                recordType: 'CHAT', // Nhãn để hiện Icon bóng thoại xanh lá
                riskScore: null,
                content: JSON.stringify(messages) // Lưu toàn bộ mảng tin nhắn
            };

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setIsSaved(true);
            }
        } catch (err) {
            console.error("Lỗi lưu Chat:", err);
            alert("❌ Không thể lưu hội thoại. Vui lòng kiểm tra đăng nhập.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { id: Date.now(), text: input, isBot: false };
        setMessages(prev => [...prev, userMsg]);
        const question = input;
        setInput("");
        setIsLoading(true);
        setIsSaved(false);

        try {
            if (chatMode === 'ai') {
                const res = await aiClient.ask(question);
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    text: res.message || res.answer, // Backend trả về res.message
                    isBot: true,
                    type: res.type || 'text',       // Nhận diện type 'contact'
                    lawyer: res.lawyer || null      // Nhận diện thông tin luật sư
                }]);
            } else {
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        id: Date.now() + 1,
                        text: "🔔 Đã gửi yêu cầu đến Luật sư trực. Vui lòng giữ kết nối trong ít phút.",
                        isBot: true
                    }]);
                    setIsLoading(false);
                }, 1500);
            }
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ Server LegAI đang bận, thử lại sau nhé Duy.", isBot: true }]);
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
            className="fixed bottom-24 right-8 w-[420px] h-[650px] z-[101] flex flex-col"
        >
            <div className="flex-grow flex flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-3xl shadow-[0_0_80px_rgba(34,211,238,0.15)]">

                {/* HEADER */}
                <div className="p-5 border-b border-white/10 bg-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-cyan-500/20">
                                <CpuChipIcon className="w-5 h-5 text-cyan-400" />
                            </div>
                            <h3 className="text-[10px] font-black text-white tracking-[0.3em] uppercase">LegAI Assistant</h3>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {/* NÚT LƯU CHAT */}
                            {messages.length > 1 && (
                                <button 
                                    onClick={handleSaveChat}
                                    disabled={isSaving || isSaved}
                                    className={`p-2 rounded-xl transition-all ${isSaved ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400 hover:text-cyan-400 hover:bg-white/5'}`}
                                    title="Lưu hội thoại"
                                >
                                    {isSaving ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : isSaved ? <CheckBadgeIcon className="w-5 h-5" /> : <CloudArrowUpIcon className="w-5 h-5" />}
                                </button>
                            )}
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-500 transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* SWITCHER */}
                    <div className="flex bg-black/50 p-1 rounded-xl border border-white/5 relative h-10">
                        <motion.div
                            className="absolute bg-cyan-500/10 border border-cyan-500/40 rounded-lg"
                            animate={{ x: chatMode === 'ai' ? 0 : '100%' }}
                            style={{ top: 4, bottom: 4, left: 4, width: 'calc(50% - 8px)' }}
                        />
                        <button onClick={() => setChatMode('ai')} className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black z-10 transition-all ${chatMode === 'ai' ? 'text-cyan-400' : 'text-gray-600'}`}>
                            <SparklesIcon className="w-3.5 h-3.5" /> AI CONSULTANT
                        </button>
                        <button onClick={() => setChatMode('human')} className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black z-10 transition-all ${chatMode === 'human' ? 'text-cyan-400' : 'text-gray-600'}`}>
                            <UserIcon className="w-3.5 h-3.5" /> LAWYER MODE
                        </button>
                    </div>
                </div>

                {/* CHAT BODY */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar bg-black/20">
                    <AnimatePresence mode='popLayout'>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: msg.isBot ? -10 : 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
                            >
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                    msg.isBot 
                                    ? 'bg-white/5 text-gray-300 rounded-tl-none border border-white/10' 
                                    : 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-tr-none shadow-lg shadow-cyan-900/20'
                                }`}>
                                    {msg.text}
                                    {/* HIỂN THỊ CARD LUẬT SƯ NẾU TYPE LÀ CONTACT */}
                                    {msg.isBot && msg.type === 'contact' && msg.lawyer && (
                                        <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl border-dashed animate-pulse">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-black font-bold">
                                                    LS
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-white">{msg.lawyer.name}</h4>
                                                    <p className="text-[10px] text-cyan-400 uppercase tracking-widest">{msg.lawyer.specialty}</p>
                                                </div>
                                            </div>
                                            {/* Thay đổi từ nút bấm thành Text bình thường */}
                                            <div className="flex items-center justify-center py-2 bg-white/5 text-gray-400 rounded-xl text-xs font-medium border border-white/5">
                                                Liên hệ: <span className="text-cyan-400 ml-1 font-bold">{msg.lawyer.phone}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {isLoading && (
                        <div className="flex items-center gap-2 text-[10px] text-cyan-500/60 font-black tracking-widest animate-pulse px-2">
                            {chatMode === 'ai' ? "PROCESSING LEGAL DATA..." : "CONNECTING TO LAWYER..."}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* INPUT AREA */}
                <form onSubmit={handleSend} className="p-5 bg-black/40 border-t border-white/10">
                    <div className="relative flex items-end gap-2 bg-white/5 border border-white/10 rounded-3xl px-4 py-2 focus-within:border-cyan-500/40 transition-all">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={chatMode === 'ai' ? "Hỏi LegAI về pháp luật..." : "Mô tả vấn đề cho luật sư..."}
                            className="flex-grow py-3 bg-transparent text-sm text-white outline-none resize-none custom-scrollbar max-h-[120px]"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className={`mb-2 p-2 rounded-xl transition-all ${!input.trim() || isLoading ? 'text-gray-700' : 'text-cyan-400 hover:bg-cyan-500/20'}`}
                        >
                            <PaperAirplaneIcon className="w-6 h-6 -rotate-45" />
                        </button>
                    </div>
                </form>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.1); border-radius: 10px; }
            `}</style>
        </motion.div>
    );
}