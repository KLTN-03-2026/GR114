import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    EyeIcon, ShareIcon, 
    PencilSquareIcon, TrashIcon, 
    DocumentIcon, 
    ShieldCheckIcon, 
    ClipboardDocumentCheckIcon, 
    DocumentDuplicateIcon ,
      VideoCameraIcon,             
    ChatBubbleLeftEllipsisIcon 
} from '@heroicons/react/24/outline';

export default function LegalRecordItem({ record }) {
    const navigate = useNavigate();

    
    // 1. Cấu hình giao diện Light Mode - 5 MÀU CHO 5 LOẠI
    const getTypeConfig = (type) => {
        
        const safeType = (type || '').trim().toUpperCase();

        switch (safeType) {
            case 'PLANNING':
                return {
                    icon: <ClipboardDocumentCheckIcon className="w-7 h-7 text-blue-600 stroke-2" />,
                    label: 'KẾ HOẠCH AI',
                    bgColor: 'bg-blue-50',
                    borderColor: 'hover:border-blue-400',
                    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200'
                };
            case 'ANALYSIS':
                return {
                    icon: <ShieldCheckIcon className="w-7 h-7 text-rose-600 stroke-2" />,
                    label: 'THẨM ĐỊNH VĂN BẢN',
                    bgColor: 'bg-rose-50',
                    borderColor: 'hover:border-rose-400',
                    badgeStyle: null // Dùng logic Risk Score
                };
            case 'VIDEO_ANALYSIS':
                return {
                    icon: <VideoCameraIcon className="w-7 h-7 text-orange-600 stroke-2" />,
                    label: 'THẨM ĐỊNH VIDEO',
                    bgColor: 'bg-orange-50',
                    borderColor: 'hover:border-orange-400',
                    badgeStyle: null // Dùng logic Trust Score/Risk Score
                };
            case 'FORM':
                return {
                    icon: <DocumentDuplicateIcon className="w-7 h-7 text-purple-600 stroke-2" />,
                    label: 'BIỂU MẪU',
                    bgColor: 'bg-purple-50',
                    borderColor: 'hover:border-purple-400',
                    badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200'
                };
            case 'CHAT':
                return {
                    icon: <ChatBubbleLeftEllipsisIcon className="w-7 h-7 text-emerald-600 stroke-2" />,
                    label: 'TRỢ LÝ CHAT',
                    bgColor: 'bg-emerald-50',
                    borderColor: 'hover:border-emerald-400',
                    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200'
                };
            default:
                return {
                    icon: <DocumentIcon className="w-7 h-7 text-zinc-500 stroke-2" />,
                    label: 'HỒ SƠ KHÁC',
                    bgColor: 'bg-zinc-100',
                    borderColor: 'hover:border-zinc-300',
                    badgeStyle: 'bg-zinc-100 text-zinc-600 border-zinc-200'
                };
        }
    };

    const config = getTypeConfig(record.type);

    // 2. Logic hiển thị Badge (Cả Analysis và Video đều có thể có điểm an toàn)
    const renderBadge = () => {
        const safeType = (record.type || '').trim().toUpperCase();
        
        if (safeType === 'ANALYSIS' || safeType === 'VIDEO_ANALYSIS') {
            const score = Number(record.riskScore ?? 0);
            const isSafe = score >= 80;
            return (
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border tracking-wider ${
                    isSafe ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                    {isSafe ? 'AN TOÀN' : 'RỦI RO'} ({score}%)
                </span>
            );
        }
        return (
            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border tracking-wider ${config.badgeStyle}`}>
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
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-white border border-zinc-200 rounded-2xl hover:shadow-md transition-all duration-300 group ${config.borderColor}`}>
            
            {/* Left: Info & Icon */}
            <div className="flex items-center gap-5 mb-4 md:mb-0">
                <div className={`p-3 ${config.bgColor} border border-zinc-100 rounded-xl shadow-sm flex-shrink-0`}>
                    {config.icon}
                </div>
                <div>
                    <div className="flex items-center gap-3 mb-1.5">
                        <h4 className="font-bold text-[#1A2530] uppercase text-sm tracking-wide group-hover:text-[#B8985D] transition-colors">
                            {record.name}
                        </h4>
                        {renderBadge()}
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest mt-1 font-medium">
                        ID: #{record.id} <span className="mx-2 text-zinc-300">|</span> <span className="text-zinc-500">Ngày tạo: {record.date}</span>
                    </p>
                </div>
            </div>

            {/* Right: Actions (Thiết kế thanh công cụ chìm) */}
            <div className="flex items-center gap-1 bg-zinc-50 p-1.5 rounded-xl border border-zinc-200 shadow-inner">
                <button onClick={handleView} title="Xem chi tiết" className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-zinc-200 transition-all group/btn">
                    <EyeIcon className="w-5 h-5 text-zinc-400 group-hover/btn:text-blue-500 stroke-2" />
                </button>

                <button onClick={handleShare} title="Chia sẻ" className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-zinc-200 transition-all group/btn">
                    <ShareIcon className="w-5 h-5 text-zinc-400 group-hover/btn:text-emerald-500 stroke-2" />
                </button>

                <button onClick={() => navigate(`/ho-so/chinh-sua/${record.id}`)} title="Chỉnh sửa" className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-zinc-200 transition-all group/btn">
                    <PencilSquareIcon className="w-5 h-5 text-zinc-400 group-hover/btn:text-amber-500 stroke-2" />
                </button>

                <div className="w-[1px] h-5 bg-zinc-200 mx-1"></div>

                <button onClick={handleDelete} title="Xóa hồ sơ" className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-zinc-200 transition-all group/btn">
                    <TrashIcon className="w-5 h-5 text-zinc-400 group-hover/btn:text-red-500 stroke-2" />
                </button>
            </div>
        </div>
    );
}