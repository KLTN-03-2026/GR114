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
        // ✅ 1. CONTAINER: Nền kính mờ (bg-white/5), viền mờ, hover phát sáng viền Cyan
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all duration-300 group">

            <div className="flex items-center gap-5 mb-4 md:mb-0">
                {/* Icon Folder: Gradient tối */}
                <div className="p-3 bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border border-white/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <DocumentIcon className="w-8 h-8 text-cyan-400" />
                </div>

                <div>
                    {/* Tên hồ sơ: Màu trắng */}
                    <h4 className="font-bold text-white uppercase text-sm tracking-wide group-hover:text-cyan-400 transition-colors">
                        {record.name}
                    </h4>
                    {/* Ngày tạo: Màu xám tối */}
                    <p className="text-xs text-gray-500 mt-1 font-mono">
                        Ngày tạo: <span className="text-gray-400">{record.date}</span>
                    </p>
                </div>
            </div>

            {/* ACTION BUTTONS: Icon xám, hover lên màu Neon tương ứng */}
            <div className="flex items-center gap-1 md:gap-2 text-gray-500 w-full md:w-auto justify-end border-t md:border-t-0 border-white/5 pt-3 md:pt-0">

                {/* Xem chi tiết (Blue) */}
                <button
                    onClick={handleGoToDetail}
                    title="Xem chi tiết"
                    className="p-2 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-all"
                >
                    <EyeIcon className="w-5 h-5" />
                </button>

                {/* Chia sẻ (Green) */}
                <button
                    onClick={() => alert("Mở cửa sổ chia sẻ")}
                    title="Chia sẻ"
                    className="p-2 hover:bg-green-500/20 hover:text-green-400 rounded-lg transition-all"
                >
                    <ShareIcon className="w-5 h-5" />
                </button>

                {/* Phân tích AI (Cyan - Điểm nhấn) */}
                <button
                    onClick={() => alert("Mở phân tích AI")}
                    title="Phân tích AI"
                    className="p-2 hover:bg-cyan-500/20 hover:text-cyan-400 rounded-lg transition-all"
                >
                    <CpuChipIcon className="w-5 h-5" />
                </button>

                {/* Chỉnh sửa (Orange) */}
                <button
                    onClick={handleGoToEdit}
                    title="Chỉnh sửa"
                    className="p-2 hover:bg-orange-500/20 hover:text-orange-400 rounded-lg transition-all"
                >
                    <PencilSquareIcon className="w-5 h-5" />
                </button>

                {/* Xóa (Red) */}
                <button
                    onClick={() => alert("Xóa hồ sơ")}
                    title="Xóa hồ sơ"
                    className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}