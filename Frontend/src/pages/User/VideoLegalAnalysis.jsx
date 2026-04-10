import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
    VideoCameraIcon,
    LinkIcon,
    SparklesIcon,
    DocumentTextIcon,
    ClipboardDocumentIcon,
    ArrowPathIcon,
    ScaleIcon
} from '@heroicons/react/24/outline';

export default function VideoLegalAnalysis() {
    const [url, setUrl] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [videoData, setVideoData] = useState(null);
    const [embedUrl, setEmbedUrl] = useState('');

    // 1. Logic xử lý URL để nhúng Video vào iframe
    const parseVideoUrl = (link) => {
        if (link.includes('youtube.com/shorts/') || link.includes('youtu.be/') || link.includes('youtube.com/watch')) {
            let id = "";
            if (link.includes('/shorts/')) id = link.split('/shorts/')[1].split('?')[0];
            else if (link.includes('v=')) id = new URL(link).searchParams.get('v');
            else id = link.split('/').pop().split('?')[0];

            setEmbedUrl(`https://www.youtube.com/embed/${id}`);
            return 'youtube';
        } else if (link.includes('tiktok.com')) {
            const parts = link.split('/');
            const id = parts[parts.length - 1].split('?')[0];
            setEmbedUrl(`https://www.tiktok.com/embed/v2/${id}`);
            return 'tiktok';
        }
        return null;
    };

    // 2. Hàm xử lý Markdown thông minh (Không cần cài thư viện)
    const formatSummary = (text) => {
        if (!text) return null;
        // Tách các dòng ra để xử lý
        return text.split('\n').map((line, index) => {
            // Xóa dấu ### và khoảng trắng thừa
            let cleanLine = line.replace(/###/g, '').trim();
            if (!cleanLine) return <br key={index} />;

            // Xử lý in đậm cho các chữ nằm trong **...**
            const parts = cleanLine.split(/\*\*(.*?)\*\*/g);
            return (
                <span key={index} className="block mb-2">
                    {parts.map((part, i) => 
                        i % 2 === 1 ? (
                            <strong key={i} className="text-cyan-400 font-black">{part}</strong>
                        ) : (
                            part
                        )
                    )}
                </span>
            );
        });
    };

    // 3. GỌI API THẬT
    const handleAnalyze = async () => {
        if (!url.trim()) return;

        setIsAnalyzing(true);
        setVideoData(null);
        parseVideoUrl(url);

        try {
            const token = localStorage.getItem('accessToken');

            const response = await axios.post('http://localhost:8000/api/ai/analyze-video',
                { url: url },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.success) {
                const result = response.data.data;

                // 🟢 Cú pháp "Vạn Năng" - Chấp cả dữ liệu từ AI lẫn SQL Server
                setVideoData({
                    transcript: result.Transcript || result.transcript,
                    summary: result.analysis_report || result.Summary || result.summary,
                    legalMap: (typeof result.LegalBases === 'string' 
                        ? JSON.parse(result.LegalBases) 
                        : (result.legal_map || result.legalBases)) || [],
                    trustScore: result.TrustScore || result.audit_metrics?.trust_score || result.trustScore || 0,
                    actionPlan: result.action_plan || (result.AnalysisJson ? JSON.parse(result.AnalysisJson).action_plan : [])
                });
            }
        } catch (error) {
            console.error("❌ Lỗi gọi API phân tích video:", error);
            alert(error.response?.data?.error || "Hệ thống không thể phân tích video này. Bạn kiểm tra lại Server hoặc link nhé!");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert("Đã copy Transcript!");
    };

    const glassClass = "bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]";

    return (
        <div className="w-full h-[calc(100vh-80px)] p-6 text-white overflow-hidden flex flex-col md:flex-row gap-6">

            {/* 🔴 CỘT TRÁI: ĐIỀU KHIỂN & VIDEO (40%) */}
            <div className="w-full md:w-5/12 flex flex-col gap-6 h-full">
                <div className={`${glassClass} p-6 border-cyan-500/20`}>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <LinkIcon className="h-5 w-5 text-cyan-400" />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Dán link TikTok hoặc YouTube Shorts..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-32 text-sm outline-none focus:border-cyan-500/50 transition-all"
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !url}
                            className="absolute right-2 top-2 bottom-2 px-6 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:opacity-30"
                        >
                            {isAnalyzing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : "Phân tích"}
                        </button>
                    </div>
                </div>

                <div className={`${glassClass} flex-grow overflow-hidden relative group`}>
                    {embedUrl ? (
                        <iframe
                            src={embedUrl}
                            className="w-full h-full border-none"
                            title="Legal Video Player"
                            allowFullScreen
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                            <div className="p-8 rounded-full bg-white/5 mb-4 group-hover:scale-110 transition-transform">
                                <VideoCameraIcon className="w-16 h-16 text-indigo-400" />
                            </div>
                            <p className="text-sm font-bold tracking-widest uppercase">Đang chờ video...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 🔵 CỘT PHẢI: KẾT QUẢ AI (60%) */}
            <div className={`${glassClass} w-full md:w-7/12 flex flex-col h-full overflow-hidden`}>
                <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-6 h-6 text-cyan-400" />
                        <h2 className="font-black uppercase tracking-tighter text-xl">LegAI Insights</h2>
                    </div>
                    {videoData && (
                        <span className="bg-indigo-500/20 text-indigo-400 px-4 py-1 rounded-full text-[10px] font-bold border border-indigo-500/30">
                            AI PROCESSED
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    {!videoData && !isAnalyzing ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-20">
                            <DocumentTextIcon className="w-20 h-20 mb-4" />
                            <p className="font-bold uppercase tracking-[0.3em]">Kết quả sẽ hiển thị tại đây</p>
                        </div>
                    ) : isAnalyzing ? (
                        <div className="space-y-6 animate-pulse">
                            <div className="h-32 bg-white/5 rounded-3xl" />
                            <div className="h-64 bg-white/5 rounded-3xl" />
                            <div className="h-20 bg-white/5 rounded-3xl" />
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                            
                            {/* SECTION: TRANSCRIPT */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-xs tracking-widest">
                                        <DocumentTextIcon className="w-4 h-4" /> Transcript bóc tách
                                    </h3>
                                    <button
                                        onClick={() => copyToClipboard(videoData.transcript)}
                                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"
                                    >
                                        <ClipboardDocumentIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 text-gray-300 text-sm leading-relaxed italic max-h-48 overflow-y-auto custom-scrollbar">
                                    "{videoData.transcript}"
                                </div>
                            </section>

                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                
                                {/* SECTION: BÁO CÁO KIỂM TOÁN (ĐÃ FIX UI MARKDOWN) */}
                                <div className="bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 p-6 rounded-3xl border border-white/10 lg:col-span-2">
                                    <h4 className="font-bold mb-4 flex items-center gap-2 text-lg">
                                        <ScaleIcon className="w-6 h-6 text-cyan-400" /> Báo cáo Legal Audit
                                    </h4>
                                    <div className="text-gray-300 text-sm leading-relaxed">
                                        {/* Sử dụng hàm formatSummary thay vì in thẳng text */}
                                        {formatSummary(videoData.summary)}
                                    </div>
                                </div>

                                {/* SECTION: CHECKLIST CƠ SỞ PHÁP LÝ (ĐÃ FIX BIẾN) */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Kiểm toán pháp lý</h4>
                                    <div className="flex flex-col gap-3">
                                        {videoData.legalMap && videoData.legalMap.length > 0 ? (
                                            videoData.legalMap.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                                                    <div>
                                                        <p className="text-xs font-bold text-cyan-400">{item.law_name}</p>
                                                        <p className="text-[10px] text-gray-500 mt-1">Điều/Khoản: {item.article}</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                                        item.status?.toLowerCase() === 'đúng' 
                                                        ? 'bg-green-500/20 text-green-400' 
                                                        : 'bg-red-500/20 text-red-400'
                                                    }`}>
                                                        {item.status ? item.status.toUpperCase() : 'N/A'}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">Không tìm thấy cơ sở pháp lý cụ thể.</p>
                                        )}
                                    </div>
                                </div>

                                {/* SECTION: TRUST SCORE */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Độ tin cậy (Trust Score)</h4>
                                        <span className="text-3xl font-black text-cyan-400">{videoData.trustScore}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${videoData.trustScore}%` }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                        />
                                    </div>
                                </div>
                            </section>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}