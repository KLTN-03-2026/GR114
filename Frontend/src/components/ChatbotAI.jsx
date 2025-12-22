import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PaperAirplaneIcon, CpuChipIcon, UserIcon } from '@heroicons/react/24/outline';
// 👇 1. IMPORT CẦU NỐI AI
import aiClient from '../api/aiClient';

export default function ChatbotAI({ isOpen, onClose }) {
    // State lưu tin nhắn
    const [messages, setMessages] = useState([
        { id: 1, text: "Chào bạn! Tôi là LegalAI. Mình có thể giúp gì cho bạn?", isBot: true }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null); // Để tự động cuộn xuống dưới cùng

    // Tự động cuộn xuống khi có tin nhắn mới
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // 👇 HÀM GỬI TIN NHẮN (LOGIC CHÍNH)
    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        // 1. Hiển thị tin nhắn của User ngay lập tức
        const userMsg = { id: Date.now(), text: input, isBot: false };
        setMessages(prev => [...prev, userMsg]);

        const question = input; // Lưu lại câu hỏi
        setInput(""); // Xóa ô nhập liệu
        setIsLoading(true); // Bật chế độ loading

        try {
            // 2. GỌI API SANG AI ENGINE (PORT 8000)
            console.log("📡 Đang gửi câu hỏi:", question);
            const res = await aiClient.post('/chat/ask', {
                question: question
            });

            console.log("✅ AI Trả lời:", res);

            // 3. Hiển thị câu trả lời của AI
            const botMsg = {
                id: Date.now() + 1,
                text: res.data.answer || "Xin lỗi, tôi không tìm thấy thông tin này.", // Lấy field 'answer' từ server
                isBot: true
            };
            setMessages(prev => [...prev, botMsg]);

        } catch (error) {
            console.error("❌ Lỗi gọi AI:", error);
            const errorMsg = {
                id: Date.now() + 1,
                text: "⚠️ Lỗi kết nối: AI Engine chưa bật hoặc gặp sự cố.",
                isBot: true
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false); // Tắt loading dù thành công hay thất bại
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-24 right-8 w-96 h-[500px] bg-white shadow-2xl rounded-2xl border border-gray-200 flex flex-col z-[100] animate-slide-up font-sans">
            {/* --- HEADER --- */}
            <div className="p-4 border-b flex items-center justify-between bg-white rounded-t-2xl">
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button className="flex items-center gap-1 px-3 py-1 bg-white rounded-md shadow-sm text-xs font-bold text-blue-600">
                        <CpuChipIcon className="w-4 h-4" /> LegalBot
                    </button>
                    <button
                        onClick={() => alert("Chức năng kết nối Luật sư thật đang phát triển...")}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-700"
                    >
                        <UserIcon className="w-4 h-4" /> Người tư vấn
                    </button>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition">
                    <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
            </div>

            {/* --- BODY (DANH SÁCH TIN NHẮN) --- */}
            <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-gray-50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
                        {msg.isBot && <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2"><CpuChipIcon className="w-5 h-5 text-blue-600" /></div>}

                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm ${msg.isBot
                            ? 'bg-white border text-gray-700 rounded-tl-none'
                            : 'bg-blue-600 text-white rounded-tr-none'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}

                {/* Hiệu ứng đang gõ... */}
                {isLoading && (
                    <div className="flex justify-start animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2"><CpuChipIcon className="w-5 h-5 text-blue-600" /></div>
                        <div className="bg-gray-200 px-4 py-3 rounded-2xl rounded-tl-none text-xs text-gray-500">
                            Bot đang suy nghĩ...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* --- FOOTER (INPUT) --- */}
            <form onSubmit={handleSend} className="p-4 border-t relative bg-white rounded-b-2xl">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Nhập câu hỏi pháp lý..."
                    disabled={isLoading} // Khóa ô nhập khi đang loading
                    className="w-full pl-4 pr-12 py-3 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className={`absolute right-6 top-1/2 -translate-y-1/2 text-blue-600 transition ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                >
                    <PaperAirplaneIcon className="w-6 h-6" />
                </button>
            </form>
        </div>
    );
}