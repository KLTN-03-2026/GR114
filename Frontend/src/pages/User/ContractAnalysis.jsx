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
    const [selectedFiles, setSelectedFiles] = useState([]); // Array chứa các file đã chọn
    const [analysisResults, setAnalysisResults] = useState(null); // Lưu toàn bộ kết quả (single object hoặc array of objects)
    const [currentFileIndex, setCurrentFileIndex] = useState(0); // Index của file đang hiển thị trong chế độ batch
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const abortControllerRef = useRef(null);
    const intervalRef = useRef(null);
    const [isSaved, setIsSaved] = useState(false);
    const [files, setFiles] = useState([]);
    
    
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []); // Chuyển FileList thành Array
        if (files.length === 0) {
            setSelectedFiles([]);
            setAnalysisResults(null);
            setCurrentFileIndex(0);
            return;
        }
        if (files.length > 10) {
            alert("Vui lòng chọn tối đa 10 file.");
            return;
        }

        const allowed = ['pdf', 'txt', 'doc', 'docx'];
        const filteredFiles = files.filter(f => allowed.includes((f.name.split('.').pop() || '').toLowerCase()));

        if (filteredFiles.length !== files.length) {
            alert("Một số file bị loại (chỉ chấp nhận pdf/txt/doc/docx).");
        }

        setSelectedFiles(filteredFiles);
        setAnalysisResults(null); // Reset kết quả khi file mới được chọn
        setCurrentFileIndex(0);    // Reset index về 0
        setIsSaved(false);         // Reset trạng thái lưu
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
        console.log(" đã dừng phân tích.");
    };

    
    const handleAnalyze = async () => {
        if (!selectedFiles || selectedFiles.length === 0) return;

        abortControllerRef.current = new AbortController();
        setIsAnalyzing(true);
        setAnalysisResults(null); // Reset kết quả cũ
        setCurrentFileIndex(0); // Reset index
        setProgress(0);
        setIsSaved(false); // Reset trạng thái lưu
        intervalRef.current = setInterval(() => {
            setProgress((prev) => (prev < 90 ? prev + Math.random() * 5 : prev));
        }, 600);

        try {
            let aiResult;
            if (selectedFiles.length === 1) {
                // Thẩm định đơn
                aiResult = await aiClient.analyzeContract(selectedFiles[0], abortControllerRef.current.signal);
                setAnalysisResults(aiResult?.data ?? aiResult); // Lưu trực tiếp kết quả object
            } else {
                // Thẩm định hàng loạt
                aiResult = await aiClient.analyzeContractsBatch(selectedFiles, abortControllerRef.current.signal);
                // `aiResult.files` là mảng các kết quả phân tích từng file
                setAnalysisResults(aiResult?.files); // Lưu mảng kết quả
            }

            setProgress(100);

        } catch (error) {
            if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                console.error("Lỗi phân tích:", error);
                alert("Có lỗi xảy ra khi phân tích. Hãy thử lại!");
            }
        } finally {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsAnalyzing(false);
        }
    };
    
    
    const handleSaveCurrentAnalysisToHistory = async () => {
        let currentFileToSave;
        let currentResultToSave;

        if (selectedFiles.length === 1 && analysisResults) {
            // Chế độ thẩm định đơn
            currentFileToSave = selectedFiles[0];
            currentResultToSave = analysisResults;
        } else if (selectedFiles.length > 1 && analysisResults && analysisResults[currentFileIndex]) {
            // Chế độ thẩm định hàng loạt, lấy file và kết quả của file hiện tại
            currentFileToSave = selectedFiles[currentFileIndex];
            currentResultToSave = analysisResults[currentFileIndex].analysis; // Lấy phần 'analysis' từ object kết quả batch
        } else {
            // Không có gì để lưu
            return;
        }

        if (!currentFileToSave || !currentResultToSave) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem("accessToken");
            const userStr = localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : { id: 1 }; // Fallback ID 1 nếu chưa login
            const userId = user.id ?? user.Id ?? user.ID;

            const payload = {
                userId: userId,
                fileName: currentFileToSave.name,
                title: `Thẩm định: ${currentFileToSave.name}`, // Tiêu đề để hiện trong tab Pháp lý
                recordType: 'ANALYSIS', // Định danh loại hồ sơ
                riskScore: currentResultToSave.risk_score ?? currentResultToSave.riskScore ?? 0,
                content: JSON.stringify(currentResultToSave) // Lưu toàn bộ JSON kết quả của file này
            };

            const res = await axios.post('http://localhost:8000/api/history/save', payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.data.success) {
                setIsSaved(true);
                alert("Đã lưu hồ sơ vào Kho lưu trữ số thành công!");
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

    
    const currentAnalysisData = selectedFiles.length === 1
        ? analysisResults // Nếu là single file, analysisResults là object kết quả
        : (analysisResults && analysisResults[currentFileIndex] ? analysisResults[currentFileIndex].analysis : null); // Nếu là batch, lấy analysis của file hiện tại

    const chartData = currentAnalysisData ? [
        { name: 'An toàn', value: currentAnalysisData.risk_score ?? currentAnalysisData.riskScore ?? 0, color: '#06b6d4' },
        { name: 'Rủi ro', value: 100 - (currentAnalysisData.risk_score ?? currentAnalysisData.riskScore ?? 0), color: '#ef4444' }
    ] : [];

    // Tính điểm trung bình cho tổng quan batch (nếu có nhiều file)
    const batchAvg = selectedFiles.length > 1 && analysisResults
        ? Math.round(analysisResults.reduce((sum, item) => sum + (item.analysis?.risk_score ?? item.analysis?.riskScore ?? 0), 0) / analysisResults.length)
        : 0;

    const chartDataBatchOverall = selectedFiles.length > 1 && analysisResults ? [
        { name: 'An toàn', value: batchAvg, color: '#06b6d4' },
        { name: 'Rủi ro', value: 100 - batchAvg, color: '#ef4444' }
    ] : [];

    
    return (
        <div className="w-full relative">
            {/* Progress Bar */}
            {isAnalyzing && (
                <div className="absolute top-0 left-0 w-full h-1 bg-transparent z-[9999]">
                    <div
                        className="h-full bg-cyan-400 transition-all duration-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 w-full flex flex-col md:flex-row items-center md:items-start pt-10 pb-20 gap-10">
                {/* CỘT TRÁI - Upload Files */}
                <div className="w-full md:w-5/12 relative z-10">
                    <div className="text-left mb-10">
                        <h1 className="text-4xl lg:text-6xl font-black uppercase text-white drop-shadow-[0_4px_20px_rgba(0,0,0,1)] leading-none">
                            Thẩm định <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Hợp đồng AI</span>
                        </h1>
                    </div>

                    <div className="bg-[#0a0a0a]/80 rounded-[2.3rem] p-8 text-center text-white border border-white/10 shadow-2xl backdrop-blur-xl">
                        {!analysisResults ? ( // Hiển thị ô upload nếu chưa có kết quả nào
                            <>
                                {/* Ô UPLOAD duy nhất, hỗ trợ MULTIPLE */}
                                <label className="block w-full cursor-pointer group mb-6">
                                    <input type="file" multiple className="hidden" onChange={handleFileChange} />
                                    <div className={`border-2 border-dashed rounded-3xl p-8 transition-all ${selectedFiles.length ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/20 hover:border-cyan-400/50'}`}>
                                        {selectedFiles.length ? (
                                            <div className="text-cyan-400 flex flex-col items-start gap-2 text-left">
                                                <DocumentTextIcon className="w-6 h-6" />
                                                <div className="text-white font-bold w-full max-h-36 overflow-y-auto custom-scrollbar">
                                                    {selectedFiles.map((f) => <div key={f.name} className="text-sm">{f.name}</div>)}
                                                </div>
                                                <span className="text-xs text-gray-400 mt-2">{selectedFiles.length} file được chọn</span>
                                            </div>
                                        ) : (
                                            <div className="text-gray-400 flex flex-col items-center">
                                                <CloudArrowUpIcon className="w-8 h-8 mb-2" />
                                                <span className="text-[10px] uppercase tracking-widest font-bold">Tải lên tài liệu (1-10 file)</span>
                                            </div>
                                        )}
                                    </div>
                                </label>


                                {!isAnalyzing ? (
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={!selectedFiles.length}
                                        className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 tracking-widest transition-all ${!selectedFiles.length ? 'bg-gray-800 text-gray-500' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02]'}`}
                                    >
                                        <ShieldCheckIcon className="w-5 h-5" /> THẨM ĐỊNH {selectedFiles.length > 1 ? 'HÀNG LOẠT' : 'NGAY'}
                                    </button>
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
                            <button onClick={() => { setSelectedFiles([]); setAnalysisResults(null); setCurrentFileIndex(0); }} className="w-full py-4 rounded-2xl border border-white/10 text-cyan-400 font-bold flex items-center justify-center gap-2">
                                <ArrowPathIcon className="w-5 h-5" /> THẨM ĐỊNH VĂN BẢN KHÁC
                            </button>
                        )}
                    </div>
                </div>

                {/* CỘT PHẢI - HIỂN THỊ KẾT QUẢ */}
                <div className="w-full md:w-7/12 relative min-h-[400px]">
                    {analysisResults && !isAnalyzing && (
                        <div className="animate-slideUp bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                            {/* Header kết quả */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-8 bg-cyan-500 rounded-full"></div>
                                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">
                                        Kết quả thẩm định
                                        {selectedFiles.length > 1 ? ` (${currentFileIndex + 1}/${selectedFiles.length})` : ''}
                                    </h3>
                                </div>

                                <button
                                    onClick={handleSaveCurrentAnalysisToHistory}
                                    disabled={isSaving || isSaved}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${isSaving || isSaved
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                                        : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                        }`}
                                >
                                    {isSaving ? (
                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    ) : isSaved ? (
                                        <CheckBadgeIcon className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                        <CheckBadgeIcon className="w-4 h-4" />
                                    )}
                                    {isSaving ? "ĐANG LƯU..." : isSaved ? "ĐÃ LƯU VÀO HỒ SƠ" : "LƯU VÀO HỒ SƠ"}
                                </button>
                            </div>

                            {/* HIỂN THỊ TỔNG QUAN BATCH (nếu có nhiều file) */}
                            {selectedFiles.length > 1 && analysisResults && (
                                <div className="mb-8 pb-8 border-b border-white/10">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                        <div className="relative w-40 h-40 flex-shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={chartDataBatchOverall} cx="50%" cy="50%" innerRadius={50} outerRadius={70} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                                                        {chartDataBatchOverall.map((entry, index) => (
                                                            <Cell key={`cell-overall-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className={`text-3xl font-black ${batchAvg >= 80 ? 'text-cyan-400' : 'text-red-500'}`}>{batchAvg}</span>
                                                <span className="text-[9px] text-gray-500 uppercase font-bold">ĐTB An toàn</span>
                                            </div>
                                        </div>
                                        <div className="flex-grow text-left">
                                            <h4 className="text-base font-bold text-white mb-1">Tóm tắt chung ({selectedFiles.length} file)</h4>
                                            <p className="text-gray-400 text-sm leading-relaxed">Điểm an toàn trung bình của các hợp đồng là {batchAvg}. Vui lòng xem chi tiết từng hợp đồng bên dưới.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* HIỂN THỊ KẾT QUẢ CỦA FILE HIỆN TẠI */}
                            {currentAnalysisData ? (
                                <>
                                    <div className="mb-8 border-b border-white/10 pb-8">
                                        {selectedFiles.length > 1 && (
                                            <div className="text-white text-sm font-bold mb-4 bg-white/5 rounded-lg p-3 truncate">
                                                <span className="text-gray-400">Đang xem: </span>{decodeUnicodeString(selectedFiles[currentFileIndex].name)}
                                            </div>
                                        )}
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
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
                                                    <span className={`text-4xl font-black ${(currentAnalysisData.risk_score ?? 0) >= 80 ? 'text-cyan-400' : 'text-red-500'}`}>{currentAnalysisData.risk_score ?? 0}</span>
                                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Điểm an toàn</span>
                                                </div>
                                            </div>
                                            <div className="flex-grow">
                                                <h3 className="text-xl font-bold text-white mb-2">Đánh giá tổng quan</h3>
                                                <p className="text-gray-400 text-sm leading-relaxed">{currentAnalysisData.summary ?? "Đang cập nhật..."}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {currentAnalysisData.risks && currentAnalysisData.risks.length > 0 ? (
                                            currentAnalysisData.risks.map((risk, index) => (
                                                <div key={index} className="bg-white/5 border border-white/5 rounded-2xl p-5">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="bg-white/10 text-gray-300 px-3 py-1 rounded-lg text-[11px] font-mono truncate max-w-[70%]">"{risk.clause}"</div>
                                                        {getSeverityBadge(risk.severity)}
                                                    </div>
                                                    <p className="text-gray-400 text-sm"><span className="text-red-400 font-bold">Vấn đề: </span>{risk.issue}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-400 text-center">Không tìm thấy rủi ro đáng kể nào.</p>
                                        )}
                                    </div>

                                    {/* Nút điều hướng cho Batch */}
                                    {selectedFiles.length > 1 && (
                                        <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                                            <button
                                                onClick={() => {
                                                    setCurrentFileIndex((prev) => Math.max(0, prev - 1));
                                                    setIsSaved(false); // Reset trạng thái lưu khi chuyển file
                                                }}
                                                disabled={currentFileIndex === 0}
                                                className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                &larr; Hợp đồng trước
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setCurrentFileIndex((prev) => Math.min(selectedFiles.length - 1, prev + 1));
                                                    setIsSaved(false); // Reset trạng thái lưu khi chuyển file
                                                }}
                                                disabled={currentFileIndex === selectedFiles.length - 1}
                                                className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Hợp đồng kế &rarr;
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-gray-400 text-center">Không có dữ liệu phân tích để hiển thị.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

}