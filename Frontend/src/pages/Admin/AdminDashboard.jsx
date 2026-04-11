import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  LayoutDashboard,
  Database,
  Users,
  Activity,
  Search,
  RefreshCw,
  Settings,
  ShieldCheck,
  Zap,
  MoreVertical
} from 'lucide-react';

const backendBase = 'http://localhost:8000/api';
const navigationItems = [
  { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, path: '/admin/dashboard' },
  { key: 'users', label: 'Quản lý Người dùng', icon: Users, path: '/admin/users' },
  { key: 'crawl', icon: Database, label: 'Trình thu thập', path: '/admin/crawl' },

  { key: 'history', icon: Activity, label: 'Lịch sử AI', path: '/admin/history' },
  { key: 'settings', icon: Settings, label: 'Cài đặt', path: '/admin/settings' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [totalUsers, setTotalUsers] = useState(0);
  const [aiRecords, setAiRecords] = useState(0);

  const [isAutoCrawl, setIsAutoCrawl] = useState(true);
  const [activeStage, setActiveStage] = useState(2);
  const [vectorQuota, setVectorQuota] = useState({ used: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  const [timeframe, setTimeframe] = useState('week');
  const [featureUsage, setFeatureUsage] = useState([]);
  const [featureUsageLoading, setFeatureUsageLoading] = useState(false);

  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlStep, setCrawlStep] = useState(0);




  useEffect(() => {
    fetchDashboardData();
    fetchAiHistory();
  }, []);

  useEffect(() => {
    fetchFeatureUsage(timeframe);
  }, [timeframe]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const statsRes = await axios.get(`${backendBase}/admin/stats`, { headers });
      if (statsRes.data?.success) {
        setTotalUsers(statsRes.data.data.totalUsers || 0);
        setAiRecords(statsRes.data.data.aiRecords || 0);
        setVectorQuota(statsRes.data.data.vectorQuota || { used: 0, total: 0 });
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu Admin:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeatureUsage = async (tf) => {
    setFeatureUsageLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${backendBase}/admin/feature-usage`, {
        headers,
        params: { timeframe: tf }
      });
      setFeatureUsage(res.data.data || []);
    } catch (error) {
      console.error('Lỗi khi lấy tính năng hot:', error);
      setFeatureUsage([]);
    } finally {
      setFeatureUsageLoading(false);
    }
  };

  const fetchAiHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${backendBase}/admin/history-analytics`, {
        headers,
        params: { page, limit: 8 }
      });
      setHistoryItems(res.data.data || []);
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử AI:', error);
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTimeframeChange = (value) => {
    setTimeframe(value);
  };

  const handleCrawlSync = async () => {
    if (!crawlUrl.trim()) {
      alert('Vui lòng nhập URL hợp lệ!');
      return;
    }
    setIsCrawling(true);
    setCrawlStep(1);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.post(`${backendBase}/admin/crawl`, { url: crawlUrl }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setCrawlStep(2);
        setTimeout(() => setCrawlStep(3), 400);
        setTimeout(() => {
          alert(`Thành công! ${res.data.message}`);
          setIsCrawling(false);
          setCrawlStep(0);
          setCrawlUrl('');
        }, 1000);
      }
    } catch (error) {
      console.error('Lỗi đồng bộ:', error);
      alert(`Có lỗi: ${error.response?.data?.message || error.message}`);
      setCrawlStep(0);
      setIsCrawling(false);
    }
  };

  const maxUsageCount = useMemo(() => {
    return featureUsage.reduce((max, item) => Math.max(max, item.UsageCount || 0), 1);
  }, [featureUsage]);

  const glassClass = 'bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden';

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans selection:bg-cyan-500/30 flex">

      {/* 🟢 SIDEBAR NAV */}
      <aside className="w-64 border-r border-white/5 bg-black/40 flex flex-col p-6 gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <span className="font-black text-xl tracking-tighter text-white">LEGAI <span className="text-cyan-400">HUB</span></span>
        </div>

        <nav className="flex flex-col gap-2">
          {navigationItems.map((item) => {
            const active = item.path === location.pathname;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-white/5 hover:text-white'}`}
              >
                <Icon size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 🔵 MAIN CONTENT */}
      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">

        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Trung tâm Điều khiển Pháp lý</h1>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">Giám sát Hoạt động & Nhập liệu Dữ liệu</p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-cyan-400 uppercase">Trạng thái Hệ thống</span>
              <span className="text-xs text-white flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-ping" /> Tất cả Hệ thống Hoạt động</span>
            </div>
          </div>
        </header>

        {/* --- GRID CHÍNH --- */}
        <div className="grid grid-cols-12 gap-6">

          {/* BÊN TRÁI (8 CỘT): KPI & BIỂU ĐỒ (Dùng Flex Column để ép sát layout) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

            {/* Hàng KPI */}
            <div className="grid grid-cols-3 gap-6">
              <KPICard label="Tổng số Người dùng" value={loading ? "..." : totalUsers.toLocaleString()} change="+12%" icon={Users} color="cyan" />
              <KPICard label="Hồ sơ Pháp lý AI" value={loading ? "..." : aiRecords.toLocaleString()} change="+8%" icon={Zap} color="indigo" />
              <div className={`${glassClass} p-5 rounded-3xl flex flex-col justify-between`}>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Dung lượng Vector</span>
                  <Database size={16} className="text-cyan-400" />
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-bold text-white mb-2">
                    <span>{loading ? "..." : `${vectorQuota.used.toLocaleString()} / ${vectorQuota.total.toLocaleString()}`}</span>
                    <span className="text-cyan-400">{loading ? "..." : `${Math.round((vectorQuota.used / vectorQuota.total) * 100)}%`}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: loading ? '0%' : `${(vectorQuota.used / vectorQuota.total) * 100}%` }} className="h-full bg-gradient-to-r from-cyan-500 to-indigo-600" />
                  </div>
                </div>
              </div>
            </div>
            {/* Hàng Biểu Đồ */}
            <div className={`${glassClass} h-[260px] rounded-[2.5rem] p-5 flex flex-col`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-white">Tính năng Sử dụng Nhiều nhất</span>
                  <p className="text-[10px] text-gray-400 mt-0.5">Xem theo {timeframe === 'week' ? 'Tuần' : timeframe === 'month' ? 'Tháng' : 'Năm'}</p>
                </div>
                <select
                  value={timeframe}
                  onChange={(e) => handleTimeframeChange(e.target.value)}
                  className="bg-white/5 border border-white/10 text-[10px] text-white px-3 py-1.5 rounded-xl outline-none focus:border-cyan-500"
                >
                  <option value="week">Tuần</option>
                  <option value="month">Tháng</option>
                  <option value="year">Năm</option>
                </select>
              </div>

              {/* Thay đổi class justify-center để khi biểu đồ thu gọn lại nó vẫn nằm giữa khung */}
              <div className="flex-1 flex items-end justify-center gap-4 md:gap-8 px-2 pb-1 mt-2">
                {featureUsageLoading ? (
                  <div className="flex items-center justify-center w-full h-full text-xs text-gray-500">Đang tải thông kê tính năng...</div>
                ) : (
                  /* --- LOGIC MERGE BASELINE: ĐẢM BẢO LUÔN HIỆN 5 CỘT --- */
                  (() => {
                    // 1. Danh sách tính năng cốt lõi (Gắn cứng)
                    const CORE_FEATURES = ['VIDEO_ANALYSIS', 'CONTRACT_REVIEW', 'CRAWL_DATA', 'PLANNING', 'CHAT'];

                    // 2. Map data: Tìm trong API, có thì lấy số, không có thì ép về 0
                    const displayFeatures = CORE_FEATURES.map(featName => {
                      const found = featureUsage.find(item => item.FeatureName === featName);
                      return {
                        FeatureName: featName,
                        UsageCount: found ? found.UsageCount : 0
                      };
                    });

                    // 3. Tìm mốc cao nhất để chia phần trăm (dùng Math.max với 1 để không bao giờ chia cho 0)
                    const currentMaxUsage = Math.max(...displayFeatures.map(item => item.UsageCount), 1);

                    return displayFeatures.map((item, idx) => {
                      const percent = Math.min(100, (item.UsageCount / currentMaxUsage) * 100);

                      return (
                        // Ép max-w-[80px] để cột thon thả, không bị phình to
                        <div key={`${item.FeatureName}-${idx}`} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end max-w-[80px]">

                          {/* Cột biểu đồ */}
                          <div className="w-full relative flex flex-col justify-end h-24">
                            <motion.div
                              initial={{ height: 0 }}
                              // Cột 0 lượt sẽ cao 2% để chừa lại vạch xám mỏng
                              animate={{ height: item.UsageCount === 0 ? '2%' : `${percent}%` }}
                              className={`w-full rounded-t-md relative transition-all duration-300 ${item.UsageCount === 0
                                  ? 'bg-white/5' // Màu xám chìm cho cột 0
                                  : 'bg-gradient-to-t from-indigo-500/40 to-cyan-400/80 group-hover:from-indigo-500/60 group-hover:to-cyan-300'
                                }`}
                            >
                              {/* Tooltip */}
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[10px] font-black text-cyan-400 bg-black/80 border border-cyan-500/30 px-2 py-0.5 rounded backdrop-blur-md whitespace-nowrap z-10 pointer-events-none">
                                {item.UsageCount} lượt
                              </div>
                            </motion.div>
                          </div>

                          {/* Tên tính năng (0 lượt thì chữ chìm đi) */}
                          <span className={`text-[9px] font-bold uppercase tracking-tighter text-center transition-colors h-8 w-full break-words leading-tight ${item.UsageCount === 0 ? 'text-gray-700' : 'text-gray-500 group-hover:text-white'}`}>
                            {item.FeatureName.replace('_', ' ')}
                          </span>

                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>

            {/* --- MODULE 2: CRAWL PIPELINE (Đã chuyển lên đây cho khít, thu gọn chiều cao, giãn chiều ngang) --- */}
            <div className={`${glassClass} rounded-[2.5rem] p-6 flex flex-col gap-4`}>
              {/* Hàng 1: Tiêu đề & Thanh Input (Nới rộng 100%) */}
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3">Thu thập dữ liệu luật</h3>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="text"
                    placeholder="Nhập URL Pháp lý cần thu thập..."
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    disabled={isCrawling}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-36 text-xs outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={handleCrawlSync}
                    disabled={isCrawling}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:scale-105 transition-transform flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={12} className={isCrawling ? "animate-spin" : "animate-spin-slow"} />
                    {isCrawling ? 'Đang đồng bộ' : 'Thu thập'}
                  </button>
                </div>
              </div>

              {/* Hàng 2: Nút Lên Lịch & Các Icon Tiến Trình (Gộp chung thành 1 khối gọn gàng) */}
              <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                {/* Công tắc Lên lịch */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nhiệm vụ Lên lịch: Tự động Thu thập (00:00)</span>
                  <button
                    onClick={() => setIsAutoCrawl(!isAutoCrawl)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${isAutoCrawl ? 'bg-cyan-500' : 'bg-gray-700'}`}
                  >
                    <motion.div animate={{ x: isAutoCrawl ? 16 : 2 }} className="absolute top-0.5 w-3 h-3 bg-white rounded-full" />
                  </button>
                </div>

                {/* Đường ống Icon (Đẩy xuống dưới chân) */}
                <div className="flex items-center justify-between gap-2 w-full pt-2 border-t border-white/5">
                  <PipelineStep icon={CloudArrowUpIcon} label="Đang Thu thập" status={crawlStep >= 1 ? 'complete' : 'pending'} active={crawlStep === 1} />
                  <div className="h-px flex-1 bg-white/10 relative"><motion.div className="absolute inset-0 bg-cyan-500" initial={{ width: 0 }} animate={{ width: crawlStep >= 2 ? '100%' : '0%' }} /></div>
                  <PipelineStep icon={Database} label="Phân tích SSMS" status={crawlStep === 2 ? 'active' : crawlStep > 2 ? 'complete' : 'pending'} active={crawlStep === 2} />
                  <div className="h-px flex-1 bg-white/10 relative"><motion.div className="absolute inset-0 bg-cyan-500" initial={{ width: 0 }} animate={{ width: crawlStep >= 3 ? '100%' : '0%' }} /></div>
                  <PipelineStep icon={Zap} label="Đồng bộ Pinecone" status={crawlStep === 3 ? 'active' : 'pending'} active={crawlStep === 3} />
                </div>
              </div>
            </div>

          </div>

          {/* BÊN PHẢI (4 CỘT): LỊCH SỬ PHÂN TÍCH AI */}
          <div className={`${glassClass} col-span-12 lg:col-span-4 rounded-[2.5rem] p-6 flex flex-col h-[450px] lg:h-auto`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Lịch sử Phân tích AI</h3>
              <Activity size={16} className="text-indigo-400" />
            </div>
            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
              {historyLoading ? (
                <div className="text-center py-10 text-gray-500">Đang tải lịch sử phân tích...</div>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Chưa có hoạt động phân tích AI</div>
              ) : (
                <div className="space-y-4">
                  {historyItems.map((item) => (
                    <div key={item.Id} className="rounded-3xl bg-white/5 border border-white/5 p-4 hover:border-white/10 transition-all">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500">{new Date(item.EventTime).toLocaleString('vi-VN')}</div>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black ${item.Outcome === 'Thành công' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                          {item.Outcome}
                        </span>
                      </div>
                      <p className="text-sm text-white font-bold leading-snug">Người dùng {item.UserName || item.Email || 'Không rõ'} đã dùng {item.FeatureName || 'tính năng'}.</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.1); border-radius: 10px; }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// --- SUB COMPONENTS ---

function KPICard({ label, value, change, icon: Icon, color }) {
  return (
    <div className={`bg-black/60 backdrop-blur-2xl border border-white/10 p-5 rounded-3xl flex flex-col justify-between shadow-xl`}>
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{label}</span>
        <Icon size={18} className={`text-${color}-400`} />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-3xl font-black text-white tracking-tighter">{value}</span>
        <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{change}</span>
      </div>
    </div>
  );
}
function PipelineStep({ icon: Icon, label, status, active }) {
  return (

    <div className="flex flex-col items-center gap-2 group w-24 text-center">

      {/* Tăng hộp Icon từ w-8/h-8 lên w-10/h-10 */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 ${status === 'complete' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' :
          status === 'active' ? 'bg-cyan-500 border-cyan-400 text-white animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.5)]' :
            'bg-white/5 border-white/10 text-gray-600'
        }`}>
        <Icon size={16} /> {/* Tăng size icon bên trong từ 14 lên 16 */}
      </div>


      <span className={`text-[10px] font-black uppercase tracking-widest leading-tight ${active ? 'text-cyan-400' : 'text-gray-500'}`}>
        {label}
      </span>

    </div>
  );
}
const CloudArrowUpIcon = (props) => (
  <motion.svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </motion.svg>
);