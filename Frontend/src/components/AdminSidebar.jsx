import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Database, Users, Scale, Settings, ShieldCheck,
    Scale3DIcon
} from 'lucide-react';
// quản lý chung mảng navigation của AdminDashboard ở 1 nơi duy nhất,


const navigationItems = [
    { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, path: '/admin/dashboard' },
    { key: 'users', label: 'Quản lý Người dùng', icon: Users, path: '/admin/users' },
    { key: 'crawl', icon: Database, label: 'Trình thu thập', path: '/admin/crawl' },
    { key: 'lawdata', icon: Scale, label: 'Quản lý data luật', path: '/admin/lawdata' },
    { key: 'settings', icon: Settings, label: 'Cài đặt', path: '/admin/settings' },
];

export default function AdminSidebar() {
    const navigate = useNavigate();
    const location = useLocation();

   return (
    <aside className="w-68 border-r border-white/5 bg-black/40 flex flex-col p-6 gap-8 sticky top-0 h-screen shrink-0 transition-all">
        {/* LOGO LEGAI HUB */}
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <span className="font-black text-xl tracking-tighter text-white uppercase">
                LEGAI <span className="text-cyan-400">HUB</span>
            </span>
        </div>

        {/* NAVIGATION MENU */}
        <nav className="flex flex-col gap-2">
            {navigationItems.map((item) => {
                const active = item.path === location.pathname;
                const Icon = item.icon;
                return (
                    <button
                        key={item.key}
                        onClick={() => navigate(item.path)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full ${
                            active
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                                : 'hover:bg-white/5 hover:text-white text-gray-400'
                        }`}
                    >
                        {/* Quay lại items-center để icon và chữ cân đối */}
                        <Icon size={18} className="shrink-0" />

                        <span className="text-[10px] font-bold uppercase tracking-widest text-left flex-1 whitespace-nowrap overflow-hidden">
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    </aside>
);
}