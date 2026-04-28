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
    ArrowDownIcon
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
        { title: "Chatbot Tư vấn AI", desc: "Trò chuyện pháp luật với ngôn ngữ gần gũi như một cộng sự thực thụ, hỗ trợ giải đáp thắc mắc 24/7.", icon: SparklesIcon, color: "from-red-500 to-orange-400" }
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
                    <motion.h3 variants={fadeUpItem} className="text-gray-400 text-sm md:text-base font-medium tracking-[0.4em] uppercase opacity-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-6">
                        Giải pháp công nghệ pháp lý hiện đại
                    </motion.h3>
                    <motion.h1 variants={fadeUpItem} className="text-4xl md:text-7xl font-black leading-[1.1] uppercase tracking-tighter">
                        <span className="text-white drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">HỆ THỐNG HỖ TRỢ PHÁP LÝ</span> <br />
                        <span className="inline-block text-glow-pink" style={titleGradient}>TÍCH HỢP AI</span> <br />
                        <span className="text-white drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">RÀ SOÁT VĂN BẢN & HỢP ĐỒNG</span>
                    </motion.h1>
                    <motion.p variants={fadeUpItem} className="max-w-4xl mx-auto text-base md:text-xl font-bold leading-relaxed px-4 mt-8">
                        <span className="inline-block text-shadow-deep" style={silverGradient}>
                            Hệ thống cung cấp giải pháp tư vấn pháp lý và tra cứu tích hợp trí tuệ nhân tạo giúp bạn giải quyết vấn đề nhanh chóng.
                        </span>
                    </motion.p>
                    <motion.div variants={fadeUpItem} className="pt-12 flex justify-center">
                        <button onClick={() => navigate('/contract-analysis')} className="group relative flex items-center gap-3 px-10 py-4 text-white rounded-full overflow-hidden transition-all duration-500 hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(0,242,254,0.2)] transform-gpu">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-cyan-500 group-hover:from-cyan-500 group-hover:to-blue-700 transition-all duration-500"></div>
                            <span className="relative font-bold uppercase tracking-widest text-sm z-10">Dùng Ngay</span>
                        </button>
                    </motion.div>
                </motion.div>
            </section>

            {/* ==========================================================
                SECTION 3: TÍNH NĂNG (Bento Box)
            ========================================================== */}
            <section className="relative w-full max-w-7xl mx-auto px-6 py-12 md:py-16 z-20 flex flex-col justify-center min-h-[calc(100vh-80px)]">
                <motion.div className="text-center mb-10" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeUpItem}>
                    <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md mb-4 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                        <SparklesIcon className="w-4 h-4 text-cyan-400" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Hệ sinh thái LegAI</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Tính năng <span className="text-cyan-400">Cốt lõi</span></h2>
                </motion.div>

                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                    {features.map((item, idx) => (
                        <motion.div key={idx} variants={fadeUpItem} className={`${darkGlassClass} p-6 rounded-2xl hover:bg-black/80 hover:border-cyan-500/30 transition-all duration-500 group hover:-translate-y-1.5 flex flex-col items-start text-left`}>
                            <div className={`w-11 h-11 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br ${item.color} shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                                <item.icon className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-lg md:text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{item.title}</h3>
                            <p className="text-sm text-gray-300 leading-snug font-medium">{item.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
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