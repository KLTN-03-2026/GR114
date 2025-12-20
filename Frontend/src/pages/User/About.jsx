import React from 'react';
import Header from "../../components/PageHeader";
import {
    CpuChipIcon,
    CheckBadgeIcon,
    ClockIcon,
    UserGroupIcon,
    SparklesIcon
} from '@heroicons/react/24/outline';

export default function About() {
    const stats = [
        { id: 1, label: "Hợp đồng đã phân tích", value: "50,000+", icon: CpuChipIcon },
        { id: 2, label: "Độ chính xác", value: "98%", icon: CheckBadgeIcon },
        { id: 3, label: "Thời gian phân tích TB", value: "5 phút", icon: ClockIcon },
        { id: 4, label: "Người dùng tin tưởng", value: "10,000+", icon: UserGroupIcon },
    ];

    return (
        <div className="min-h-screen bg-white font-sans">
            <Header />

            <main className="flex flex-col">
                <section className="bg-gradient-to-b from-orange-500 to-orange-600 text-white pt-20 pb-40 px-6 text-center">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm">
                            <SparklesIcon className="w-4 h-4" /> Công nghệ AI & Pháp lý
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                            Giới Thiệu Ứng Dụng Tư Vấn Pháp Lý
                        </h1>
                        <p className="text-lg opacity-90 max-w-2xl mx-auto leading-relaxed">
                            Ứng dụng tư vấn pháp lý thông minh tích hợp AI để phân tích hợp đồng,
                            giúp bạn hiểu rõ quyền lợi và nghĩa vụ, phát hiện rủi ro trước khi ký kết.
                        </p>
                    </div>
                </section>

                <section className="max-w-6xl mx-auto w-full px-6 -mt-24">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {stats.map((stat) => (
                            <div
                                key={stat.id}
                                className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl shadow-xl text-center text-white transform hover:scale-105 transition-all duration-300 cursor-default group"
                            >
                                <p className="text-3xl font-black mb-2 tracking-tighter">{stat.value}</p>
                                <p className="text-xs font-bold uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="max-w-6xl mx-auto w-full px-6 py-24 space-y-24">
                    <div className="relative group rounded-3xl overflow-hidden shadow-2xl border border-slate-100">
                        <img
                            src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=2000"
                            alt="Legal Analysis Visual"
                            className="w-full h-[500px] object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute bottom-8 left-8 bg-black/40 backdrop-blur-md px-6 py-3 rounded-xl border border-white/20 flex items-center gap-3">
                            <CpuChipIcon className="w-6 h-6 text-white" />
                            <span className="text-white font-bold tracking-tight">Phân tích hợp đồng thông minh</span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="space-y-8 text-slate-700">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-orange-600 font-bold uppercase tracking-widest text-sm">
                                    <ScaleIcon className="w-5 h-5" /> Về ứng dụng
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 leading-tight">Giải Pháp Tư Vấn Pháp Lý Thông Minh</h3>
                                <p className="leading-relaxed text-lg">
                                    <strong className="text-slate-900">LegalBot</strong> là ứng dụng tư vấn pháp lý tiên tiến,
                                    kết hợp công nghệ trí tuệ nhân tạo (AI) với kiến thức pháp luật Việt Nam,
                                    giúp cá nhân và doanh nghiệp phân tích hợp đồng một cách nhanh chóng, chính xác và hiệu quả.
                                </p>
                                <p className="leading-relaxed">
                                    Được phát triển bởi đội ngũ chuyên gia pháp lý và kỹ sư AI hàng đầu, ứng dụng sử dụng
                                    công nghệ xử lý ngôn ngữ tự nhiên (NLP) và máy học (Machine Learning) để hiểu sâu nội dung hợp đồng,
                                    phát hiện các điều khoản rủi ro và đưa ra khuyến nghị pháp lý phù hợp.
                                </p>
                            </div>

                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group transition-all hover:bg-white hover:shadow-lg">
                                <div className="p-3 bg-green-100 rounded-xl text-green-600 group-hover:scale-110 transition-transform">
                                    <CheckBadgeIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900">Phân tích tự động</h4>
                                    <p className="text-sm text-slate-500 mt-1">Hệ thống AI xử lý văn bản pháp lý 24/7 với tốc độ vượt trội.</p>
                                </div>
                            </div>
                        </div>

                        <div className="relative rounded-2xl overflow-hidden shadow-xl">
                            <img
                                src="https://i0.wp.com/www.gamingtechlaw.com/wp-content/uploads/2024/11/AI-Agents-e1730645163521.png?fit=700%2C400&ssl=1"
                                alt="AI Processing"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                                <div className="text-white">
                                    <p className="text-5xl font-black mb-2 opacity-20 uppercase tracking-tighter">LAW</p>
                                    <p className="font-bold tracking-tight">Xử lý văn bản pháp luật tiên tiến</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

function ScaleIcon({ className }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 15.75V7.125c0-1.45-1.175-2.625-2.625-2.625h-4.5V3.75m6.75 12h-6.75m0 0v-8.25m0 8.25h6.75M9.375 7.125h4.5M9.375 7.125v8.625m0 0h6.75m-6.75 0v-8.625m0 0H4.875" />
        </svg>
    );
}