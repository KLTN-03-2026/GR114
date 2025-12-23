import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    MagnifyingGlassIcon, 
    FolderOpenIcon, 
    ArrowLeftIcon, 
    PlusIcon, 
    DocumentTextIcon 
} from '@heroicons/react/24/outline';
import CreateRecordModal from "../../components/CreateRecordModal";
import LegalRecordItem from "../../components/LegalRecordItem";

export default function LegalRecordPage() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [records, setRecords] = useState([
        { id: 1, name: "GIẤY MUA BÁN NHÀ ĐẤT", date: "20/12/2023" }
    ]);

    const handleAddRecord = (newRecord) => {
        setRecords([newRecord, ...records]);
        setIsModalOpen(false);
    };

    const handleBack = () => navigate('/');

    const handleOpenModal = () => setIsModalOpen(true);

    const filteredRecords = records.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        // ✅ 1. NỀN ĐEN
        <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">

            {/* Hiệu ứng Glow nền */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            <main className="max-w-7xl mx-auto w-full px-6 py-24 relative z-10">
                
                {/* ✅ 2. HEADER SECTION */}
                <div className="text-center mb-16 space-y-6 animate-fadeInUp">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
                        <FolderOpenIcon className="w-4 h-4" /> Kho lưu trữ số
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black tracking-tight uppercase leading-tight">
                        Hồ sơ <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Pháp lý</span>
                    </h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Lưu trữ, quản lý và tra cứu văn bản pháp lý của bạn một cách an toàn và bảo mật tuyệt đối.
                    </p>
                </div>

                {/* ✅ 3. ACTION BAR (Nút bấm Dark Mode) */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-10">
                    <button
                        onClick={handleBack}
                        className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 font-bold text-sm hover:bg-white/10 hover:text-white hover:border-white/20 transition-all flex items-center gap-2 group"
                    >
                        <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
                        Quay lại
                    </button>

                    <button
                        onClick={handleOpenModal}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-black text-sm uppercase tracking-wider hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" /> Tải lên hồ sơ mới
                    </button>
                </div>

                {/* ✅ 4. LIST CONTAINER (Kính mờ tối) */}
                <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl min-h-[500px] flex flex-col">
                    
                    {/* Search Input */}
                    <div className="mb-10 max-w-md">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">Tìm kiếm hồ sơ</label>
                        <div className="relative group">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Nhập tên hồ sơ cần tìm..."
                                className="w-full pl-5 pr-12 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors">
                                <MagnifyingGlassIcon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Danh sách hồ sơ */}
                    <div className="flex-grow space-y-4">
                        {filteredRecords.length > 0 ? (
                            filteredRecords.map(record => (
                                // ⚠️ Lưu ý: Nếu LegalRecordItem có nền trắng cứng, bạn cần vào sửa component đó thành nền trong suốt hoặc tối
                                <LegalRecordItem key={record.id} record={record} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                                <DocumentTextIcon className="w-16 h-16 text-gray-700 mb-4" />
                                <p className="text-gray-500 font-medium italic">Không tìm thấy hồ sơ nào phù hợp</p>
                            </div>
                        )}
                    </div>

                    {/* Footer thống kê */}
                    <div className="text-right mt-8 pt-6 border-t border-white/5">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            Tổng cộng: <span className="text-cyan-400 text-lg ml-1">{filteredRecords.length}</span> hồ sơ
                        </p>
                    </div>
                </div>
            </main>

            <CreateRecordModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onUploadSuccess={handleAddRecord}
            />
        </div>
    );
}