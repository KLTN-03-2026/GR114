import React, { useState } from 'react';
import {
    PaperAirplaneIcon,
    DocumentArrowDownIcon,
    PrinterIcon,
    SparklesIcon,
    ChatBubbleLeftEllipsisIcon,
    DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import aiClient from "../api/aiClient"; 

export default function FormGeneration() {
    // STATE QUẢN LÝ CHAT
    const [messages, setMessages] = useState([
        { id: 1, sender: 'ai', text: 'Chào bạn! Tôi là trợ lý LegAI. Bạn cần tạo hợp đồng gì? (VD: Soạn hợp đồng dịch vụ tư vấn pháp lý, tôi là Công ty A, MST 12345, phí dịch vụ 50 triệu...)' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // STATE QUẢN LÝ BIỂU MẪU (Dựa trên cấu trúc chuẩn bạn cung cấp)
    const [currentTemplate, setCurrentTemplate] = useState('none');
    const [formData, setFormData] = useState({
        // Căn cứ pháp lý
        can_cu_luat: [],

        // Thông tin Bên A
        benA_name: '',
        benA_id: '', // CCCD hoặc MST
        benA_address: '',
        benA_phone: '',
        benA_rep: '', // Người đại diện

        // Thông tin Bên B
        benB_name: '',
        benB_id: '',
        benB_address: '',
        benB_phone: '',
        benB_rep: '',

        // Nội dung thỏa thuận
        noi_dung_chinh: '',
        gia_tri_hop_dong: '',
        thoi_han: ''
    });

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        // 1. Cập nhật tin nhắn của User lên UI
        const newUserMsg = { id: Date.now(), sender: 'user', text: inputValue };
        setMessages(prev => [...prev, newUserMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            // 2. GỌI API THẬT XUỐNG BACKEND
            const chatHistory = messages.map(m => ({ role: m.sender, content: m.text }));
            const response = await aiClient.generateForm({
                text: inputValue,
                history: chatHistory
            });
            const aiData = response.data; // Cấu trúc JSON

            // 3. CẬP NHẬT UI DỰA TRÊN DATA THẬT
            setCurrentTemplate(aiData.template_type);

            // Hàm merge cực hay: Chỉ đè những trường AI bóc được (không phải chuỗi rỗng) vào Form hiện tại
            setFormData(prev => {
                const newData = { ...prev };
                for (const key in aiData.extracted_data) {
                    if (aiData.extracted_data[key] && aiData.extracted_data[key].length > 0) {
                        newData[key] = aiData.extracted_data[key];
                    }
                }
                return newData;
            });

            // Hiển thị câu trả lời của AI
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiData.chat_reply }]);

        } catch (error) {
            console.error("Lỗi gọi AI Form:", error);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'ai',
                text: 'Xin lỗi, hệ thống bóc tách dữ liệu đang bận. Bạn có thể tự điền tay vào biểu mẫu bên phải nhé!'
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handlePrint = () => window.print();
    const glassPanel = "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-3xl";

    // Component Input dùng chung để tái sử dụng
    const FieldInput = ({ label, field, placeholder }) => (
        <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-800 text-[13px] print:text-black min-w-[120px]">- {label}:</span>
            <input
                type="text"
                value={formData[field]}
                onChange={(e) => handleFormChange(field, e.target.value)}
                placeholder={placeholder}
                className="flex-1 border-b border-dashed border-gray-400 bg-transparent py-0.5 focus:outline-none focus:border-cyan-600 transition-colors placeholder-gray-400 print:border-none print:p-0 font-medium text-[14px]"
            />
        </div>
    );

    return (
        <div className="w-full h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col md:flex-row gap-6 text-white selection:bg-cyan-500/30">

            {/* CỘT TRÁI: CHAT AI */}
            <div className={`w-full md:w-[400px] lg:w-[450px] flex flex-col h-full ${glassPanel} overflow-hidden flex-shrink-0`}>
                
                {/* Header Cột Chat */}
                <div className="p-5 border-b border-white/10 bg-white/5 flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                        <SparklesIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-white">Trợ lý Biểu mẫu</h2>
                        <p className="text-xs text-gray-400">Tự động điền Hợp đồng chuẩn</p>
                    </div>
                </div>

                {/* Khu vực hiển thị tin nhắn  */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${msg.sender === 'user' ? 'bg-gradient-to-br from-cyan-600 to-blue-600 rounded-tr-none' : 'bg-white/10 text-gray-200 border border-white/10 rounded-tl-none'
                                }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white/10 border border-white/10 rounded-2xl rounded-tl-none p-4 flex gap-1.5 shadow-lg">
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Form nhập liệu */}
                <div className="p-4 border-t border-white/10 bg-black/40">
                    <form onSubmit={handleSendMessage} className="relative flex items-end">
                        <textarea
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                // Logic tự co giãn chiều cao (Auto-resize)
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                            }}
                            onKeyDown={(e) => {
                                // Nhấn Enter (không giữ Shift) để gửi
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                            placeholder="Nhập yêu cầu soạn hợp đồng (Shift + Enter để xuống dòng)..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:border-cyan-500/50 transition-all resize-none custom-scrollbar"
                            style={{ minHeight: '52px' }} // Chiều cao mặc định 1 dòng
                            disabled={isTyping}
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={isTyping || !inputValue.trim()}
                            className="absolute right-2 bottom-2 aspect-square h-[36px] flex items-center justify-center rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <PaperAirplaneIcon className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>

            {/* CỘT PHẢI: TỜ A4 */}
            <div className={`flex-1 flex flex-col h-full ${glassPanel} overflow-hidden relative print:shadow-none print:border-none print:bg-white print:text-black`}>

                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center px-6 print:hidden">
                    <div className="flex items-center gap-2 text-gray-300">
                        <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-pink-400" />
                        <span className="text-sm font-semibold uppercase tracking-widest">
                            {currentTemplate === 'none' ? 'Khu vực soạn thảo' : 'Bản thảo: Hợp Đồng'}
                        </span>
                    </div>
                    <button onClick={handlePrint} disabled={currentTemplate === 'none'} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                        <PrinterIcon className="w-4 h-4" /> In / Lưu PDF
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-black/40 print:bg-white custom-scrollbar print:p-0 print:overflow-visible text-[15px]">

                    {currentTemplate === 'none' && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                            <DocumentMagnifyingGlassIcon className="w-24 h-24 mb-4" />
                            <p className="text-lg font-medium">Trò chuyện với AI để sinh hợp đồng</p>
                        </div>
                    )}

                    {currentTemplate !== 'none' && (
                        <div
                            className="max-w-[210mm] mx-auto min-h-[297mm] bg-white text-gray-900 p-12 md:p-16 shadow-2xl relative print:shadow-none print:m-0 print:p-0 leading-relaxed"
                            style={{ fontFamily: '"Times New Roman", Times, serif', fontKerning: 'normal' }}
                        >
                            {/* QUỐC HIỆU */}
                            <div className="text-center mb-8">
                                <h3 className="font-bold text-[15px] uppercase">Cộng hòa Xã hội Chủ nghĩa Việt Nam</h3>
                                <h4 className="font-bold text-[15px] underline decoration-1 underline-offset-4 mb-2">Độc lập - Tự do - Hạnh phúc</h4>
                                <p className="text-sm italic text-gray-600">------o0o------</p>
                            </div>

                            {/* TIÊU ĐỀ HỢP ĐỒNG */}
                            <div className="text-center mb-6">
                                <h1 className="text-xl font-black uppercase mb-1">
                                    <input
                                        type="text"
                                        value={formData.ten_hop_dong}
                                        className="w-full text-center bg-transparent focus:outline-none print:border-none"
                                    />
                                </h1>
                                <p className="text-sm text-gray-600 italic">Hôm nay, ngày ... tháng ... năm 202..., tại ........................................</p>
                                <p className="text-sm text-gray-600 italic">Chúng tôi gồm có:</p>
                            </div>

                            <div className="space-y-6 text-justify">

                                {/* CĂN CỨ LUẬT */}
                                {formData.can_cu_luat.length > 0 && (
                                    <div className="italic text-sm space-y-1 mb-4">
                                        <p className="font-semibold">- Căn cứ theo:</p>
                                        {formData.can_cu_luat.map((luat, idx) => (
                                            <p key={idx} className="ml-4">- {luat}</p>
                                        ))}
                                    </div>
                                )}

                                {/* THÔNG TIN CHỦ THỂ (Áp dụng cho cả Công ty & Cá nhân) */}
                                <div className="space-y-4">
                                    <div>
                                        <h2 className="font-bold uppercase mb-2">BÊN A (BÊN THUÊ / SỬ DỤNG DỊCH VỤ):</h2>
                                        <div className="pl-4">
                                            <FieldInput label="Tên Cá nhân/Tổ chức" field="benA_name" placeholder="Tên Công ty hoặc người đại diện..." />
                                            <FieldInput label="Mã số thuế / CCCD" field="benA_id" placeholder="Nhập số..." />
                                            <FieldInput label="Địa chỉ" field="benA_address" placeholder="Nhập địa chỉ..." />
                                            <FieldInput label="Điện thoại" field="benA_phone" placeholder="Nhập SĐT..." />
                                            <FieldInput label="Người đại diện" field="benA_rep" placeholder="Họ tên và Chức vụ (nếu có)..." />
                                        </div>
                                    </div>

                                    <div>
                                        <h2 className="font-bold uppercase mb-2">BÊN B (BÊN CUNG CẤP DỊCH VỤ):</h2>
                                        <div className="pl-4">
                                            <FieldInput label="Tên Cá nhân/Tổ chức" field="benB_name" placeholder="Tên Công ty hoặc cá nhân..." />
                                            <FieldInput label="Mã số thuế / CCCD" field="benB_id" placeholder="Nhập số..." />
                                            <FieldInput label="Địa chỉ" field="benB_address" placeholder="Nhập địa chỉ..." />
                                            <FieldInput label="Điện thoại" field="benB_phone" placeholder="Nhập SĐT..." />
                                            <FieldInput label="Người đại diện" field="benB_rep" placeholder="Họ tên và Chức vụ (nếu có)..." />
                                        </div>
                                    </div>
                                    <p className="italic">Hai bên thỏa thuận và đồng ý ký kết Hợp đồng với các điều khoản sau:</p>
                                </div>

                                {/* CÁC ĐIỀU KHOẢN CỐT LÕI */}
                                <div className="space-y-4 pt-2">
                                    <div>
                                        <h2 className="font-bold uppercase">Điều 1: Nội dung và Phạm vi công việc</h2>
                                        <textarea
                                            value={formData.noi_dung_chinh}
                                            onChange={(e) => handleFormChange('noi_dung_chinh', e.target.value)}
                                            className="w-full mt-2 min-h-[60px] resize-none bg-transparent border-b border-dashed border-gray-400 focus:outline-none focus:border-cyan-600 print:border-none"
                                            placeholder="Ghi rõ nội dung thỏa thuận hoặc công việc thực hiện..."
                                        />
                                    </div>

                                    <div>
                                        <h2 className="font-bold uppercase">Điều 2: Giá trị Hợp đồng và Thanh toán</h2>
                                        <div className="mt-2 flex items-center flex-wrap gap-2">
                                            <span>- Tổng giá trị hợp đồng là:</span>
                                            <input
                                                type="text"
                                                value={formData.gia_tri_hop_dong}
                                                onChange={(e) => handleFormChange('gia_tri_hop_dong', e.target.value)}
                                                className="w-48 bg-transparent border-b border-dashed border-gray-400 focus:outline-none focus:border-cyan-600 print:border-none font-bold text-center"
                                                placeholder="VD: 50.000.000 VNĐ"
                                            />
                                        </div>
                                        <p className="mt-1">- Phương thức thanh toán: Chuyển khoản hoặc Tiền mặt.</p>
                                    </div>

                                    <div>
                                        <h2 className="font-bold uppercase">Điều 3: Thời hạn Hợp đồng</h2>
                                        <div className="mt-2 flex items-center flex-wrap gap-2">
                                            <span>- Hợp đồng này có hiệu lực trong</span>
                                            <input
                                                type="text"
                                                value={formData.thoi_han}
                                                onChange={(e) => handleFormChange('thoi_han', e.target.value)}
                                                className="w-20 bg-transparent border-b border-dashed border-gray-400 focus:outline-none focus:border-cyan-600 print:border-none font-bold text-center"
                                                placeholder="[Số]"
                                            />
                                            <span>tháng, kể từ ngày ký.</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h2 className="font-bold uppercase">Điều 4: Giải quyết tranh chấp và Điều khoản chung</h2>
                                        <p className="mt-1 text-justify">
                                            Mọi tranh chấp phát sinh từ Hợp đồng này trước hết được giải quyết thông qua thương lượng, hòa giải.
                                            Trường hợp không thể hòa giải, vụ việc sẽ được đưa ra Tòa án có thẩm quyền tại Việt Nam giải quyết theo pháp luật hiện hành.
                                            Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.
                                        </p>
                                    </div>
                                </div>

                                {/* CHỮ KÝ */}
                                <div className="pt-16 pb-10 grid grid-cols-2 gap-8 text-center break-inside-avoid">
                                    <div className="flex flex-col items-center">
                                        <h3 className="font-bold uppercase mb-1">Đại diện Bên A</h3>
                                        <p className="text-sm italic text-gray-500 mb-24">(Ký, đóng dấu và ghi rõ họ tên)</p>
                                        <p className="font-bold uppercase border-b border-dashed border-gray-400 min-w-[180px]">
                                            {formData.benA_rep || formData.benA_name || ""}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <h3 className="font-bold uppercase mb-1">Đại diện Bên B</h3>
                                        <p className="text-sm italic text-gray-500 mb-24">(Ký, đóng dấu và ghi rõ họ tên)</p>
                                        <p className="font-bold uppercase border-b border-dashed border-gray-400 min-w-[180px]">
                                            {formData.benB_rep || formData.benB_name || ""}
                                        </p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>
                {`
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 20px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(34, 211, 238, 0.5); }
                    @media print {
                        body { background: white; }
                        input, textarea { border: none !important; background: transparent !important; }
                        input::placeholder, textarea::placeholder { color: transparent; }
                    }
                `}
            </style>
        </div>
    );
}