import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    ArrowDownTrayIcon,
    ShareIcon,
    TrashIcon,
    CheckIcon
} from "@heroicons/react/24/outline";

export default function EditLegalRecord() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [record, setRecord] = useState(null);
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`http://localhost:8000/api/history/detail/${id}`);
                if (res.data?.success) {
                    const data = res.data.data;
                    setRecord(data);
                    const parsed = (() => {
                        try {
                            return JSON.parse(data.AnalysisJson || "{}");
                        } catch {
                            return {};
                        }
                    })();
                    const meta = parsed?.meta && typeof parsed.meta === "object" ? parsed.meta : {};
                    setTitle(meta.title ?? data.FileName ?? "");
                    setCategory(meta.category ?? "");
                    setDescription(meta.description ?? "");
                } else {
                    setRecord(null);
                }
            } catch (err) {
                console.error("Get detail error:", err);
                setRecord(null);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [id]);

    const handleCancel = () => {
        navigate(-1);
    };

    const handleShare = async () => {
        try {
            const url = `${window.location.origin}/ho-so/chi-tiet/${id}`;
            await navigator.clipboard.writeText(url);
            alert("Đã sao chép link hồ sơ vào bộ nhớ tạm!");
        } catch {
            alert("Lỗi khi sao chép link.");
        }
    };

    const handleDelete = async () => {
        if (!record) return;
        if (!window.confirm(`Đưa hồ sơ vào thùng rác (tự xóa sau 30 ngày): ${record.FileName}?`)) return;
        setDeleting(true);
        try {
            await axios.delete(`http://localhost:8000/api/history/delete/${record.Id}`);
            navigate("/ho-so-phap-ly");
        } catch (err) {
            console.error("Delete error:", err);
            alert("Xóa thất bại. Vui lòng thử lại.");
        } finally {
            setDeleting(false);
        }
    };

    const handleExportPdf = async () => {
        if (!record) return;
        setExporting(true);
        try {
            const res = await axios.post(
                `http://localhost:8000/api/history/export-pdf/${record.Id}`,
                {},
                { responseType: "blob" }
            );
            const blob = new Blob([res.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `LegAI_${record.Id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export error:", err);
            alert("Xuất PDF thất bại. Vui lòng thử lại.");
        } finally {
            setExporting(false);
        }
    };

    const handleUpdate = async () => {
        if (!title.trim()) return alert("Vui lòng nhập tiêu đề");
        setSaving(true);
        try {
            await axios.put(`http://localhost:8000/api/history/meta/${id}`, { title, category, description });
            alert("Đã lưu thay đổi!");
            navigate(`/ho-so/chi-tiet/${id}`);
        } catch (err) {
            console.error("Update error:", err);
            alert("Lỗi: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-500">Đang tải...</div>;
    if (!record) return <div className="min-h-screen bg-black text-white flex justify-center pt-20">Không tìm thấy hồ sơ</div>;

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            <main className="max-w-5xl mx-auto w-full px-6 py-10 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <button
                        onClick={handleCancel}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> Quay lại
                    </button>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleExportPdf}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-bold text-sm hover:scale-[1.02] transition disabled:opacity-60"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" /> {exporting ? "Đang xuất..." : "Xuất PDF"}
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300"
                        >
                            <ShareIcon className="w-4 h-4" /> Chia sẻ
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/15 border border-red-500/30 rounded-xl hover:bg-red-500/25 transition text-red-300 disabled:opacity-60"
                        >
                            <TrashIcon className="w-4 h-4" /> {deleting ? "Đang xóa..." : "Xóa"}
                        </button>
                    </div>
                </div>

                <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-white/10">
                        <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">Chỉnh sửa hồ sơ</div>
                        <div className="text-2xl font-black uppercase tracking-wide">{record.FileName}</div>
                    </div>

                    <div className="p-8 grid md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Tiêu đề</label>
                                <input
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Nhập tiêu đề hồ sơ"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Danh mục</label>
                                <input
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    placeholder="Ví dụ: Hợp đồng lao động"
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Mô tả</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all min-h-[172px] resize-none"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Nhập mô tả hồ sơ"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-8 border-t border-white/10 flex items-center justify-end gap-3">
                        <button
                            onClick={handleUpdate}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-sm uppercase tracking-widest hover:opacity-95 transition disabled:opacity-60"
                        >
                            <CheckIcon className="w-5 h-5" /> {saving ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
