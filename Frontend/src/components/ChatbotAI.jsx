import React, { useState } from 'react';
import { XMarkIcon, PaperAirplaneIcon, CpuChipIcon, UserIcon } from '@heroicons/react/24/outline';

export default function ChatbotAI({ isOpen, onClose }) {
    const [messages, setMessages] = useState([
        { id: 1, text: "Chào bạn! Tôi là LegalBot. Bạn cần hỗ trợ gì về pháp lý?", isBot: true }
    ]);
    const [input, setInput] = useState("");

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const newUserMsg = { id: Date.now(), text: input, isBot: false };
        setMessages([...messages, newUserMsg]);
        setInput("");

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: "Hệ thống đang ghi nhận thông tin. Vui lòng chờ trong giây lát...",
                isBot: true
            }]);
        }, 1000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-24 right-8 w-96 h-[500px] bg-white shadow-2xl rounded-2xl border border-gray-200 flex flex-col z-[100] animate-slide-up">
            <div className="p-4 border-b flex items-center justify-between">
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button className="flex items-center gap-1 px-3 py-1 bg-white rounded-md shadow-sm text-xs font-bold text-blue-600">
                        <CpuChipIcon className="w-4 h-4" /> LegalBot
                    </button>
                    <button
                        onClick={() => alert("Đang kết nối với Luật sư...")}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-700"
                    >
                        <UserIcon className="w-4 h-4" /> Người tư vấn
                    </button>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                    <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-gray-50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.isBot ? 'bg-white border text-gray-700' : 'bg-blue-600 text-white'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={handleSend} className="p-4 border-t relative">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Nhập thông tin cần trao đổi..."
                    className="w-full pl-4 pr-12 py-3 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button type="submit" className="absolute right-6 top-1/2 -translate-y-1/2 text-blue-600 hover:scale-110 transition">
                    <PaperAirplaneIcon className="w-6 h-6" />
                </button>
            </form>
        </div>
    );
}