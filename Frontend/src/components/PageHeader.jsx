import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import {
    Bars3Icon,
    UserIcon,
    ChatBubbleLeftEllipsisIcon,
    ArrowRightOnRectangleIcon,
    ArrowLeftOnRectangleIcon,
    PhoneIcon,
    UserPlusIcon
} from "@heroicons/react/24/outline";

import logo from "../assets/icons/logo.png";

export default function PageHeader() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("accessToken"));
    const [userName, setUserName] = useState("");

    const isHomePage = location.pathname === "/";

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
        try {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("user");
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("userRole");
        } catch (e) {
            console.warn('Logout cleanup failed', e);
        }
        setIsLoggedIn(false);
        setUserName("");
        setIsMenuOpen(false);
        alert("Đã đăng xuất thành công!");
        window.location.href = "/";
    };

    useEffect(() => {
        setIsLoggedIn(!!localStorage.getItem("accessToken"));
        try {
            const userStr = localStorage.getItem("user");
            if (userStr) {
                try {
                    const u = JSON.parse(userStr);
                    const name = u?.fullName || u?.FullName || u?.name || u?.email || "Người dùng";
                    setUserName(name);
                } catch (e) {
                    setUserName(userStr);
                }
            }
        } catch (err) {
            console.error('Error reading user from storage', err);
        }

        const onStorage = (e) => {
            if (!e) return;
            if (e.key === 'accessToken') {
                const has = !!e.newValue;
                setIsLoggedIn(has);
                if (!has) setUserName("");
                else {
                    const userStr = localStorage.getItem('user');
                    if (userStr) {
                        try {
                            const u = JSON.parse(userStr);
                            const name = u?.fullName || u?.FullName || u?.name || u?.email || 'Người dùng';
                            setUserName(name);
                        } catch (e) {
                            setUserName(userStr);
                        }
                    }
                }
            }
            if (e.key === 'user' && e.newValue) {
                try {
                    const u = JSON.parse(e.newValue);
                    const name = u?.fullName || u?.FullName || u?.name || u?.email || 'Người dùng';
                    setUserName(name);
                } catch (ex) {
                    setUserName(e.newValue);
                }
            }
        };

        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return (
        <header className={`transition-all duration-500 w-full h-20 flex items-center border-b ${isHomePage
            ? "bg-transparent border-white/5"
            : "bg-black/40 backdrop-blur-xl border-white/10 shadow-lg"
            }`}>
            <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between relative">

                {/* Khu vực Logo & Menu Chính */}
                <div className="flex items-center gap-10">
                    <img
                        src={logo}
                        alt="LegalAI"
                        className="h-9 cursor-pointer transition-all duration-300 brightness-0 invert hover:opacity-80"
                        onClick={() => navigate("/")}
                    />

                    <nav className="hidden md:flex gap-8 text-sm font-medium">
                        <NavLink to="/" className={navClass}>Trang chủ</NavLink>
                        <NavLink to="/contract-analysis" className={navClass}>Rà soát Hợp đồng AI</NavLink>
                        <NavLink to="/soan-thao" className={navClass}>Tạo BIỂU MẪU AI</NavLink>
                        <NavLink to="/ke-hoach-bao-cao" className={navClass}> Lập Kế hoạch AI </NavLink>
                        <NavLink to="/ho-so-phap-ly" className={navClass}> Hồ Sơ Pháp lý</NavLink>
                        <NavLink to="/van-ban-phap-luat" className={navClass}>Tra Cứu Văn bản</NavLink>
                    </nav>
                </div>

                {/* Khu vực Nút chức năng đã được dọn dẹp sạch sẽ, chỉ giữ lại icon Menu */}
                <div className="flex items-center gap-6">
                    <div className="relative">
                        {/* Nút Trigger Dropdown */}
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center focus:outline-none p-2 rounded-full hover:bg-white/10 transition-colors" title="Menu">
                            {/* Nếu đã login, đổi icon 3 gạch thành icon Avatar cho chuẩn UX */}
                            {isLoggedIn ? (
                                <UserIcon className="h-6 w-6 text-cyan-400" />
                            ) : (
                                <Bars3Icon className="h-6 w-6 text-gray-300 hover:text-cyan-400 transition-colors" />
                            )}
                        </button>

                        {/* Menu Dropdown Cao Cấp */}
                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                                <div className="absolute right-0 mt-4 w-64 border rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] py-2 z-20 animate-fadeIn backdrop-blur-2xl bg-[#0a0a0a]/95 border-white/10 text-gray-200">

                                    {/* 🔴 Nhóm 1: Trạng thái Login / Register hoặc Thông tin User */}
                                    {isLoggedIn ? (
                                        <div className="px-5 py-3 mb-2 border-b border-white/10 bg-white/5">
                                            <p className="text-xs text-gray-400 mb-1">Đăng nhập với tư cách</p>
                                            <p className="text-sm font-bold text-white truncate">{userName || 'Người dùng'}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => { navigate("/login"); setIsMenuOpen(false); }}
                                                className="w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 hover:bg-white/10 hover:text-cyan-400"
                                            >
                                                <ArrowLeftOnRectangleIcon className="h-5 w-5" /> Đăng nhập
                                            </button>
                                            <button
                                                onClick={() => { navigate("/register"); setIsMenuOpen(false); }}
                                                className="w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 hover:bg-white/10 hover:text-cyan-400"
                                            >
                                                <UserPlusIcon className="h-5 w-5" /> Đăng ký
                                            </button>
                                            <div className="border-t my-2 border-white/10"></div>
                                        </>
                                    )}

                                    {/* 🔴 Nhóm 2: Chức năng hỗ trợ chung */}
                                    <button
                                        onClick={() => { navigate("/lien-he"); setIsMenuOpen(false); }}
                                        className="w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 hover:bg-white/10 hover:text-cyan-400"
                                    >
                                        <PhoneIcon className="h-5 w-5" /> Liên hệ hỗ trợ
                                    </button>

                                    <button
                                        onClick={() => { navigate("/gui-phan-hoi"); setIsMenuOpen(false); }}
                                        className="w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 hover:bg-white/10 hover:text-cyan-400"
                                    >
                                        <ChatBubbleLeftEllipsisIcon className="h-5 w-5" /> Gửi phản hồi
                                    </button>

                                    {/* 🔴 Nhóm 3: Đăng xuất (Chỉ hiện khi đã đăng nhập) */}
                                    {isLoggedIn && (
                                        <>
                                            <div className="border-t my-2 border-white/10"></div>
                                            <button
                                                onClick={handleLogout}
                                                className="w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 hover:bg-white/10 hover:text-red-400"
                                            >
                                                <ArrowRightOnRectangleIcon className="h-5 w-5" /> Đăng xuất
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}