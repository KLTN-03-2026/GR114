import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Spline from '@splinetool/react-spline';
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
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 100);
        };
        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // --- GRADIENTS ---
    const titleGradient = {
        background: 'linear-gradient(to right, #ff758c 0%, #ffffff 50%, #ff7eb3 100%)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shinyFlow 3s linear infinite',
    };

    const silverGradient = {
        background: 'linear-gradient(to right, #cbd5e1 0%, #f1f5f9 50%, #cbd5e1 100%)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shinyFlow 5s linear infinite',
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
        { title: "Soạn thảo Tự động", desc: "Sử dụng Template kết hợp công nghệ RAG để tự động điền và tạo lập văn bản pháp lý chuẩn xác, cá nhân hóa.", icon: DocumentPlusIcon, color: "from-pink-500 to-rose-400" },
        { title: "Kế hoạch & Báo cáo", desc: "Agentic Workflow biến dữ liệu thô thành kế hoạch chi tiết, đồng thời xuất trực tiếp ra slide thuyết trình (.pptx).", icon: PresentationChartLineIcon, color: "from-purple-500 to-indigo-400" }
    ];

    // --- FRAMER MOTION VARIANTS ---
    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
    };
    const fadeUpItem = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
    };

    const darkGlassClass = "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.5)]";

    return (
        <div className="w-full relative flex flex-col items-center selection:bg-cyan-500/30 overflow-hidden pb-20">
            <style>
                {`
                    @keyframes shinyFlow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
                    .text-glow-pink { filter: drop-shadow(0 0 15px rgba(255, 117, 140, 0.5)); }
                    .text-shadow-deep { filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.9)); }
                `}
            </style>

           
            {/* ==========================================================
                SECTION 1: TYPOGRAPHY KHỔNG LỒ & ROBOT 
            ========================================================== */}
          
            <section className="relative w-full z-30 flex flex-col items-center justify-end min-h-[calc(100vh-80px)] pt-20 pb-32">
                
                {/* 🔴 2. LỚP MẶT NẠ MA THUẬT: 
                
                        - Tạo hiệu ứng mờ dần ở phần dưới để giúp typography nổi bật hơn và tạo chiều sâu cho cảnh.
                */}
                <div className="absolute top-0 left-0 w-full h-[125%] bg-gradient-to-b from-[#050505] via-[#050505] via-[80%] to-transparent pointer-events-none -z-10"></div>

                {/* Khối Robot 3D Spline */}
                <div className="relative z-20 w-full max-w-3xl h-[280px] md:h-[380px] flex justify-center items-end pointer-events-auto">
                    <Spline scene="https://prod.spline.design/dMx4Jy6SuNlBOCdL/scene.splinecode" />
                </div>

                {/* Typography Khổng Lồ */}
                <motion.div 
                    className="relative z-10 w-full flex justify-center items-end pointer-events-none px-4 -mt-4 md:-mt-4 mb-0"
                    initial="hidden"
                    animate="visible"
                    variants={fadeUpItem}
                >
                    <h1 className="text-[18vw] md:text-[16vw] font-black text-white uppercase tracking-tighter leading-[0.75] select-none m-0 p-0 drop-shadow-[0_10px_30px_rgba(0,0,0,1)]">
                        LEGAL<span className="text-cyan-500">AI</span>
                    </h1>
                </motion.div>

                {/* Mũi tên nhấp nháy báo hiệu cuộn xuống */}
                <div 
                    onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
                    className={`absolute bottom-[-2rem] left-1/2 -translate-x-1/2 transition-all duration-700 z-40 cursor-pointer hover:text-cyan-400 hover:scale-110 ${isScrolled ? 'opacity-0 translate-y-5 pointer-events-none' : 'opacity-100 animate-bounce'}`}
                >
                    <ArrowDownIcon className="w-8 h-8 text-gray-400 drop-shadow-lg" />
                </div>
            </section>
            {/* ==========================================================
                MỚI - SECTION 2: GIỚI THIỆU HỆ THỐNG (Hero cũ)
            ========================================================== */}
            <section className="relative w-full flex justify-center items-center py-32 z-10">
                <motion.div className="max-w-6xl px-6 text-center" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: false, margin: "-100px" }}>
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
                        <button onClick={() => navigate('/contract-analysis')} className="group relative flex items-center gap-3 px-10 py-4 text-white rounded-full overflow-hidden transition-all duration-500 hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(0,242,254,0.2)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-cyan-500 group-hover:from-cyan-500 group-hover:to-blue-700 transition-all duration-500"></div>
                            <span className="relative font-bold uppercase tracking-widest text-sm z-10">Dùng Ngay</span>
                        </button>
                    </motion.div>
                </motion.div>
            </section>

            {/* ==========================================================
                MỚI - SECTION 3: TÍNH NĂNG (Timeline)
            ========================================================== */}
            <section className="relative w-full max-w-7xl mx-auto px-6 py-20 z-20">
                <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: false, margin: "-100px" }} variants={fadeUpItem}>
                    <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 px-5 py-2 rounded-full text-sm font-bold backdrop-blur-md mb-4 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                        <SparklesIcon className="w-5 h-5 text-cyan-400" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Hệ sinh thái LegalBot</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">Quy trình làm việc <span className="text-cyan-400">Toàn diện</span></h2>
                </motion.div>

                <div className="relative">
                    <div className="absolute top-[3.5rem] left-[1.5rem] right-[1.5rem] h-px bg-white/10 z-0 hidden md:block"></div>
                    <motion.div className="grid md:grid-cols-3 gap-12" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: false, margin: "-100px" }}>
                        {features.map((item, idx) => (
                            <motion.div key={idx} variants={fadeUpItem} className="relative z-10">
                                <div className={`mx-auto md:mx-0 flex flex-col items-center justify-center w-28 h-28 rounded-3xl mb-8 z-10 relative ${darkGlassClass} ${idx === 0 ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10' : idx === 1 ? 'bg-gradient-to-br from-pink-500/20 to-rose-500/10' : 'bg-gradient-to-br from-purple-500/20 to-indigo-500/10'} shadow-[0_8px_20px_rgba(0,0,0,0.3)]`}>
                                    <span className={`text-5xl font-black ${idx === 0 ? 'text-cyan-400' : idx === 1 ? 'text-rose-400' : 'text-indigo-400'}`}>{idx + 1}</span>
                                </div>
                                <div className={`${darkGlassClass} p-8 rounded-[2rem] hover:bg-black/80 hover:border-cyan-500/30 transition-all duration-500 group text-center md:text-left`}>
                                    <div className={`w-14 h-14 mx-auto md:mx-0 rounded-2xl mb-6 flex items-center justify-center bg-gradient-to-br ${item.color} shadow-lg group-hover:scale-110 transition-transform`}>
                                        <item.icon className="w-7 h-7 text-white" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-cyan-400 transition-colors">{item.title}</h3>
                                    <p className="text-gray-300 leading-relaxed font-medium">{item.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ==========================================================
                MỚI - SECTION 4: GIỚI THIỆU & THỐNG KÊ
            ========================================================== */}
            <section className="relative w-full max-w-7xl mx-auto px-6 py-20 z-20">
                <div className="grid md:grid-cols-2 gap-16 items-center">
                    {/* Cột Trái: Về LegalBot */}
                    <motion.div className="space-y-6" initial="hidden" whileInView="visible" viewport={{ once: false, margin: "-100px" }} variants={staggerContainer}>
                        <motion.div variants={fadeUpItem} className="flex items-center gap-3 text-cyan-400 font-bold uppercase tracking-[0.2em] text-sm mb-2">
                            <div className="w-8 h-[2px] bg-cyan-400"></div> Về LegalBot
                        </motion.div>
                        <motion.h3 variants={fadeUpItem} className="text-3xl lg:text-5xl font-black text-white leading-[1.1]">
                            Giải pháp pháp lý <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Thời đại số</span>
                        </motion.h3>
                        <motion.p variants={fadeUpItem} className="text-gray-300 text-lg leading-relaxed font-medium">
                            <strong className="text-white">LegalBot</strong> không chỉ là một công cụ tra cứu, mà là trợ lý pháp lý ảo đắc lực. Sử dụng các mô hình ngôn ngữ lớn (LLM) được tinh chỉnh chuyên sâu, chúng tôi giúp bạn "dịch" những thuật ngữ luật khô khan thành ngôn ngữ đời thường dễ hiểu.
                        </motion.p>
                    </motion.div>

                    {/* Cột Phải: Grid Stats 2x2 */}
                    <motion.div className="grid grid-cols-2 gap-6" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: false, margin: "-100px" }}>
                        {stats.map((stat) => (
                            <motion.div key={stat.id} variants={fadeUpItem} className={`${darkGlassClass} p-6 rounded-3xl flex flex-col items-center md:items-start text-center md:text-left hover:bg-black/80 hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.1)] transition-all duration-500 group`}>
                                <div className="mb-4 inline-flex p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 group-hover:scale-110 transition-transform">
                                    <stat.icon className="w-7 h-7 text-cyan-400" />
                                </div>
                                <p className="text-3xl md:text-4xl font-black mb-2 tracking-tighter text-white group-hover:text-cyan-400 transition-colors">{stat.value}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

        </div>
    );
} 