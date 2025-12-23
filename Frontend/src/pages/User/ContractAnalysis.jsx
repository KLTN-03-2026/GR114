import React, { useState } from 'react';
// ❌ KHÔNG import Header (MainLayout đã có)
// ❌ KHÔNG import video_bg (MainLayout đã giữ)

import {
    CloudArrowUpIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    CheckBadgeIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon // Thêm icon này nếu phần kết quả cần dùng
} from '@heroicons/react/24/outline';
import aiClient from "../../api/aiClient";

export default function ContractAnalysis() {
    const [file, setFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0); // State cho thanh tiến trình

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) setFile(selectedFile);
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setIsAnalyzing(true);
        setResult(null);
        setProgress(0);

        // Giả lập thanh chạy
        const interval = setInterval(() => {
            setProgress((prev) => (prev < 90 ? prev + Math.random() * 10 : prev));
        }, 300);

        try {
            const aiResult = await aiClient.analyzeContract(file);
            setProgress(100);
            setTimeout(() => {
                setResult(aiResult);
            }, 500);
        } catch (error) {
            console.error("Lỗi phân tích:", error);
            alert("Có lỗi khi kết nối với LegAI. Vui lòng thử lại!");
        } finally {
            clearInterval(interval);
            setIsAnalyzing(false);
        }
    };

    // Các hàm helper giữ nguyên (getScoreColor, getSeverityBadge...)
    const getScoreColor = (score) => {
        if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
        if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
        return "text-red-600 bg-red-50 border-red-200";
    };

    const getSeverityBadge = (severity) => {
         // Logic badge giữ nguyên như code cũ của bạn
         const level = severity ? severity.toLowerCase() : 'medium';
         if (level === 'high') return <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-600 border border-red-200">NGHIÊM TRỌNG</span>;
         if (level === 'medium') return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-600 border border-yellow-200">CẢNH BÁO</span>;
         return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-600 border border-blue-200">LƯU Ý</span>;
    };

    return (
        <div className="w-full">
            {/* --- THANH TIẾN TRÌNH (Loading Bar) --- */}
            {isAnalyzing && (
                <div className="fixed top-[70px] left-0 w-full h-1 z-50">
                    <div 
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_15px_#22d3ee] transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            )}

            {/* --- NỘI DUNG CHÍNH (Split Screen) --- */}
            <div className="max-w-7xl mx-auto px-6 w-full flex flex-col md:flex-row items-center md:items-start pt-10">
                
                {/* 🟢 KHỐI BÊN TRÁI: TIÊU ĐỀ & UPLOAD */}
                <div className="w-full md:w-1/2 lg:w-5/12 animate-fadeInLeft">
                    
                    <div className="text-left mb-12">
                        <h1 className="text-4xl lg:text-6xl font-black uppercase tracking-tighter text-white drop-shadow-2xl leading-none">
                            Thẩm định <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Hợp đồng AI</span>
                        </h1>
                        <p className="text-gray-300 mt-6 font-medium text-lg lg:text-xl drop-shadow-lg max-w-md">
                            Công nghệ trí tuệ nhân tạo giúp phát hiện rủi ro pháp lý chỉ trong vài giây.
                        </p>
                    </div>

                    {!result ? (
                        /* HỘP UPLOAD GLASSMORPHISM */
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-1 border border-white/10 shadow-2xl overflow-hidden">
                            <div className="bg-black/40 rounded-[2.3rem] p-8 text-center text-white">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                                    <DocumentTextIcon className="w-8 h-8 text-cyan-400" />
                                </div>

                                <label className="block w-full cursor-pointer group">
                                    <input type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" onChange={handleFileChange} />
                                    <div className={`border-2 border-dashed rounded-3xl p-8 transition-all duration-500 
                                        ${file ? 'border-cyan-400 bg-cyan-400/20' : 'border-white/20 group-hover:border-cyan-400/50 group-hover:bg-white/10'}`}>
                                        {file ? (
                                            <div className="flex flex-col items-center gap-2 text-cyan-400">
                                                <CheckBadgeIcon className="w-10 h-10 animate-bounce" />
                                                <span className="font-bold text-sm truncate max-w-[200px] text-white">{file.name}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center text-gray-400 group-hover:text-white">
                                                <CloudArrowUpIcon className="w-8 h-8 mb-2 opacity-70" />
                                                <span className="font-medium uppercase tracking-widest text-[10px]">Tải lên tài liệu của bạn</span>
                                            </div>
                                        )}
                                    </div>
                                </label>

                                <button
                                    onClick={handleAnalyze}
                                    disabled={!file || isAnalyzing}
                                    className={`mt-8 w-full py-4 rounded-2xl font-black text-white transition-all flex items-center justify-center gap-3 text-base tracking-widest
                                        ${!file || isAnalyzing ? 'bg-gray-700/50 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] active:scale-95 shadow-lg shadow-cyan-500/20'}
                                    `}
                                >
                                    {isAnalyzing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ShieldCheckIcon className="w-5 h-5" />}
                                    {isAnalyzing ? "ĐANG PHÂN TÍCH..." : "THẨM ĐỊNH NGAY"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* KẾT QUẢ PHÂN TÍCH (Render lại logic kết quả của bạn ở đây) */
                        <div className="animate-slideUp pb-10">
                            <button
                                onClick={() => { setFile(null); setResult(null); }}
                                className="mb-4 text-cyan-400 flex items-center gap-2 font-bold text-sm hover:underline"
                            >
                                ← Thử lại với hợp đồng khác
                            </button>
                            
                            {/* Khối hiển thị điểm số */}
                            <div className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center text-center shadow-lg bg-white/95 backdrop-blur-md mb-6 ${getScoreColor(result.risk_score)}`}>
                                <div className="text-5xl font-black mb-1 text-slate-900">{result.risk_score}/100</div>
                                <div className="text-xs font-bold uppercase tracking-widest text-slate-600">Điểm an toàn pháp lý</div>
                            </div>
                            
                            {/* Khối tóm tắt */}
                            <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl border border-slate-200 shadow-xl mb-6 text-slate-900">
                                <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-3">Tóm tắt hợp đồng</h3>
                                <p className="text-slate-800 font-medium leading-relaxed text-sm">{result.summary}</p>
                            </div>

                            {/* Khối chi tiết rủi ro */}
                             <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-slate-200 overflow-hidden text-slate-900">
                                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                                        Rủi ro ({result.risks ? result.risks.length : 0})
                                    </h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {result.risks && result.risks.map((risk, index) => (
                                        <div key={index} className="p-4 hover:bg-blue-50/30">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-mono font-bold max-w-[70%] truncate">
                                                    "{risk.clause}"
                                                </div>
                                                {getSeverityBadge(risk.severity)}
                                            </div>
                                            <p className="text-slate-700 text-xs leading-relaxed">
                                                <span className="font-bold text-red-500">Vấn đề: </span>
                                                {risk.issue}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 🟢 KHỐI BÊN PHẢI: RỖNG ĐỂ LỘ VIDEO TỪ LAYOUT */}
                <div className="hidden md:block md:flex-grow"></div>
            </div>
        </div>
    );
}