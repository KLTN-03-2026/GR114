import React, { useState, useRef } from 'react';
import {
    CloudArrowUpIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    CheckBadgeIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    StopIcon,
    ShieldExclamationIcon,
    XMarkIcon
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
    const fileInputRef = useRef(null);

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

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: {
                    // Đưa thẻ cho ông bảo vệ check ở đây
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.data.success) {
                setIsSaved(true);
                alert(" Đã lưu hồ sơ vào Kho lưu trữ số thành công!");
            }
        } catch (saveErr) {
            console.error("Lỗi lưu SQL:", saveErr);
            alert(" Lỗi khi lưu hồ sơ vào Database.");
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
    // Helper: Reset tất cả trạng thái về ban đầu, bao gồm cả giá trị thẻ input
    const resetAll = () => {
        setFile(null);
        setResult(null);
        setProgress(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // ĐÂY LÀ CHÌA KHÓA: Xóa giá trị thẻ input
        }
    };
    // xử lý khi người dùng muốn xóa file đã chọn (nếu có) và reset trạng thái về ban đầu
    const handleRemoveFile = (e) => {

        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }



        resetAll();
        console.log("Đã xóa file và reset trạng thái.");
    };

    return (
        <div className="w-full relative">
            {/* Progress Bar  */}
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
                <div className="w-full md:w-5/12 relative z-10 flex flex-col gap-6">
                    <div className="text-left mb-6">
                        <h1 className="text-4xl lg:text-6xl font-black uppercase text-white drop-shadow-[0_4px_20px_rgba(0,0,0,1)] leading-none">
                            Thẩm định <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Hợp đồng AI</span>
                        </h1>
                    </div>

                    <div className="w-full flex flex-col gap-4"> 
                        <label className="block w-full cursor-pointer group relative shadow-2xl">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

                            {/* Upload hiệu ứng kính mờ - Phiên bản viền Bold & Glow */}
                            <div className={`group bg-white/5 backdrop-blur-2xl rounded-[2rem] p-10 text-center transition-all duration-500 relative flex flex-col items-center justify-center min-h-[200px]
    /* Cấu hình viền: to (border-4) và nét đứt (border-dashed) */
    border-4 border-dashed 
    ${file
                                    ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.15)] scale-[1.02]'
                                    : 'border-white/30 hover:border-cyan-400 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                                }`}
                            >

                                {file ? (
                                    <>
                                        {/* Nút xóa file */}
                                        <button
                                            onClick={ handleRemoveFile}
                                            className="absolute top-5 right-5 p-2 rounded-full bg-white/70 hover:bg-red-500/20 hover:text-red-500 text-gray-400 transition-all z-20 border border-white/5 hover:border-red-500/40"
                                            title="Xóa file"
                                        >
                                            <XMarkIcon className="w-6 h-6" />
                                        </button>

                                        {/* Hiển thị file đã chọn */}
                                        <div className="text-cyan-400 flex flex-col items-center gap-3">
                                            <div className="relative">
                                                <DocumentTextIcon className="w-16 h-16 animate-pulse" />
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-400 rounded-full blur-sm animate-ping"></div>
                                            </div>
                                            <span className="text-white font-bold break-all px-4 tracking-wide">{file.name}</span>
                                            <span className="text-cyan-400/60 text-xs uppercase font-black tracking-widest">Sẵn sàng phân tích</span>
                                        </div>
                                    </>
                                ) : (
                                    /* Trạng thái chờ upload */
                                    <div className="flex flex-col items-center cursor-pointer">
                                        <CloudArrowUpIcon className="w-14 h-14 mb-4 text-white/40 group-hover:text-cyan-400 group-hover:scale-110 transition-all duration-300" />
                                        <span className="text-[16px] text-white/70 group-hover:text-white uppercase tracking-[0.3em] font-black transition-colors">
                                            Tải lên tài liệu pháp lý
                                        </span>
                                        <span className="text-[14px] text-white/30 mt-2 font-medium">Hỗ trợ PDF, DOCX </span>
                                    </div>
                                )}
                            </div>
                        </label>

                        {/* LOGIC NÚT BẤM */}
                        {isAnalyzing ? (
                            <button
                                onClick={handleCancelAnalysis}
                                className="
                            /* 1. KÍCH THƯỚC: Thu gọn ngang và dọc, căn giữa */
                            w-fit px-8 py-2 mx-auto rounded-xl 
        
                            /* 2. CHỮ: Giảm độ dày và kích thước cho thanh thoát */
                            font-bold text-[12px] text-red-400 flex items-center justify-center gap-2 tracking-wider 
        
                             /* 3. HIỆU ỨNG: Glassmorphism nhẹ nhàng, bớt nhấp nháy mạnh */
                                bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 
                            transition-all backdrop-blur-md group  "

                            >
                                {/* Icon nhỏ lại và chỉ nháy nhẹ khi hover hoặc đang chạy */}
                                <StopIcon className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                                <span>DỪNG PHÂN TÍCH</span>
                            </button>
                        ) : result ? (
                            <button onClick={() => { setFile(null); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="w-fit px-8 py-2 mx-auto  rounded-xl border border-white/20 hover:border-cyan-400 hover:bg-cyan-400/10 text-cyan-400 font-bold flex items-center justify-center gap-2 transition-all backdrop-blur-md">
                                <ArrowPathIcon className="w-5 h-5" /> PHÂN TÍCH VĂN BẢN KHÁC
                            </button>
                        ) : file && (
                            <button
                                onClick={handleAnalyze}
                                disabled={!file}
                                className={`
                                /* 1. ĐIỀU CHỈNH KÍCH THƯỚC: Thu ngắn chiều ngang (mx-auto để căn giữa) và giảm chiều cao */
                                w-fit px-10 py-2.5 mx-auto rounded-xl 
        
                                /* 2. CHỈNH CHỮ: Giảm độ dày (bold thay vì black) và khoảng cách vừa phải */
                                font-bold text-[13px] text-white flex items-center justify-center gap-2 tracking-wider 
        
                                /* 3. HIỆU ỨNG: Giữ sự mượt mà */
                                transition-all shadow-lg backdrop-blur-md 
        
        ${!file
                                        ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                                        : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-105 active:scale-95 border border-cyan-400/30 shadow-cyan-500/20 hover:shadow-cyan-500/40'
                                    }
    `}
                            >
                                <ShieldCheckIcon className="w-4 h-4" />
                                <span>THẨM ĐỊNH NGAY</span>
                            </button>
                        )}
                    </div>
                </div>
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
                                    // Đổi background nhẹ tùy theo severity để phân cấp tốt hơn
                                    <div key={index} className={`border rounded-2xl p-5 ${risk.severity === 'High' ? 'bg-red-500/5 border-red-500/20' :
                                        risk.severity === 'Medium' ? 'bg-orange-500/5 border-orange-500/20' :
                                            'bg-white/5 border-white/10'
                                        }`}>
                                        <div className="flex justify-between items-start mb-4">
                                            {/* Phần trích dẫn được làm nổi bật hơn */}
                                            <div className="bg-[#0a0a0a] border border-white/10 text-gray-400 px-3 py-2 rounded-xl text-xs font-mono w-[80%] italic">
                                                "{risk.clause}"
                                            </div>
                                            {getSeverityBadge(risk.severity)}
                                        </div>

                                        <div className="space-y-3">
                                            {/* VẤN ĐỀ (Màu đỏ/cam tùy severity) */}
                                            <p className="text-gray-300 text-sm leading-relaxed">
                                                <span className={`${risk.severity === 'High' ? 'text-red-400' : 'text-orange-400'} font-bold flex items-center gap-1 mb-1`}>
                                                    <ShieldExclamationIcon className="w-4 h-4" /> Phân tích rủi ro:
                                                </span>
                                                {risk.issue}
                                            </p>

                                            {/* ĐỀ XUẤT SỬA ĐỔI (Trường mới thêm vào) */}
                                            {risk.solution && (
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mt-2">
                                                    <p className="text-emerald-100 text-sm leading-relaxed">
                                                        <span className="text-emerald-400 font-bold flex items-center gap-1 mb-1">
                                                            <CheckBadgeIcon className="w-4 h-4" /> Đề xuất sửa đổi:
                                                        </span>
                                                        {risk.solution}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
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