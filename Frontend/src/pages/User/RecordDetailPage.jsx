import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeftIcon,
    ArrowDownTrayIcon,
    CpuChipIcon,
    ShareIcon,
    PencilSquareIcon,
    TrashIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline';
import Header from "../../components/PageHeader";
import AIAnalysisModal from "../../components/AIAnalysisModal";

export default function RecordDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [isAIModalOpen, setIsAIModalOpen] = useState(false);

    const record = {
        name: "GIẤY MUA BÁN NHÀ ĐẤT",
        date: "20/12/2023",
        content: "Nội dung hồ sơ pháp lý chi tiết sẽ hiển thị ở đây..."
    };

    const handleBack = () => navigate(-1);

    const handleDownload = () => alert("Hồ sơ đang được tải xuống dưới dạng file PDF...");

    const handleShare = () => alert("Mở cửa sổ chia sẻ hồ sơ...");

    const handleEdit = () => alert("Mở cửa sổ chỉnh sửa hồ sơ...");

    const handleDelete = () => {
        if (window.confirm("Bạn có chắc chắn muốn xoá hồ sơ này?")) {
            alert("Hồ sơ đã được xoá thành công");
            navigate('/ho-so-phap-ly');
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Header />

            <main className="max-w-5xl mx-auto w-full px-6 py-10 flex-grow">
                <div className="flex justify-between items-center mb-8">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> Quay lại
                    </button>

                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition shadow-md"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" /> Tải xuống (PDF)
                    </button>
                </div>

                <div className="border border-gray-200 rounded-2xl shadow-sm overflow-hidden bg-gray-50">
                    <div className="bg-white p-6 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <DocumentTextIcon className="w-10 h-10 text-blue-500" />
                            <div>
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                    {record.name}
                                </h2>
                                <p className="text-xs text-gray-400 font-medium uppercase">Ngày tạo: {record.date}</p>
                            </div>
                        </div>

                        {/* Nhóm nút tác vụ (Mục 3-6) */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsAIModalOpen(true)}
                                title="Phân tích AI"
                                className="p-2.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-600 hover:text-white transition"
                            >
                                <CpuChipIcon className="w-5 h-5" />
                            </button>

                            <button
                                onClick={handleShare}
                                title="Chia sẻ"
                                className="p-2.5 bg-green-50 text-green-600 rounded-full hover:bg-green-600 hover:text-white transition"
                            >
                                <ShareIcon className="w-5 h-5" />
                            </button>

                            <button
                                onClick={handleEdit}
                                title="Chỉnh sửa"
                                className="p-2.5 bg-orange-50 text-orange-600 rounded-full hover:bg-orange-600 hover:text-white transition"
                            >
                                <PencilSquareIcon className="w-5 h-5" />
                            </button>

                            <button
                                onClick={handleDelete}
                                title="Xoá"
                                className="p-2.5 bg-red-50 text-red-600 rounded-full hover:bg-red-600 hover:text-white transition"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="p-10 bg-white min-h-[600px] shadow-inner">
                        <div className="max-w-3xl mx-auto border border-gray-100 p-8 min-h-[500px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {record.content}
                        </div>
                    </div>
                </div>
            </main>

            <AIAnalysisModal
                isOpen={isAIModalOpen}
                onClose={() => setIsAIModalOpen(false)}
                recordName={record.name}
            />
        </div>
    );
}