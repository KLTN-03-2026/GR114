import React, { useState } from 'react';
import Header from "../../components/PageHeader";

// ✅ Cập nhật đường dẫn video chính xác
import video_bg from '../../assets/videos/video_bg.mp4';

import {
    CloudArrowUpIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    CheckBadgeIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import aiClient from "../../api/aiClient";

export default function ContractAnalysis() {
    const [file, setFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) setFile(selectedFile);
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setIsAnalyzing(true);
        try {
            const aiResult = await aiClient.analyzeContract(file);
            setResult(aiResult);
        } catch (error) {
            console.error("Lỗi phân tích:", error);
            alert("Có lỗi khi kết nối với LegAI. Vui lòng thử lại!");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
        if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
        return "text-red-600 bg-red-50 border-red-200";
    };

    const getSeverityBadge = (severity) => {
        const level = severity ? severity.toLowerCase() : 'medium';
        if (level === 'high') return <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-600 border border-red-200">NGHIÊM TRỌNG</span>;
        if (level === 'medium') return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-600 border border-yellow-200">CẢNH BÁO</span>;
        return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-600 border border-blue-200">LƯU Ý</span>;
    };

    return (
        <div className="relative min-h-screen font-sans overflow-x-hidden bg-black">
            {/* ✅ LỚP 1: VIDEO NỀN */}
            <div className="fixed inset-0 z-0">
                <video
                    autoPlay loop muted playsInline
                    className="w-full h-full object-cover opacity-80"
                >
                    <source src={video_bg} type="video/mp4" />
                </video>
                {/* 🟢 Overlay điều chỉnh: Làm tối bên trái hơn một chút để đọc chữ, bên phải sáng hơn để thấy cán cân */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent"></div>
            </div>

            {/* ✅ LỚP 2: NỘI DUNG CHÍNH */}
            <div className="relative z-10 flex flex-col min-h-screen">
                <Header />

                {/* 🟢 Thay đổi container thành flex và căn trái */}
                <main className="flex-grow max-w-7xl mx-auto px-6 py-20 w-full flex flex-col md:flex-row items-center md:items-start">

                    {/* 🟢 KHỐI BÊN TRÁI: TIÊU ĐỀ & UPLOAD */}
                    <div className="w-full md:w-1/2 lg:w-5/12 animate-fadeInLeft">

                        {/* Tiêu đề căn trái */}
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
                            /* ✅ HỘP UPLOAD: THU GỌN VÀ CĂN TRÁI */
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
                            /* KẾT QUẢ: HIỂN THỊ ĐÈ LÊN NHƯNG VẪN GIỮ CẤU TRÚC */
                            <div className="animate-slideUp pb-10">
                                <button
                                    onClick={() => { setFile(null); setResult(null); }}
                                    className="mb-4 text-cyan-400 flex items-center gap-2 font-bold text-sm hover:underline"
                                >
                                    ← Thử lại với hợp đồng khác
                                </button>
                                {/* Render kết quả tại đây... */}
                            </div>
                        )}
                    </div>

                    {/* 🟢 KHỐI BÊN PHẢI: ĐỂ TRỐNG ĐỂ HIỂN THỊ CÁN CÂN */}
                    <div className="hidden md:block md:flex-grow"></div>
                </main>
            </div>
        </div>
    );

}