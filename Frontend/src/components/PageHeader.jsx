import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom"; // Thêm useLocation
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
    const location = useLocation(); // Lấy thông tin trang hiện tại
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Kiểm tra xem có đang ở trang chủ hay không
    const isHomePage = location.pathname === "/";

    const navClass = ({ isActive }) => {
        const baseClass = `relative px-1 py-2 transition-all duration-300 uppercase tracking-widest text-[11px] group`; // Thêm group để quản lý hover tốt hơn

        // 1. Quản lý màu sắc Text
        let stateColor = "";
        if (isHomePage) {
            stateColor = isActive ? "text-white font-bold" : "text-gray-400 hover:text-white";
        } else {
            stateColor = isActive ? "text-blue-600 font-bold" : "text-slate-600 hover:text-blue-600";
        }

        // 2. Quản lý màu sắc/hiệu ứng đường gạch chân (Pseudo-element 'after')
        // Chuyển origin-left thành origin-center để giống bản tham khảo
        const underlineBase = "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:transition-transform after:duration-500 after:origin-center";

        // Scale và Color
        const underlineState = isActive
            ? "after:scale-x-100 after:bg-gradient-to-r after:from-pink-500 after:to-blue-500"
            : `after:scale-x-0 group-hover:after:scale-x-100 ${isHomePage ? "after:bg-white/70" : "after:bg-blue-600/70"}`;

        return `${baseClass} ${stateColor} ${underlineBase} ${underlineState}`;
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setIsMenuOpen(false);
        alert("Đã đăng xuất thành công!");
        navigate("/");
    };

    return (
        // ✅ 2. Sửa header: Tự động đổi Style dựa trên biến isHomePage
        <header className={`sticky top-0 z-[100] transition-all duration-500 border-b ${isHomePage
                ? "bg-black/20 backdrop-blur-lg border-white/10"
                : "bg-white/80 backdrop-blur-md border-slate-200 shadow-sm"
            }`}>
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between relative">
                <div className="flex items-center gap-10">
                    <img
                        src={logo}
                        alt="LegalAI"
                        // ✅ Logo tự động trắng ở trang chủ, trở về bình thường ở trang con
                        className={`h-8 cursor-pointer transition-all duration-500 ${isHomePage ? "brightness-0 invert" : ""}`}
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
                    {/* ✅ Icon đổi màu linh hoạt */}
                    <button onClick={() => alert("Mở tìm kiếm")} title="Tìm kiếm">
                        <MagnifyingGlassIcon className={`h-5 w-5 transition-all hover:scale-110 ${isHomePage ? "text-gray-300 hover:text-white" : "text-slate-600 hover:text-blue-600"}`} />
                    </button>

                    <button onClick={() => navigate("/tai-khoan")} title="Tài khoản">
                        <UserIcon className={`h-5 w-5 transition-all hover:scale-110 ${isHomePage ? "text-gray-300 hover:text-white" : "text-slate-600 hover:text-blue-600"}`} />
                    </button>

                    <div className="relative">
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center focus:outline-none" title="Menu">
                            <Bars3Icon className={`h-6 w-6 transition-all hover:scale-110 ${isHomePage ? "text-gray-300 hover:text-white" : "text-slate-600 hover:text-blue-600"}`} />
                        </button>

                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>

                                {/* ✅ Dropdown Menu cũng đổi màu nền linh hoạt */}
                                <div className={`absolute right-0 mt-6 w-60 border rounded-2xl shadow-2xl py-3 z-20 animate-fadeIn backdrop-blur-xl ${isHomePage ? "bg-[#121212] border-white/10" : "bg-white border-slate-100"
                                    }`}>
                                    {!isLoggedIn ? (
                                        <button
                                            onClick={() => { navigate("/login"); setIsMenuOpen(false); }}
                                            className={`w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 ${isHomePage ? "text-gray-300 hover:bg-white/5 hover:text-white" : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                                                }`}
                                        >
                                            <ArrowLeftOnRectangleIcon className="h-5 w-5" /> Đăng nhập
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleLogout}
                                            className={`w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 ${isHomePage ? "text-gray-300 hover:bg-white/5 hover:text-white" : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                                                }`}
                                        >
                                            <ArrowRightOnRectangleIcon className="h-5 w-5" /> Đăng xuất
                                        </button>
                                    )}

                                    <div className={`border-t my-2 ${isHomePage ? "border-white/5" : "border-slate-100"}`}></div>

                                    <button
                                        onClick={() => { navigate("/gui-phan-hoi"); setIsMenuOpen(false); }}
                                        className={`w-full text-left px-5 py-3 text-sm font-semibold transition flex items-center gap-3 ${isHomePage ? "text-gray-300 hover:bg-white/5 hover:text-white" : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                                            }`}
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