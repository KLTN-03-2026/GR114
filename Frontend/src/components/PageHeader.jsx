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
    VideoCameraIcon
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

    const navClass = ({ isActive }) => {
        const baseClass = `relative px-1 py-2 transition-all duration-300 uppercase tracking-widest text-[11px] group flex items-center gap-1`;
        const stateColor = isActive ? "text-cyan-400 font-bold" : "text-gray-300 hover:text-white";
        const underlineBase = "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:transition-transform after:duration-500 after:origin-center";
        const underlineState = isActive
            ? "after:scale-x-100 after:bg-gradient-to-r after:from-cyan-400 after:to-blue-500"
            : "after:scale-x-0 group-hover:after:scale-x-100 after:bg-cyan-400/70";
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

    return (
<<<<<<< HEAD
        <header className={`fixed top-0 left-0 right-0 transition-all duration-500 w-full h-20 flex items-center border-b z-[100] ${
            isHomePage ? "bg-black/20 border-white/5 backdrop-blur-md" : "bg-black/60 backdrop-blur-2xl border-white/10 shadow-lg"
        }`}>
=======
        <header className={`fixed top-0 left-0 right-0 transition-all duration-500 w-full h-20 flex items-center border-b z-[100] ${isHomePage ? "bg-black/20 border-white/5 backdrop-blur-md" : "bg-black/60 backdrop-blur-2xl border-white/10 shadow-lg"
            }`}>
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
            <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between relative">

                <div className="flex items-center gap-10">
                    <img
                        src={logo}
                        alt="LegalAI"
                        className="h-9 cursor-pointer brightness-0 invert hover:opacity-80 transition-all"
                        onClick={() => navigate("/")}
                    />

                    <nav className="hidden md:flex gap-8 text-sm font-medium items-center">
                        <NavLink to="/" className={navClass}>Trang chủ</NavLink>

<<<<<<< HEAD
                        <div 
=======
                        <div
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
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
                                        <div className="bg-[#0a0a0a]/95 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex">
                                            <div className="w-2/3 p-6 space-y-1">
                                                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-4">Công cụ thông minh</p>
<<<<<<< HEAD
                                                
=======

>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                                                <Link to="/contract-analysis" className="flex items-start gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group">
                                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20"><DocumentTextIcon className="w-5 h-5" /></div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">Rà soát Hợp đồng AI</h4>
                                                        <p className="text-[10px] text-gray-400 leading-tight">Phân tích rủi ro & đối chiếu luật pháp.</p>
                                                    </div>
                                                </Link>

                                                <Link to="/soan-thao" className="flex items-start gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group">
                                                    <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20"><DocumentPlusIcon className="w-5 h-5" /></div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">Tạo Biểu mẫu AI</h4>
                                                        <p className="text-[10px] text-gray-400 leading-tight">Khởi tạo văn bản chuẩn qua RAG.</p>
                                                    </div>
                                                </Link>

                                                <Link to="/ke-hoach-bao-cao" className="flex items-start gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group">
                                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20"><PresentationChartLineIcon className="w-5 h-5" /></div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">Lập Kế hoạch AI</h4>
                                                        <p className="text-[10px] text-gray-400 leading-tight">Trích xuất lộ trình & Slide báo cáo.</p>
                                                    </div>
                                                </Link>

                                                <Link to="/phan-tich-video" className="flex items-start gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group">
                                                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20"><VideoCameraIcon className="w-5 h-5" /></div>
                                                    <div>
<<<<<<< HEAD
                                                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">Phân tích Video Pháp lý</h4>
                                                        <p className="text-[10px] text-gray-400 leading-tight">Tóm tắt tư vấn từ TikTok/YouTube.</p>
=======
                                                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">Xác Thực Video Pháp lý</h4>
                                                        <p className="text-[10px] text-gray-400 leading-tight">Tóm tắt tư vấn từ TikTok/YouTube Short.</p>
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                                                    </div>
                                                </Link>
                                            </div>

                                            <div className="w-1/3 bg-white/5 p-6 border-l border-white/5 flex flex-col justify-center">
                                                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-4">Labs</p>
                                                <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                                                    <div className="flex items-center gap-2 mb-1 text-indigo-400">
                                                        <SparklesIcon className="w-3 h-3" />
<<<<<<< HEAD
                                                        <span className="text-[10px] font-bold">Video AI v1.0</span>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 italic leading-snug">Chuyển đổi video ngắn thành văn bản tư vấn chuyên sâu.</p>
=======
                                                        <span className="text-[10px] font-bold"> AI v2.0</span>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 italic leading-snug">LLM</p>
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <NavLink to="/van-ban-phap-luat" className={navClass}>Tra cứu văn bản</NavLink>
                        <NavLink to="/ho-so-phap-ly" className={navClass}>Hồ sơ pháp lý</NavLink>
<<<<<<< HEAD
=======


                        {/* ========================================================= */}
                        {/* NÚT CHUYỂN MẠCH THẦN THÁNH CỦA ADMIN (BẢN TỐI THƯỢNG) */}
                        {/* ========================================================= */}
                        {(() => {
                            const userStr = localStorage.getItem("user");
                            if (!userStr) return null;

                            try {
                                const user = JSON.parse(userStr);

                                // 🔍 LOG RA CONSOLE ĐỂ BẮT MẠCH (Duy mở F12 -> Console lên xem nhé)
                                console.log("🔍 Thông tin User đang đăng nhập:", user);

                                // LƯỚI BẮT CÁ: Quét mọi key có thể có (Role, role, ROLE) và ép hết về IN HOA
                                const rawRole = user.Role || user.role || user.ROLE || "";
                                const userRole = String(rawRole).toUpperCase();

                                // So sánh chuẩn xác 100%
                                if (userRole === 'ADMIN' && !location.pathname.includes('/admin')) {
                                    return (
                                        // ĐỔI TỪ <button> SANG <Link> VÀ THÊM Z-50
                                        <Link
                                            to="/admin"
                                            className="relative z-50 cursor-pointer ml-4 px-4 py-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 text-purple-300 rounded-lg text-[10px] font-black uppercase tracking-widest hover:from-purple-600 hover:to-blue-600 hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(168,85,247,0.15)] flex items-center gap-2"
                                        >
                                            <SparklesIcon className="w-3 h-3 animate-pulse" /> BẢNG QUẢN TRỊ
                                        </Link>
                                    );
                                }
                            } catch (error) {
                                console.error("Lỗi đọc dữ liệu User:", error);
                            }

                            return null;
                        })()}
                        {/* ========================================================= */}
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                    </nav>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative">
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center focus:outline-none p-2 rounded-full hover:bg-white/10 transition-colors">
                            {isLoggedIn ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center border border-white/20">
                                        <UserIcon className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                            ) : (
                                <Bars3Icon className="h-6 w-6 text-gray-300 hover:text-cyan-400" />
                            )}
                        </button>

                        <AnimatePresence>
                            {isMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
<<<<<<< HEAD
                                    <motion.div 
=======
                                    <motion.div
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="absolute right-0 mt-4 w-64 border rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] py-2 z-20 backdrop-blur-2xl bg-[#0a0a0a]/95 border-white/10 text-gray-200"
                                    >
                                        {isLoggedIn ? (
                                            <div className="px-5 py-3 mb-2 border-b border-white/10 bg-white/5">
                                                <p className="text-xs text-gray-400 mb-1 font-mono tracking-tighter">AUTHENTICATED AS</p>
                                                <p className="text-sm font-bold text-white truncate">{userName}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <button onClick={() => { navigate("/login"); setIsMenuOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-semibold hover:bg-white/10 hover:text-cyan-400 transition-colors flex items-center gap-3">
                                                    <ArrowLeftOnRectangleIcon className="h-5 w-5" /> Đăng nhập
                                                </button>
                                                <button onClick={() => { navigate("/login"); setIsMenuOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-semibold hover:bg-white/10 hover:text-cyan-400 transition-colors flex items-center gap-3">
                                                    <UserPlusIcon className="h-5 w-5" /> Đăng ký
                                                </button>
                                                <div className="border-t my-2 border-white/10"></div>
                                            </>
                                        )}

                                        <button onClick={() => { navigate("/lien-he"); setIsMenuOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-semibold hover:bg-white/10 hover:text-cyan-400 transition-colors flex items-center gap-3">
                                            <PhoneIcon className="h-5 w-5" /> Liên hệ hỗ trợ
                                        </button>

                                        <button onClick={() => { navigate("/gui-phan-hoi"); setIsMenuOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-semibold hover:bg-white/10 hover:text-cyan-400 transition-colors flex items-center gap-3">
                                            <ChatBubbleLeftEllipsisIcon className="h-5 w-5" /> Gửi phản hồi
                                        </button>

                                        {isLoggedIn && (
                                            <>
                                                <div className="border-t my-2 border-white/10"></div>
                                                <button onClick={handleLogout} className="w-full text-left px-5 py-3 text-sm font-semibold hover:bg-red-500/10 hover:text-red-400 transition-colors flex items-center gap-3">
                                                    <ArrowRightOnRectangleIcon className="h-5 w-5" /> Đăng xuất
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