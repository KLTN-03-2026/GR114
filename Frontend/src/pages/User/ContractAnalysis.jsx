import React, { useState } from 'react';
import Header from "../../components/PageHeader";
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

    // Hàm xử lý khi chọn file
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    // --- SỬA ĐỔI QUAN TRỌNG: GỬI FILE TRỰC TIẾP (KHÔNG DÙNG FILEREADER) ---
    const handleAnalyze = async () => {
        if (!file) return;

        setIsAnalyzing(true);
        try {
            // Gửi nguyên file (PDF/Word/Txt) xuống Backend để Backend tự xử lý
            const aiResult = await aiClient.analyzeContract(file);
            setResult(aiResult);
        } catch (error) {
            console.error("Lỗi phân tích:", error);
            alert("Có lỗi khi kết nối với LegAI. Vui lòng thử lại!");
        } finally {
            setIsAnalyzing(false);
        }
    };
    // -----------------------------------------------------------------------

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
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
            <Header />

            <main className="max-w-6xl mx-auto px-4 py-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900">
                        Thẩm định Hợp đồng AI
                    </h1>
                    <p className="text-slate-500 mt-3 font-medium text-lg">
                        Phát hiện rủi ro pháp lý trong vài giây với công nghệ Gemini 2.5
                    </p>
                </div>

                {!result && (
                    <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-fadeIn">
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <DocumentTextIcon className="w-10 h-10 text-slate-400" />
                            </div>

                            <h3 className="text-xl font-bold text-slate-800 mb-2">Tải lên bản hợp đồng của bạn</h3>
                            <p className="text-slate-500 text-sm mb-8">Hỗ trợ định dạng .txt, .pdf, .doc, .docx</p>

                            <label className="block w-full cursor-pointer group">
                                {/*  ĐÃ SỬA: Cho phép chọn nhiều loại file */}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".txt,.pdf,.doc,.docx"
                                    onChange={handleFileChange}
                                />
                                {/* --------------------------------------- */}

                                <div className={`border-2 border-dashed rounded-2xl p-8 transition-all ${file ? 'border-blue-500 bg-blue-50' : 'border-slate-300 group-hover:border-slate-400'}`}>
                                    {file ? (
                                        <div className="flex items-center justify-center gap-3 text-blue-600">
                                            <CheckBadgeIcon className="w-6 h-6" />
                                            <span className="font-bold">{file.name}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-400">
                                            <CloudArrowUpIcon className="w-8 h-8 mb-2" />
                                            <span className="font-medium">Nhấn để chọn file (PDF, Word, TXT)</span>
                                        </div>
                                    )}
                                </div>
                            </label>

                            <button
                                onClick={handleAnalyze}
                                disabled={!file || isAnalyzing}
                                className={`mt-8 w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                                    ${!file || isAnalyzing ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 active:scale-95'}
                                `}
                            >
                                {isAnalyzing ? (
                                    <>
                                        <ArrowPathIcon className="w-5 h-5 animate-spin" /> LegAI đang đọc và phân tích...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheckIcon className="w-5 h-5" /> BẮT ĐẦU THẨM ĐỊNH
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {result && (
                    <div className="animate-slideUp space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className={`p-8 rounded-3xl border-2 flex flex-col items-center justify-center text-center shadow-sm ${getScoreColor(result.risk_score)}`}>
                                <div className="text-6xl font-black mb-2">{result.risk_score}/100</div>
                                <div className="text-sm font-bold uppercase tracking-widest">Điểm an toàn pháp lý</div>
                                <div className="mt-4 px-4 py-1 bg-white/50 rounded-full text-xs font-bold">
                                    {result.risk_score < 50 ? "RỦI RO CAO" : result.risk_score < 80 ? "CẦN CÂN NHẮC" : "AN TOÀN"}
                                </div>
                            </div>

                            <div className="md:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-3">Tóm tắt hợp đồng</h3>
                                    <p className="text-slate-800 font-medium leading-relaxed">{result.summary}</p>
                                </div>
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <h3 className="font-bold text-blue-600 text-xs uppercase tracking-widest mb-2">💡 Lời khuyên của LegAI</h3>
                                    <p className="text-slate-600 text-sm italic whitespace-pre-line">
                                        {result.recommendation}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                                    Chi tiết các điều khoản rủi ro ({result.risks ? result.risks.length : 0})
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {result.risks && result.risks.map((risk, index) => (
                                    <div key={index} className="p-6 hover:bg-slate-50 transition-colors group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-mono font-bold max-w-[80%] truncate">
                                                "{risk.clause}"
                                            </div>
                                            {getSeverityBadge(risk.severity)}
                                        </div>
                                        <p className="text-slate-700 text-sm leading-relaxed">
                                            <span className="font-bold text-red-500">Vấn đề: </span>
                                            {risk.issue}
                                        </p>
                                    </div>
                                ))}
                                {result.risks && result.risks.length === 0 && (
                                    <div className="p-12 text-center text-slate-400">
                                        <CheckBadgeIcon className="w-16 h-16 mx-auto mb-4 text-green-500" />
                                        <p>Tuyệt vời! Không tìm thấy rủi ro pháp lý rõ ràng nào.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="text-center">
                            <button
                                onClick={() => { setFile(null); setResult(null); }}
                                className="text-slate-400 hover:text-slate-900 font-bold text-sm underline underline-offset-4"
                            >
                                Phân tích hợp đồng khác
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}