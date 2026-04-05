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

function decodeUnicodeString(str) {
    if (!str) return str;
    try {
        // Attempt to decode as UTF-8 from Latin-1 (common double-encoding)
        const fixed = decodeURIComponent(escape(str));
        // Simple check for common garbled characters, might need refinement
        if (fixed.includes('�') || fixed.includes('Ã') || fixed.includes('Ä')) {
            // Fallback for cases where the above might not be enough, though escape/unescape is deprecated
            return decodeURIComponent(escape(str)); 
        }
        return fixed;
    } catch (e) {
        // If decoding fails, return original string
        console.warn("Failed to decode string:", str, e);
        return str;
    }
}

export default function ContractAnalysis() {
    const [file, setFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const abortControllerRef = useRef(null);
    const intervalRef = useRef(null);
    const [isSaved, setIsSaved] = useState(false);
    const [files, setFiles] = useState([]);
    const [isBatch, setIsBatch] = useState(false);
    const [batchResult, setBatchResult] = useState(null);
    const [isBatchSaving, setIsBatchSaving] = useState(false);
    const [isBatchSaved, setIsBatchSaved] = useState(false);


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
            alert("❌ Lỗi khi lưu hồ sơ vào Database.");
        } finally {
            setIsSaving(false);
        }
    };
    const handleSaveBatchHistory = async () => {
        if (!batchResult) return;

        setIsBatchSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 1 }; // Fallback ID 1 nếu chưa login
            const userId = user.id ?? user.Id ?? user.ID;

            const payload = {
                userId: userId,
                fileName: 'Kết quả thẩm định hàng loạt', // Tiêu đề để hiện trong tab Pháp lý
                title: 'Kết quả thẩm định hàng loạt', // Tiêu đề để hiện trong tab Pháp lý
                recordType: 'ANALYSIS', // Định danh loại hồ sơ
                riskScore: batchAvg, // Lưu điểm an toàn trung bình
                content: JSON.stringify(batchResult) // Lưu toàn bộ JSON kết quả
            };

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: {
                    // Đưa thẻ cho ông bảo vệ check ở đây
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.data.success) {
                setIsBatchSaved(true);
                alert("Đã lưu hồ sơ vào Kho lưu trữ thành công!");
            }
        } catch (saveErr) {
            console.error("Lỗi lưu SQL:", saveErr);
            alert("❌ Lỗi khi lưu hồ sơ vào Database.");
        } finally {
            setIsBatchSaving(false);
        }
    };
    // Batch handlers: upload nhiều file và gọi API batch
    const handleBatchFilesChange = (e) => {
        const selected = Array.from(e.target.files || []);
        if (selected.length === 0) return;
        if (selected.length > 10) {
            alert("Vui lòng chọn tối đa 10 file.");
            return;
        }
        const allowed = ['pdf', 'txt', 'doc', 'docx'];
        const filtered = selected.filter(f => allowed.includes((f.name.split('.').pop() || '').toLowerCase()));
        if (filtered.length !== selected.length) {
            alert("Một số file bị loại (chỉ chấp nhận pdf/txt/doc/docx). Nếu cần, hãy nén và thử lại.");
        }
        setFiles(filtered);
    };

    const handleAnalyzeBatch = async () => {
        if (!files || files.length === 0) return;

        abortControllerRef.current = new AbortController();
        setIsAnalyzing(true);
        setBatchResult(null);
        setProgress(0);
        intervalRef.current = setInterval(() => {
            setProgress((prev) => (prev < 90 ? prev + Math.random() * 5 : prev));
        }, 600);

        try {
            const aiResult = await aiClient.analyzeContractsBatch(files, abortControllerRef.current.signal);
            setProgress(100);
            setBatchResult(aiResult);
        } catch (error) {
            if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                console.error("Lỗi batch:", error);
                alert("Có lỗi xảy ra khi phân tích hàng loạt. Hãy thử lại!");
            }
        } finally {
            if (intervalRef.current) clearInterval(intervalRef.current);
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

    const chartData = result ? [
        { name: 'An toàn', value: result.risk_score ?? result.riskScore ?? 0, color: '#06b6d4' },
        { name: 'Rủi ro', value: 100 - (result.risk_score ?? result.riskScore ?? 0), color: '#ef4444' }
    ] : [];

    const batchAvg = batchResult ? (batchResult.aggregated?.average_risk_score ?? 0) : 0;
    const chartDataBatch = batchResult ? [
        { name: 'An toàn', value: batchAvg, color: '#06b6d4' },
        { name: 'Rủi ro', value: 100 - batchAvg, color: '#ef4444' }
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
                <div className="w-full md:w-5/12 relative z-10">
                    <div className="text-left mb-10">
                        <h1 className="text-4xl lg:text-6xl font-black uppercase text-white drop-shadow-[0_4px_20px_rgba(0,0,0,1)] leading-none">
                            Thẩm định <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Hợp đồng AI</span>
                        </h1>
                    </div>

                    {/* Ô UPLOAD MÀU GỐC CỦA DUY */}
                    <div className="bg-[#0a0a0a]/80 rounded-[2.3rem] p-8 text-center text-white border border-white/10 shadow-2xl backdrop-blur-xl">
                        {!result ? (
                            <>
                                <label className="block w-full cursor-pointer group mb-4">
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

                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <button onClick={() => setIsBatch(prev => !prev)} className="text-sm text-cyan-300 underline">
                                        {isBatch ? 'Quay lại thẩm định đơn' : 'Thẩm định nhiều hợp đồng'}
                                    </button>
                                    {isBatch && files.length > 0 && <div className="text-xs text-gray-400">{files.length} file được chọn</div>}
                                </div>

                                {isBatch && (
                                    <label className="block w-full cursor-pointer group mb-6">
                                        <input type="file" multiple className="hidden" onChange={handleBatchFilesChange} />
                                        <div className={`border-2 border-dashed rounded-3xl p-6 transition-all ${files.length ? 'border-cyan-400 bg-cyan-400/8' : 'border-white/20 hover:border-cyan-400/50'}`}>
                                            {files.length ? (
                                                <div className="text-cyan-400 flex flex-col items-start gap-2 text-left">
                                                    <DocumentTextIcon className="w-6 h-6" />
                                                    <div className="text-white font-bold w-full max-h-36 overflow-y-auto">{files.map((f) => <div key={f.name} className="text-sm">{f.name}</div>)}</div>
                                                </div>
                                            ) : (
                                                <div className="text-gray-400 flex flex-col items-center">
                                                    <CloudArrowUpIcon className="w-8 h-8 mb-2" />
                                                    <span className="text-[10px] uppercase tracking-widest font-bold">Tải lên nhiều tài liệu (max 10)</span>
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                )}

                                {!isAnalyzing ? (
                                    isBatch ? (
                                        <button
                                            onClick={handleAnalyzeBatch}
                                            disabled={!files.length}
                                            className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 tracking-widest transition-all ${!files.length ? 'bg-gray-800 text-gray-500' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02]'}`}
                                        >
                                            <ShieldCheckIcon className="w-5 h-5" /> THẨM ĐỊNH HÀNG LOẠT
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={!file}
                                            className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 tracking-widest transition-all ${!file ? 'bg-gray-800 text-gray-500' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02]'}`}
                                        >
                                            <ShieldCheckIcon className="w-5 h-5" /> THẨM ĐỊNH NGAY
                                        </button>
                                    )
                                ) : (
                                    <button
                                        onClick={handleCancelAnalysis}
                                        className="w-full py-4 rounded-2xl font-black text-white bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 flex items-center justify-center gap-3 tracking-widest transition-all animate-pulse"
                                    >
                                        <StopIcon className="w-6 h-6 text-red-500" /> DỪNG THẨM ĐỊNH
                                    </button>
                                )}
                            </>
                        ) : (
                            <button onClick={() => { setFile(null); setResult(null); }} className="w-full py-4 rounded-2xl border border-white/10 text-cyan-400 font-bold flex items-center justify-center gap-2">
                                <ArrowPathIcon className="w-5 h-5" /> THẨM ĐỊNH VĂN BẢN KHÁC
                            </button>
                        )}
                    </div>
                </div>

                {/* 🔵 CỘT PHẢI - SẠCH SẼ, CHỈ HIỆN KẾT QUẢ */}
                <div className="w-full md:w-7/12 relative min-h-[400px]">
                    {batchResult && !isAnalyzing && (
                        <div className="animate-slideUp bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-8 bg-cyan-500 rounded-full"></div>
                                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">Kết quả thẩm định - Hàng loạt</h3>
                                
                                </div>
                                {/* <div className="px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">Đã phân tích {batchResult.aggregated?.total_files ?? batchResult.files?.length ?? 0} file</div> */}
                                <button
                                    onClick={handleSaveBatchHistory}
                                    disabled={isSaving || isBatchSaved}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${isSaving || isBatchSaved
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5' // Style khi bị khóa
                                        : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                        }`}
                                >
                                    {isSaving ? (
                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    ) : isBatchSaved ? (
                                        <CheckBadgeIcon className="w-4 h-4 text-emerald-400" /> // Icon khi đã lưu
                                    ) : (
                                        <CheckBadgeIcon className="w-4 h-4" />
                                    )}

                                    {/* Thay đổi chữ hiển thị tương ứng */}
                                    {isSaving ? "ĐANG LƯU..." : isBatchSaved ? "ĐÃ LƯU VÀO HỒ SƠ" : "LƯU VÀO HỒ SƠ"}
                                </button>
                            </div>
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8 border-b border-white/10 pb-8">
                                <div className="relative w-48 h-48 flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={chartDataBatch} cx="50%" cy="50%" innerRadius={60} outerRadius={80} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                                                {chartDataBatch.map((entry, index) => (
                                                    <Cell key={`cell-b-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className={`text-4xl font-black ${batchAvg >= 80 ? 'text-cyan-400' : 'text-red-500'}`}>{batchAvg}</span>
                                        <span className="text-[10px] text-gray-500 uppercase font-bold">Điểm an toàn trung bình</span>
                                    </div>
                                </div>
                                <div className="flex-grow">
                                    <h3 className="text-xl font-bold text-white mb-2">Đánh giá tổng quan</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{batchResult.aggregated?.summary ?? `Phân tích ${batchResult.files?.length ?? 0} file.`}</p>
                                </div>
                            </div>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {batchResult.files?.map((f, index) => (
                                    <div key={index} className="bg-white/5 border border-white/5 rounded-2xl p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="bg-white/10 text-gray-300 px-3 py-1 rounded-lg text-[11px] font-mono truncate max-w-[70%]" title={decodeUnicodeString(f.fileName)}>{decodeUnicodeString(f.fileName)}</div>
                                            <span className="px-2 py-1 rounded text-[10px] font-bold bg-gray-700 text-white border border-white/10">Điểm: {(f.analysis?.risk_score ?? f.analysis?.riskScore) ?? '-'}</span>
                                        </div>
                                        <p className="text-gray-400 text-sm"><span className="text-red-400 font-bold">Tóm tắt: </span>{f.analysis?.summary ?? f.error ?? 'Không có dữ liệu'}</p>
                                        {f.analysis?.risks?.slice(0, 3).map((risk, i) => (
                                            <div key={i} className="mt-3 bg-white/3 p-3 rounded">{getSeverityBadge(risk.severity)}<div className="text-gray-300 text-sm mt-1">{risk.issue}</div></div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {result && !isAnalyzing && (
                        <div className="animate-slideUp bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                            {/* THÊM ĐOẠN NÀY: Header của kết quả kèm nút LƯU */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-8 bg-cyan-500 rounded-full"></div>
                                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">Kết quả thẩm định</h3>
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