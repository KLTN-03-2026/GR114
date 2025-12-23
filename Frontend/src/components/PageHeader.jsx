import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom"; 
import {
    Bars3Icon,
    MagnifyingGlassIcon,
    UserIcon,
    ChatBubbleLeftEllipsisIcon,
    ArrowRightOnRectangleIcon,
    ArrowLeftOnRectangleIcon
} from "@heroicons/react/24/outline";

import logo from "../assets/icons/logo.png";

export default function PageHeader() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const isHomePage = location.pathname === "/";

    // Style Link: Giữ nguyên
    const navClass = ({ isActive }) => {
        const baseClass = `relative px-1 py-2 transition-all duration-300 uppercase tracking-widest text-[11px] group`; 
        const stateColor = isActive ? "text-cyan-400 font-bold" : "text-gray-300 hover:text-white";
        const underlineBase = "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:transition-transform after:duration-500 after:origin-center";
        const underlineState = isActive
            ? "after:scale-x-100 after:bg-gradient-to-r after:from-cyan-400 after:to-blue-500"
            : "after:scale-x-0 group-hover:after:scale-x-100 after:bg-cyan-400/70";
        return `${baseClass} ${stateColor} ${underlineBase} ${underlineState}`;
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setIsMenuOpen(false);
        alert("Đã đăng xuất thành công!");
        navigate("/");
    };

    return (
        // ✅ FIX 1: Thêm 'h-20' (80px) để khớp tuyệt đối với padding-top của MainLayout
        // ✅ FIX 2: Tăng độ đậm 'bg-black/40' để kính trông dày dặn, sang trọng hơn
        <header className={`transition-all duration-500 w-full h-20 flex items-center border-b ${
            isHomePage 
                ? "bg-transparent border-white/5" 
                : "bg-black/40 backdrop-blur-xl border-white/10 shadow-lg" // Kính tối màu xóa tan khoảng cách
        }`}>
            <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between relative">
                <div className="flex items-center gap-10">
                    <img
                        src={logo}
                        alt="LegalAI"
                        // Logo hơi mờ nhẹ khi hover tạo cảm giác tương tác
                        className="h-9 cursor-pointer transition-all duration-300 brightness-0 invert hover:opacity-80"
                        onClick={() => navigate("/")}
                    />

                    <nav className="hidden md:flex gap-8 text-sm font-medium">
                        <NavLink to="/" className={navClass}>Trang chủ</NavLink>
                        <NavLink to="/contract-analysis" className={navClass}>Rà soát Hợp đồng AI</NavLink>
                        <NavLink to="/ho-so-phap-ly" className={navClass}>Pháp lý</NavLink>
                        <NavLink to="/van-ban-phap-luat" className={navClass}>Văn bản</NavLink>
                        <NavLink to="/gioi-thieu" className={navClass}>Giới thiệu</NavLink>
                        <NavLink to="/lien-he" className={navClass}>Liên hệ</NavLink>
                    </nav>
                </div>

                <div className="flex items-center gap-6">
                    <button onClick={() => alert("Mở tìm kiếm")} title="Tìm kiếm">
                        <MagnifyingGlassIcon className="h-5 w-5 transition-all hover:scale-110 text-gray-300 hover:text-cyan-400" />
                    </button>

                    <button onClick={() => navigate("/tai-khoan")} title="Tài khoản">
                        <UserIcon className="h-5 w-5 transition-all hover:scale-110 text-gray-300 hover:text-cyan-400" />
                    </button>

                    <div className="relative">
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center focus:outline-none" title="Menu">
                            <Bars3Icon className="h-6 w-6 transition-all hover:scale-110 text-gray-300 hover:text-cyan-400" />
                        </button>

                        {/* Menu Dropdown */}
                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                                <div className="absolute right-0 mt-8 w-64 border rounded-2xl shadow-2xl py-3 z-20 animate-fadeIn backdrop-blur-2xl bg-[#0a0a0a]/95 border-white/10 text-gray-200">
                                    {!isLoggedIn ? (
                                        <button
                                            onClick={() => { navigate("/login"); setIsMenuOpen(false); }}
                                            className="w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 hover:bg-white/10 hover:text-cyan-400"
                                        >
                                            <ArrowLeftOnRectangleIcon className="h-5 w-5" /> Đăng nhập
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 hover:bg-white/10 hover:text-red-400"
                                        >
                                            <ArrowRightOnRectangleIcon className="h-5 w-5" /> Đăng xuất
                                        </button>
                                    )}

                                    <div className="border-t my-2 border-white/10"></div>

                                    <button
                                        onClick={() => { navigate("/gui-phan-hoi"); setIsMenuOpen(false); }}
                                        className="w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 hover:bg-white/10 hover:text-cyan-400"
                                    >
                                        <ChatBubbleLeftEllipsisIcon className="h-5 w-5" /> Gửi phản hồi
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}