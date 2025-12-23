import React, { useState } from 'react';
import {
    CloudArrowUpIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    CheckBadgeIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import aiClient from "../../api/aiClient";

// 👇 1. Import Recharts để vẽ biểu đồ
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function ContractAnalysis() {
    const [file, setFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) setFile(selectedFile);
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setIsAnalyzing(true);
        setResult(null);
        setProgress(0);

        // Giả lập thanh chạy (Giữ nguyên logic của bạn)
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

    // Helper: Badge mức độ nghiêm trọng (Đã update style Dark Mode)
    const getSeverityBadge = (severity) => {
         const level = severity ? severity.toLowerCase() : 'medium';
         if (level === 'high') return <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">NGHIÊM TRỌNG</span>;
         if (level === 'medium') return <span className="px-2 py-1 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">CẢNH BÁO</span>;
         return <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">LƯU Ý</span>;
    };

    // 👇 2. Cấu hình dữ liệu cho Biểu đồ (Dựa trên kết quả thực tế)
    const chartData = result ? [
        { name: 'An toàn', value: result.risk_score, color: '#06b6d4' }, // Cyan
        { name: 'Rủi ro', value: 100 - result.risk_score, color: '#ef4444' } // Red
    ] : [];

    return (
        <div className="w-full">
            {/* --- THANH TIẾN TRÌNH (Loading Bar) --- */}
            {isAnalyzing && (
                <div className="fixed top-[80px] left-0 w-full h-1 z-50">
                    <div 
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_15px_#22d3ee] transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 w-full flex flex-col md:flex-row items-center md:items-start pt-10 pb-20 gap-10">
                
                {/* 🟢 CỘT TRÁI: TIÊU ĐỀ & UPLOAD FORM */}
                <div className="w-full md:w-5/12 animate-fadeInLeft">
                    <div className="text-left mb-10">
                        <h1 className="text-4xl lg:text-6xl font-black uppercase tracking-tighter text-white drop-shadow-2xl leading-none">
                            Thẩm định <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Hợp đồng AI</span>
                        </h1>
                        <p className="text-gray-400 mt-6 font-medium text-lg lg:text-xl drop-shadow-lg max-w-md">
                            Công nghệ trí tuệ nhân tạo giúp phát hiện rủi ro pháp lý chỉ trong vài giây.
                        </p>
                    </div>

                    {/* Hộp Upload (Dark Glassmorphism) */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-1 border border-white/10 shadow-2xl overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <div className="bg-[#0a0a0a]/80 rounded-[2.3rem] p-8 text-center text-white relative z-10">
                            
                            {!result ? (
                                <>
                                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                                        <DocumentTextIcon className="w-8 h-8 text-cyan-400" />
                                    </div>

                                    <label className="block w-full cursor-pointer group/label">
                                        <input type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" onChange={handleFileChange} />
                                        <div className={`border-2 border-dashed rounded-3xl p-8 transition-all duration-500 
                                            ${file ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/20 group-hover/label:border-cyan-400/50 group-hover/label:bg-white/5'}`}>
                                            {file ? (
                                                <div className="flex flex-col items-center gap-2 text-cyan-400">
                                                    <CheckBadgeIcon className="w-10 h-10 animate-bounce" />
                                                    <span className="font-bold text-sm truncate max-w-[200px] text-white">{file.name}</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-gray-400 group-hover/label:text-white transition-colors">
                                                    <CloudArrowUpIcon className="w-8 h-8 mb-2 opacity-70" />
                                                    <span className="font-medium uppercase tracking-widest text-[10px]">Tải lên tài liệu</span>
                                                </div>
                                            )}
                                        </div>
                                    </label>

                                    <button
                                        onClick={handleAnalyze}
                                        disabled={!file || isAnalyzing}
                                        className={`mt-8 w-full py-4 rounded-2xl font-black text-white transition-all flex items-center justify-center gap-3 text-base tracking-widest
                                            ${!file || isAnalyzing ? 'bg-gray-800 cursor-not-allowed text-gray-500' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/20'}
                                        `}
                                    >
                                        {isAnalyzing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ShieldCheckIcon className="w-5 h-5" />}
                                        {isAnalyzing ? "ĐANG PHÂN TÍCH..." : "THẨM ĐỊNH NGAY"}
                                    </button>
                                </>
                            ) : (
                                /* Nút thử lại khi đã có kết quả (Reset State) */
                                <button
                                    onClick={() => { setFile(null); setResult(null); }}
                                    className="w-full py-4 rounded-2xl border border-white/10 hover:bg-white/5 text-cyan-400 font-bold tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <ArrowPathIcon className="w-5 h-5" /> PHÂN TÍCH VĂN BẢN KHÁC
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 🔵 CỘT PHẢI: HIỂN THỊ KẾT QUẢ (Thay thế khoảng trống cũ) */}
                {result && (
                    <div className="w-full md:w-7/12 animate-slideUp">
                        <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                            
                            {/* Header Kết quả: Biểu đồ + Tóm tắt */}
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8 border-b border-white/10 pb-8">
                                
                                {/* 👇 3. BIỂU ĐỒ TRÒN (Pie Chart) */}
                                <div className="relative w-48 h-48 flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                startAngle={90}
                                                endAngle={-270}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    
                                    {/* Số điểm nằm giữa biểu đồ */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className={`text-4xl font-black ${result.risk_score >= 80 ? 'text-cyan-400' : 'text-red-500'}`}>
                                            {result.risk_score}
                                        </span>
                                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Điểm an toàn</span>
                                    </div>
                                </div>

                                {/* Text tóm tắt */}
                                <div className="flex-grow text-center md:text-left">
                                    <h3 className="text-xl font-bold text-white mb-2">Đánh giá tổng quan</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">
                                        {result.summary}
                                    </p>
                                </div>
                            </div>

                            {/* Danh sách rủi ro */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm mb-4">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
                                    Chi tiết các vấn đề ({result.risks ? result.risks.length : 0})
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {result.risks && result.risks.map((risk, index) => (
                                        <div key={index} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                                            <div className="flex justify-between items-start mb-2 gap-4">
                                                <div className="bg-white/10 text-gray-300 px-3 py-1 rounded-lg text-[11px] font-mono border border-white/5 max-w-[70%] truncate">
                                                    "{risk.clause}"
                                                </div>
                                                {getSeverityBadge(risk.severity)}
                                            </div>
                                            <p className="text-gray-400 text-sm leading-relaxed">
                                                <span className="text-red-400 font-bold">Vấn đề: </span>
                                                {risk.issue}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}