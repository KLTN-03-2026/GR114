import React, { useState } from 'react';
import {
    EnvelopeIcon,
    PhoneIcon,
    MapPinIcon,
    ChatBubbleLeftRightIcon,
    ClockIcon,
    PaperAirplaneIcon
} from '@heroicons/react/24/outline';

export default function Contact() {
    const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });

    const handleSubmit = (e) => {
        e.preventDefault();
        alert("Cảm ơn bạn! Yêu cầu của bạn đã được gửi đến đội ngũ luật sư. Chúng tôi sẽ phản hồi trong vòng 24h.");
    };

    return (

        // Để cho phép cuộn dọc xuống xem hết nội dung
        <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">

            {/* Hiệu ứng nền Glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            {/* HERO SECTION */}
            <section className="relative pt-32 pb-32 px-6 text-center">
                <div className="max-w-3xl mx-auto space-y-6 animate-fadeInUp">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
                        <ChatBubbleLeftRightIcon className="w-4 h-4" /> Hỗ trợ 24/7
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight uppercase italic leading-tight">
                        Liên hệ với <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                            Chúng tôi
                        </span>
                    </h1>
                    <p className="text-gray-400 text-lg font-medium max-w-2xl mx-auto">
                        Đội ngũ luật sư và chuyên gia AI luôn sẵn sàng lắng nghe và hỗ trợ bạn giải quyết mọi vấn đề pháp lý.
                    </p>
                </div>
            </section>

            <main className="max-w-7xl mx-auto px-6 -mt-16 pb-20 relative z-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* CỘT TRÁI: THÔNG TIN */}
                    <aside className="lg:col-span-5 space-y-6">
                        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 space-y-8 h-full">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight italic flex items-center gap-2">
                                <span className="w-1 h-8 bg-cyan-500 rounded-full"></span>
                                Thông tin hỗ trợ
                            </h2>

                            <div className="space-y-6">
                                {/* Item 1: Địa chỉ */}
                                <div className="flex items-start gap-5 group">
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black transition-all duration-300">
                                        <MapPinIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 group-hover:text-cyan-400 transition-colors">Địa chỉ văn phòng</p>
                                        <p className="font-semibold text-gray-200 leading-relaxed">Thanh Khê Thạc Gián, Quận Thanh Khê, TP. Đà Nẵng</p>
                                    </div>
                                </div>

                                {/* Item 2: Hotline */}
                                <div className="flex items-start gap-5 group">
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-green-400 group-hover:bg-green-500 group-hover:text-black transition-all duration-300">
                                        <PhoneIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 group-hover:text-green-400 transition-colors">Hotline tư vấn</p>
                                        <p className="font-bold text-white text-lg tracking-wide">033 444 5555</p>
                                    </div>
                                </div>

                                {/* Item 3: Email */}
                                <div className="flex items-start gap-5 group">
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-orange-400 group-hover:bg-orange-500 group-hover:text-black transition-all duration-300">
                                        <EnvelopeIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 group-hover:text-orange-400 transition-colors">Email hỗ trợ</p>
                                        <p className="font-semibold text-gray-200">support@legalai.vn</p>
                                    </div>
                                </div>

                                {/* Item 4: Giờ làm việc */}
                                <div className="flex items-start gap-5 group">
                                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-purple-400 group-hover:bg-purple-500 group-hover:text-black transition-all duration-300">
                                        <ClockIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 group-hover:text-purple-400 transition-colors">Giờ làm việc</p>
                                        <p className="font-semibold text-gray-200">Thứ 2 - Thứ 6: 08:00 - 18:00</p>
                                        <p className="text-sm text-cyan-400 italic mt-1 font-medium">Hỗ trợ AI 24/7 trên ứng dụng</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bản đồ */}
                        <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden h-64 grayscale hover:grayscale-0 transition-all duration-700 shadow-2xl">
                            <iframe
                                title="map"
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3834.110435402535!2d108.20986531416955!3d16.05975803962638!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x314219b4c48979b9%3A0x6e9a6565155601d8!2zVGjhuqFjIEdpw6FuLCBUaGFuaCBLaMOqLCBEYSBOYW5nLCBWaWV0bmFt!5e0!3m2!1sen!2s!4v1645500000000!5m2!1sen!2s"
                                width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"
                                className="opacity-80 hover:opacity-100 transition-opacity"
                            ></iframe>
                        </div>
                    </aside>

                    {/* CỘT PHẢI: FORM */}
                    <section className="lg:col-span-7 bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-8 md:p-12 shadow-2xl">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl text-white shadow-lg shadow-cyan-500/20">
                                <PaperAirplaneIcon className="w-6 h-6 -rotate-45 translate-x-0.5 -translate-y-0.5" />
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight italic">Gửi yêu cầu hỗ trợ</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 group-focus-within:text-cyan-400 transition-colors">Họ và tên</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                        placeholder="Nguyễn Văn A"
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 group-focus-within:text-cyan-400 transition-colors">Địa chỉ Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                        placeholder="example@gmail.com"
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 group-focus-within:text-cyan-400 transition-colors">Chủ đề cần hỗ trợ</label>
                                <div className="relative">
                                    <select
                                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all appearance-none cursor-pointer hover:bg-white/10"
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    >
                                        <option className="bg-gray-900 text-gray-300">Tư vấn hợp đồng bằng AI</option>
                                        <option className="bg-gray-900 text-gray-300">Đặt lịch hẹn với luật sư</option>
                                        <option className="bg-gray-900 text-gray-300">Hỗ trợ kỹ thuật tài khoản</option>
                                        <option className="bg-gray-900 text-gray-300">Khác</option>
                                    </select>
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1 group-focus-within:text-cyan-400 transition-colors">Nội dung tin nhắn</label>
                                <textarea
                                    rows="6"
                                    required
                                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all resize-none"
                                    placeholder="Vui lòng mô tả chi tiết vấn đề bạn đang gặp phải..."
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-4 rounded-xl font-black uppercase tracking-[0.2em] hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-500/25 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 group"
                            >
                                <PaperAirplaneIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                Gửi thông tin ngay
                            </button>
                        </form>
                    </section>
                </div>
            </main>
        </div>
    );
}