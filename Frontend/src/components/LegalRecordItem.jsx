import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    EyeIcon, ShareIcon, 
    PencilSquareIcon, TrashIcon, DocumentIcon, ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

export default function LegalRecordItem({ record, isTrash = false }) {
    const navigate = useNavigate();

    // Chuyển sang trang chi tiết
    const handleView = () => navigate(`/ho-so/chi-tiet/${record.id}`);
    
    // Copy link chia sẻ
    const handleShare = async () => {
        try {
            const url = `${window.location.origin}/ho-so/chi-tiet/${record.id}`;
            await navigator.clipboard.writeText(url);
            alert('Đã sao chép link hồ sơ vào bộ nhớ tạm!');
        } catch (err) {
            alert('Lỗi khi sao chép link.');
        }
    };

    // Xóa hồ sơ
    const handleDelete = async () => {
        if (isTrash) {
            if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ: ${record.name}?`)) return;
        } else {
            if (!window.confirm(`Đưa hồ sơ vào thùng rác (tự xóa sau 30 ngày): ${record.name}?`)) return;
        }
        try {
            const url = isTrash
                ? `http://localhost:8000/api/history/purge/${record.id}`
                : `http://localhost:8000/api/history/delete/${record.id}`;
            await axios.delete(url);
            window.location.reload();
        } catch (err) {
            console.error('Delete error', err);
            alert('Xóa thất bại. Vui lòng thử lại.');
        }
    };

    const handleRestore = async () => {
        try {
            await axios.post(`http://localhost:8000/api/history/restore/${record.id}`);
            window.location.reload();
        } catch (err) {
            console.error('Restore error', err);
            alert('Khôi phục thất bại. Vui lòng thử lại.');
        }
    };

    // Logic hiển thị màu Badge
    const badgeClass = (score) => {
        const s = Number(score ?? 0);
        return s >= 80
            ? 'px-3 py-1 rounded-full text-xs font-bold bg-green-800 text-green-300 border border-green-700'
            : 'px-3 py-1 rounded-full text-xs font-bold bg-red-900 text-red-300 border border-red-700';
    };

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300 group">
            <div className="flex items-center gap-5 mb-4 md:mb-0">
                <div className="p-3 bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border border-white/10 rounded-xl">
                    <DocumentIcon className="w-8 h-8 text-cyan-400" />
                </div>
                <div>
                    <h4 className="font-bold text-white uppercase text-sm tracking-wide">{record.name}</h4>
                    <p className="text-xs text-gray-400 mt-1 font-mono">Ngày tạo: <span className="text-gray-300">{record.date}</span></p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Badge Rủi ro/An toàn */}
                <span className={badgeClass(record.riskScore ?? record.RiskScore ?? 0)}>
                    { (record.riskScore ?? record.RiskScore ?? 0) >= 80 ? 'AN TOÀN' : 'RỦI RO' }
                </span>

                {/* Nút Xem chi tiết */}
                <button onClick={handleView} title="Xem chi tiết" className="p-2 hover:bg-blue-500/10 rounded-lg transition">
                    <EyeIcon className="w-5 h-5 text-gray-300 hover:text-blue-400" />
                </button>

                {!isTrash && (
                    <button onClick={handleShare} title="Chia sẻ" className="p-2 hover:bg-green-500/10 rounded-lg transition">
                        <ShareIcon className="w-5 h-5 text-gray-300 hover:text-green-400" />
                    </button>
                )}

                {!isTrash && (
                    <button onClick={() => navigate(`/ho-so/chinh-sua/${record.id}`)} title="Chỉnh sửa" className="p-2 hover:bg-orange-500/10 rounded-lg transition">
                        <PencilSquareIcon className="w-5 h-5 text-gray-300 hover:text-orange-400" />
                    </button>
                )}

                {isTrash && (
                    <button onClick={handleRestore} title="Khôi phục" className="p-2 hover:bg-cyan-500/10 rounded-lg transition">
                        <ArrowUturnLeftIcon className="w-5 h-5 text-gray-300 hover:text-cyan-400" />
                    </button>
                )}

                <button onClick={handleDelete} title={isTrash ? "Xóa vĩnh viễn" : "Đưa vào thùng rác"} className="p-2 hover:bg-red-500/10 rounded-lg transition">
                    <TrashIcon className="w-5 h-5 text-gray-300 hover:text-red-500" />
                </button>
            </div>
        </div>
    );
}
