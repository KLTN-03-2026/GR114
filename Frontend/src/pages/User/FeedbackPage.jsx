import React, { useState } from 'react';
import Header from "../../components/PageHeader";
import {
    BugAntIcon,
    LightBulbIcon,
    HandThumbUpIcon,
    EllipsisHorizontalCircleIcon,
    PaperAirplaneIcon,
    ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';

export default function FeedbackPage() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        type: "Góp ý",
        rating: 0,
        content: ""
    });

    const feedbackTypes = [
        { id: 'Báo lỗi', icon: BugAntIcon },
        { id: 'Góp ý', icon: LightBulbIcon },
        { id: 'Khen ngợi', icon: HandThumbUpIcon },
        { id: 'Khác', icon: EllipsisHorizontalCircleIcon },
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        // Kiểm tra dữ liệu bắt buộc
        if (!formData.name || !formData.email || !formData.content) {
            alert("Vui lòng điền đầy đủ các trường yêu cầu có dấu *");
            return;
        }
        alert("Gửi phản hồi thành công! Cảm ơn ý kiến của bạn.");
        window.history.back();
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
            <Header />

            <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-grow">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                        <div className="flex items-center gap-3">
                            <ChatBubbleLeftRightIcon className="w-8 h-8" />
                            <div>
                                <h1 className="text-xl font-bold uppercase tracking-tight">Gửi Phản Hồi</h1>
                                <p className="text-xs opacity-80 italic">Chúng tôi luôn lắng nghe ý kiến từ bạn</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Họ và tên *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nhập tên của bạn"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all"
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Email *</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="email@example.com"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all"
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Loại phản hồi *</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {feedbackTypes.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: item.id })}
                                        className={`flex items-center gap-2 justify-center py-2.5 border rounded-xl transition-all ${formData.type === item.id
                                                ? "border-purple-600 bg-purple-50 text-purple-700 font-bold shadow-sm"
                                                : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300"
                                            }`}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        <span className="text-xs">{item.id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="py-2 border-y border-slate-50 text-center">
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Mức độ hài lòng</label>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        className="transition-transform active:scale-90"
                                        onClick={() => setFormData({ ...formData, rating: star })}
                                    >
                                        {formData.rating >= star
                                            ? <StarSolid className="w-8 h-8 text-yellow-400" />
                                            : <StarOutline className="w-8 h-8 text-slate-200" />
                                        }
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Nội dung chi tiết *</label>
                            <textarea
                                required
                                rows="4"
                                placeholder="Chia sẻ ý kiến hoặc báo lỗi tại đây..."
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all resize-none"
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95"
                        >
                            <PaperAirplaneIcon className="w-4 h-4 -rotate-45" />
                            Gửi phản hồi
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}