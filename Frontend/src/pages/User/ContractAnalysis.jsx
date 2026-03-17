import React, { useState } from 'react';
import {
    CloudArrowUpIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    CheckBadgeIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    CpuChipIcon // Thêm icon này cho bảng Loading
} from '@heroicons/react/24/outline';
import aiClient from "../../api/aiClient";
import axios from "axios";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function ContractAnalysis() {
    const [file, setFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);

    // Quản lý dòng text log của AI
    const [statusIndex, setStatusIndex] = useState(0);
    const aiStatuses = [
        "Đang khởi tạo LegAI Engine...",
        "Đang đọc hiểu ngữ cảnh văn bản...",
        "Trích xuất các điều khoản trọng yếu...",
        "Đang quét đối chiếu Luật Dân sự & Thương mại...",
        "Phân tích rủi ro và ranh giới pháp lý...",
        "Đang tổng hợp báo cáo cuối cùng..."
    ];

    // 1. LOGIC MỚI: Kiểm tra đuôi file PDF/TXT
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        const ext = (selectedFile.name.split('.').pop() || '').toLowerCase();
        if (!['pdf', 'txt', 'doc', 'docx'].includes(ext)) {
            alert("Vui lòng chọn file văn bản (.pdf, .txt, .doc)");
            return;
        }
        setFile(selectedFile);
    };

    // 2. LOGIC MỚI: Phân tích xong -> Tự động LƯU VÀO SQL
    const handleAnalyze = async () => {
        if (!file) return;
        setIsAnalyzing(true);
        setResult(null);
        setProgress(0);

        // Giả lập thanh chạy và nhảy text log
        const interval = setInterval(() => {
            setProgress((prev) => {
                const nextProgress = prev < 90 ? prev + Math.random() * 15 : prev;
                // Tính toán index của mảng text dựa trên % hoàn thành
                const currentIdx = Math.floor((nextProgress / 100) * aiStatuses.length);
                setStatusIndex(currentIdx < aiStatuses.length ? currentIdx : aiStatuses.length - 1);
                return nextProgress;
            });
        }, 400);

        try {
            // Gọi AI Engine
            const aiResult = await aiClient.analyzeContract(file);
            const analysis = aiResult?.data ?? aiResult;

            setProgress(100);

            // Hiện kết quả sau 0.5s
            setTimeout(async () => {
                setResult(analysis);

                // --- BẮT ĐẦU ĐOẠN LƯU VÀO CSDL ---
                try {
                    const userStr = localStorage.getItem("user");
                    if (userStr) {
                        const user = JSON.parse(userStr);
                        const userId = user.id ?? user.Id ?? user.ID;
                        const riskScore = analysis?.risk_score ?? analysis?.riskScore ?? 0;

                        const payload = {
                            userId,
                            fileName: file.name,
                            riskScore,
                            content: JSON.stringify(analysis)
                        };

                        await axios.post('http://localhost:8000/api/history/save', payload);
                        alert("✅ Kết quả đã được lưu vào Hồ sơ pháp lý!");
                    } else {
                        alert("⚠️ Bạn đang xem với tư cách Khách. Hãy đăng nhập để lưu kết quả.");
                    }
                } catch (saveErr) {
                    console.error("Lỗi lưu SQL:", saveErr);
                }
                // --- KẾT THÚC ĐOẠN LƯU ---
            }, 500);

        } catch (error) {
            console.error("Lỗi phân tích:", error);
            alert("Có lỗi khi kết nối với LegAI. Vui lòng thử lại!");
        } finally {
            clearInterval(interval);
            setIsAnalyzing(false);
        }
    };

    // Helper: Badge 
    const getSeverityBadge = (severity) => {
        const level = severity ? severity.toLowerCase() : 'medium';
        if (level === 'high') return <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">NGHIÊM TRỌNG</span>;
        if (level === 'medium') return <span className="px-2 py-1 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">CẢNH BÁO</span>;
        return <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">LƯU Ý</span>;
    };

    // Cấu hình Biểu đồ 
    const chartData = result ? [
        { name: 'An toàn', value: result.risk_score ?? result.riskScore ?? 0, color: '#06b6d4' },
        { name: 'Rủi ro', value: 100 - (result.risk_score ?? result.riskScore ?? 0), color: '#ef4444' }
    ] : [];

    return (
        <div className="w-full">
            {/* Đã xóa thanh Progress Bar dư thừa ở đây */}

            <div className="max-w-7xl mx-auto px-6 w-full flex flex-col md:flex-row items-center md:items-start pt-10 pb-20 gap-10">

                {/* 🟢 CỘT TRÁI: TIÊU ĐỀ & UPLOAD FORM */}
                <div className="w-full md:w-5/12 animate-fadeInLeft relative z-10">

                    {/* KHU VỰC TIÊU ĐỀ ĐÃ ĐƯỢC TỐI ƯU HIỂN THỊ */}
                    <div className="text-left mb-10 relative">
                        <div className="absolute -inset-6 bg-black/50 blur-2xl -z-10 rounded-full pointer-events-none"></div>

                        <h1 className="text-4xl lg:text-6xl font-black uppercase tracking-tighter text-white drop-shadow-[0_4px_20px_rgba(0,0,0,1)] leading-none">
                            Thẩm định <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_2px_15px_rgba(34,211,238,0.3)]">
                                Hợp đồng AI
                            </span>
                        </h1>

                        <div className="mt-6 inline-block bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
                            <p className="text-gray-200 font-medium text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] max-w-md leading-relaxed">
                                Công nghệ trí tuệ nhân tạo giúp phát hiện rủi ro pháp lý chỉ trong vài giây.
                            </p>
                        </div>
                    </div>

                    {/* Hộp Upload */}
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

                {/* 🔵 CỘT PHẢI: HIỂN THỊ KẾT QUẢ VÀ SCANNER */}
                <div className="w-full md:w-7/12 relative min-h-[400px]">

                    {/* Thêm CSS cho tia Laser quét */}
                    <style>
                        {`
                            @keyframes scanLaser {
                                0% { top: 0%; opacity: 0; }
                                10% { opacity: 1; }
                                90% { opacity: 1; }
                                100% { top: 100%; opacity: 0; }
                            }
                            .animate-scan {
                                animation: scanLaser 2.5s ease-in-out infinite;
                            }
                        `}
                    </style>

                    {/* TRẠNG THÁI 1: ĐANG PHÂN TÍCH (AI SCANNER) */}
                    {isAnalyzing && (
                        <div className="absolute inset-0 z-20 animate-fadeIn">
                            <div className="bg-[#0a0a0a]/80 backdrop-blur-2xl border border-cyan-500/30 rounded-[2.5rem] p-10 shadow-[0_0_40px_rgba(34,211,238,0.1)] w-full h-full flex flex-col items-center justify-center relative overflow-hidden">

                                {/* Tia Laser quét dọc */}
                                <div className="absolute left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_20px_#22d3ee] animate-scan z-0"></div>

                                {/* Vòng tròn xoay Loading */}
                                <div className="relative w-24 h-24 mb-8 z-10">
                                    <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-cyan-400 animate-spin"></div>
                                    <div className="absolute inset-2 rounded-full border-4 border-white/5 border-b-blue-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                    <CpuChipIcon className="absolute inset-0 m-auto w-8 h-8 text-cyan-400 animate-pulse" />
                                </div>

                                <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-4 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                                    AI Đang Xử Lý
                                </h3>

                                {/* Khung hiển thị Log nhấp nháy */}
                                <div className="h-10 flex items-center justify-center overflow-hidden bg-black/50 px-6 py-2 rounded-lg border border-white/5 w-3/4 max-w-sm">
                                    <p className="text-cyan-400 font-mono text-sm tracking-wide animate-pulse text-center">
                                        {">"} {aiStatuses[statusIndex]} <span className="animate-ping">_</span>
                                    </p>
                                </div>

                                {/* Phần trăm to mờ ở background */}
                                <div className="absolute bottom-4 right-8 text-7xl font-black text-white/5 select-none pointer-events-none">
                                    {Math.round(progress)}%
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TRẠNG THÁI 2: KẾT QUẢ ĐÃ PHÂN TÍCH XONG */}
                    {result && !isAnalyzing && (
                        // ✅ Đã sửa class h-full ở đây để kết quả không bị bóp nghẹt
                        <div className="animate-slideUp h-full">
                            <div className="bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">

                                {/* Header Kết quả: Biểu đồ + Tóm tắt */}
                                <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8 border-b border-white/10 pb-8">

                                    {/* BIỂU ĐỒ TRÒN */}
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

                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className={`text-4xl font-black ${(result.risk_score ?? result.riskScore ?? 0) >= 80 ? 'text-cyan-400' : 'text-red-500'}`}>
                                                {result.risk_score ?? result.riskScore ?? 0}
                                            </span>
                                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Điểm an toàn</span>
                                        </div>
                                    </div>

                                    {/* Text tóm tắt */}
                                    <div className="flex-grow text-center md:text-left">
                                        <h3 className="text-xl font-bold text-white mb-2">Đánh giá tổng quan</h3>
                                        <p className="text-gray-400 text-sm leading-relaxed">
                                            {result.summary ?? result.summaryText ?? "Đang cập nhật..."}
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
        </div>
    );
}