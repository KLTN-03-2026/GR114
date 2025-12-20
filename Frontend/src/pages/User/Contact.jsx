import React, { useState } from 'react';
import Header from "../../components/PageHeader";
import {
    EnvelopeIcon,
    PhoneIcon,
    MapPinIcon,
    ChatBubbleLeftRightIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

export default function Contact() {
    const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });

    const handleSubmit = (e) => {
        e.preventDefault();
        alert("Cảm ơn bạn! Yêu cầu của bạn đã được gửi đến đội ngũ luật sư. chúng tôi sẽ phản hồi trong vòng 24h.");
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
            <Header />

            {/* Hero Section - Đồng bộ với trang Giới thiệu */}
            <section className="bg-slate-900 text-white pt-20 pb-32 px-6 text-center">
                <div className="max-w-3xl mx-auto space-y-4">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight italic uppercase">
                        Liên hệ với chúng tôi
                    </h1>
                    <p className="text-slate-400 text-lg font-medium">
                        Đội ngũ luật sư và chuyên gia AI luôn sẵn sàng lắng nghe và hỗ trợ bạn.
                    </p>
                </div>
            </section>

            <main className="max-w-6xl mx-auto px-4 -mt-16 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Cột trái: Thông tin liên lạc */}
                    <aside className="lg:col-span-5 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 space-y-8">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic">
                                Thông tin hỗ trợ
                            </h2>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                                        <MapPinIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Địa chỉ văn phòng</p>
                                        <p className="font-semibold text-slate-700 leading-relaxed">Thanh Khê Thạc Gián, Quận Thanh Khê, TP. Đà Nẵng</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-green-50 rounded-xl text-green-600">
                                        <PhoneIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Hotline tư vấn</p>
                                        <p className="font-semibold text-slate-700 text-lg">033 444 5555</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-orange-50 rounded-xl text-orange-600">
                                        <EnvelopeIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email hỗ trợ</p>
                                        <p className="font-semibold text-slate-700">support@legalai.vn</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                                        <ClockIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Giờ làm việc</p>
                                        <p className="font-semibold text-slate-700">Thứ 2 - Thứ 6: 08:00 - 18:00</p>
                                        <p className="text-sm text-slate-400 italic">Hỗ trợ AI 24/7 trên ứng dụng</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bản đồ nhúng */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden h-64 grayscale hover:grayscale-0 transition-all duration-500">
                            <iframe
                                title="map"
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3833.895551532454!2d108.21200381485848!3d16.05943268888746!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTbCsDAzJzM0LjAiTiAxMDjCsDEyJzUxLjEiRQ!5e0!3m2!1svi!2s!4v1625123456789"
                                width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"
                            ></iframe>
                        </div>
                    </aside>

                    {/* Cột phải: Form gửi yêu cầu */}
                    <section className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-slate-900 rounded-lg text-white">
                                <ChatBubbleLeftRightIcon className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Gửi yêu cầu hỗ trợ</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Họ và tên</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                                        placeholder="Nguyễn Văn A"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Địa chỉ Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                                        placeholder="example@gmail.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chủ đề cần hỗ trợ</label>
                                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all appearance-none">
                                    <option>Tư vấn hợp đồng bằng AI</option>
                                    <option>Đặt lịch hẹn với luật sư</option>
                                    <option>Hỗ trợ kỹ thuật tài khoản</option>
                                    <option>Khác</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nội dung tin nhắn</label>
                                <textarea
                                    rows="6"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all resize-none"
                                    placeholder="Vui lòng mô tả chi tiết vấn đề bạn đang gặp phải..."
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
                            >
                                Gửi thông tin ngay
                            </button>
                        </form>
                    </section>
                </div>
            </main>
        </div>
    );
}