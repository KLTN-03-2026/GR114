import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const navClass = ({ isActive }) =>
        `relative px-1 py-2 transition
        ${isActive ? "text-red-600 font-semibold" : "text-gray-700 hover:text-red-600"}
        after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full
        after:origin-left after:scale-x-0 after:bg-red-600 after:transition-transform
        hover:after:scale-x-100`;

    const handleLogout = () => {
        setIsLoggedIn(false);
        setIsMenuOpen(false);
        alert("Đã đăng xuất thành công!");
        navigate("/");
    };

    return (
        <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between relative">
                <div className="flex items-center gap-10">
                    <img
                        src={logo}
                        alt="LegalAI"
                        className="h-8 cursor-pointer"
                        onClick={() => navigate("/")}
                    />

                    <nav className="hidden md:flex gap-6 text-sm font-medium">
                        <NavLink to="/" className={navClass}>Trang chủ</NavLink>
                        <NavLink to="/dat-lich" className={navClass}>Rà soát Hợp đồng AI</NavLink>
                        <NavLink to="/ho-so-phap-ly" className={navClass}>Pháp lý</NavLink>
                        <NavLink to="/van-ban-phap-luat" className={navClass}>Văn bản</NavLink>
                        <NavLink to="/gioi-thieu" className={navClass}>Giới thiệu</NavLink>
                        <NavLink to="/lien-he" className={navClass}>Liên hệ</NavLink>
                    </nav>
                </div>
                <div className="flex items-center gap-5">
                    <button onClick={() => alert("Mở tìm kiếm")} title="Tìm kiếm">
                        <MagnifyingGlassIcon className="h-6 w-6 text-gray-600 hover:text-red-600 transition hover:scale-110" />
                    </button>

                    <button onClick={() => navigate("/tai-khoan")} title="Tài khoản">
                        <UserIcon className="h-6 w-6 text-gray-600 hover:text-red-600 transition hover:scale-110" />
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center focus:outline-none"
                            title="Menu"
                        >
                            <Bars3Icon className="h-6 w-6 text-gray-600 hover:text-red-600 transition hover:scale-110" />
                        </button>

                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>

                                <div className="absolute right-0 mt-4 w-56 bg-white border border-gray-100 rounded-2xl shadow-2xl py-3 z-20 animate-fadeIn">
                                    {!isLoggedIn ? (
                                        <button
                                            onClick={() => { navigate("/login"); setIsMenuOpen(false); }}
                                            className="w-full text-left px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 transition flex items-center gap-3"
                                        >
                                            <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                                            Đăng nhập
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 transition flex items-center gap-3"
                                        >
                                            <ArrowRightOnRectangleIcon className="h-5 w-5" />
                                            Đăng xuất
                                        </button>
                                    )}

                                    <div className="border-t border-gray-50 my-1"></div>

                                    <button
                                        onClick={() => { navigate("/gui-phan-hoi"); setIsMenuOpen(false); }}
                                        className="w-full text-left px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 transition flex items-center gap-3"
                                    >
                                        <ChatBubbleLeftEllipsisIcon className="h-5 w-5" />
                                        Gửi phản hồi
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