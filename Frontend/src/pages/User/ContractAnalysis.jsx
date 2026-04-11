import React, { useState, useRef } from 'react';
import {
    CloudArrowUpIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    CheckBadgeIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    StopIcon
} from '@heroicons/react/24/outline';
import aiClient from "../../api/aiClient";
import axios from "axios";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function ContractAnalysis() {
    const [file, setFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const abortControllerRef = useRef(null);
    const intervalRef = useRef(null);
    const [isSaved, setIsSaved] = useState(false);


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

    const handleCancelAnalysis = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        setIsAnalyzing(false);
        setProgress(0);
        // Đã xóa setStatusIndex ở đây để hết lỗi trắng màn hình
        console.log(" đã dừng phân tích.");
    };

    const handleAnalyze = async () => {
        if (!file) return;

        abortControllerRef.current = new AbortController();
        setIsAnalyzing(true);
        setResult(null);
        setProgress(0);
        setIsSaved(false);
        intervalRef.current = setInterval(() => {
            setProgress((prev) => (prev < 90 ? prev + Math.random() * 5 : prev));
        }, 600);

        try {
            const aiResult = await aiClient.analyzeContract(file, abortControllerRef.current.signal);
            const analysis = aiResult?.data ?? aiResult;

            setProgress(100);
            setResult(analysis);


        } catch (error) {
            if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                console.error("Lỗi:", error);
                alert("Có lỗi xảy ra. Hãy thử lại!");
            }
        } finally {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsAnalyzing(false);
        }
    };
    const handleSaveToHistory = async () => {
        if (!result || !file) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 1 }; // Fallback ID 1 nếu chưa login
            const userId = user.id ?? user.Id ?? user.ID;

            const payload = {
                userId: userId,
                fileName: file.name,
                title: `Thẩm định: ${file.name}`, // Tiêu đề để hiện trong tab Pháp lý
                recordType: 'ANALYSIS',           // Định danh loại hồ sơ
                riskScore: result.risk_score ?? result.riskScore ?? 0,
                content: JSON.stringify(result) // Lưu toàn bộ JSON kết quả
            };

<<<<<<< HEAD
           const res = await axios.post('http://localhost:8000/api/history/save', payload, {
            headers: {
                // Đưa thẻ cho ông bảo vệ check ở đây
                Authorization: `Bearer ${token}` 
            }
        });
=======
            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: {
                    // Đưa thẻ cho ông bảo vệ check ở đây
                    Authorization: `Bearer ${token}`
                }
            });
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c

            if (res.data.success) {
                setIsSaved(true);
                alert(" Đã lưu hồ sơ vào Kho lưu trữ số thành công!");
            }
        } catch (saveErr) {
            console.error("Lỗi lưu SQL:", saveErr);
            alert("❌ Lỗi khi lưu hồ sơ vào Database.");
        } finally {
            setIsSaving(false);
        }
    };

    // Helper: Badge 
    const getSeverityBadge = (severity) => {
        const level = severity ? severity.toLowerCase() : 'medium';
        if (level === 'high') return <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">NGHIÊM TRỌNG</span>;
        if (level === 'medium') return <span className="px-2 py-1 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">CẢNH BÁO</span>;
        return <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">LƯU Ý</span>;
    };

    const chartData = result ? [
        { name: 'An toàn', value: result.risk_score ?? result.riskScore ?? 0, color: '#06b6d4' },
        { name: 'Rủi ro', value: 100 - (result.risk_score ?? result.riskScore ?? 0), color: '#ef4444' }
    ] : [];

    return (
        <div className="w-full relative">
            {/* Progress Bar duy nhất của Duy */}
            {isAnalyzing && (
                <div className="absolute top-0 left-0 w-full h-1 bg-transparent z-[9999]">
                    <div
                        className="h-full bg-cyan-400 transition-all duration-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 w-full flex flex-col md:flex-row items-center md:items-start pt-10 pb-20 gap-10">
                {/* 🟢 CỘT TRÁI */}
<<<<<<< HEAD
                <div className="w-full md:w-5/12 relative z-10">
                    <div className="text-left mb-10">
=======
                <div className="w-full md:w-5/12 relative z-10 flex flex-col gap-6">
                    <div className="text-left mb-6">
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                        <h1 className="text-4xl lg:text-6xl font-black uppercase text-white drop-shadow-[0_4px_20px_rgba(0,0,0,1)] leading-none">
                            Thẩm định <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Hợp đồng AI</span>
                        </h1>
                    </div>

<<<<<<< HEAD
                    {/* Ô UPLOAD MÀU GỐC CỦA DUY */}
                    <div className="bg-[#0a0a0a]/80 rounded-[2.3rem] p-8 text-center text-white border border-white/10 shadow-2xl backdrop-blur-xl">
                        {!result ? (
                            <>
                                <label className="block w-full cursor-pointer group mb-6">
                                    <input type="file" className="hidden" onChange={handleFileChange} />
                                    <div className={`border-2 border-dashed rounded-3xl p-8 transition-all ${file ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/20 hover:border-cyan-400/50'}`}>
                                        {file ? (
                                            <div className="text-cyan-400 flex flex-col items-center gap-2">
                                                <CheckBadgeIcon className="w-10 h-10 animate-bounce" />
                                                <span className="text-white font-bold">{file.name}</span>
                                            </div>
                                        ) : (
                                            <div className="text-gray-400 flex flex-col items-center">
                                                <CloudArrowUpIcon className="w-8 h-8 mb-2" />
                                                <span className="text-[10px] uppercase tracking-widest font-bold">Tải lên tài liệu</span>
                                            </div>
                                        )}
                                    </div>
                                </label>

                                {!isAnalyzing ? (
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={!file}
                                        className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 tracking-widest transition-all ${!file ? 'bg-gray-800 text-gray-500' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02]'}`}
                                    >
                                        <ShieldCheckIcon className="w-5 h-5" /> THẨM ĐỊNH NGAY
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleCancelAnalysis}
                                        className="w-full py-4 rounded-2xl font-black text-white bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 flex items-center justify-center gap-3 tracking-widest transition-all animate-pulse"
                                    >
                                        <StopIcon className="w-6 h-6 text-red-500" /> DỪNG PHÂN TÍCH
                                    </button>
                                )}
                            </>
                        ) : (
                            <button onClick={() => { setFile(null); setResult(null); }} className="w-full py-4 rounded-2xl border border-white/10 text-cyan-400 font-bold flex items-center justify-center gap-2">
=======
                    {/* KHU VỰC CHỌN FILE (LUÔN LUÔN HIỆN) */}
                    <div className="bg-[#0a0a0a]/80 rounded-[2.3rem] p-8 text-center text-white border border-white/10 shadow-2xl backdrop-blur-xl">
                        <label className="block w-full cursor-pointer group mb-6">
                            <input type="file" className="hidden" onChange={handleFileChange} />
                            <div className={`border-2 border-dashed rounded-3xl p-8 transition-all ${file ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/20 hover:border-cyan-400/50'}`}>
                                {file ? (
                                    <div className="text-cyan-400 flex flex-col items-center gap-2">
                                        <DocumentTextIcon className="w-10 h-10 animate-pulse" />
                                        <span className="text-white font-bold break-all">{file.name}</span>
                                    </div>
                                ) : (
                                    <div className="text-gray-400 flex flex-col items-center">
                                        <CloudArrowUpIcon className="w-8 h-8 mb-2" />
                                        <span className="text-[10px] uppercase tracking-widest font-bold">Tải lên tài liệu (.pdf, .doc)</span>
                                    </div>
                                )}
                            </div>
                        </label>

                        {/* LOGIC NÚT BẤM DƯỚI KHUNG UPLOAD */}
                        {!isAnalyzing && !result && (
                            <button
                                onClick={handleAnalyze}
                                disabled={!file}
                                className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 tracking-widest transition-all ${!file ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02]'}`}
                            >
                                <ShieldCheckIcon className="w-5 h-5" /> THẨM ĐỊNH NGAY
                            </button>
                        )}

                        {isAnalyzing && (
                            <button
                                onClick={handleCancelAnalysis}
                                className="w-full py-4 rounded-2xl font-black text-white bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 flex items-center justify-center gap-3 tracking-widest transition-all animate-pulse"
                            >
                                <StopIcon className="w-6 h-6 text-red-500" /> DỪNG PHÂN TÍCH
                            </button>
                        )}

                        {result && !isAnalyzing && (
                            <button
                                onClick={() => { setFile(null); setResult(null); }}
                                className="w-full py-4 rounded-2xl border border-white/20 hover:border-cyan-400 hover:bg-cyan-400/10 text-cyan-400 font-bold flex items-center justify-center gap-2 transition-all"
                            >
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                                <ArrowPathIcon className="w-5 h-5" /> PHÂN TÍCH VĂN BẢN KHÁC
                            </button>
                        )}
                    </div>
                </div>
<<<<<<< HEAD

=======
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                {/* 🔵 CỘT PHẢI - SẠCH SẼ, CHỈ HIỆN KẾT QUẢ */}
                <div className="w-full md:w-7/12 relative min-h-[400px]">
                    {result && !isAnalyzing && (
                        <div className="animate-slideUp bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                            {/* THÊM ĐOẠN NÀY: Header của kết quả kèm nút LƯU */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-8 bg-cyan-500 rounded-full"></div>
                                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">Kết quả phân tích</h3>
                                </div>

                                <button
                                    onClick={handleSaveToHistory}
                                    //  Nút sẽ bị vô hiệu hóa nếu ĐANG LƯU hoặc ĐÃ LƯU XONG
                                    disabled={isSaving || isSaved}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${isSaving || isSaved
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5' // Style khi bị khóa
                                        : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                        }`}
                                >
                                    {isSaving ? (
                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    ) : isSaved ? (
                                        <CheckBadgeIcon className="w-4 h-4 text-emerald-400" /> // Icon khi đã lưu
                                    ) : (
                                        <CheckBadgeIcon className="w-4 h-4" />
                                    )}

                                    {/* Thay đổi chữ hiển thị tương ứng */}
                                    {isSaving ? "ĐANG LƯU..." : isSaved ? "ĐÃ LƯU VÀO HỒ SƠ" : "LƯU VÀO HỒ SƠ"}
                                </button>
                            </div>
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8 border-b border-white/10 pb-8">
                                <div className="relative w-48 h-48 flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className={`text-4xl font-black ${(result.risk_score ?? 0) >= 80 ? 'text-cyan-400' : 'text-red-500'}`}>{result.risk_score ?? 0}</span>
                                        <span className="text-[10px] text-gray-500 uppercase font-bold">Điểm an toàn</span>
                                    </div>
                                </div>
                                <div className="flex-grow">
                                    <h3 className="text-xl font-bold text-white mb-2">Đánh giá tổng quan</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{result.summary ?? "Đang cập nhật..."}</p>
                                </div>
                            </div>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {result.risks?.map((risk, index) => (
                                    <div key={index} className="bg-white/5 border border-white/5 rounded-2xl p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="bg-white/10 text-gray-300 px-3 py-1 rounded-lg text-[11px] font-mono truncate max-w-[70%]">"{risk.clause}"</div>
                                            {getSeverityBadge(risk.severity)}
                                        </div>
                                        <p className="text-gray-400 text-sm"><span className="text-red-400 font-bold">Vấn đề: </span>{risk.issue}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}