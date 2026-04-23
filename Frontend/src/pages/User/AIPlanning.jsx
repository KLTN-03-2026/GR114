import React, { useState, useRef } from 'react';
import axios from 'axios';

import {
    DocumentChartBarIcon,
    PlayIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    PresentationChartBarIcon,
    Bars3BottomLeftIcon,
    ClockIcon,
    UserCircleIcon,
    PaperClipIcon,
    DocumentIcon,
    XMarkIcon,
    PrinterIcon
} from '@heroicons/react/24/outline';

import aiClient from "../../api/aiClient";

export default function AIPlanning() {
    const [rawText, setRawText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [planData, setPlanData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const [isDragging, setIsDragging] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState([]);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setAttachedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };
    const handleFileSelect = (e) => {
        if (e.target.files) setAttachedFiles(prev => [...prev, ...Array.from(e.target.files)]);
    };
    const removeFile = (indexToRemove) => {
        setAttachedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleAnalyze = async () => {
        // 1. Kiểm tra đầu vào
        if (!rawText.trim() && attachedFiles.length === 0) {
            alert("Vui lòng nhập yêu cầu!"); return;
        }

        // 2. Lấy Token
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

        setIsProcessing(true);
        setPlanData(null);
        setProgress(1);

        try {
            const formData = new FormData();
            formData.append('prompt', rawText); // Thống nhất dùng 'prompt'
            attachedFiles.forEach(file => formData.append('files', file));

            const result = await aiClient.generatePlan(formData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log("Kết quả từ Backend:", result);

            //  Backend trả về result.data
            if (result && result.success && result.data) {
                let finalArray = Array.isArray(result.data) ? result.data : [];

                if (finalArray.length > 0) {
                    const processedData = finalArray.map(item => ({
                        ...item,
                        status: item.status || 'pending'
                    }));
                    setPlanData(processedData);
                    setProgress(3);
                } else {
                    alert("AI không tạo được danh sách công việc. Hãy thử lại!");
                    setProgress(0);
                }
            }
        } catch (error) {
            console.error(" Lỗi kết nối server:", error.message);
            alert("Server đang bận hoặc bị sập. hãy kiểm tra lại Terminal Backend!");
            setProgress(0);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveToHistory = async () => {
        if (!planData) return;
        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 3 };
            const userId = user.id ?? user.Id ?? user.ID;

            const payload = {
                userId: userId,
                fileName: `Plan_${Date.now()}.json`,
                title: `Lập kế hoạch: ${rawText.substring(0, 40) || 'Tài liệu đính kèm'}...`,
                recordType: 'PLANNING',
                content: JSON.stringify(planData)
            };

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setIsSaved(true);
                alert(" Đã lưu Kế hoạch thành công!");
            }
        } catch (err) {
            console.error("Lỗi lưu:", err);
            alert(" Lỗi lưu trữ Database.");
        } finally {
            setIsSaving(false);
        }
    };
    //  return giao diện
    const groupedPlan = planData?.reduce((acc, task) => {
        const phaseName = task.phase || 'Giai đoạn khác';
        if (!acc[phaseName]) {
            acc[phaseName] = [];
        }
        acc[phaseName].push(task);
        return acc;
    }, {});
    const handlePrint = () => window.print();

    const glassPanel = "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl";

    return (
        <div className="w-full h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col lg:flex-row gap-6 text-white selection:bg-cyan-500/30">
            {/* CỘT TRÁI: NHẬP LIỆU (ĐÃ TỐI ƯU KHÔNG GIAN) */}
            <div className={`w-full lg:w-[450px] flex flex-col h-full ${glassPanel} overflow-hidden flex-shrink-0 print:hidden`}>

                {/* HEADER */}
                <div className="p-5 border-b border-white/10 bg-white/5 flex items-center gap-3 flex-shrink-0">
                    <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30">
                        <DocumentChartBarIcon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg">Dữ liệu đầu vào</h2>
                        <p className="text-xs text-gray-400">Agent sẽ lập kế hoạch từ đây</p>
                    </div>
                </div>

                {/* KHU VỰC NHẬP LIỆU: Tự động chiếm toàn bộ không gian còn lại */}
                <div className="flex-1 p-5 flex flex-col min-h-0">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`flex-1 flex flex-col rounded-2xl border-2 transition-all bg-black/40 overflow-hidden ${isDragging
                            ? 'border-dashed border-cyan-500 bg-cyan-500/10 scale-[1.01]'
                            : 'border-solid border-white/10 focus-within:border-purple-500/50'
                            }`}
                    >
                        {/* TEXTAREA chiếm toàn bộ chiều cao */}
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Nhập yêu cầu chi tiết hoặc kéo thả tài liệu pháp lý vào đây..."
                            className="flex-1 w-full p-4 text-sm text-gray-300 bg-transparent focus:outline-none resize-none custom-scrollbar"
                        ></textarea>

                        {/* DANH SÁCH FILE ĐÍNH KÈM (Hiện ngay trên thanh công cụ) */}
                        {attachedFiles.length > 0 && (
                            <div className="px-4 pb-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar border-t border-white/5 pt-2">
                                {attachedFiles.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[11px]">
                                        <DocumentIcon className="w-3.5 h-3.5 text-cyan-400" />
                                        <span className="max-w-[150px] truncate">{file.name}</span>
                                        <button onClick={() => removeFile(index)}>
                                            <XMarkIcon className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* THANH CÔNG CỤ BOTTOM */}
                        <div className="flex justify-between items-center px-4 py-3 bg-white/5 border-t border-white/5">
                            <button
                                onClick={() => fileInputRef.current.click()}
                                className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-cyan-400 transition-colors"
                            >
                                <PaperClipIcon className="w-4 h-4 transform -rotate-45" />
                                Đính kèm tài liệu
                            </button>
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                accept=".pdf,.doc,.docx,.txt"
                            />
                            <span className="text-[10px] text-gray-600 uppercase font-black tracking-widest">
                                PDF / DOCX
                            </span>
                        </div>
                    </div>

                    {/* NÚT KHỞI CHẠY: To, rõ ràng và có loading state */}
                    <button
                        onClick={handleAnalyze}
                        disabled={isProcessing}
                        className={`mt-4 w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex justify-center items-center gap-3 ${isProcessing
                            ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-xl shadow-purple-500/20 active:scale-95'
                            }`}
                    >
                        {isProcessing ? (
                            <>
                                <ArrowPathIcon className="w-5 h-5 animate-spin text-purple-400" />
                                <span>Hệ thống đang trích xuất luật...</span>
                            </>
                        ) : (
                            <>
                                <PlayIcon className="w-5 h-5" />
                                <span>Khởi chạy Workflow</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* CỘT PHẢI: KẾT QUẢ KANBAN */}
            <div className={`flex-1 flex flex-col h-full ${glassPanel} overflow-hidden relative print:bg-white print:text-black print:shadow-none print:border-none`}>
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center px-6 print:hidden">
                    <div className="flex items-center gap-2 text-gray-300">
                        <PresentationChartBarIcon className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm font-semibold uppercase tracking-widest">Lộ trình thực thi (Preview)</span>
                    </div>

                    <div className="flex gap-3">
                        {/* NÚT LƯU HỒ SƠ */}
                        {planData && (
                            <button onClick={handleSaveToHistory} disabled={isSaving || isSaved} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isSaved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}>
                                {isSaving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                                {isSaving ? "ĐANG LƯU..." : isSaved ? "ĐÃ LƯU" : "LƯU KẾ HOẠCH"}
                            </button>
                        )}
                        {/* NÚT IN/PDF */}
                        <button onClick={handlePrint} disabled={!planData} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold disabled:opacity-50 transition-all">
                            <PrinterIcon className="w-5 h-5" /> In / PDF
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-black/40 custom-scrollbar print:bg-white print:overflow-visible">
                    {/* Kiểm tra: Nếu KHÔNG PHẢI là mảng hoặc mảng rỗng thì hiện thông báo trống */}
                    {(!planData || !Array.isArray(planData)) ? (
                        // Nếu chưa có data HOẶC data trả về không phải là mảng
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                            <DocumentChartBarIcon className="w-20 h-20 mb-4" />
                            <p className="text-lg font-medium">
                                {!planData ? "Chưa có kế hoạch nào được khởi tạo" : "Lỗi: Dữ liệu AI trả về sai cấu trúc mảng"}
                            </p>
                        </div>
                    ) : (
                        // CHỈ KHI NÀO LÀ MẢNG THÌ MỚI MAP
                        <div className="max-w-3xl mx-auto space-y-8 print:space-y-8">
                            <h2 className="hidden print:block text-2xl font-bold text-center mb-8 uppercase">Lộ trình giải quyết pháp lý</h2>

                            {groupedPlan && Object.keys(groupedPlan).map((phaseName, phaseIndex) => (
                                <div key={phaseIndex} className="phase-group">

                                    {/* TIÊU ĐỀ GIAI ĐOẠN */}
                                    <div className="py-3 mb-4 border-b border-indigo-500/30 print:border-black">
                                        <h3 className="text-lg font-black uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                                            <span className="bg-indigo-500/20 px-2 py-1 rounded text-sm">Bước {phaseIndex + 1}</span>
                                            {phaseName}
                                        </h3>
                                    </div>

                                    {/* DANH SÁCH TASK TRONG GIAI ĐOẠN ĐÓ */}
                                    <div className="space-y-4 pl-2 md:pl-4 border-l-2 border-white/5 print:border-black/10">
                                        {groupedPlan[phaseName].map((task, index) => (
                                            <div key={task.id || index} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors print:border-black/20 print:bg-white">
                                                <h4 className="text-lg font-bold text-indigo-100">{task.title}</h4>

                                                {(task.legal_notes || task.description) && (
                                                    <div className="mt-3 text-sm text-gray-300 leading-relaxed border-l-2 border-indigo-500 pl-4 py-2 bg-indigo-500/5 rounded-r-lg print:text-black">
                                                        <span className="font-semibold text-indigo-300 block mb-1">⚖️ Góc nhìn pháp lý:</span>
                                                        {task.legal_notes || task.description}
                                                    </div>
                                                )}

                                                <div className="flex gap-6 mt-4 opacity-70 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <UserCircleIcon className="w-4 h-4" /> {task.assignee || "Chưa phân công"}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <ClockIcon className="w-4 h-4" /> {task.deadline || "N/A"}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-white/10 px-2 py-0.5 rounded-full text-[10px] uppercase">
                                                            {task.status || "Pending"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; } 
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } 
                .animate-fadeInUp { animation: fadeInUp 0.4s ease-out forwards; }
                @media print {
                    .print\\:hidden { display: none !important; }
                    body { background: white !important; }
                }
            `}</style>
        </div>
    );
}