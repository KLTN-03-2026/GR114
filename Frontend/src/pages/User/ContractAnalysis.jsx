import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);

    // Quản lý dòng text log của AI
    const [statusIndex, setStatusIndex] = useState(0);
    const aiStatuses = [
        "Đang khởi tạo LegAI Engine...",
        "Đang đọc hiểu ngữ cảnh văn bản...",
        "Trích xuất các điều khoản trọng yếu...",
        "Đang đối chiếu quy định pháp luật lao động...",
        "Phân tích rủi ro và khuyến nghị...",
        "Đang tổng hợp báo cáo cuối cùng..."
    ];

    const convertImageFileToJpegDataUrl = (file, opts = {}) => new Promise((resolve, reject) => {
        const { maxWidth = 1240, quality = 0.82 } = opts;
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / (img.naturalWidth || img.width || 1));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
                canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('Không đọc được ảnh.'));
            img.src = reader.result;
        };
        reader.onerror = () => reject(new Error('Không đọc được file.'));
        reader.readAsDataURL(file);
    });

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Không đọc được file.'));
        reader.readAsDataURL(file);
    });

    // 1. LOGIC MỚI: Kiểm tra đuôi file (hỗ trợ nhiều ảnh)
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        if (selectedFiles.length > 30) {
            alert("Tối đa 30 ảnh/lần.");
            e.target.value = '';
            return;
        }

        const exts = selectedFiles.map((f) => (f.name.split('.').pop() || '').toLowerCase());
        const isAllImages = selectedFiles.every((f) => f.type && f.type.startsWith('image/'));

        if (selectedFiles.length > 1 && !isAllImages) {
            alert("Nếu chọn nhiều file, chỉ hỗ trợ nhiều ảnh (png/jpg/jpeg/webp).");
            e.target.value = '';
            return;
        }

        const allowedExts = ['pdf', 'txt', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp'];
        const ok = exts.every((ext) => allowedExts.includes(ext));
        if (!ok) {
            alert("Vui lòng chọn file văn bản/ảnh (.pdf, .txt, .docx, .png, .jpg, .jpeg, .webp)");
            e.target.value = '';
            return;
        }

        setFiles(selectedFiles);
    };

    // 2. LOGIC MỚI: Phân tích xong -> Tự động LƯU VÀO SQL
    const handleAnalyze = async () => {
        if (!files.length) return;
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
            const aiResult = await aiClient.analyzeContract(files.length === 1 ? files[0] : files);
            const analysis = aiResult?.data ?? aiResult;

            setProgress(100);

            // Hiện kết quả sau 0.5s
            setTimeout(async () => {
                setResult(analysis);

                // --- BẮT ĐẦU ĐOẠN LƯU VÀO CSDL ---
                try {
                    const userStr = localStorage.getItem("user");
                    const user = userStr ? JSON.parse(userStr) : null;
                    const userId = user?.id ?? user?.Id ?? user?.ID ?? 1;
                    const riskScore = analysis?.risk_score ?? analysis?.riskScore ?? 0;
                    const contractText = analysis?.contract_text ?? null;
                    const analysisJson = (() => {
                        if (!analysis || typeof analysis !== "object") return analysis;
                        const { contract_text, ...rest } = analysis;
                        return rest;
                    })();

                    const isImageBatch = files.every((f) => f.type && f.type.startsWith('image/'));
                    const pagesImages = isImageBatch
                        ? await Promise.all(files.map((f) => convertImageFileToJpegDataUrl(f)))
                        : null;

                    const singleFile = !isImageBatch && files.length === 1 ? files[0] : null;
                    const isSinglePdfOrDocx = Boolean(singleFile) && (
                        (singleFile.type === 'application/pdf') ||
                        (singleFile.type === 'application/msword') ||
                        (singleFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
                        (String(singleFile.name || '').toLowerCase().endsWith('.pdf')) ||
                        (String(singleFile.name || '').toLowerCase().endsWith('.doc')) ||
                        (String(singleFile.name || '').toLowerCase().endsWith('.docx'))
                    );
                    const originalFileDataUrl = isSinglePdfOrDocx ? await readFileAsDataUrl(singleFile) : null;

                    const signaturePlacement = isImageBatch ? {
                        pageIndex: Math.max(0, pagesImages.length - 1),
                        a: { x: 0.14, y: 0.70, w: 0.30, h: 0.12 },
                        b: { x: 0.56, y: 0.70, w: 0.30, h: 0.12 }
                    } : undefined;

                    const fileName = isImageBatch
                        ? `Ảnh hợp đồng (${files.length} trang)`
                        : files[0].name;

                    const payload = {
                        userId,
                        fileName,
                        originalFileName: fileName,
                        riskScore,
                        contractText,
                        content: JSON.stringify(analysisJson),
                        meta: {
                            ...(isImageBatch ? {
                                pagesImages,
                                pagesOriginalNames: files.map((f) => f.name),
                                signaturePlacement
                            } : {}),
                            ...(originalFileDataUrl ? {
                                originalFileDataUrl,
                                originalFileMimeType: singleFile?.type || null,
                                originalFileName: singleFile?.name || null
                            } : {})
                        }
                    };

                    const saveRes = await axios.post('http://localhost:8000/api/history/save', payload);
                    const savedId = saveRes?.data?.analysis?.Id ?? saveRes?.data?.analysis?.id;
                    if (savedId) {
                        navigate(`/ho-so/chi-tiet/${savedId}`);
                    } else {
                        alert("✅ Kết quả đã được lưu vào Hồ sơ pháp lý!");
                    }
                } catch (saveErr) {
                    console.error("Lỗi lưu SQL:", saveErr);
                }
                // --- KẾT THÚC ĐOẠN LƯU ---
            }, 500);

        } catch (error) {
            console.error("Lỗi phân tích:", error);
            const serverMessage = error?.response?.data?.message || error?.response?.data?.error;
            alert(serverMessage ? `LegAI báo lỗi: ${serverMessage}` : "Có lỗi khi kết nối với LegAI. Vui lòng thử lại!");
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
                                        <input type="file" className="hidden" multiple accept=".txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={handleFileChange} />
                                        <div className={`border-2 border-dashed rounded-3xl p-8 transition-all duration-500 
                                            ${files.length ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/20 group-hover/label:border-cyan-400/50 group-hover/label:bg-white/5'}`}>
                                            {files.length ? (
                                                <div className="flex flex-col items-center gap-2 text-cyan-400">
                                                    <CheckBadgeIcon className="w-10 h-10 animate-bounce" />
                                                    <span className="font-bold text-sm truncate max-w-[240px] text-white">
                                                        {files.length === 1 ? files[0].name : `${files.length} ảnh (trang)`}
                                                    </span>
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
                                        disabled={!files.length || isAnalyzing}
                                        className={`mt-8 w-full py-4 rounded-2xl font-black text-white transition-all flex items-center justify-center gap-3 text-base tracking-widest
                                            ${!files.length || isAnalyzing ? 'bg-gray-800 cursor-not-allowed text-gray-500' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/20'}
                                        `}
                                    >
                                        {isAnalyzing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ShieldCheckIcon className="w-5 h-5" />}
                                        {isAnalyzing ? "ĐANG PHÂN TÍCH..." : "THẨM ĐỊNH NGAY"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => { setFiles([]); setResult(null); }}
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
