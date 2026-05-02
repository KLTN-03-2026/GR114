import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    ArrowLeftIcon,
    CalendarIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    PencilSquareIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import {
    getTypeConfig,
    normalizeRecord,
    parseAnalysisJson,
    renderRecordBadge
} from '../../utils/legalRecordUtils';
import { getMockDetailResponse, USE_MOCK_DATA } from '../../mockData/legalRecordsMock';

export default function RecordDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(true);

    console.log('Current Record Data:', record);

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            try {
                let res;
                
                // Sử dụng mock data nếu USE_MOCK_DATA = true
                if (USE_MOCK_DATA) {
                    console.log('🔍 Sử dụng MOCK DATA cho ID:', id);
                    res = { data: getMockDetailResponse(id) };
                } else {
                    // Gọi API thực tế
                    const token = localStorage.getItem('accessToken');
                    res = await axios.get(`http://localhost:8000/api/history/detail/${id}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                }

                if (res.data?.success) {
                    setRecord(normalizeRecord(res.data.data));
                } else {
                    toast.error(res.data?.message || 'Không thể tải hồ sơ.');
                }
            } catch (error) {
                console.error('Fetch record detail error:', error);
                toast.error(error.response?.data?.message || 'Không thể tải hồ sơ này.');
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [id]);

    const safeRecord = useMemo(() => normalizeRecord(record || {}), [record]);
    const analysis = useMemo(() => parseAnalysisJson(safeRecord.analysisJson), [safeRecord.analysisJson]);
    const config = getTypeConfig(safeRecord.type);
    const score = Number(safeRecord.riskScore || 0);
    const chartData = [
        { name: 'An toàn', value: score, color: '#10b981' },
        { name: 'Rủi ro', value: Math.max(100 - score, 0), color: '#ef4444' }
    ];

    const detailRows = [
        ['Mã hồ sơ', safeRecord.id || 'N/A'],
        ['Tên hồ sơ', safeRecord.name],
        ['Loại hồ sơ', safeRecord.type || 'N/A'],
        ['Ngày tạo', safeRecord.createdAt ? new Date(safeRecord.createdAt).toLocaleString('vi-VN') : safeRecord.date],
        ['Tên file', safeRecord.fileName || 'Không có file'],
        ['Mô tả', safeRecord.description || 'Chưa có mô tả']
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center text-[#B8985D] font-black uppercase tracking-widest">
                Đang tải hồ sơ...
            </div>
        );
    }

    if (!record) {
        return (
            <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center gap-4 text-[#1A2530]">
                <DocumentTextIcon className="h-14 w-14 text-zinc-300 stroke-1" />
                <p className="font-bold">Không tìm thấy hồ sơ.</p>
                <button onClick={() => navigate('/ho-so-phap-ly')} className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-600 shadow-sm hover:text-[#B8985D]">
                    Quay lại danh sách
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9fa] text-[#1A2530] relative overflow-x-hidden selection:bg-[#B8985D]/30 selection:text-[#1A2530]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#B8985D]/5 rounded-full blur-[120px] -z-10"></div>

            <main className="max-w-6xl mx-auto w-full px-6 py-24 relative z-10">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={() => navigate(-1)} className="w-fit px-6 py-3 bg-white border border-zinc-200 rounded-xl text-zinc-600 font-bold text-sm flex items-center gap-2 hover:bg-zinc-50 hover:text-[#1A2530] transition-colors shadow-sm">
                        <ArrowLeftIcon className="w-4 h-4 stroke-2" /> Quay lại
                    </button>
                    <button onClick={() => navigate(`/ho-so/chinh-sua/${safeRecord.id}`)} className="w-fit px-6 py-3 bg-[#1A2530] border border-[#1A2530] rounded-xl text-white font-bold text-sm flex items-center gap-2 hover:bg-[#263442] transition-colors shadow-sm">
                        <PencilSquareIcon className="w-4 h-4 stroke-2" /> Chỉnh sửa
                    </button>
                </div>

                <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl">
                    <div className="border-b border-zinc-100 p-8">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-5">
                                <div className={`rounded-2xl border border-zinc-100 p-4 shadow-sm ${config.bgColor}`}>
                                    {config.icon}
                                </div>
                                <div>
                                    <div className="mb-3 flex flex-wrap items-center gap-3">
                                        {renderRecordBadge(safeRecord)}
                                        <span className="inline-flex items-center gap-2 rounded-md border border-[#B8985D]/30 bg-[#B8985D]/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#8E6D45]">
                                            <CalendarIcon className="h-3.5 w-3.5 stroke-2" /> {safeRecord.date}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wide text-[#1A2530]">
                                        {safeRecord.name}
                                    </h1>
                                    <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-zinc-500">
                                        {safeRecord.description || analysis?.summary || 'Hồ sơ chưa có mô tả chi tiết.'}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-4 text-center shadow-inner">
                                <div className={`text-4xl font-black ${score >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{score}</div>
                                <div className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Điểm an toàn</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-8 p-8 lg:grid-cols-3">
                        <aside className="space-y-6">
                            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                                <div className="mx-auto h-44 w-44">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={chartData} innerRadius={58} outerRadius={78} dataKey="value" stroke="none">
                                                {chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-2 flex items-center justify-center gap-2 text-sm font-bold text-zinc-500">
                                    <ShieldCheckIcon className="h-5 w-5 text-[#B8985D] stroke-2" /> Biểu đồ rủi ro
                                </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                                <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-[#B8985D]">Thông tin hồ sơ</h3>
                                <div className="space-y-3">
                                    {detailRows.map(([label, value]) => (
                                        <div key={label} className="border-b border-zinc-200/70 pb-3 last:border-b-0 last:pb-0">
                                            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
                                            <p className="mt-1 break-words text-sm font-semibold text-[#1A2530]">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </aside>

                        <section className="lg:col-span-2">
                            <div className="mb-5 flex items-center gap-2">
                                <ExclamationTriangleIcon className="h-5 w-5 text-orange-500 stroke-2" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">Chi tiết phân tích</h2>
                            </div>

                            <div className="space-y-4">
                                {Array.isArray(analysis?.risks) && analysis.risks.length > 0 ? (
                                    analysis.risks.map((risk, index) => (
                                        <article key={`${risk.clause || 'risk'}-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-[#B8985D]/40">
                                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                                <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                    Khoản mục: {risk.clause || 'N/A'}
                                                </span>
                                                <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                                                    String(risk.severity || '').toLowerCase() === 'high'
                                                        ? 'border-red-200 bg-red-50 text-red-600'
                                                        : String(risk.severity || '').toLowerCase() === 'medium'
                                                            ? 'border-amber-200 bg-amber-50 text-amber-600'
                                                            : 'border-blue-200 bg-blue-50 text-blue-600'
                                                }`}>
                                                    {risk.severity || 'Lưu ý'}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium leading-6 text-zinc-600">{risk.issue || risk.description || 'Không có mô tả rủi ro.'}</p>
                                            {risk.suggestion && (
                                                <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-700">
                                                    Đề xuất: {risk.suggestion}
                                                </p>
                                            )}
                                        </article>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/70 py-14 text-center text-sm font-semibold text-zinc-500">
                                        Chưa có dữ liệu phân tích chi tiết cho hồ sơ này.
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </section>
            </main>
        </div>
    );
}
