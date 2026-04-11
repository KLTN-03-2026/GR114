<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
=======
import React, { useState, useEffect, useRef } from 'react';
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    MagnifyingGlassIcon,
    FolderOpenIcon,
    ArrowLeftIcon,
    DocumentTextIcon,
<<<<<<< HEAD
    ArrowPathIcon
=======
    ArrowPathIcon,
    ChevronLeftIcon,   // <-- THÊM ICON
    ChevronRightIcon   // <-- THÊM ICON
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
} from '@heroicons/react/24/outline';
import CreateRecordModal from "../../components/CreateRecordModal";
import LegalRecordItem from "../../components/LegalRecordItem";

export default function LegalRecordPage() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
<<<<<<< HEAD

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const token = localStorage.getItem("accessToken");
                const userStr = localStorage.getItem("user");
                
                if (!userStr || !token) {
                    console.error("Chưa đăng nhập!");
                    setLoading(false);
                    return;
                }

                const user = JSON.parse(userStr);
                const userId = user.id ?? user.Id ?? user.ID;

                const res = await axios.get(`http://localhost:8000/api/history/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.data && res.data.success) {
                    const formattedRecords = res.data.data.map(item => ({
                        id: item.Id,
                        name: item.Title || item.FileName || "Bản ghi không tên",
                        date: new Date(item.CreatedAt).toLocaleDateString('vi-VN'),
                        type: item.RecordType,
                        riskScore: item.RiskScore,
                        fullData: item
                    }));
                    setRecords(formattedRecords);
                }
            } catch (error) {
                console.error("Lỗi tải dữ liệu:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []); // Xóa navigate khỏi đây để tránh loop

    const handleBack = () => navigate('/');
    
    const filteredRecords = records.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
=======
    
    // THÊM: State quản lý Phân trang
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalDocs: 0
    });
    
    // THÊM: Ref để chống spam gọi API khi gõ tìm kiếm
    const searchRef = useRef(null);

    // SỬA: Hàm fetch truyền thêm page
    const fetchHistory = async (page = 1) => {
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            
            if (!userStr || !token) {
                console.error("Chưa đăng nhập!");
                setLoading(false);
                return;
            }

            const user = JSON.parse(userStr);
            const userId = user.id ?? user.Id ?? user.ID;

            // Truyền param lên Backend
            const res = await axios.get(`http://localhost:8000/api/history/${userId}`, {
                params: {
                    page: page,
                    limit: 6,
                    search: searchTerm.trim()
                },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                const formattedRecords = res.data.data.map(item => ({
                    id: item.Id,
                    name: item.Title || item.FileName || "Bản ghi không tên",
                    date: new Date(item.CreatedAt).toLocaleDateString('vi-VN'),
                    type: item.RecordType,
                    riskScore: item.RiskScore,
                    fullData: item
                }));
                setRecords(formattedRecords);
                
                // Cập nhật thông tin phân trang từ Backend trả về
                setPagination({
                    currentPage: res.data.currentPage || 1,
                    totalPages: res.data.totalPages || 1,
                    totalDocs: res.data.totalDocs || 0
                });
            }
        } catch (error) {
            console.error("Lỗi tải dữ liệu:", error);
        } finally {
            setLoading(false);
        }
    };

    // SỬA: Lắng nghe sự thay đổi của Trang hiện tại
    useEffect(() => {
        fetchHistory(pagination.currentPage);
    }, [pagination.currentPage]);

    // SỬA: Xử lý tìm kiếm (Debounce)
    useEffect(() => {
        if (searchRef.current) clearTimeout(searchRef.current);
        searchRef.current = setTimeout(() => {
            if (pagination.currentPage !== 1) {
                setPagination(prev => ({ ...prev, currentPage: 1 }));
            } else {
                fetchHistory(1);
            }
        }, 500);
        return () => clearTimeout(searchRef.current);
    }, [searchTerm]);

    const handleBack = () => navigate('/');
    
    // SỬA: Hàm chuyển trang
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, currentPage: newPage }));
        }
    };

    // XÓA: Bỏ logic filteredRecords ở Client đi, dùng luôn state records
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c

    return (
        <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] -z-10"></div>
            <main className="max-w-7xl mx-auto w-full px-6 py-24 relative z-10">
                <div className="text-center mb-16 space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-bold uppercase">
                        <FolderOpenIcon className="w-4 h-4" /> Kho lưu trữ số
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black uppercase">
                        Hồ sơ <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Pháp lý</span>
                    </h2>
                </div>

                <div className="flex justify-between mb-10">
                    <button onClick={handleBack} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 flex items-center gap-2 hover:bg-white/10">
                        <ArrowLeftIcon className="w-4 h-4" /> Quay lại
                    </button>
<<<<<<< HEAD
                </div>

                <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 min-h-[500px]">
=======
                    {/* THÊM: Hiển thị tổng số hồ sơ */}
                    <div className="text-sm font-bold text-cyan-400 border border-cyan-500/30 px-4 py-3 rounded-xl bg-cyan-500/10">
                        Tổng cộng: {pagination.totalDocs} hồ sơ
                    </div>
                </div>

                <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 min-h-[500px] flex flex-col">
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                    <div className="mb-10 max-w-md">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm kiếm hồ sơ..."
<<<<<<< HEAD
                                className="w-full pl-5 pr-12 py-4 bg-white/5 border border-white/10 rounded-xl text-white"
=======
                                className="w-full pl-5 pr-12 py-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-500"
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                            />
                            <MagnifyingGlassIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500" />
                        </div>
                    </div>

<<<<<<< HEAD
                    <div className="space-y-4">
=======
                    <div className="space-y-4 flex-grow">
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                <ArrowPathIcon className="w-8 h-8 animate-spin mb-2 text-cyan-500" />
                                <span>Đang đồng bộ dữ liệu...</span>
                            </div>
<<<<<<< HEAD
                        ) : filteredRecords.length > 0 ? (
                            filteredRecords.map(record => (
                                <LegalRecordItem key={record.id} record={record} />
=======
                        ) : records.length > 0 ? (
                            records.map(record => (
                                <LegalRecordItem key={record.id} record={record} /> // SỬA: đổi filteredRecords thành records
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/10 rounded-2xl">
                                <DocumentTextIcon className="w-16 h-16 text-gray-700 mb-4" />
                                <p className="text-gray-500 italic">Chưa có hồ sơ nào</p>
                            </div>
                        )}
                    </div>
<<<<<<< HEAD
=======

                    {/* THÊM: KHỐI UI PHÂN TRANG */}
                    {!loading && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-8 border-t border-white/5 mt-6">
                            <button 
                                onClick={() => handlePageChange(pagination.currentPage - 1)}
                                disabled={pagination.currentPage === 1}
                                className="p-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-20 transition-all text-white"
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>

                            {[...Array(pagination.totalPages)].map((_, i) => {
                                const p = i + 1;
                                if (p === 1 || p === pagination.totalPages || (p >= pagination.currentPage - 1 && p <= pagination.currentPage + 1)) {
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => handlePageChange(p)}
                                            className={`w-10 h-10 rounded-lg border font-bold text-sm transition-all ${
                                                pagination.currentPage === p 
                                                ? "bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/40" 
                                                : "border-white/10 text-gray-500 hover:bg-white/5"
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                }
                                if (p === pagination.currentPage - 2 || p === pagination.currentPage + 2) return <span key={p} className="text-gray-700">...</span>;
                                return null;
                            })}

                            <button 
                                onClick={() => handlePageChange(pagination.currentPage + 1)}
                                disabled={pagination.currentPage === pagination.totalPages}
                                className="p-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-20 transition-all text-white"
                            >
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                </div>
            </main>
        </div>
    );
}