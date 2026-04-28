import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PaperAirplaneIcon, CpuChipIcon, SparklesIcon } from '@heroicons/react/24/outline';
import aiClient from '../api/aiClient';

export default function ChatbotAI({ isOpen, onClose }) {
    const [messages, setMessages] = useState([
        { id: 1, text: "Chào bạn! Tôi là LegalAI. Mình có thể giúp gì cho bạn?", isBot: true }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { id: Date.now(), text: input, isBot: false };
        setMessages(prev => [...prev, userMsg]);
        const question = input;
        setInput("");
        setIsLoading(true);

        try {
            const res = await aiClient.ask(question); 
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: res.answer || "Xin lỗi, tôi không tìm thấy thông tin này.", 
                isBot: true
            }]);
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ Lỗi kết nối AI.", isBot: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-24 right-8 w-[380px] h-[520px] z-[101] flex flex-col animate-slide-up">
            <div className="flex-grow flex flex-col overflow-hidden rounded-[2rem] border border-cyan-500/30 bg-black/85 backdrop-blur-2xl shadow-[0_0_50px_rgba(34,211,238,0.2)]">
                
                {/* HEADER */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                            <CpuChipIcon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <h3 className="text-sm font-black text-white tracking-widest uppercase">LegalAI Bot</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* MESSAGES BODY */}
                <div className="flex-grow p-5 overflow-y-auto space-y-4 bg-gradient-to-b from-transparent to-cyan-950/20 custom-scrollbar">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
                            {msg.isBot && (
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mr-2 shrink-0">
                                    <SparklesIcon className="w-4 h-4 text-cyan-400" />
                                </div>
                            )}
                            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                                msg.isBot ? 'bg-white/10 text-gray-200 rounded-tl-none border border-white/10' : 'bg-cyan-600 text-white rounded-tr-none'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && <div className="text-xs text-cyan-400/50 animate-pulse">Bot đang suy nghĩ...</div>}
                    <div ref={messagesEndRef} />
                </div>

                {/* INPUT FOOTER */}
                <form onSubmit={handleSend} className="p-4 bg-black/40 border-t border-white/10">
                    <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Nhập câu hỏi..."
                            className="w-full pl-4 pr-12 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:border-cyan-500/50 outline-none"
                        />
                        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-white transition-all">
                            <PaperAirplaneIcon className="w-6 h-6 -rotate-45" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}