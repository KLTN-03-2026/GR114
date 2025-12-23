import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MagnifyingGlassIcon,
    DocumentTextIcon,
    CalendarIcon,
    FunnelIcon,
    ArrowRightIcon,
    BookOpenIcon
} from '@heroicons/react/24/outline';

export default function LegalDocuments() {
    const navigate = useNavigate();

    const [filter, setFilter] = useState({
        keyword: "",
        type: "",
        fromDate: "",
        toDate: ""
    });

    const [documents, setDocuments] = useState([
        { id: 1, title: "Nghị quyết 41/2017/QH14", date: "10/09/2025", type: "Nghị quyết", desc: "Nghị quyết về việc thi hành Bộ luật Hình sự số 100/2015/QH13 đã được sửa đổi, bổ sung một số điều..." },
        { id: 2, title: "Nghị định 52/2013/NĐ-CP", date: "16/05/2013", type: "Nghị định", desc: "Văn bản hợp nhất quy định về Thương mại điện tử và các hoạt động giao dịch trực tuyến..." },
        { id: 3, title: "Luật Đất Đai 2024", date: "18/01/2024", type: "Luật", desc: "Quy định về chế độ sở hữu đất đai, quyền hạn và trách nhiệm của Nhà nước đại diện chủ sở hữu..." }
    ]);

    const handleSearch = () => {
        console.log("Đang tìm kiếm với:", filter);
        alert("Hệ thống đang lọc dữ liệu...");
    };

    const handleViewDetail = (id) => {
        navigate(`/van-ban/chi-tiet/${id}`);
    };

    return (
        // ✅ 1. NỀN ĐEN
        <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">

            {/* Hiệu ứng nền Glow */}
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-[800px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            <main className="max-w-7xl mx-auto w-full px-6 py-24 relative z-10">

                {/* ✅ 2. HERO SECTION */}
                <div className="text-center mb-16 space-y-6 animate-fadeInUp">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
                        <BookOpenIcon className="w-4 h-4" /> Thư viện pháp luật số
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black tracking-tight uppercase leading-tight">
                        Tra cứu <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Văn bản</span>
                    </h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Hệ thống cơ sở dữ liệu pháp luật toàn diện, cập nhật nhanh chóng và chính xác nhất.
                    </p>
                </div>

                {/* ✅ 3. FILTER SECTION (Glass Box) */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 mb-16 shadow-2xl relative overflow-hidden group">
                    {/* Glow effect on hover container */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                    <div className="flex items-center gap-2 mb-6 text-cyan-400 font-bold uppercase tracking-widest text-xs">
                        <FunnelIcon className="w-4 h-4" /> Bộ lọc tìm kiếm
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {/* Keyword */}
                        <div className="space-y-2 group/input">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 group-focus-within/input:text-white transition-colors">Từ khoá</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Nhập số hiệu, tên văn bản..."
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 pl-10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all text-white placeholder-gray-600"
                                    onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
                                />
                                <MagnifyingGlassIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        {/* Type */}
                        <div className="space-y-2 group/input">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 group-focus-within/input:text-white transition-colors">Loại văn bản</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all text-white appearance-none cursor-pointer"
                                    onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                                >
                                    <option value="" className="bg-gray-900">Tất cả loại</option>
                                    <option className="bg-gray-900">Nghị quyết</option>
                                    <option className="bg-gray-900">Nghị định</option>
                                    <option className="bg-gray-900">Thông tư</option>
                                    <option className="bg-gray-900">Luật</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        {/* From Date */}
                        <div className="space-y-2 group/input">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 group-focus-within/input:text-white transition-colors">Từ ngày</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 pl-10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all text-white placeholder-gray-600 [color-scheme:dark]"
                                    onChange={(e) => setFilter({ ...filter, fromDate: e.target.value })}
                                />
                                <CalendarIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        {/* To Date */}
                        <div className="space-y-2 group/input">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 group-focus-within/input:text-white transition-colors">Đến ngày</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 pl-10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all text-white placeholder-gray-600 [color-scheme:dark]"
                                    onChange={(e) => setFilter({ ...filter, toDate: e.target.value })}
                                />
                                <CalendarIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={handleSearch}
                            className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-12 py-3 rounded-xl font-black uppercase tracking-widest hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center gap-2"
                        >
                            <MagnifyingGlassIcon className="w-5 h-5" />
                            Tìm kiếm ngay
                        </button>
                    </div>
                </div>

                {/* ✅ 4. RESULTS SECTION */}
                <div className="flex items-center justify-between mb-8 px-2">
                    <p className="text-gray-400 italic">
                        Tìm thấy <span className="text-white font-bold not-italic">{documents.length}</span> văn bản phù hợp
                    </p>
                    <div className="h-[1px] flex-grow bg-white/10 ml-6"></div>
                </div>

                <div className="grid gap-6">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className="group relative bg-[#0a0a0a]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 hover:bg-white/5 hover:border-cyan-500/30 transition-all duration-300"
                        >
                            {/* Decoration line left */}
                            <div className="absolute left-0 top-6 bottom-6 w-1 bg-gradient-to-b from-blue-600 to-cyan-500 rounded-r-full opacity-50 group-hover:opacity-100 transition-opacity"></div>

                            <div className="flex flex-col md:flex-row gap-6 md:items-start">
                                {/* Icon Box */}
                                <div className="hidden md:flex flex-shrink-0 w-16 h-16 bg-white/5 border border-white/5 rounded-2xl items-center justify-center group-hover:scale-110 group-hover:bg-cyan-500/10 transition-all">
                                    <DocumentTextIcon className="w-8 h-8 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                                </div>

                                <div className="flex-grow">
                                    <div className="flex flex-wrap gap-3 mb-3">
                                        <span className="px-3 py-1 rounded-lg bg-blue-900/30 border border-blue-500/30 text-blue-300 text-xs font-mono font-bold uppercase">
                                            {doc.type}
                                        </span>
                                        <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-mono flex items-center gap-1">
                                            <CalendarIcon className="w-3 h-3" /> {doc.date}
                                        </span>
                                    </div>

                                    <h3 className="text-xl md:text-2xl font-bold text-white mb-3 group-hover:text-cyan-400 transition-colors leading-tight">
                                        {doc.title}
                                    </h3>

                                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-6 md:mb-0">
                                        {doc.desc}
                                    </p>
                                </div>

                                {/* Action Button */}
                                <div className="flex-shrink-0 self-end md:self-center">
                                    <button
                                        onClick={() => handleViewDetail(doc.id)}
                                        className="group/btn bg-white/5 border border-white/10 hover:bg-cyan-500 hover:border-cyan-500 text-white pl-6 pr-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all"
                                    >
                                        Xem chi tiết
                                        <ArrowRightIcon className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}