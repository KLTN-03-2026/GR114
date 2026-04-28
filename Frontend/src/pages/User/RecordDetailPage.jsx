import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowLeftIcon, 
    ShieldCheckIcon,
    ExclamationTriangleIcon, 
    DocumentTextIcon, 
    CalendarIcon,
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    ShareIcon,
    PencilSquareIcon,
    TrashIcon,
    PencilIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function RecordDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState(null);
    const [isSignOpen, setIsSignOpen] = useState(false);
    const [activeSigner, setActiveSigner] = useState('A');
    const [signatureA, setSignatureA] = useState(null);
    const [signatureB, setSignatureB] = useState(null);
    const [pagesImages, setPagesImages] = useState([]);
    const [signaturePlacement, setSignaturePlacement] = useState(null);
    const [placementModeSigner, setPlacementModeSigner] = useState(null);
    const [selectedPlacementPageIndex, setSelectedPlacementPageIndex] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);
    const canvasRef = React.useRef(null);
    const isDrawingRef = React.useRef(false);
    const signatureSectionRef = React.useRef(null);
    const signatureUploadARef = React.useRef(null);
    const signatureUploadBRef = React.useRef(null);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                // Gọi API lấy dữ liệu thật
                const res = await axios.get(`http://localhost:8000/api/history/detail/${id}`);
                if (res.data && res.data.success) {
                    const data = res.data.data;
                    setRecord(data);
                    
                    // Parse nội dung JSON AI trả về từ SQL
                    try {
                        const parsedContent = JSON.parse(data.AnalysisJson || '{}');
                        setAnalysis(parsedContent);
                        const meta = parsedContent?.meta && typeof parsedContent.meta === 'object' ? parsedContent.meta : {};
                        const sigA = meta.signatureADataUrl ?? null;
                        const sigB = meta.signatureBDataUrl ?? null;
                        setSignatureA(sigA);
                        setSignatureB(sigB);
                        const nextPagesImages = Array.isArray(meta.pagesImages) ? meta.pagesImages : [];
                        setPagesImages(nextPagesImages);
                        const nextPlacement = meta.signaturePlacement && typeof meta.signaturePlacement === 'object' ? meta.signaturePlacement : null;
                        setSignaturePlacement(nextPlacement);
                        const defaultPageIndex = Math.max(0, nextPagesImages.length - 1);
                        const pageIndex = typeof nextPlacement?.pageIndex === 'number' ? Math.max(0, Math.floor(nextPlacement.pageIndex)) : defaultPageIndex;
                        setSelectedPlacementPageIndex(pageIndex);
                    } catch (e) {
                        console.error("Lỗi đọc dữ liệu JSON:", e);
                    }
                }
            } catch (error) {
                console.error("Lỗi:", error);
                alert("Không thể tải hồ sơ này.");
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [id]);

    const handleBack = () => navigate(-1);

    const handleShare = async () => {
        try {
            const url = `${window.location.origin}/ho-so/chi-tiet/${id}`;
            await navigator.clipboard.writeText(url);
            alert('Đã sao chép link hồ sơ vào bộ nhớ tạm!');
        } catch {
            alert('Lỗi khi sao chép link.');
        }
    };

    const handleDelete = async () => {
        if (!record) return;
        if (!window.confirm(`Đưa hồ sơ vào thùng rác (tự xóa sau 30 ngày): ${record.FileName}?`)) return;
        setIsDeleting(true);
        try {
            await axios.delete(`http://localhost:8000/api/history/delete/${record.Id}`);
            navigate('/ho-so-phap-ly');
        } catch (err) {
            console.error('Delete error', err);
            alert('Xóa thất bại. Vui lòng thử lại.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleExportPdf = async () => {
        if (!record) return;
        setIsExporting(true);
        try {
            const res = await axios.post(
                `http://localhost:8000/api/history/export-pdf/${record.Id}`,
                {
                    signatureADataUrl: signatureA,
                    signatureBDataUrl: signatureB
                },
                { responseType: 'blob' }
            );

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `LegAI_${record.Id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export error', err);
            try {
                const data = err?.response?.data;
                if (data instanceof Blob) {
                    const text = await data.text();
                    const parsed = JSON.parse(text);
                    const message = parsed?.message;
                    if (message) {
                        alert(message);
                        return;
                    }
                }
            } catch {
            }
            const serverMessage = err?.response?.data?.message || err?.message;
            alert(serverMessage ? `Xuất PDF thất bại: ${serverMessage}` : 'Xuất PDF thất bại. Vui lòng thử lại.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleScrollToSignatures = () => {
        signatureSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const getDefaultSignaturePlacement = (pageCount) => ({
        pageIndex: Math.max(0, (pageCount || 1) - 1),
        a: { x: 0.14, y: 0.70, w: 0.30, h: 0.12 },
        b: { x: 0.56, y: 0.70, w: 0.30, h: 0.12 }
    });

    const persistSignatures = async (nextA, nextB) => {
        if (!record) return;
        setIsSavingSignature(true);
        try {
            const payload = {};
            if (typeof nextA === 'string') payload.signatureADataUrl = nextA;
            if (typeof nextB === 'string') payload.signatureBDataUrl = nextB;
            await axios.put(`http://localhost:8000/api/history/signatures/${record.Id}`, payload);
            setSignatureA(nextA);
            setSignatureB(nextB);
            return true;
        } catch (err) {
            console.error('Save signature error', err);
            alert('Lưu chữ ký thất bại. Vui lòng thử lại.');
            return false;
        } finally {
            setIsSavingSignature(false);
        }
    };

    const persistSignaturePlacement = async (nextPlacement) => {
        if (!record) return false;
        try {
            await axios.put(`http://localhost:8000/api/history/meta/${record.Id}`, {
                signaturePlacement: nextPlacement
            });
            setSignaturePlacement(nextPlacement);
            return true;
        } catch (err) {
            console.error('Save placement error', err);
            alert('Lưu vị trí ký thất bại. Vui lòng thử lại.');
            return false;
        }
    };

    const getPlacementForRender = () => {
        if (signaturePlacement && typeof signaturePlacement === 'object') return signaturePlacement;
        if (!pagesImages.length) return null;
        return getDefaultSignaturePlacement(pagesImages.length);
    };

    const clamp01 = (n) => Math.max(0, Math.min(1, n));

    const handleChangePlacementPage = async (nextIndex) => {
        if (!pagesImages.length) return;
        const idx = Math.max(0, Math.min(pagesImages.length - 1, Number(nextIndex) || 0));
        setSelectedPlacementPageIndex(idx);
        const base = getPlacementForRender();
        if (!base) return;
        const nextPlacement = { ...base, pageIndex: idx };
        setSignaturePlacement(nextPlacement);
        await persistSignaturePlacement(nextPlacement);
    };

    const handleContractImageClick = async (e) => {
        if (!pagesImages.length) return;
        if (!placementModeSigner) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = clamp01((e.clientX - rect.left) / rect.width);
        const y = clamp01((e.clientY - rect.top) / rect.height);
        const base = getPlacementForRender();
        if (!base) return;

        const key = placementModeSigner === 'A' ? 'a' : 'b';
        const w = base?.[key]?.w ?? 0.30;
        const h = base?.[key]?.h ?? 0.12;
        const nextX = clamp01(Math.min(1 - w, x - w / 2));
        const nextY = clamp01(Math.min(1 - h, y - h / 2));

        const nextPlacement = {
            ...base,
            pageIndex: selectedPlacementPageIndex,
            [key]: { x: nextX, y: nextY, w, h }
        };

        setSignaturePlacement(nextPlacement);
        await persistSignaturePlacement(nextPlacement);
        setPlacementModeSigner(null);
    };

    const convertImageFileToPngDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Không đọc được ảnh chữ ký.'));
            img.src = reader.result;
        };
        reader.onerror = () => reject(new Error('Không đọc được file.'));
        reader.readAsDataURL(file);
    });

    const handleUploadSignatureClick = (signer) => {
        if (signer === 'A') signatureUploadARef.current?.click();
        else signatureUploadBRef.current?.click();
    };

    const handleSignatureUpload = async (signer, event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Chỉ hỗ trợ file ảnh chữ ký.');
            return;
        }

        try {
            const dataUrl = await convertImageFileToPngDataUrl(file);
            const nextA = signer === 'A' ? dataUrl : signatureA;
            const nextB = signer === 'B' ? dataUrl : signatureB;
            await persistSignatures(nextA, nextB);
        } catch (err) {
            console.error('Upload signature error', err);
            alert(err.message || 'Tải ảnh chữ ký thất bại.');
        }
    };

    const openSignPad = (signer) => {
        setActiveSigner(signer);
        setIsSignOpen(true);
        setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ratio = window.devicePixelRatio || 1;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            canvas.width = Math.floor(width * ratio);
            canvas.height = Math.floor(height * ratio);
            const ctx = canvas.getContext('2d');
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#0f172a';
        }, 0);
    };

    const closeSignPad = () => {
        setIsSignOpen(false);
        isDrawingRef.current = false;
    };

    const getCanvasPoint = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const onPointerDown = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(e.pointerId);
        const ctx = canvas.getContext('2d');
        const p = getCanvasPoint(e);
        if (!p) return;
        isDrawingRef.current = true;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    };

    const onPointerMove = (e) => {
        if (!isDrawingRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const p = getCanvasPoint(e);
        if (!p) return;
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };

    const onPointerUp = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            canvas.releasePointerCapture(e.pointerId);
        } catch {
        }
        isDrawingRef.current = false;
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    };

    const saveSignature = async () => {
        const canvas = canvasRef.current;
        if (!canvas || !record) return;
        const dataUrl = canvas.toDataURL('image/png');
        const nextA = activeSigner === 'A' ? dataUrl : signatureA;
        const nextB = activeSigner === 'B' ? dataUrl : signatureB;
        const saved = await persistSignatures(nextA, nextB);
        if (saved) {
            closeSignPad();
        }
    };

    // Dữ liệu biểu đồ
    const chartData = analysis ? [
        { name: 'An toàn', value: record?.RiskScore ?? 0, color: '#06b6d4' },
        { name: 'Rủi ro', value: 100 - (record?.RiskScore ?? 0), color: '#ef4444' }
    ] : [];

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-500">Đang tải...</div>;
    if (!record) return <div className="min-h-screen bg-black text-white flex justify-center pt-20">Không tìm thấy hồ sơ</div>;

    const contractText = record.ContractText || record.AnalysisText || "";

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 relative">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

            <main className="max-w-5xl mx-auto w-full px-6 py-10 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300">
                        <ArrowLeftIcon className="w-4 h-4" /> Quay lại
                    </button>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleExportPdf}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-bold text-sm hover:scale-[1.02] transition disabled:opacity-60"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" /> {isExporting ? "Đang xuất..." : "Xuất PDF"}
                        </button>
                        <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300">
                            <ShareIcon className="w-4 h-4" /> Chia sẻ
                        </button>
                        <button onClick={handleScrollToSignatures} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 transition text-cyan-300">
                            <PencilIcon className="w-4 h-4" /> Mở vùng ký
                        </button>
                        <button onClick={() => navigate(`/ho-so/chinh-sua/${record.Id}`)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300">
                            <PencilSquareIcon className="w-4 h-4" /> Chỉnh sửa
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/15 border border-red-500/30 rounded-xl hover:bg-red-500/25 transition text-red-300 disabled:opacity-60"
                        >
                            <TrashIcon className="w-4 h-4" /> {isDeleting ? "Đang xóa..." : "Xóa"}
                        </button>
                    </div>
                </div>

                <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                <DocumentTextIcon className="w-10 h-10 text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white uppercase tracking-wide">{record.FileName}</h1>
                                <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4" /> 
                                    {new Date(record.CreatedAt).toLocaleString('vi-VN')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 px-5 py-3 rounded-2xl border border-white/5">
                            <div className={`text-3xl font-black ${record.RiskScore >= 80 ? 'text-green-400' : 'text-red-500'}`}>
                                {record.RiskScore}/100
                            </div>
                            <div className="text-xs text-gray-400 uppercase font-bold">Điểm<br/>An toàn</div>
                        </div>
                    </div>

                    <div className="p-8 grid md:grid-cols-3 gap-8">
                        <div className="md:col-span-1 space-y-6">
                            <div className="bg-black/40 rounded-2xl p-6 border border-white/5 flex flex-col items-center">
                                <div className="h-40 w-40 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={chartData} innerRadius={50} outerRadius={70} dataKey="value" stroke="none">
                                                {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <ShieldCheckIcon className="w-8 h-8 text-gray-500 opacity-50" />
                                    </div>
                                </div>
                                <p className="text-center text-sm text-gray-400 mt-2 font-bold uppercase">Biểu đồ rủi ro</p>
                            </div>
                            <div className="bg-blue-900/10 rounded-2xl p-6 border border-blue-500/20">
                                <h3 className="text-cyan-400 font-bold mb-2 uppercase text-xs tracking-widest">Tóm tắt AI</h3>
                                <p className="text-gray-300 text-sm leading-relaxed">
                                    {analysis?.summary || "Không có bản tóm tắt nội dung."}
                                </p>
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <h3 className="text-white font-bold mb-6 flex items-center gap-2 uppercase tracking-widest text-sm">
                                <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
                                Chi tiết các điều khoản cần lưu ý
                            </h3>
                            <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                {analysis?.risks && analysis.risks.length > 0 ? (
                                    analysis.risks.map((risk, index) => (
                                        <div key={index} className="bg-white/5 border border-white/5 rounded-xl p-5 hover:bg-white/10 transition">
                                            <div className="flex justify-between items-start gap-4 mb-2">
                                                <span className="bg-white/10 text-gray-300 px-2 py-1 rounded text-[10px] font-mono border border-white/5">
                                                    Khoản mục: {risk.clause || "N/A"}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border 
                                                    ${risk.severity?.toLowerCase() === 'high' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 
                                                      risk.severity?.toLowerCase() === 'medium' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' : 
                                                      'bg-blue-500/20 text-blue-500 border-blue-500/30'}`}>
                                                    {risk.severity || "Lưu ý"}
                                                </span>
                                            </div>
                                            <p className="text-gray-300 text-sm">
                                                <span className="text-red-400 font-bold">Vấn đề: </span> {risk.issue}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-500 italic border-2 border-dashed border-white/10 rounded-xl">
                                        Không phát hiện rủi ro nghiêm trọng nào.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div ref={signatureSectionRef} className="p-8 border-t border-white/10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                            <h3 className="text-white font-bold flex items-center gap-2 uppercase tracking-widest text-sm">
                                <DocumentTextIcon className="w-5 h-5 text-cyan-400" />
                                Nội dung hợp đồng
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={() => openSignPad('A')} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300">
                                    <PencilIcon className="w-4 h-4" /> Ký tên (Bên A)
                                </button>
                                <button onClick={() => handleUploadSignatureClick('A')} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300">
                                    <ArrowUpTrayIcon className="w-4 h-4" /> Tải ảnh ký (Bên A)
                                </button>
                                <button onClick={() => openSignPad('B')} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300">
                                    <PencilIcon className="w-4 h-4" /> Ký tên (Bên B)
                                </button>
                                <button onClick={() => handleUploadSignatureClick('B')} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300">
                                    <ArrowUpTrayIcon className="w-4 h-4" /> Tải ảnh ký (Bên B)
                                </button>
                            </div>
                        </div>

                        <div className="mb-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
                            <div className="text-sm font-bold text-cyan-300">Khu vực ký điện tử</div>
                            <div className="text-sm text-gray-300 mt-1">
                                Bạn có thể vẽ trực tiếp trên Canvas hoặc tải ảnh chữ ký từ máy lên. Hệ thống sẽ chuyển ảnh sang PNG, lưu vào hồ sơ và tự gắn vào file PDF khi xuất.
                            </div>
                        </div>

                        <input
                            ref={signatureUploadARef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleSignatureUpload('A', event)}
                        />
                        <input
                            ref={signatureUploadBRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleSignatureUpload('B', event)}
                        />

                        {pagesImages.length ? (
                            <div className="bg-black/40 rounded-2xl border border-white/5 p-5">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">Trang</div>
                                        <select
                                            value={selectedPlacementPageIndex}
                                            onChange={(e) => handleChangePlacementPage(e.target.value)}
                                            className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none"
                                        >
                                            {pagesImages.map((_, idx) => (
                                                <option key={idx} value={idx}>Trang {idx + 1}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => setPlacementModeSigner('A')}
                                            className={`px-4 py-2 rounded-xl border text-sm font-bold transition ${placementModeSigner === 'A' ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40' : 'bg-white/5 text-gray-200 border-white/10 hover:bg-white/10'}`}
                                        >
                                            Đặt vị trí Bên A
                                        </button>
                                        <button
                                            onClick={() => setPlacementModeSigner('B')}
                                            className={`px-4 py-2 rounded-xl border text-sm font-bold transition ${placementModeSigner === 'B' ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40' : 'bg-white/5 text-gray-200 border-white/10 hover:bg-white/10'}`}
                                        >
                                            Đặt vị trí Bên B
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!pagesImages.length) return;
                                                const next = getDefaultSignaturePlacement(pagesImages.length);
                                                setSelectedPlacementPageIndex(next.pageIndex);
                                                await persistSignaturePlacement(next);
                                            }}
                                            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 transition text-sm font-bold"
                                        >
                                            Reset vị trí
                                        </button>
                                    </div>
                                </div>

                                {placementModeSigner && (
                                    <div className="mb-3 text-sm text-cyan-200">
                                        Chạm vào trang để đặt vị trí ký {placementModeSigner === 'A' ? 'Bên A' : 'Bên B'}.
                                    </div>
                                )}

                                {(() => {
                                    const placement = getPlacementForRender();
                                    const showOverlay = Boolean(placement) && Number(placement.pageIndex) === Number(selectedPlacementPageIndex);
                                    const aBox = placement?.a;
                                    const bBox = placement?.b;

                                    return (
                                        <div className="rounded-2xl overflow-hidden border border-white/10 bg-white">
                                            <div className="relative w-full" onClick={handleContractImageClick}>
                                                <img
                                                    src={pagesImages[selectedPlacementPageIndex]}
                                                    alt={`Trang ${selectedPlacementPageIndex + 1}`}
                                                    className="w-full h-auto block"
                                                />

                                                {showOverlay && aBox && (
                                                    <div
                                                        className="absolute border-2 border-dashed border-cyan-500/80 bg-cyan-500/10 rounded-xl overflow-hidden"
                                                        style={{ left: `${aBox.x * 100}%`, top: `${aBox.y * 100}%`, width: `${aBox.w * 100}%`, height: `${aBox.h * 100}%` }}
                                                    >
                                                        {signatureA ? (
                                                            <img src={signatureA} alt="Signature A" className="w-full h-full object-contain" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-cyan-700">BÊN A</div>
                                                        )}
                                                    </div>
                                                )}

                                                {showOverlay && bBox && (
                                                    <div
                                                        className="absolute border-2 border-dashed border-cyan-500/80 bg-cyan-500/10 rounded-xl overflow-hidden"
                                                        style={{ left: `${bBox.x * 100}%`, top: `${bBox.y * 100}%`, width: `${bBox.w * 100}%`, height: `${bBox.h * 100}%` }}
                                                    >
                                                        {signatureB ? (
                                                            <img src={signatureB} alt="Signature B" className="w-full h-full object-contain" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-cyan-700">BÊN B</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="bg-black/40 rounded-2xl border border-white/5 p-6 max-h-[520px] overflow-y-auto custom-scrollbar whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
                                {contractText ? contractText : "Chưa có nội dung hợp đồng được lưu trong hồ sơ này."}
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-6 mt-6">
                            <div className="bg-black/40 rounded-2xl border border-white/5 p-5">
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3">Chữ ký Bên A</div>
                                {signatureA ? (
                                    <img src={signatureA} alt="Signature A" className="max-h-[120px] w-full object-contain bg-white rounded-xl p-2" />
                                ) : (
                                    <div className="h-[120px] border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-gray-500 uppercase tracking-widest">
                                        Chưa có chữ ký
                                    </div>
                                )}
                            </div>
                            <div className="bg-black/40 rounded-2xl border border-white/5 p-5">
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3">Chữ ký Bên B</div>
                                {signatureB ? (
                                    <img src={signatureB} alt="Signature B" className="max-h-[120px] w-full object-contain bg-white rounded-xl p-2" />
                                ) : (
                                    <div className="h-[120px] border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-gray-500 uppercase tracking-widest">
                                        Chưa có chữ ký
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {isSignOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-black/70" onClick={closeSignPad} />
                    <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div className="font-black text-gray-900 uppercase tracking-widest text-sm">
                                Bảng ký tên • {activeSigner === 'A' ? 'Bên A' : 'Bên B'}
                            </div>
                            <button onClick={closeSignPad} className="p-2 rounded-xl hover:bg-gray-100 transition">
                                <XMarkIcon className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 overflow-hidden">
                                <div className="h-[260px]">
                                    <canvas
                                        ref={canvasRef}
                                        className="w-full h-full"
                                        style={{ touchAction: 'none' }}
                                        onPointerDown={onPointerDown}
                                        onPointerMove={onPointerMove}
                                        onPointerUp={onPointerUp}
                                        onPointerCancel={onPointerUp}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
                                <button onClick={clearSignature} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition">
                                    Xóa nét ký
                                </button>
                                <div className="flex items-center gap-3">
                                    <button onClick={closeSignPad} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition">
                                        Hủy
                                    </button>
                                    <button onClick={saveSignature} disabled={isSavingSignature} className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-sm uppercase tracking-widest hover:opacity-95 transition disabled:opacity-60">
                                        {isSavingSignature ? 'Đang lưu...' : 'Lưu chữ ký'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
