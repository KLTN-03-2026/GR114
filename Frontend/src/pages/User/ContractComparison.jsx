import React, { useState, useRef } from 'react';
import {
    CloudArrowUpIcon,
    ArrowPathIcon,
    ScaleIcon,
    StopIcon,
    DocumentDuplicateIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    TrashIcon,
    ShieldCheckIcon,
    BeakerIcon
} from '@heroicons/react/24/outline';
import aiClient from "../../api/aiClient";

export default function ContractComparison() {
    const [fileA, setFileA] = useState(null);
    const [fileB, setFileB] = useState(null);
    const [isComparing, setIsComparing] = useState(false);
    const [comparisonResult, setComparisonResult] = useState(null);
    const abortControllerRef = useRef(null);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef(null);

    const [fileNameAState, setFileNameAState] = useState('');
    const [fileNameBState, setFileNameBState] = useState('');

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (type === 'A') setFileA(file);
            else setFileB(file);
        }
    };

    const handleCompare = async () => {
        if (!fileA || !fileB) {
            alert("Vui lòng tải lên cả hai hợp đồng để bắt đầu so sánh đối chiếu.");
            return;
        }

        abortControllerRef.current = new AbortController();
        setIsComparing(true);
        setComparisonResult(null);
        setProgress(0);

        intervalRef.current = setInterval(() => {
            setProgress((prev) => (prev < 90 ? prev + Math.random() * 5 : prev));
        }, 600);

        try {
            const result = await aiClient.compareContracts(fileA, fileB, abortControllerRef.current.signal);
            setProgress(100);
            setComparisonResult(result);
            setFileNameAState(result.fileNameA || fileA.name);
            setFileNameBState(result.fileNameB || fileB.name);
        } catch (error) {
            if (error.name !== 'CanceledError') {
                alert("Có lỗi xảy ra trong quá trình phân tích đối chiếu. Hãy thử lại!");
            }
        } finally {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsComparing(false);
        }
    };

    const resetComparison = () => {
        setFileA(null);
        setFileB(null);
        setComparisonResult(null);
        setIsComparing(false);
        setProgress(0);
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans p-4 md:p-8 pt-20">
            {/* Tiêu đề trang */}
            <div className="max-w-[1600px] mx-auto mb-10 text-center">
                <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent italic tracking-tighter mb-4 uppercase">
                    contract comparison
                </h1>
                <p className="text-gray-400 max-w-3xl mx-auto text-sm md:text-lg font-medium">
                    Phân tích đối chiếu song song hai mẫu hợp đồng để đánh giá sự khác biệt và lựa chọn phương án tối ưu nhất cho doanh nghiệp của bạn.
                </p>
            </div>

            <main className="max-w-[1600px] mx-auto flex flex-col gap-10">
                
                {/* 🔵 PHẦN TẢI LÊN (Upload) */}
                <div className={`grid grid-cols-1 ${comparisonResult ? 'md:grid-cols-5' : 'md:grid-cols-2'} gap-6 transition-all duration-700 items-center`}>
                    {/* Hợp đồng 1 */}
                    <div className="relative group md:col-span-2">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/50 to-blue-500/50 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 h-full flex flex-col items-center justify-center min-h-[220px] shadow-2xl">
                            <ShieldCheckIcon className="w-12 h-12 text-cyan-400 mb-4" />
                            <h3 className="text-sm font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">Lựa chọn 1 (Option A)</h3>
                            <input type="file" onChange={(e) => handleFileChange(e, 'A')} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <p className="text-sm font-bold text-cyan-500 text-center truncate w-full px-6">
                                {fileA ? fileA.name : "Tải lên tài liệu thứ nhất..."}
                            </p>
                        </div>
                    </div>

                    {/* Nút điều khiển trung tâm */}
                    <div className={`flex flex-col items-center justify-center ${comparisonResult ? 'md:col-span-1' : ''}`}>
                        {!comparisonResult ? (
                            <button
                                onClick={handleCompare}
                                disabled={isComparing || !fileA || !fileB}
                                className="group relative w-20 h-20 bg-white text-black rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 disabled:opacity-20 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                <ScaleIcon className={`w-8 h-8 ${isComparing ? 'animate-spin' : ''}`} />
                            </button>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <button onClick={handleCompare} className="p-4 bg-cyan-600/20 text-cyan-400 rounded-2xl border border-cyan-500/30 hover:bg-cyan-600 hover:text-white transition-all">
                                    <ArrowPathIcon className="w-6 h-6" />
                                </button>
                                <button onClick={resetComparison} className="p-4 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
                                    <TrashIcon className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Hợp đồng 2 */}
                    <div className="relative group md:col-span-2">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/50 to-indigo-500/50 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 h-full flex flex-col items-center justify-center min-h-[220px] shadow-2xl">
                            <BeakerIcon className="w-12 h-12 text-blue-400 mb-4" />
                            <h3 className="text-sm font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">Lựa chọn 2 (Option B)</h3>
                            <input type="file" onChange={(e) => handleFileChange(e, 'B')} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <p className="text-sm font-bold text-blue-500 text-center truncate w-full px-6">
                                {fileB ? fileB.name : "Tải lên tài liệu thứ hai..."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 🔵 KẾT QUẢ PHÂN TÍCH ĐỐI CHIẾU */}
                {isComparing && (
                    <div className="w-full py-20 flex flex-col items-center justify-center space-y-6">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"></div>
                        </div>
                        <p className="text-cyan-500 font-black tracking-widest uppercase text-sm animate-pulse">
                            AI đang tiến hành đối soát điều khoản... {Math.round(progress)}%
                        </p>
                    </div>
                )}

                {comparisonResult && !isComparing && (
                    <div className="w-full space-y-10 animate-slideUp">
                        
                        {/* 1. Đánh giá lựa chọn tối ưu */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                            <div className="md:col-span-4 bg-[#0a0a0a] border border-white/10 p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <ScaleIcon className="w-20 h-20" />
                                </div>
                                <h4 className="font-black uppercase text-xs tracking-widest text-cyan-500 mb-4">Kết luận lựa chọn</h4>
                                <p className="text-lg text-white leading-relaxed font-bold italic">
                                    "{comparisonResult.overall_summary}"
                                </p>
                            </div>

                            <div className="md:col-span-8 bg-gradient-to-br from-[#0a0a0a] to-[#111] border border-white/10 p-8 rounded-[3rem] shadow-xl">
                                <h4 className="font-black uppercase text-xs tracking-widest text-indigo-400 mb-4">Phân tích rủi ro & Lời khuyên</h4>
                                <div className="text-gray-300 leading-relaxed text-sm md:text-base space-y-2">
                                    {comparisonResult.recommendations.split('\n').map((line, i) => (
                                        <p key={i} className="flex gap-2">
                                            <span className="text-indigo-500">✦</span> {line}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 2. BẢNG ĐỐI CHIẾU CHI TIẾT */}
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl">
                            <div className="bg-white/5 p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                                <h3 className="text-2xl font-black italic flex items-center gap-3">
                                    <DocumentDuplicateIcon className="w-8 h-8 text-cyan-500" />
                                    BẢNG ĐỐI CHIẾU NỘI DUNG SONG SONG
                                </h3>
                                <div className="flex items-center gap-6 px-6 py-2 bg-black/40 rounded-full border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Hợp đồng 1</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Hợp đồng 2</span>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-black/60 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                            <th className="p-8 border-r border-white/5 w-[18%]">Tiêu chí / Điều khoản</th>
                                            <th className="p-8 border-r border-white/5 w-[33%] text-cyan-400">Nội dung Hợp đồng 1</th>
                                            <th className="p-8 border-r border-white/5 w-[33%] text-blue-400">Nội dung Hợp đồng 2</th>
                                            <th className="p-8 w-[16%]">Đánh giá khác biệt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y divide-white/5">
                                        {comparisonResult.differences.map((diff, idx) => (
                                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors group border-b border-white/5 last:border-0">
                                                {/* Cột Tên Tiêu chí / Điều khoản */}
                                                <td className="p-8 border-r border-white/5 font-black text-xs text-gray-500 bg-black/20 uppercase tracking-widest align-top">
                                                    {diff.section_identifier || `Tiêu chí ${idx + 1}`}
                                                </td>
                                                
                                                {/* Cột Nội dung Hợp đồng 1 (Dữ liệu cũ - old_text) */}
                                                <td className="p-8 border-r border-white/5 leading-relaxed text-gray-300 align-top">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="text-[10px] text-cyan-500/50 font-bold uppercase tracking-tighter">Option 1 Content:</span>
                                                        <p className="text-sm md:text-base whitespace-pre-line">
                                                            {diff.old_text || "---"}
                                                        </p>
                                                    </div>
                                                </td>

                                                {/* Cột Nội dung Hợp đồng 2 (Dữ liệu mới - new_text) */}
                                                <td className="p-8 border-r border-white/5 leading-relaxed text-gray-300 bg-blue-500/[0.02] align-top">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="text-[10px] text-blue-500/50 font-bold uppercase tracking-tighter">Option 2 Content:</span>
                                                        <p className="text-sm md:text-base whitespace-pre-line font-medium text-white/90">
                                                            {diff.new_text || "---"}
                                                        </p>
                                                    </div>
                                                </td>

                                                {/* Cột Phân tích ưu/nhược điểm */}
                                                <td className="p-8 bg-black/10 align-top">
                                                    <div className="flex flex-col gap-4">
                                                        <div className={`text-[10px] font-black px-3 py-1 rounded-md w-fit border ${
                                                            diff.type === 'added' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                                                            diff.type === 'modified' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 
                                                            'bg-red-500/10 text-red-400 border-red-500/20'
                                                        }`}>
                                                            {diff.type === 'added' ? 'ĐIỀU KHOẢN MỚI' : 
                                                             diff.type === 'modified' ? 'CÓ SỰ KHÁC BIỆT' : 
                                                             'BỊ LƯỢC BỎ'}
                                                        </div>
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-bold text-gray-600 uppercase">Ghi chú so sánh:</span>
                                                            <p className="text-[12px] text-gray-400 italic leading-relaxed">
                                                                {diff.explanation}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Footer bảng */}
                            <div className="bg-white/5 p-6 text-center border-t border-white/10">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">
                                    End of Comparison Analysis - Powered by LegalBot AI
                                </p>
                            </div>
                        </div>

                        {/* Thông tin bổ sung */}
                        <div className="flex items-center justify-center gap-8 py-10 opacity-30 grayscale grayscale-100">
                             <img src="/logo-dtu.png" alt="DTU" className="h-12" />
                             <div className="h-8 w-[1px] bg-white/20"></div>
                             <span className="text-xs font-black tracking-[0.5em] uppercase">Security Standard</span>
                        </div>
                    </div>
                )}
            </main>

            {/* CSS Tùy chỉnh */}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    height: 8px;
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #050505;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1a1a1a;
                    border-radius: 20px;
                    border: 2px solid #050505;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #333;
                }
                
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slideUp {
                    animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
}