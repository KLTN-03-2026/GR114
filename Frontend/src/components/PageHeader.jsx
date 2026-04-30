import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bars3Icon,
    UserIcon,
    ChatBubbleLeftEllipsisIcon,
    ArrowRightOnRectangleIcon,
    ArrowLeftOnRectangleIcon,
    PhoneIcon,
    UserPlusIcon,
    DocumentTextIcon,
    DocumentPlusIcon,
    PresentationChartLineIcon,
    ChevronDownIcon,
    SparklesIcon,
    VideoCameraIcon,
    ShieldCheckIcon
} from "@heroicons/react/24/outline";

import logo from "../assets/icons/logo.png";

export default function PageHeader() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAISolutionsOpen, setIsAISolutionsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("accessToken"));
    const [userName, setUserName] = useState("");

    const isHomePage = location.pathname === "/";

    // CẬP NHẬT NAV CLASS: Chữ xám than, hover vàng đồng, gạch chân gradient vàng
    const navClass = ({ isActive }) => {
        const baseClass = `relative px-1 py-2 transition-all duration-300 uppercase tracking-widest text-[11px] group flex items-center gap-1 font-semibold`;
        const stateColor = isActive ? "text-[#B8985D]" : "text-zinc-500 hover:text-[#1A2530]";
        const underlineBase = "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:transition-transform after:duration-500 after:origin-center";
        const underlineState = isActive
            ? "after:scale-x-100 after:bg-gradient-to-r after:from-[#C5A880] after:to-[#8E6D45]"
            : "after:scale-x-0 group-hover:after:scale-x-100 after:bg-[#B8985D]/40";
        return `${baseClass} ${stateColor} ${underlineBase} ${underlineState}`;
    };

    const handleLogout = () => {
        localStorage.clear();
        setIsLoggedIn(false);
        setUserName("");
        setIsMenuOpen(false);
        window.location.href = "/";
    };

    useEffect(() => {
        setIsLoggedIn(!!localStorage.getItem("accessToken"));
        const userStr = localStorage.getItem("user");
        if (userStr) {
            try {
                const u = JSON.parse(userStr);
                setUserName(u?.fullName || u?.name || u?.email || "Người dùng");
            } catch (e) { setUserName(userStr); }
        }
    }, []);
    if (location.pathname.includes('/admin')) {

            return null;
    }
    return (
        // HEADER BACKGROUND: Kính mờ trắng
        <header className={`fixed top-0 left-0 right-0 transition-all duration-500 w-full h-20 flex items-center z-[100] ${
            isHomePage 
            ? "bg-white/80 border-b border-zinc-200/50 backdrop-blur-xl shadow-sm" 
            : "bg-white/95 backdrop-blur-2xl border-b border-zinc-200 shadow-md"
        }`}>
            <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between relative">

                {/* CỘT TRÁI: LOGO VÀ MENU NAV */}
                <div className="flex items-center gap-10">
                    {/* LOGO */}
                    <img
                        src={logo}
                        alt="LegalAI"
                        className="h-9 cursor-pointer brightness-0 opacity-80 hover:opacity-100 transition-all"
                        onClick={() => navigate("/")}
                    />

                    <nav className="hidden md:flex gap-8 text-sm items-center">
                        <NavLink to="/" className={navClass}>Trang chủ</NavLink>

                        <div
                            className="relative"
                            onMouseEnter={() => setIsAISolutionsOpen(true)}
                            onMouseLeave={() => setIsAISolutionsOpen(false)}
                        >
                            <button className={`${navClass({ isActive: location.pathname.includes('analysis') || location.pathname.includes('soan-thao') || location.pathname.includes('video') })} cursor-default`}>
                                Giải pháp AI <ChevronDownIcon className={`w-3 h-3 transition-transform duration-300 ${isAISolutionsOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {isAISolutionsOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute left-1/2 -translate-x-1/2 mt-0 pt-6 w-[580px]"
                                    >
                                        <div className="bg-white/95 backdrop-blur-3xl border border-zinc-200 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.08)] flex">
                                            <div className="w-2/3 p-6 space-y-1">
                                                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-4">Công cụ thông minh</p>

                                                <Link to="/contract-analysis" className="flex items-start gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-colors group">
                                                    <div className="p-2 rounded-lg bg-[#B8985D]/10 text-[#8E6D45] group-hover:bg-[#B8985D]/20"><DocumentTextIcon className="w-5 h-5" /></div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-[#1A2530] group-hover:text-[#B8985D] transition-colors">Rà soát Hợp đồng AI</h4>
                                                        <p className="text-[10px] text-zinc-500 leading-tight">Phân tích rủi ro & đối chiếu luật pháp.</p>
                                                    </div>
                                                </Link>

                                                <Link to="/soan-thao" className="flex items-start gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-colors group">
                                                    <div className="p-2 rounded-lg bg-[#B8985D]/10 text-[#8E6D45] group-hover:bg-[#B8985D]/20"><DocumentPlusIcon className="w-5 h-5" /></div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-[#1A2530] group-hover:text-[#B8985D] transition-colors">Tạo Biểu mẫu AI</h4>
                                                        <p className="text-[10px] text-zinc-500 leading-tight">Khởi tạo văn bản chuẩn qua RAG.</p>
                                                    </div>
                                                </Link>

                                                <Link to="/ke-hoach-bao-cao" className="flex items-start gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-colors group">
                                                    <div className="p-2 rounded-lg bg-[#B8985D]/10 text-[#8E6D45] group-hover:bg-[#B8985D]/20"><PresentationChartLineIcon className="w-5 h-5" /></div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-[#1A2530] group-hover:text-[#B8985D] transition-colors">Lập Kế hoạch AI</h4>
                                                        <p className="text-[10px] text-zinc-500 leading-tight">Trích xuất lộ trình & Slide báo cáo.</p>
                                                    </div>
                                                </Link>

                                                <Link to="/phan-tich-video" className="flex items-start gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-colors group">
                                                    <div className="p-2 rounded-lg bg-[#B8985D]/10 text-[#8E6D45] group-hover:bg-[#B8985D]/20"><VideoCameraIcon className="w-5 h-5" /></div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-[#1A2530] group-hover:text-[#B8985D] transition-colors">Xác Thực Video Pháp lý</h4>
                                                        <p className="text-[10px] text-zinc-500 leading-tight">Tóm tắt tư vấn từ TikTok/YouTube Short.</p>
                                                    </div>
                                                </Link>
                                            </div>

                                            <div className="w-1/3 bg-zinc-50 p-6 border-l border-zinc-100 flex flex-col justify-center">
                                                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-4">Labs</p>
                                                <div className="p-3 rounded-xl bg-white border border-zinc-200 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-1 text-[#B8985D]">
                                                        <SparklesIcon className="w-3 h-3" />
                                                        <span className="text-[10px] font-bold"> AI v2.0</span>
                                                    </div>
                                                    <p className="text-[10px] text-zinc-500 italic leading-snug">LLM</p>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <NavLink to="/van-ban-phap-luat" className={navClass}>Tra cứu văn bản</NavLink>
                        <NavLink to="/ho-so-phap-ly" className={navClass}>Hồ sơ pháp lý</NavLink>
                    </nav>
                </div>

                {/* CỘT PHẢI: NÚT ADMIN & PROFILE DROPDOWN */}
                <div className="flex items-center gap-3 md:gap-5">
                    
                    {/* ========================================================= */}
                    {/* NÚT ADMIN */}
                    {/* ========================================================= */}
                    {(() => {
                        const userStr = localStorage.getItem("user");
                        if (!userStr) return null;

                        try {
                            const user = JSON.parse(userStr);
                            const rawRole = user.Role || user.role || user.ROLE || "";
                            const userRole = String(rawRole).toUpperCase();

                            if (userRole === 'ADMIN' && !location.pathname.includes('/admin')) {
                                return (
                                    <Link
                                        to="/admin"
                                        className="hidden sm:flex items-center gap-2 px-4 py-2 bg-zinc-50 border border-zinc-200 text-[#1A2530] rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-[#1A2530] hover:border-[#1A2530] hover:text-[#B8985D] transition-all duration-300 shadow-sm group"
                                    >
                                        <ShieldCheckIcon className="w-4 h-4 text-[#B8985D] group-hover:animate-pulse stroke-2" /> 
                                        ADMIN
                                    </Link>
                                );
                            }
                        } catch (error) {
                            console.error("Lỗi đọc dữ liệu User:", error);
                        }
                        return null;
                    })()}
                    {/* ========================================================= */}

                    {/* AVATAR & DROPDOWN */}
                    <div className="relative">
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center focus:outline-none p-1.5 rounded-full hover:bg-zinc-100 transition-colors">
                            {isLoggedIn ? (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C5A880] to-[#8E6D45] flex items-center justify-center border-2 border-white shadow-md">
                                    <UserIcon className="h-5 w-5 text-white" />
                                </div>
                            ) : (
                                <Bars3Icon className="h-6 w-6 text-zinc-600 hover:text-[#B8985D]" />
                            )}
                        </button>

                        <AnimatePresence>
                            {isMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="absolute right-0 mt-4 w-64 border rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.1)] py-2 z-20 backdrop-blur-2xl bg-white/95 border-zinc-200 text-[#1A2530]"
                                    >
                                        {isLoggedIn ? (
                                            <div className="px-5 py-4 mb-2 border-b border-zinc-100 bg-zinc-50/50">
                                                <p className="text-[10px] text-zinc-400 mb-1 font-bold tracking-widest uppercase">Xin chào,</p>
                                                <p className="text-sm font-black truncate text-[#1A2530]">{userName}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <button onClick={() => { navigate("/login"); setIsMenuOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-zinc-600 hover:bg-zinc-50 hover:text-[#B8985D] transition-colors flex items-center gap-3">
                                                    <ArrowLeftOnRectangleIcon className="h-5 w-5 stroke-2" /> Đăng nhập
                                                </button>
                                                <button onClick={() => { navigate("/login"); setIsMenuOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-zinc-600 hover:bg-zinc-50 hover:text-[#B8985D] transition-colors flex items-center gap-3">
                                                    <UserPlusIcon className="h-5 w-5 stroke-2" /> Đăng ký
                                                </button>
                                                <div className="border-t my-2 border-zinc-100"></div>
                                            </>
                                        )}

                                        <button onClick={() => { navigate("/lien-he"); setIsMenuOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-zinc-600 hover:bg-zinc-50 hover:text-[#B8985D] transition-colors flex items-center gap-3">
                                            <PhoneIcon className="h-5 w-5 stroke-2" /> Liên hệ hỗ trợ
                                        </button>

                                        <button onClick={() => { navigate("/gui-phan-hoi"); setIsMenuOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-zinc-600 hover:bg-zinc-50 hover:text-[#B8985D] transition-colors flex items-center gap-3">
                                            <ChatBubbleLeftEllipsisIcon className="h-5 w-5 stroke-2" /> Gửi phản hồi
                                        </button>

                                        {isLoggedIn && (
                                            <>
                                                <div className="border-t my-2 border-zinc-100"></div>
                                                <button onClick={handleLogout} className="w-full text-left px-5 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3">
                                                    <ArrowRightOnRectangleIcon className="h-5 w-5 stroke-2" /> Đăng xuất
                                                </button>
                                            </>
                                        )}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

            </div>
        </header>
    );
}