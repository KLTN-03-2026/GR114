import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import {
    CpuChipIcon,
    CheckBadgeIcon,
    ClockIcon,
    UserGroupIcon,
    SparklesIcon,
    DocumentTextIcon,
    DocumentPlusIcon,
    PresentationChartLineIcon,
    ArrowDownIcon,
    MagnifyingGlassIcon,
    ArrowUpIcon,
    VideoCameraIcon,
    ChartBarIcon,
    ShieldExclamationIcon
} from '@heroicons/react/24/outline';

export default function HeroSection() {
    const navigate = useNavigate();

    const section4Ref = useRef(null);
    const [hideArrow, setHideArrow] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setHideArrow(entry.isIntersecting);
            },
            {
                root: null,
                threshold: 0.2,
            }
        );

        if (section4Ref.current) {
            observer.observe(section4Ref.current);
        }

        return () => {
            if (section4Ref.current) observer.unobserve(section4Ref.current);
        };
    }, []);

    // --- GRADIENTS ---
    const titleGradient = {
        background: 'linear-gradient(to right, #ff758c 0%, #ffffff 50%, #ff7eb3 100%)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shinyFlow 3s linear infinite',
        willChange: 'background-position',
    };

    const silverGradient = {
        background: 'linear-gradient(to right, #cbd5e1 0%, #f1f5f9 50%, #cbd5e1 100%)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shinyFlow 5s linear infinite',
        willChange: 'background-position',
    };
    
    // --- DATA ---
    const stats = [
        { id: 1, label: "Hợp đồng phân tích", value: "10,000+", icon: CpuChipIcon },
        { id: 2, label: "Độ chính xác AI", value: "98%", icon: CheckBadgeIcon },
        { id: 3, label: "Thời gian xử lý TB", value: "< 5s", icon: ClockIcon },
        { id: 4, label: "DN tin dùng", value: "500+", icon: UserGroupIcon },
    ];

    const features = [
        { title: "Rà soát Hợp đồng AI", desc: "Tự động phát hiện rủi ro, phân tích điều khoản và đối chiếu luật pháp Việt Nam hiện hành trong vài giây.", icon: DocumentTextIcon, color: "from-blue-500 to-cyan-400" },
        { title: "Tạo Biểu mẫu AI", desc: "Sử dụng công nghệ RAG để tự động khởi tạo văn bản pháp lý chuẩn xác theo yêu cầu riêng biệt của bạn.", icon: DocumentPlusIcon, color: "from-pink-500 to-rose-400" },
        { title: "Lập Kế hoạch AI", desc: "Agentic Workflow biến dữ liệu thô thành lộ trình chi tiết, đồng thời hỗ trợ xuất trực tiếp ra Slide thuyết trình.", icon: PresentationChartLineIcon, color: "from-purple-500 to-indigo-400" },
        { title: "Hồ sơ Pháp lý", desc: "Kho lưu trữ thông minh cho mọi văn bản, lịch sử phân tích và kết quả trò chuyện với AI của riêng bạn.", icon: UserGroupIcon, color: "from-emerald-500 to-teal-400" },
        { title: "Tra cứu Văn bản", desc: "Thư viện luật số hóa, giúp bạn truy xuất nhanh các điều khoản mà không cần tìm kiếm rời rạc trên Google.", icon: CpuChipIcon, color: "from-orange-500 to-amber-400" },
        { title: "Chatbot Tư vấn AI", desc: "Trò chuyện pháp luật với ngôn ngữ gần gũi như một cộng sự thực thụ, hỗ trợ giải đáp thắc mắc 24/7.", icon: SparklesIcon, color: "from-red-500 to-orange-400" },
        { title: "Xác thực Video", desc: "Tự động phân tích, tóm tắt và trích xuất nội dung pháp lý từ các clip short video trên YouTube.", icon: VideoCameraIcon, color: "from-violet-500 to-fuchsia-400" }
        
    ];

    // --- FRAMER MOTION VARIANTS TỐI ƯU ---
    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
    };

    const fadeUpItem = {
        hidden: { opacity: 0, y: 40, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 80, damping: 15, mass: 1 } }
    };

    const darkGlassClass = "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.5)] transform-gpu will-change-transform";

    const textContainer = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
    };

    const textLetter = {
        hidden: { opacity: 0, y: 50, rotateX: -90, filter: "blur(10px)" },
        visible: { opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)", transition: { type: "spring", damping: 12, stiffness: 200 } }
    };

    return (
        <div className="w-full relative flex flex-col items-center selection:bg-cyan-500/30 overflow-x-hidden pb-20">
            <style>
                {`
                    @keyframes shinyFlow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
                    .text-glow-pink { filter: drop-shadow(0 0 15px rgba(255, 117, 140, 0.5)); }
                    .text-shadow-deep { filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.9)); }
                `}
            </style>


            {/* ==========================================================
                SECTION 2: GIỚI THIỆU HỆ THỐNG
            ========================================================== */}
            <section className="relative w-full flex justify-center items-center py-32 z-10">
                <motion.div className="max-w-6xl px-6 text-center" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                    <motion.h3 variants={fadeUpItem} className="text-white text-lg md:text-xl font-bold tracking-[0.2em] uppercase opacity-90 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] mb-12">
                        Giải pháp công nghệ pháp lý hiện đại
                    </motion.h3>
                    <motion.h1 variants={fadeUpItem} className="text-4xl md:text-7xl font-black leading-[1.8] uppercase tracking-tighter">
                        <span className="text-white drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">HỆ THỐNG HỖ TRỢ PHÁP LÝ</span> <br />

                        <span className="inline-block text-glow-pink py-4" style={titleGradient}>TÍCH HỢP AI</span> <br />

                        <span className="text-white drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">RÀ SOÁT VĂN BẢN & HỢP ĐỒNG</span>
                    </motion.h1>
                    <motion.p variants={fadeUpItem} className="max-w-6xl mx-auto text-base md:text-3xl font-bold leading-loose px-4 mt-14">
                        <span className="inline-block text-shadow-deep" style={silverGradient}>
                            Hệ thống cung cấp giải pháp tư vấn pháp lý và tra cứu tích hợp trí tuệ nhân tạo giúp bạn giải quyết vấn đề nhanh chóng.
                        </span>
                    </motion.p>
                    
                </motion.div>
            </section>
{/* ==========================================================
    SECTION 3: TÍNH NĂNG (Full 3D Ecosystem - Final)
========================================================== */}
<section className="relative w-full max-w-7xl mx-auto px-6 py-12 md:py-20 z-20 flex flex-col justify-center min-h-[800px]">

    {/* ================= STYLES ================= */}
    <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .animate-float { animation: float 5s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 7s ease-in-out infinite; }
    `}</style>

{/* ================= LAYER 0: NỀN TYPOGRAPHY (Z-0) ================= */}
    <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-[5%] md:top-[8%] left-0 w-full flex flex-col items-center justify-center text-center"
        >
            {/* Chữ LEGAL: Trắng tinh khiết + Bóng glow màu Vàng Hổ Phách rực rỡ */}
            <h1 className="text-[28vw] md:text-[15vw] font-black text-white tracking-tighter leading-none select-none uppercase drop-shadow-[0_0_40px_rgba(245,158,11,0.5)]">
                LEGAL
            </h1>
        </motion.div>

    </div>


    {/* ================= LAYER 1: CÁC KHỐI LƠ LỬNG (Z-20) ================= */}
    <div className="absolute inset-0 w-full max-w-7xl mx-auto pointer-events-none z-20 hidden lg:block">
        
        {/* --- WIDGET TO TRÁI (Đổi sang tone AMBER/ORANGE) --- */}
        <div className="absolute left-6 top-[32%] animate-float pointer-events-auto">
            <div className="bg-[#0a0a0a]/40 backdrop-blur-xl border border-amber-500/20 p-5 rounded-[2rem] shadow-[0_10px_40px_rgba(245,158,11,0.15)] w-48 hover:bg-[#0a0a0a]/60 hover:border-amber-400/40 transition-all cursor-default">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/40">
                        <ChartBarIcon className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-[10px] text-amber-100/70 font-black uppercase tracking-widest">Database</span>
                </div>
                <h4 className="text-2xl font-black text-white leading-none">14,203</h4>
                <p className="text-[10px] text-amber-100/50 mt-1 font-medium">Hợp đồng đã quét</p>
                <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 w-[75%] shadow-[0_0_10px_#f59e0b]"></div>
                </div>
            </div>
        </div>

        {/* --- WIDGET TO PHẢI (Giữ tone RED nhưng làm viền sáng hơn) --- */}
        <div className="absolute right-6 top-[28%] animate-float-slow pointer-events-auto">
            <div className="bg-[#0a0a0a]/40 backdrop-blur-xl border border-rose-500/20 p-5 rounded-[2rem] shadow-[0_10px_40px_rgba(244,63,94,0.15)] w-56 hover:bg-[#0a0a0a]/60 hover:border-rose-400/40 transition-all cursor-default">
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-rose-500 blur-md opacity-60 animate-pulse"></div>
                        <ShieldExclamationIcon className="w-5 h-5 text-rose-400 relative z-10" />
                    </div>
                    <span className="text-[10px] text-rose-100/70 font-black uppercase tracking-widest">Cảnh báo rủi ro</span>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="border-l-2 border-rose-500 pl-3 relative group">
                        <p className="text-[10px] text-white font-bold leading-tight">Điều khoản bảo mật</p>
                        <p className="text-[9px] text-rose-200/50">Thiếu cam kết 2 chiều</p>
                    </div>
                    <div className="border-l-2 border-orange-500/50 pl-3 opacity-60">
                        <p className="text-[10px] text-white font-bold leading-tight">Tranh chấp tài phán</p>
                        <p className="text-[9px] text-gray-400">Chưa rõ cơ quan</p>
                    </div>
                </div>
            </div>
        </div>

        {/* --- WIDGET MINI TRÁI (Đổi sang tone EMERALD/NEON GREEN) --- */}
        <motion.div animate={{ y: [0, -15, 0], rotate: [0, 2, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[12%] left-[8%] md:left-[12%] bg-[#0a0a0a]/50 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-3 shadow-[0_10px_30px_rgba(16,185,129,0.2)] flex items-center gap-3 pointer-events-auto">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg border border-emerald-500/50">
                <CheckBadgeIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
                <p className="text-[9px] text-emerald-100/60 uppercase tracking-widest">AI Confidence</p>
                <p className="text-sm font-bold text-white drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">99.8%</p>
            </div>
        </motion.div>

        {/* --- WIDGET MINI PHẢI (Đổi sang tone FUCHSIA/HỒNG TÍM) --- */}
        <motion.div animate={{ y: [0, 15, 0], rotate: [0, -2, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute top-[10%] right-[8%] md:right-[12%] bg-[#0a0a0a]/50 backdrop-blur-md border border-fuchsia-500/30 rounded-2xl p-3 shadow-[0_10px_30px_rgba(217,70,239,0.2)] flex items-center gap-3 pointer-events-auto">
            <div className="p-1.5 bg-fuchsia-500/20 rounded-lg border border-fuchsia-500/50">
                <ClockIcon className="w-4 h-4 text-fuchsia-400" />
            </div>
            <div>
                <p className="text-[9px] text-fuchsia-100/60 uppercase tracking-widest">Tốc độ quét</p>
                <p className="text-sm font-bold text-white drop-shadow-[0_0_5px_rgba(217,70,239,0.5)]">1.2s / Trang</p>
            </div>
        </motion.div>

        
    </div>


    {/* ================= LAYER 2: INTERACTIVE DOCK & HEADER (Z-50) ================= */}
    <div className="relative z-50 flex flex-col w-full h-full justify-between mt-10">
        
        {/* DOCK WRAPPER */}
        <div className="w-full flex justify-center pt-40 pb-10">
            <motion.div variants={fadeUpItem} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="relative inline-flex flex-wrap justify-center items-end gap-3 md:gap-6 bg-white/5 border border-white/10 rounded-[2.5rem] px-6 md:px-10 py-4 shadow-2xl backdrop-blur-lg">
                {features.map((item, idx) => (
                    <div key={idx} className="relative group flex flex-col items-center justify-end cursor-pointer">
                        {/* TOOLTIP */}
                        <div className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 w-[260px] opacity-0 translate-y-8 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-out z-[60]">
                            <div className="bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/20 p-5 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex flex-col items-start text-left relative">
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0a0a0a]/90 border-b border-r border-white/20 rotate-45"></div>
                                <h3 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 mb-2 uppercase tracking-tight">{item.title}</h3>
                                <p className="text-xs text-gray-300 leading-relaxed font-medium">{item.desc}</p>
                            </div>
                        </div>

                        {/* ICON */}
                        <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[1.2rem] flex items-center justify-center bg-gradient-to-br ${item.color} shadow-lg transition-transform duration-300 ease-out origin-bottom group-hover:scale-[1.4] group-hover:-translate-y-4 group-hover:shadow-[0_10px_30px_rgba(34,211,238,0.4)] border border-white/10`}>
                            <item.icon className="w-7 h-7 md:w-8 md:h-8 text-white drop-shadow-md" />
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-[0_0_8px_#22d3ee]"></div>
                    </div>
                ))}
            </motion.div>
        </div>
    </div>
</section>
            {/* ==========================================================
    SECTION 4: GIỚI THIỆU & THỐNG KÊ (Đã tối ưu Performance)
========================================================== */}
            <section className="relative w-full max-w-7xl mx-auto px-6 py-32 z-20">
                <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">

                    {/* CỘT TRÁI: Dính (Sticky) */}
                    <motion.div
                        className="lg:w-5/12 lg:sticky lg:top-40 space-y-8 p-8 md:p-10 rounded-[2.5rem] bg-black/40 border border-white/10 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] transform-gpu will-change-transform"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.1, margin: "-100px" }} // Trình diễn sớm hơn
                        variants={staggerContainer}
                    >
                        {/* Nội dung cột trái giữ nguyên */}
                        <motion.div variants={fadeUpItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                            Về LegalBot
                        </motion.div>
                        <motion.h2 variants={fadeUpItem} className="text-4xl md:text-6xl font-black text-white leading-[1] tracking-tighter">
                            Giải pháp pháp lý <br />
                            <span className="text-cyan-400 font-serif italic font-light tracking-normal">Thời đại số</span>
                        </motion.h2>
                        <motion.p variants={fadeUpItem} className="text-gray-300 text-lg leading-relaxed font-medium">
                            <strong className="text-white">LegalBot</strong> không chỉ là công cụ tra cứu, mà là trợ lý ảo đắc lực.
                        </motion.p>
                    </motion.div>

                    {/* CỘT PHẢI: Lưới So Le */}
                    <motion.div
                        className="lg:w-7/12 grid grid-cols-1 md:grid-cols-2 gap-6"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.1 }}
                        variants={staggerContainer}
                    >
                        {stats.map((stat, idx) => (
                            <motion.div
                                key={stat.id}
                                variants={fadeUpItem}
                                // Tối ưu class: Dùng backdrop-blur-xl và transform-gpu
                                className={`p-8 md:p-10 rounded-[2rem] bg-black/40 border border-white/10 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col justify-between aspect-square group hover:border-cyan-500/50 hover:bg-white/5 transition-all duration-500 transform-gpu will-change-transform ${idx % 2 !== 0 ? 'md:mt-16' : ''}`}
                            >
                                {/* Nội dung Card giữ nguyên */}
                                <div className="flex justify-between items-start">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center border border-white/10 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500">
                                        <stat.icon className="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-500">0{idx + 1}</span>
                                </div>
                                <div>
                                    <p className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter mb-2 group-hover:text-cyan-400 origin-left transition-all duration-500">{stat.value}</p>
                                    <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">{stat.label}</p>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>
            {/* ==========================================================
                SECTION 5: IMMERSIVE CTA (Split-Screen Layout)
            ========================================================== */}
            <section ref={section4Ref} className="relative w-full max-w-7xl mx-auto px-6 py-20 z-20">
                <motion.div
                    initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeUpItem}
                    className="relative w-full rounded-[2.5rem] overflow-hidden p-10 md:p-16 lg:p-20 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-left"
                >
                    {/* Lớp màng lọc sương mù tạo chiều sâu */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-2xl -z-10"></div>
                    {/* Hiệu ứng gradient mờ ảo bên trong khối */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent -z-10"></div>

                    {/* Sử dụng CSS Grid để chia 2 cột */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">

                        {/* CỘT TRÁI: Tiêu đề & Form Đăng ký */}
                        <div className="flex flex-col items-start">
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter mb-6 leading-[1.1]">
                                Tiên phong trong <br className="hidden md:block" />
                                <span className="font-serif italic font-light text-cyan-400">Pháp lý số</span>
                            </h2>

                            <p className="text-gray-300 text-base font-medium leading-relaxed mb-10">
                                Đăng ký để nhận quyền truy cập sớm về dự án của chúng tôi.
                            </p>

                            {/* Form Đăng ký (Pill Input) */}
                            <form className="w-full max-w-md flex items-center bg-black/50 border border-white/20 rounded-full p-1.5 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all duration-300">
                                <input
                                    type="email"
                                    placeholder="Nhập địa chỉ email..."
                                    required
                                    className="flex-1 bg-transparent px-5 text-white text-sm font-medium focus:outline-none placeholder-gray-500 w-full"
                                />
                                <button
                                    type="submit"
                                    className="bg-white text-black px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-cyan-400 hover:text-black transition-colors duration-300 shrink-0"
                                >
                                    Đăng ký <span>✦</span>
                                </button>
                            </form>
                        </div>

                        {/* CỘT PHẢI: 3 Đoạn Text kèm vòng tròn đánh số */}
                        <div className="flex flex-col space-y-8">

                            {/* Dòng 1 */}
                            <div className="flex items-start gap-5 group">
                                <div className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 group-hover:border-cyan-500/50 group-hover:text-cyan-400 transition-colors">
                                    01
                                </div>
                                <p className="text-gray-300 text-sm md:text-base leading-relaxed pt-2">
                                    Trở thành một trong những người đầu tiên tham gia thử nghiệm tính năng Agentic Workflow và RAG đa luồng của LegalBot.
                                </p>
                            </div>

                            {/* Dòng 2 */}
                            <div className="flex items-start gap-5 group">
                                <div className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 group-hover:border-cyan-500/50 group-hover:text-cyan-400 transition-colors">
                                    02
                                </div>
                                <p className="text-gray-300 text-sm md:text-base leading-relaxed pt-2">
                                    Cùng chúng tôi định hình tương lai của ngành luật Việt Nam.
                                </p>
                            </div>

                            {/* Dòng 3 */}
                            <div className="flex items-start gap-5 group">
                                <div className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 group-hover:border-cyan-500/50 group-hover:text-cyan-400 transition-colors">
                                    03
                                </div>
                                <p className="text-gray-300 text-sm md:text-base leading-relaxed pt-2">
                                    Khám phá cách trí tuệ nhân tạo giúp rút ngắn 80% thời gian rà soát hợp đồng và giảm thiểu tối đa rủi ro pháp lý.
                                </p>
                            </div>

                        </div>
                    </div>
                </motion.div>
            </section>
            {/* ==========================================================
                MŨI TÊN CUỘN 
            ========================================================== */}
            <div
                onClick={() => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
                className={`fixed bottom-8 left-1/2 -translate-x-1/2 transition-all duration-700 z-50 cursor-pointer hover:text-cyan-400 hover:scale-110 ${hideArrow ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 animate-bounce'}`}
            >
                <ArrowDownIcon className="w-8 h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] bg-black/30 p-1.5 rounded-full backdrop-blur-md border border-white/10" />
            </div>
        </div>
    );
}