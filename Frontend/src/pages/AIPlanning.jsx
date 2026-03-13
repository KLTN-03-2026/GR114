import React, { useState, useRef } from 'react';
import { 
    DocumentChartBarIcon, 
    PlayIcon, 
    ArrowPathIcon, 
    CheckCircleIcon,
    PresentationChartBarIcon,
    Bars3BottomLeftIcon,
    ClockIcon,
    UserCircleIcon,
    PaperClipIcon, // 🔴 Icon đính kèm
    DocumentIcon,  // 🔴 Icon hiển thị file
    XMarkIcon      // 🔴 Icon xóa file
} from '@heroicons/react/24/outline';

export default function AIPlanning() {
    const [rawText, setRawText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0); 
    const [planData, setPlanData] = useState(null);

    // 🔴 States & Refs mới cho tính năng Kéo Thả / Upload File
    const [isDragging, setIsDragging] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState([]);
    const fileInputRef = useRef(null);

    // --- HÀM XỬ LÝ KÉO THẢ FILE ---
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files);
            setAttachedFiles((prev) => [...prev, ...newFiles]);
        }
    };

    // --- HÀM XỬ LÝ CHỌN FILE TỪ NÚT ĐÍNH KÈM ---
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setAttachedFiles((prev) => [...prev, ...newFiles]);
        }
    };

    // --- HÀM XÓA FILE ĐÃ CHỌN ---
    const removeFile = (indexToRemove) => {
        setAttachedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
    };

    // Giả lập luồng Agentic Workflow
    const handleAnalyze = () => {
        if (!rawText.trim() && attachedFiles.length === 0) return;
        setIsProcessing(true);
        setProgress(1);

        setTimeout(() => setProgress(2), 2000);

        setTimeout(() => {
            setProgress(3);
            setPlanData([
                { id: 1, phase: 'Giai đoạn 1', title: 'Thu thập & Xác minh hồ sơ', assignee: 'Luật sư A', deadline: '3 ngày', status: 'pending' },
                { id: 2, phase: 'Giai đoạn 2', title: 'Gửi công văn yêu cầu thanh toán', assignee: 'Trợ lý Pháp lý', deadline: '5 ngày', status: 'pending' },
                { id: 3, phase: 'Giai đoạn 3', title: 'Khởi kiện ra Tòa án (Nếu cần)', assignee: 'Luật sư Trưởng', deadline: 'Chờ phản hồi', status: 'locked' },
            ]);
            setIsProcessing(false);
        }, 4500);
    };

    const glassPanel = "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-3xl";

    return (
        <div className="w-full h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col lg:flex-row gap-6 selection:bg-cyan-500/30 text-white">
            
            {/* ==========================================
                CỘT TRÁI: KHU VỰC NHẬP LIỆU & AGENTIC LOG
            ========================================== */}
            <div className={`w-full lg:w-[450px] flex flex-col h-full ${glassPanel} overflow-hidden flex-shrink-0`}>
                
                {/* Header Input */}
                <div className="p-5 border-b border-white/10 bg-white/5 flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30">
                        <DocumentChartBarIcon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg tracking-wide text-white">Dữ liệu thô (Raw Data)</h2>
                        <p className="text-xs text-gray-400">Dán text hoặc kéo thả tài liệu vào đây</p>
                    </div>
                </div>

                {/* 🔴 KHU VỰC NHẬP LIỆU (HYBRID INPUT + DRAG & DROP) */}
                <div className="p-5 flex-shrink-0">
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative w-full rounded-2xl border-2 transition-all duration-300 flex flex-col bg-black/40 
                            ${isDragging 
                                ? 'border-dashed border-cyan-500 bg-cyan-500/10 scale-[1.02]' 
                                : 'border-solid border-white/10 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50'
                            }`}
                    >
                        {/* 🔴 Textarea cho phép gõ/dán */}
                        <textarea 
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder={isDragging ? "Thả file của bạn vào đây..." : "VD: Khách hàng Nguyễn Văn A bị công ty X sa thải trái luật..."}
                            className={`w-full h-32 p-4 text-sm text-gray-300 placeholder-gray-500 bg-transparent focus:outline-none resize-none custom-scrollbar transition-opacity ${isDragging ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
                        ></textarea>

                        {/* 🔴 Khu vực hiển thị File đã đính kèm */}
                        {attachedFiles.length > 0 && (
                            <div className="px-4 pb-2 flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                                {attachedFiles.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1.5 rounded-lg text-xs group">
                                        <DocumentIcon className="w-4 h-4 text-cyan-400" />
                                        <span className="max-w-[120px] truncate text-gray-200">{file.name}</span>
                                        <button onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-400 transition-colors">
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 🔴 Thanh công cụ bên trong Input (Toolbar) */}
                        <div className="flex justify-between items-center px-4 py-3 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                {/* Input ẩn dùng để mở hộp thoại chọn file */}
                                <input 
                                    type="file" 
                                    multiple 
                                    ref={fileInputRef} 
                                    onChange={handleFileSelect} 
                                    className="hidden" 
                                    accept=".pdf,.doc,.docx,.txt"
                                />
                                <button 
                                    onClick={() => fileInputRef.current.click()}
                                    className="p-2 rounded-full text-gray-400 hover:text-cyan-400 hover:bg-white/10 transition-colors tooltip-trigger relative"
                                    title="Đính kèm tài liệu"
                                >
                                    <PaperClipIcon className="w-5 h-5 transform -rotate-45" />
                                </button>
                                <span className="text-xs text-gray-600 font-medium hidden sm:inline-block">Kéo thả file hoặc đính kèm</span>
                            </div>
                        </div>
                        
                        {/* Overlay thông báo Drop (Chỉ hiện khi đang kéo file qua) */}
                        {isDragging && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-cyan-900/40 backdrop-blur-sm z-10 pointer-events-none">
                                <p className="text-cyan-300 font-bold tracking-widest text-sm animate-pulse flex items-center gap-2">
                                    <DocumentIcon className="w-6 h-6" /> THẢ FILE VÀO ĐÂY
                                </p>
                            </div>
                        )}
                    </div>
                    
                    {/* Nút Khởi chạy */}
                    <button 
                        onClick={handleAnalyze}
                        disabled={isProcessing || (!rawText.trim() && attachedFiles.length === 0)}
                        className={`mt-4 w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all flex justify-center items-center gap-2
                            ${isProcessing || (!rawText.trim() && attachedFiles.length === 0)
                                ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10' 
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-indigo-600 hover:to-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:scale-[1.02] active:scale-95'
                            }`}
                    >
                        {isProcessing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PlayIcon className="w-5 h-5" />}
                        {isProcessing ? 'Agent Đang Phân Tích...' : 'Khởi chạy Workflow'}
                    </button>
                </div>

                {/* Tiến trình Agentic (Giữ nguyên) */}
                <div className="flex-1 overflow-y-auto p-5 border-t border-white/10 bg-black/20 custom-scrollbar">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                        <Bars3BottomLeftIcon className="w-4 h-4" /> Nhật ký hệ thống AI
                    </h3>
                    
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                        
                        {/* Step 1 */}
                        {progress >= 1 && (
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white/20 bg-black text-gray-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                                    {progress > 1 ? <CheckCircleIcon className="w-5 h-5 text-emerald-400" /> : <ArrowPathIcon className="w-4 h-4 animate-spin text-purple-400" />}
                                </div>
                                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-white/10 bg-white/5 shadow-sm">
                                    <p className="text-xs font-semibold text-white">Phân tích thực thể</p>
                                    <p className="text-[10px] text-gray-400 mt-1">Bóc tách Tên, Tổ chức, Sự kiện từ {attachedFiles.length > 0 ? 'Tài liệu' : 'Văn bản'}...</p>
                                </div>
                            </div>
                        )}

                        {/* Step 2 (Thiếu thông tin) */}
                        {progress >= 2 && (
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active animate-fadeInUp">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white/20 bg-black text-gray-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                                    {progress > 2 ? <CheckCircleIcon className="w-5 h-5 text-emerald-400" /> : <ArrowPathIcon className="w-4 h-4 animate-spin text-amber-400" />}
                                </div>
                                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-sm">
                                    <p className="text-xs font-semibold text-amber-400">Cảnh báo thiếu dữ liệu</p>
                                    <p className="text-[10px] text-gray-300 mt-1">Chưa rõ "Người phụ trách" vụ việc. Tự động gán: Chờ phân công.</p>
                                </div>
                            </div>
                        )}

                        {/* Step 3 (Hoàn thành) */}
                        {progress >= 3 && (
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active animate-fadeInUp">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                                    <CheckCircleIcon className="w-5 h-5" />
                                </div>
                                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-sm">
                                    <p className="text-xs font-semibold text-emerald-400">Hoàn thành JSON</p>
                                    <p className="text-[10px] text-gray-300 mt-1">Đã render xong Bản đồ Kế hoạch.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ==========================================
                CỘT PHẢI: KẾT QUẢ (KANBAN PREVIEW) (Giữ nguyên)
            ========================================== */}
            <div className={`flex-1 flex flex-col h-full ${glassPanel} overflow-hidden relative`}>
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center px-6">
                    <div className="flex items-center gap-2 text-gray-300">
                        <PresentationChartBarIcon className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm font-semibold uppercase tracking-widest">Bản đồ Kế hoạch (Preview)</span>
                    </div>
                    
                    <button 
                        disabled={!planData}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all
                            ${planData 
                                ? 'bg-gradient-to-r from-orange-500 to-rose-500 hover:scale-105 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]' 
                                : 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/5'
                            }`}
                    >
                        <PresentationChartBarIcon className="w-5 h-5" /> Xuất Slide (.pptx)
                    </button>
                </div>

                <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-black/40 custom-scrollbar">
                    {!planData ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center opacity-50">
                            <DocumentChartBarIcon className="w-20 h-20 text-gray-500 mb-4" />
                            <p className="text-lg font-medium text-gray-400">Chưa có kế hoạch nào được khởi tạo</p>
                            <p className="text-sm text-gray-500 mt-2 max-w-sm">Hãy nhập dữ liệu thô hoặc đính kèm tài liệu vào cột bên trái và khởi chạy Workflow.</p>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-6 animate-fadeInUp">
                            {planData.map((task) => (
                                <div key={task.id} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group relative overflow-hidden">
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.status === 'pending' ? 'bg-indigo-500' : 'bg-gray-600'}`}></div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                                                {task.phase}
                                            </span>
                                            <h3 className="text-lg font-bold text-white mt-3">{task.title}</h3>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <UserCircleIcon className="w-5 h-5 text-gray-500" />
                                            <span className={task.assignee === 'Chờ phân công' ? 'text-amber-400 italic' : ''}>
                                                Phụ trách: <strong className="text-gray-200">{task.assignee}</strong>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <ClockIcon className="w-5 h-5 text-gray-500" />
                                            <span>Deadline: <strong className="text-gray-200">{task.deadline}</strong></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>
                {`
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(168, 85, 247, 0.5); }
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fadeInUp { animation: fadeInUp 0.5s ease-out forwards; }
                `}
            </style>
        </div>
    );
}