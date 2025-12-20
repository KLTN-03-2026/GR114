import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import logo from "../assets/icons/logo.png";
import chat from "../assets/icons/chat.svg";
import search from "../assets/icons/search.svg";
import user from "../assets/icons/user.png";
import menu from "../assets/icons/menu.png";

export default function PageHeader() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    const navClass = ({ isActive }) =>
        `relative px-1 py-2 transition
        ${isActive
            ? "text-red-600 font-semibold"
            : "text-gray-700 hover:text-red-600"}
        after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full
        after:origin-left after:scale-x-0 after:bg-red-600 after:transition-transform
        hover:after:scale-x-100`;

    const mobileNavClass = ({ isActive }) =>
        `block px-2 py-2 rounded transition
        ${isActive
            ? "bg-red-50 text-red-600 font-medium"
            : "text-gray-700 hover:bg-gray-100"}`;

    return (
        <header className="bg-white border-b sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-10">
                    <img
                        src={logo}
                        alt="LegalAI"
                        className="h-8 cursor-pointer"
                        onClick={() => navigate("/")}
                    />

                    <nav className="hidden md:flex gap-6 text-sm font-medium">
                        <NavLink to="/" className={navClass}>Trang chủ</NavLink>
                        <NavLink to="/dat-lich" className={navClass}>Đặt lịch</NavLink>
                        <NavLink to="/phap-ly" className={navClass}>Pháp lý</NavLink>
                        <NavLink to="/gioi-thieu" className={navClass}>Giới thiệu</NavLink>
                        <NavLink to="/lien-he" className={navClass}>Liên hệ</NavLink>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <img
                        src={chat}
                        alt="Chat AI"
                        className="h-5 hidden sm:block cursor-pointer hover:scale-110 transition"
                        onClick={() => alert("Mở chat AI (demo)")}
                    />
                    <img
                        src={search}
                        alt="Search"
                        className="h-5 hidden sm:block cursor-pointer hover:scale-110 transition"
                        onClick={() => alert("Tìm kiếm (demo)")}
                    />
                    <img
                        src={user}
                        alt="User"
                        className="h-5 cursor-pointer hover:scale-110 transition"
                        onClick={() => navigate("/tai-khoan")}
                    />

                    <img
                        src={menu}
                        alt="Menu"
                        className="h-6 md:hidden cursor-pointer"
                        onClick={() => setOpen(!open)}
                    />
                </div>
            </div>

            {open && (
                <nav className="md:hidden bg-white border-t px-6 py-4 space-y-2 text-sm font-medium">
                    <NavLink to="/" onClick={() => setOpen(false)} className={mobileNavClass}>Trang chủ</NavLink>
                    <NavLink to="/dat-lich" onClick={() => setOpen(false)} className={mobileNavClass}>Đặt lịch</NavLink>
                    <NavLink to="/phap-ly" onClick={() => setOpen(false)} className={mobileNavClass}>Pháp lý</NavLink>
                    <NavLink to="/gioi-thieu" onClick={() => setOpen(false)} className={mobileNavClass}>Giới thiệu</NavLink>
                    <NavLink to="/lien-he" onClick={() => setOpen(false)} className={mobileNavClass}>Liên hệ</NavLink>
                </nav>
            )}
        </header>
    );
}
