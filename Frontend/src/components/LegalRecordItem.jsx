import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    EyeIcon, ShareIcon, CpuChipIcon,
    PencilSquareIcon, TrashIcon, DocumentIcon
} from '@heroicons/react/24/outline';

export default function LegalRecordItem({ record }) {
    const navigate = useNavigate();

    const handleGoToEdit = () => {
        navigate(`/ho-so/chinh-sua/${record.id}`);
    };
    const handleGoToDetail = () => {
        navigate(`/ho-so/chi-tiet/${record.id}`);
    };

    return (
        <div className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition">
                    <DocumentIcon className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                    <h4 className="font-bold text-gray-800 uppercase text-sm tracking-tight">{record.name}</h4>
                    <p className="text-xs text-gray-400">Ngày tạo: {record.date}</p>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 text-gray-500">
                <button onClick={handleGoToDetail} className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-full transition">
                    <EyeIcon className="w-5 h-5" />
                </button>

                <button onClick={() => alert("Mở cửa sổ chia sẻ")} className="p-2 hover:bg-green-50 hover:text-green-600 rounded-full transition">
                    <ShareIcon className="w-5 h-5" />
                </button>

                <button onClick={() => alert("Mở phân tích AI")} className="p-2 hover:bg-purple-50 hover:text-purple-600 rounded-full transition">
                    <CpuChipIcon className="w-5 h-5" />
                </button>

                <button onClick={handleGoToEdit} className="p-2 hover:bg-orange-50 hover:text-orange-600 rounded-full transition">
                    <PencilSquareIcon className="w-5 h-5" />
                </button>

                <button onClick={() => alert("Xóa hồ sơ")} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}