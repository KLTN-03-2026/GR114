import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    Database, Play, CloudDownload, CheckCircle, Clock,
    ShieldCheck, Scale, LayoutDashboard, Users, Activity, Settings, LogOut, User, FileText, BarChart2
} from 'lucide-react';
import AdminSidebar from '../../components/AdminSidebar';
export default function AdminCrawler() {
    const [isAutoCrawlEnabled, setIsAutoCrawlEnabled] = useState(false);
    const [crawlTime, setCrawlTime] = useState('02:00');
    const [urls, setUrls] = useState('');
    const [dailyLimit, setDailyLimit] = useState(50);
    const [keywordFilter, setKeywordFilter] = useState('/ban-an/');
    const navigate = useNavigate();
    const location = useLocation();
    const backendBase = 'http://localhost:8000/api';
    const [isManualCrawling, setIsManualCrawling] = useState(false);
    const [history, setHistory] = useState([]);


    // Fetch settings từ API
    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.get(`${backendBase}/admin/crawler/settings`, { headers });

            // CONSOLE 
            console.log("Data từ API trả về:", res.data);

            if (res.data.success) {
                const data = res.data.data;

                //  Bọc lót cả hoa lẫn thường (SQL hay trả về viết hoa chữ cái đầu)
                setIsAutoCrawlEnabled(data.IsAutoCrawlOn ?? data.isAutoCrawlOn ?? false);
                setCrawlTime(data.CrawlTime || data.crawlTime || '02:00');
                setUrls(data.TargetUrls || data.targetUrls || '');
                setDailyLimit(data.DailyLimit || data.dailyLimit || 50);
                setKeywordFilter(data.FilterPatterns || data.filterPatterns || '/ban-an/');
            }
        } catch (error) {
            console.error('Lỗi khi tải cấu hình crawler:', error);
        }
    };

    // Fetch lịch sử thu thập
    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.get(`${backendBase}/admin/crawler/history`, { headers });

            if (res.data.success) {
                console.log(" Dữ liệu lịch sử mới đã cập nhật:", res.data.data[0]?.Title);
                setHistory(res.data.data || []);
            }
        } catch (error) {
            console.error('Lỗi khi tải lịch sử thu thập:', error);
            setHistory([]);
        }
    };
    useEffect(() => {
        fetchSettings();
        fetchHistory();
    }, []);

    const handleSaveConfig = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const data = {
                isAutoCrawlOn: isAutoCrawlEnabled,
                crawlTime: crawlTime,
                targetUrls: urls,
                dailyLimit: parseInt(dailyLimit),
                filterPatterns: keywordFilter
            };
            const res = await axios.put(`${backendBase}/admin/crawler/settings`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                alert('Cấu hình đã được lưu thành công!');
            } else {
                alert(`Lỗi: ${res.data.message}`);
            }
        } catch (error) {
            console.error('Lỗi khi lưu cấu hình:', error);
            alert(`Lỗi server: ${error.response?.data?.message || error.message}`);
        }
    };

    const handleManualCrawl = async () => {
        const urlArray = urls
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (urlArray.length === 0) {
            alert('Vui lòng nhập ít nhất một URL để thu thập.');
            return;
        }

        if (urlArray.length > 5) {
            alert('Chỉ được thu thập tối đa 5 URLs mỗi lần.');
            return;
        }

        setIsManualCrawling(true);

        try {
            const token = localStorage.getItem('accessToken');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.post(`${backendBase}/admin/crawler/run-manual`, { urls: urlArray }, { headers });

            if (res.data?.success) {
                const { successCount, duplicateCount, failCount } = res.data;
                alert(`Thu thập hoàn thành!\nThành công: ${successCount}\nTrùng lặp: ${duplicateCount}\nLỗi: ${failCount}`);
                fetchHistory(); // Cập nhật lịch sử ngay lập tức
            } else {
                alert(`Lỗi: ${res.data?.message || 'Không thể thu thập dữ liệu.'}`);
            }
        } catch (error) {
            console.error('Lỗi khi chạy thu thập thủ công:', error);
            alert(`Có lỗi: ${error.response?.data?.message || error.message}`);
        } finally {
            setIsManualCrawling(false);
        }
    };

    const glassClass = 'bg-white/80 backdrop-blur-xl border border-amber-200 shadow-2xl overflow-hidden';

    return (
        <div className="fixed inset-0 z-[200] w-full h-screen bg-white text-gray-900 font-sans selection:bg-amber-500/30 flex">

            {/*  SIDEBAR ADMIN  */}
            <AdminSidebar />

            {/* 🔵 MAIN CONTENT */}
            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">

                {/* HEADER */}
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Trình Thu Thập Dữ Liệu</h1>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">Tự Động & Thủ Công Thu Thập Văn Bản Pháp Luật</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-amber-600 uppercase">Trạng thái Hệ thống</span>
                            <span className="text-xs text-gray-900 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                                Trình Thu Thập Sẵn Sàng
                            </span>
                        </div>
                    </div>
                </header>

                {/* --- 3 KHU VỰC CHÍNH --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                    {/* KHU VỰC 1: CẤU HÌNH THU THẬP TỰ ĐỘNG */}
                    <div className={`${glassClass} rounded-3xl p-6`}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider">Cấu Hình Thu Thập Tự Động</h2>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-600 uppercase">Bật/Tắt</span>
                                <button
                                    onClick={() => setIsAutoCrawlEnabled(!isAutoCrawlEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAutoCrawlEnabled ? 'bg-amber-500' : 'bg-gray-300'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAutoCrawlEnabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Giờ Chạy Hàng Ngày</label>
                                <input
                                    type="time"
                                    value={crawlTime}
                                    onChange={(e) => setCrawlTime(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Danh Sách URLs Đích (Mỗi Link 1 Dòng)</label>
                                <textarea
                                    value={urls}
                                    onChange={(e) => setUrls(e.target.value)}
                                    placeholder="https://vanbanphapluat.com&#10;https://thuvienphapluat.vn&#10;https://moj.gov.vn"
                                    rows={6}
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 text-sm resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Giới Hạn Số Bài / Ngày</label>
                                    <input
                                        type="number"
                                        value={dailyLimit}
                                        onChange={(e) => setDailyLimit(e.target.value)}
                                        min="1"
                                        max="1000"
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Từ Khóa / Đuôi Link Ưu Tiên</label>
                                    <input
                                        type="text"
                                        value={keywordFilter}
                                        onChange={(e) => setKeywordFilter(e.target.value)}
                                        placeholder="/ban-an/"
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl outline-none focus:border-amber-500 text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveConfig}
                                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-3 px-6 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-amber-500/25 uppercase text-sm tracking-wider"
                            >
                                Lưu Cấu Hình
                            </button>
                        </div>
                    </div>

                    {/* KHU VỰC 2: ĐIỀU KHIỂN THỦ CÔNG */}
                    <div className={`${glassClass} rounded-3xl p-6 flex flex-col justify-center items-center text-center`}>
                        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider mb-6">Điều Khiển Thủ Công</h2>

                        <button
                            onClick={handleManualCrawl}
                            disabled={isManualCrawling}
                            className={`flex items-center justify-center gap-3 w-full max-w-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-4 px-6 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-amber-500/25 uppercase text-sm tracking-wider mb-4 ${isManualCrawling ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                        >
                            {isManualCrawling ? (
                                <Clock className="w-6 h-6" />
                            ) : (
                                <Play className="w-6 h-6" />
                            )}
                            {isManualCrawling ? 'Đang Thu Thập...' : 'Chạy Thu Thập Ngay'}
                        </button>

                        <p className="text-xs text-gray-600 leading-relaxed">
                            Hệ thống sẽ lập tức thu thập dữ liệu từ các URLs trên.
                            Quá trình có thể mất vài phút tùy thuộc vào số lượng dữ liệu.
                        </p>
                    </div>
                </div>

                {/* KHU VỰC 3: LỊCH SỬ THU THẬP GẦN ĐÂY */}
                <div className={`${glassClass} rounded-3xl p-6`}>
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider mb-6">Lịch Sử Thu Thập Gần Đây</h2>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-xs font-bold text-gray-600 uppercase py-3 px-4">ID</th>
                                    <th className="text-xs font-bold text-gray-600 uppercase py-3 px-4">Số Hiệu</th>
                                    <th className="text-xs font-bold text-gray-600 uppercase py-3 px-4">Tiêu Đề Văn Bản</th>
                                    <th className="text-xs font-bold text-gray-600 uppercase py-3 px-4">Nguồn</th>
                                    <th className="text-xs font-bold text-gray-600 uppercase py-3 px-4">Thời Gian</th>
                                    <th className="text-xs font-bold text-gray-600 uppercase py-3 px-4">Trạng Thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Thêm history?.length để chặn lỗi null */}
                                {!history || history.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-8 text-center text-gray-500">
                                            Chưa có dữ liệu thu thập nào
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((item) => {
                                        const createdAt = new Date(item.CreatedAt);
                                        const timeStr = createdAt.getHours().toString().padStart(2, '0') + ":" +
                                            createdAt.getMinutes().toString().padStart(2, '0');

                                        const shortTitle = item.Title.length > 50 ? item.Title.substring(0, 50) + '...' : item.Title;

                                        return (
                                            <motion.tr
                                                key={item.Id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                            >
                                                {/* 1. ID */}
                                                <td className="py-4 px-4 text-[10px] text-gray-500 font-mono">
                                                    {item.Id}
                                                </td>

                                                {/* 2. SỐ HIỆU */}
                                                <td className="py-4 px-4 text-sm text-amber-600 font-bold">
                                                    {item.DocumentNumber && item.DocumentNumber !== "-"
                                                        ? item.DocumentNumber
                                                        : "Đang cập nhật"}
                                                </td>

                                                {/* 3. TIÊU ĐỀ VĂN BẢN */}
                                                <td className="py-4 px-4 text-sm text-gray-900 max-w-xs truncate" title={item.Title}>
                                                    {shortTitle}
                                                </td>

                                                {/* 4. NGUỒN (Link) */}
                                                <td className="py-4 px-4 text-sm text-gray-700">
                                                    <a
                                                        href={item.SourceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-amber-600/80 hover:text-amber-600 underline decoration-amber-600/20"
                                                    >
                                                        {item.SourceUrl && item.SourceUrl.length > 25 ? item.SourceUrl.substring(0, 25) + '...' : item.SourceUrl}
                                                    </a>
                                                </td>

                                                {/* 5. THỜI GIAN */}
                                                <td className="py-4 px-4 text-sm text-gray-600 font-mono">
                                                    {timeStr}
                                                </td>

                                                {/* 6. TRẠNG THÁI */}
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                                        <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">
                                                            Thành Công
                                                        </span>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}