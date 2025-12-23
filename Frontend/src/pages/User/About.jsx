import React from 'react';
import {
    CpuChipIcon,
    CheckBadgeIcon,
    ClockIcon,
    UserGroupIcon,
    SparklesIcon,
    ScaleIcon
} from '@heroicons/react/24/outline';

export default function About() {
    // Dữ liệu thống kê (Giữ nguyên nội dung, chỉ đổi icon/style)
    const stats = [
        { id: 1, label: "Hợp đồng đã phân tích", value: "50,000+", icon: CpuChipIcon },
        { id: 2, label: "Độ chính xác AI", value: "98%", icon: CheckBadgeIcon },
        { id: 3, label: "Thời gian xử lý TB", value: "< 5s", icon: ClockIcon },
        { id: 4, label: "Doanh nghiệp tin dùng", value: "500+", icon: UserGroupIcon },
    ];

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30">

            <main className="flex flex-col relative z-10">
                {/* 1. HERO SECTION: Nền tối + Hiệu ứng Glow */}
                <section className="relative pt-32 pb-40 px-6 text-center overflow-hidden">
                    {/* Hiệu ứng nền tỏa sáng phía sau */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] -z-10"></div>

                    <div className="max-w-5xl mx-auto space-y-8 animate-fadeInUp">
                        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-5 py-2 rounded-full text-sm font-bold backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                            <SparklesIcon className="w-5 h-5 text-cyan-400" /> 
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                                Tiên phong Công nghệ Pháp lý
                            </span>
                        </div>
                        
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
                            Minh bạch hóa <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
                                Rủi ro Pháp lý
                            </span>
                        </h1>
                        
                        <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                            Chúng tôi kết hợp sức mạnh của <span className="text-white font-bold">Trí tuệ nhân tạo (AI)</span> với sự chính xác của 
                            <span className="text-white font-bold"> Luật pháp Việt Nam</span> để bảo vệ quyền lợi của bạn trong mọi giao dịch.
                        </p>
                    </div>
                </section>

                {/* 2. STATS SECTION: Các thẻ kính mờ nổi lên */}
                <section className="max-w-7xl mx-auto w-full px-6 -mt-24 relative z-20">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {stats.map((stat) => (
                            <div
                                key={stat.id}
                                className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl text-center hover:bg-white/10 hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.1)] transition-all duration-500 group"
                            >
                                <div className="mb-4 inline-flex p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 group-hover:scale-110 transition-transform">
                                    <stat.icon className="w-8 h-8 text-cyan-400" />
                                </div>
                                <p className="text-4xl font-black mb-2 tracking-tighter text-white">{stat.value}</p>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 group-hover:text-cyan-400 transition-colors">
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. CONTENT SECTION: Nội dung chính */}
                <section className="max-w-7xl mx-auto w-full px-6 py-32 space-y-32">
                    
                    {/* Hình ảnh lớn với hiệu ứng Gradient bao quanh */}
                    <div className="relative group rounded-[3rem] overflow-hidden border border-white/10">
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10"></div>
                        <img
                            src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=2000"
                            alt="Legal Analysis Visual"
                            className="w-full h-[600px] object-cover transition-transform duration-1000 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                        />
                        <div className="absolute bottom-10 left-10 z-20 bg-black/60 backdrop-blur-xl px-8 py-4 rounded-2xl border border-white/20 flex items-center gap-4">
                            <div className="p-2 bg-cyan-500 rounded-lg">
                                <CpuChipIcon className="w-6 h-6 text-black" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Công nghệ lõi</p>
                                <span className="text-white font-bold text-lg tracking-tight">AI Natural Language Processing</span>
                            </div>
                        </div>
                    </div>

                    {/* Khối thông tin chi tiết */}
                    <div className="grid md:grid-cols-2 gap-20 items-center">
                        <div className="space-y-10">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 text-cyan-400 font-bold uppercase tracking-[0.2em] text-sm">
                                    <div className="w-8 h-[2px] bg-cyan-400"></div> Về LegalBot
                                </div>
                                
                                <h3 className="text-4xl lg:text-5xl font-black text-white leading-[1.1]">
                                    Giải pháp pháp lý <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                                        Thời đại số
                                    </span>
                                </h3>
                                
                                <p className="text-gray-400 text-lg leading-relaxed">
                                    <strong className="text-white">LegalBot</strong> không chỉ là một công cụ tra cứu, mà là trợ lý pháp lý ảo đắc lực. 
                                    Sử dụng các mô hình ngôn ngữ lớn (LLM) được tinh chỉnh chuyên sâu cho hệ thống pháp luật Việt Nam, 
                                    chúng tôi giúp bạn "dịch" những thuật ngữ luật khô khan thành ngôn ngữ đời thường dễ hiểu.
                                </p>
                            </div>

                            {/* Feature Card nhỏ */}
                            <div className="flex items-start gap-5 p-6 rounded-3xl bg-white/5 border border-white/10 group hover:bg-white/10 transition-colors">
                                <div className="p-4 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <CheckBadgeIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-xl text-white mb-2">Phân tích Tức thì</h4>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Thay vì chờ đợi luật sư hàng giờ, AI xử lý văn bản pháp lý 24/7 với tốc độ chỉ tính bằng giây, 
                                        giúp bạn ra quyết định nhanh chóng.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Hình ảnh minh họa bên phải */}
                        <div className="relative rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl group">
                            <div className="absolute inset-0 bg-cyan-500/20 mix-blend-overlay z-10 group-hover:opacity-0 transition-opacity"></div>
                            <img
                                src="https://i0.wp.com/www.gamingtechlaw.com/wp-content/uploads/2024/11/AI-Agents-e1730645163521.png?fit=700%2C400&ssl=1"
                                alt="AI Processing"
                                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                            />
                            {/* Chữ chìm nghệ thuật */}
                            <div className="absolute bottom-0 right-0 p-10 z-20 text-right">
                                <p className="text-8xl font-black text-white/5 uppercase tracking-tighter leading-none select-none">
                                    FUTURE
                                </p>
                                <p className="text-8xl font-black text-white/10 uppercase tracking-tighter leading-none select-none -mt-10">
                                    OF LAW
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}