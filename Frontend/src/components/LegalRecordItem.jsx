import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    EyeIcon, ShareIcon, 
    PencilSquareIcon, TrashIcon, 
    DocumentIcon, 
    ShieldCheckIcon, // Dùng cho Thẩm định
    ClipboardDocumentCheckIcon, // Dùng cho Kế hoạch
    DocumentDuplicateIcon // Dùng cho Biểu mẫu
} from '@heroicons/react/24/outline';

export default function LegalRecordItem({ record }) {
    const navigate = useNavigate();

    // 1. Cấu hình giao diện theo từng loại RecordType
    const getTypeConfig = (type) => {
        switch (type) {
            case 'PLANNING':
                return {
                    icon: <ClipboardDocumentCheckIcon className="w-8 h-8 text-blue-400" />,
                    label: 'KẾ HOẠCH AI',
                    bgColor: 'from-blue-900/40 to-indigo-900/40',
                    borderColor: 'group-hover:border-blue-500/50',
                    badgeStyle: 'bg-blue-900/50 text-blue-300 border-blue-700'
                };
            case 'ANALYSIS':
                return {
                    icon: <ShieldCheckIcon className="w-8 h-8 text-red-400" />,
                    label: 'THẨM ĐỊNH',
                    bgColor: 'from-red-900/40 to-orange-900/40',
                    borderColor: 'group-hover:border-red-500/50',
                    badgeStyle: null // Sẽ dùng logic Risk Score riêng
                };
            case 'FORM':
                return {
                    icon: <DocumentDuplicateIcon className="w-8 h-8 text-purple-400" />,
                    label: 'BIỂU MẪU',
                    bgColor: 'from-purple-900/40 to-fuchsia-900/40',
                    borderColor: 'group-hover:border-purple-500/50',
                    badgeStyle: 'bg-purple-900/50 text-purple-300 border-purple-700'
                };
            default:
                return {
                    icon: <DocumentIcon className="w-8 h-8 text-gray-400" />,
                    label: 'HỒ SƠ',
                    bgColor: 'from-gray-900/40 to-slate-900/40',
                    borderColor: 'group-hover:border-gray-500/50',
                    badgeStyle: 'bg-gray-800 text-gray-300 border-gray-700'
                };
        }
    };

    const config = getTypeConfig(record.type);

    // 2. Logic hiển thị Badge (Ưu tiên Risk Score cho ANALYSIS)
    const renderBadge = () => {
        if (record.type === 'ANALYSIS') {
            const score = Number(record.riskScore ?? 0);
            const isSafe = score >= 80;
            return (
                <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${
                    isSafe ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-red-900/50 text-red-300 border-red-700'
                }`}>
                    {isSafe ? 'AN TOÀN' : 'RỦI RO'} ({score}%)
                </span>
            );
        }
        // Các loại khác thì hiện nhãn loại hình
        return (
            <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${config.badgeStyle}`}>
                {config.label}
            </span>
        );
    };

    // --- Các hàm xử lý giữ nguyên ---
    const handleView = () => navigate(`/ho-so/chi-tiet/${record.id}`);
    
    const handleShare = async () => {
        try {
            const url = `${window.location.origin}/ho-so/chi-tiet/${record.id}`;
            await navigator.clipboard.writeText(url);
            alert('🔗 Đã sao chép link hồ sơ!');
        } catch (err) { alert('Lỗi khi sao chép link.'); }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Xóa vĩnh viễn hồ sơ: ${record.name}?`)) return;
        try {
            await axios.delete(`http://localhost:8000/api/history/delete/${record.id}`);
            window.location.reload();
        } catch (err) { alert('Xóa thất bại.'); }
    };

    return (
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-300 group ${config.borderColor}`}>
            
            {/* Left: Info & Icon */}
            <div className="flex items-center gap-5 mb-4 md:mb-0">
                <div className={`p-3 bg-gradient-to-br ${config.bgColor} border border-white/10 rounded-xl shadow-lg`}>
                    {config.icon}
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-white uppercase text-sm tracking-wide group-hover:text-cyan-400 transition-colors">
                            {record.name}
                        </h4>
                        {renderBadge()}
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">
                        ID: #{record.id} • <span className="text-gray-400">Ngày tạo: {record.date}</span>
                    </p>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 bg-black/20 p-1.5 rounded-xl border border-white/5">
                <button onClick={handleView} title="Xem chi tiết" className="p-2.5 hover:bg-blue-500/20 rounded-lg transition-all group/btn">
                    <EyeIcon className="w-5 h-5 text-gray-400 group-hover/btn:text-blue-400" />
                </button>

                <button onClick={handleShare} title="Chia sẻ" className="p-2.5 hover:bg-green-500/20 rounded-lg transition-all group/btn">
                    <ShareIcon className="w-5 h-5 text-gray-400 group-hover/btn:text-green-400" />
                </button>

                <button onClick={() => navigate(`/ho-so/chinh-sua/${record.id}`)} title="Chỉnh sửa" className="p-2.5 hover:bg-orange-500/20 rounded-lg transition-all group/btn">
                    <PencilSquareIcon className="w-5 h-5 text-gray-400 group-hover/btn:text-orange-400" />
                </button>

                <div className="w-[1px] h-4 bg-white/10 mx-1"></div>

                <button onClick={handleDelete} title="Xóa hồ sơ" className="p-2.5 hover:bg-red-500/20 rounded-lg transition-all group/btn">
                    <TrashIcon className="w-5 h-5 text-gray-400 group-hover/btn:text-red-500" />
                </button>
            </div>
        </div>
    );
}