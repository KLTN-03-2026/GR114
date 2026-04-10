import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowLeftIcon, 
    ShieldCheckIcon,
    ExclamationTriangleIcon, 
    DocumentTextIcon, 
    CalendarIcon
} from '@heroicons/react/24/outline';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function RecordDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState(null);

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

    // Dữ liệu biểu đồ
    const chartData = analysis ? [
        { name: 'An toàn', value: record?.RiskScore ?? 0, color: '#06b6d4' },
        { name: 'Rủi ro', value: 100 - (record?.RiskScore ?? 0), color: '#ef4444' }
    ] : [];

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-500">Đang tải...</div>;
    if (!record) return <div className="min-h-screen bg-black text-white flex justify-center pt-20">Không tìm thấy hồ sơ</div>;

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 relative">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

            <main className="max-w-5xl mx-auto w-full px-6 py-10 relative z-10">
                {/* Header chỉ còn nút Quay lại */}
                <div className="flex justify-start items-center mb-8">
                    <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-gray-300">
                        <ArrowLeftIcon className="w-4 h-4" /> Quay lại
                    </button>
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
                </div>
            </main>
        </div>
    );
}