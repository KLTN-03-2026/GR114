import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Header from "../../components/PageHeader";
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
        <div className="min-h-screen bg-white flex flex-col">
            <Header />

            <main className="max-w-6xl mx-auto w-full px-6 py-10 flex-grow">
                <h2 className="text-3xl font-black text-center mb-10 uppercase tracking-tighter text-gray-900">
                    Hồ sơ pháp lí
                </h2>

                <div className="flex justify-between items-center mb-10">
                    <button
                        onClick={handleBack}
                        className="px-8 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-sm hover:bg-gray-200 transition"
                    >
                        Quay lại
                    </button>

                    <button
                        onClick={handleOpenModal}
                        className="px-8 py-2.5 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 shadow-lg transition flex items-center gap-2"
                    >
                        <span>+</span> Tải lên hồ sơ
                    </button>
                </div>

                <div className="mb-8">
                    <label className="block font-bold text-lg mb-3 text-gray-800 tracking-tight">Hồ sơ của tôi</label>
                    <div className="relative max-w-sm">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm tên hồ sơ..."
                            className="w-full pl-4 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
                            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-2xl p-6 md:p-8 bg-[#fafafa] min-h-[450px] flex flex-col justify-between shadow-inner">
                    <div className="space-y-4">
                        {filteredRecords.length > 0 ? (
                            filteredRecords.map(record => (
                                <LegalRecordItem key={record.id} record={record} />
                            ))
                        ) : (
                            <div className="text-center py-20">
                                <p className="text-gray-400 italic">Không tìm thấy hồ sơ nào trùng khớp.</p>
                            </div>
                        )}
                    </div>

                    <div className="text-right mt-10 text-sm font-semibold text-gray-400 uppercase tracking-widest">
                        Tổng cộng: {filteredRecords.length} hồ sơ
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