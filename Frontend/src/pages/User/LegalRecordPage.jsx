import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    MagnifyingGlassIcon,
    FolderOpenIcon,
    ArrowLeftIcon,
    DocumentTextIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import CreateRecordModal from "../../components/CreateRecordModal";
import LegalRecordItem from "../../components/LegalRecordItem";

export default function LegalRecordPage() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

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
                </div>

                <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 min-h-[500px]">
                    <div className="mb-10 max-w-md">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm kiếm hồ sơ..."
                                className="w-full pl-5 pr-12 py-4 bg-white/5 border border-white/10 rounded-xl text-white"
                            />
                            <MagnifyingGlassIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                <ArrowPathIcon className="w-8 h-8 animate-spin mb-2 text-cyan-500" />
                                <span>Đang đồng bộ dữ liệu...</span>
                            </div>
                        ) : filteredRecords.length > 0 ? (
                            filteredRecords.map(record => (
                                <LegalRecordItem key={record.id} record={record} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/10 rounded-2xl">
                                <DocumentTextIcon className="w-16 h-16 text-gray-700 mb-4" />
                                <p className="text-gray-500 italic">Chưa có hồ sơ nào</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}