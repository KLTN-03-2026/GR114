import React, { useState } from 'react';
import { 
    PaperAirplaneIcon, 
    DocumentArrowDownIcon, 
    PrinterIcon, 
    SparklesIcon,
    ChatBubbleLeftEllipsisIcon
} from '@heroicons/react/24/outline';

export default function FormGeneration() {
    // State quản lý tin nhắn chat (Mock data)
    const [messages, setMessages] = useState([
        { id: 1, sender: 'ai', text: 'Chào bạn! Tôi là trợ lý LegalBot. Bạn đang cần soạn thảo loại văn bản pháp lý hoặc hợp đồng nào hôm nay?' }
    ]);
    const [inputValue, setInputValue] = useState('');

    // Xử lý gửi tin nhắn (UI demo)
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        // Thêm tin nhắn user
        const newMsg = { id: Date.now(), sender: 'user', text: inputValue };
        setMessages([...messages, newMsg]);
        setInputValue('');

        // Giả lập AI phản hồi sau 1s
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                id: Date.now() + 1, 
                sender: 'ai', 
                text: 'Tôi đã hiểu. Dựa trên Luật Nhà ở hiện hành, tôi đã khởi tạo Form "Hợp đồng thuê nhà ở" ở bên phải. Bạn vui lòng điền các thông tin vào chỗ trống nhé!' 
            }]);
        }, 1000);
    };

    // Class dùng chung cho kính mờ
    const glassPanel = "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-3xl";

    return (
        // Container chiếm toàn bộ chiều cao còn lại dưới Header (giả sử Header cao 80px)
        <div className="w-full h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col md:flex-row gap-6 selection:bg-cyan-500/30 text-white">
            
            {/* ==========================================
                CỘT TRÁI: KHUNG CHAT AI (RAG & GEMINI)
            ========================================== */}
            <div className={`w-full md:w-[400px] lg:w-[450px] flex flex-col h-full ${glassPanel} overflow-hidden flex-shrink-0`}>
                {/* Header Chat */}
                <div className="p-5 border-b border-white/10 bg-white/5 flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                        <SparklesIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg tracking-wide text-white">Trợ lý Soạn thảo</h2>
                        <p className="text-xs text-gray-400">LegalBot AI đang sẵn sàng</p>
                    </div>
                </div>

                {/* Khu vực hiển thị tin nhắn */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${
                                msg.sender === 'user' 
                                ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-none' 
                                : 'bg-white/10 text-gray-200 border border-white/10 rounded-tl-none'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {/* Element thông báo đang gõ (nếu cần) */}
                </div>

                {/* Khu vực nhập liệu */}
                <div className="p-4 border-t border-white/10 bg-black/40">
                    <form onSubmit={handleSendMessage} className="relative flex items-center">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="VD: Viết cho tôi hợp đồng thuê nhà..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all"
                        />
                        <button 
                            type="submit"
                            className="absolute right-2 p-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl transition-colors shadow-lg"
                        >
                            <PaperAirplaneIcon className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>

            {/* ==========================================
                CỘT PHẢI: KHUNG ĐIỀN BIỂU MẪU (GIẤY A4)
            ========================================== */}
            <div className={`flex-1 flex flex-col h-full ${glassPanel} overflow-hidden relative`}>
                
                {/* Header Document */}
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center px-6">
                    <div className="flex items-center gap-2 text-gray-300">
                        <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-pink-400" />
                        <span className="text-sm font-semibold uppercase tracking-widest">Bản thảo: Hợp đồng thuê nhà</span>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors border border-white/5">
                            <PrinterIcon className="w-4 h-4" /> In ấn
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 rounded-lg text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all">
                            <DocumentArrowDownIcon className="w-4 h-4" /> Xuất PDF
                        </button>
                    </div>
                </div>

                {/* Khu vực chứa tờ giấy A4 cuộn được */}
                <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-black/40 custom-scrollbar">
                    
                    {/* TỜ GIẤY A4 - TRẮNG */}
                    <div className="max-w-[210mm] mx-auto min-h-[297mm] bg-[#f8f9fa] text-gray-900 p-12 md:p-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-sm relative">
                        
                        {/* Quốc hiệu */}
                        <div className="text-center mb-10">
                            <h3 className="font-bold text-lg uppercase">Cộng hòa Xã hội Chủ nghĩa Việt Nam</h3>
                            <h4 className="font-bold text-base underline decoration-1 underline-offset-4">Độc lập - Tự do - Hạnh phúc</h4>
                        </div>

                        {/* Tiêu đề */}
                        <div className="text-center mb-12">
                            <h1 className="text-2xl font-black uppercase mb-2">Hợp đồng thuê nhà ở</h1>
                            <p className="text-sm text-gray-600 italic">Hôm nay, ngày ... tháng ... năm 202..., tại ........................................</p>
                        </div>

                        {/* Form nhập liệu (Sinh ra bởi AI) */}
                        <div className="space-y-8 text-justify leading-relaxed">
                            
                            {/* Bên A */}
                            <div className="space-y-4">
                                <h2 className="font-bold text-lg uppercase">Bên cho thuê nhà (Bên A):</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Họ và tên</label>
                                        <input type="text" placeholder="Nhập tên bên cho thuê..." className="w-full border-b border-gray-300 bg-transparent py-2 focus:outline-none focus:border-cyan-600 transition-colors placeholder-gray-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Số CCCD/CMND</label>
                                        <input type="text" placeholder="Nhập số CCCD..." className="w-full border-b border-gray-300 bg-transparent py-2 focus:outline-none focus:border-cyan-600 transition-colors placeholder-gray-400" />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Địa chỉ thường trú</label>
                                        <input type="text" placeholder="Nhập địa chỉ..." className="w-full border-b border-gray-300 bg-transparent py-2 focus:outline-none focus:border-cyan-600 transition-colors placeholder-gray-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Căn cứ luật do RAG nhả ra (Chỉ đọc) */}
                            <div className="p-4 bg-blue-50/50 border-l-4 border-cyan-500 text-sm text-gray-700 rounded-r-lg">
                                <strong className="text-cyan-800">Căn cứ pháp lý (Đã cập nhật):</strong>
                                <ul className="list-disc ml-5 mt-2 space-y-1">
                                    <li>Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</li>
                                    <li>Căn cứ Luật Nhà ở số 27/2023/QH15 ngày 27/11/2023;</li>
                                </ul>
                            </div>

                            {/* Điều khoản */}
                            <div className="space-y-4 pt-4">
                                <h2 className="font-bold text-lg uppercase">Điều 1: Nội dung thỏa thuận</h2>
                                <p>
                                    Bên A đồng ý cho Bên B thuê căn nhà tại địa chỉ: 
                                    <input type="text" className="inline-block w-64 border-b border-dashed border-gray-400 bg-transparent mx-2 focus:outline-none focus:border-cyan-600 text-center" placeholder="[Nhập địa chỉ nhà thuê]" />
                                    với tổng diện tích sử dụng là 
                                    <input type="text" className="inline-block w-20 border-b border-dashed border-gray-400 bg-transparent mx-2 focus:outline-none focus:border-cyan-600 text-center" placeholder="[Số]" /> m².
                                </p>
                                <p>
                                    Thời hạn thuê nhà là 
                                    <input type="text" className="inline-block w-20 border-b border-dashed border-gray-400 bg-transparent mx-2 focus:outline-none focus:border-cyan-600 text-center" placeholder="[Số tháng]" />
                                    tháng, tính từ ngày bàn giao nhà.
                                </p>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            <style>
                {`
                    /* Tùy chỉnh thanh cuộn cho mượt mà */
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 8px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background-color: rgba(255, 255, 255, 0.1);
                        border-radius: 20px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background-color: rgba(34, 211, 238, 0.5); /* Màu Cyan khi hover */
                    }
                `}
            </style>
        </div>
    );
}