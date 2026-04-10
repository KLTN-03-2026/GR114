import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  BookOpenIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon
} from "@heroicons/react/24/outline";

export default function LegalDocuments() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({
    keyword: "",
    fromDate: "",
    toDate: "",
    category: "Tất cả"
  });

  // State quản lý dữ liệu và phân trang
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalDocs: 0
  });

  const searchRef = useRef(null);

  // 1. LẤY SỐ LƯỢNG SIDEBAR (NHẢY SỐ TỰ ĐỘNG)
  const fetchStats = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/document-stats");
      if (res.data.success) {
        const apiStats = res.data.stats;
        // Danh sách hiển thị ưu tiên (Duy có thể thêm full 20 cái vào đây)
        const menuItems = ["Bộ máy hành chính", "Tài chính nhà nước", "Bất động sản", "Thương mại", "Dân sự", "Hình sự", "Lao động - Tiền lương", "Giao thông - Vận tải"];

        const updated = [
          { name: "Xem tất cả", count: res.data.total },
          ...menuItems.map(name => ({
            name,
            count: apiStats.find(s => s.Category === name)?.Count || 0
          })),
          { name: "Lĩnh vực khác", count: apiStats.find(s => s.Category === "Lĩnh vực khác")?.Count || 0 }
        ];
        setCategories(updated);
      }
    } catch (err) { console.error("Stats error:", err); }
  };

  // 2. GỌI API LẤY VĂN BẢN (CÓ PHÂN TRANG)
  const fetchDocuments = async (page = 1) => {
    setLoading(true);
    try {
      let categoryToSend = filter.category === "Tất cả" || filter.category === "Xem tất cả" ? "" : filter.category;

      const res = await axios.get("http://localhost:8000/api/documents", {
        params: {
          search: filter.keyword.trim(),
          category: categoryToSend,
          page: page,
          limit: 10
        }
      });
      console.log("🔍 Check Data từ API Tra Cứu:", res.data);
      if (res.data.success) {
        setDocuments(res.data.data);
        setPagination({
          currentPage: res.data.currentPage,
          totalPages: res.data.totalPages,
          totalDocs: res.data.totalDocs
        });
      }
    } catch (err) { console.error("Fetch error:", err); }
    finally { setLoading(false); }
  };

  // Effect load ban đầu và khi đổi Category
  useEffect(() => {
    fetchStats();
    fetchDocuments(1); // Đổi category thì về trang 1
  }, [filter.category]);

  // Debounce search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => fetchDocuments(1), 400);
    return () => clearTimeout(searchRef.current);
  }, [filter.keyword]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Cuộn lên đầu cho mượt
      fetchDocuments(newPage);
    }
  };

  const handleClearFilter = () => {
    setFilter({ keyword: "", fromDate: "", toDate: "", category: "Tất cả" });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex pt-16 w-full overflow-x-hidden">

      {/* ================= SIDEBAR ================= */}
      <aside className="hidden lg:flex flex-col w-72 bg-[#0a0a0a] border-r border-white/10 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto z-10">
        <div className="p-6 border-b border-white/10">
          <h2 className="font-bold text-lg flex items-center gap-2 text-cyan-400 italic underline decoration-cyan-500/50">
            <BookOpenIcon className="w-5 h-5" /> TRA CỨU VĂN BẢN
          </h2>
        </div>
        <div className="p-4 flex flex-col gap-1">
          {categories.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => setFilter({ ...filter, category: cat.name })}
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl transition-all group ${filter.category === cat.name || (cat.name === "Xem tất cả" && filter.category === "Tất cả")
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                  : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                }`}
            >
              <span className="text-[18px] font-medium tracking-tight truncate">{cat.name}</span>
              <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-gray-600 group-hover:text-cyan-500">({cat.count})</span>
            </button>
          ))}
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 px-4 py-8 md:px-10 max-w-5xl mx-auto w-full">

        {/* Search Bar */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 mb-8 shadow-2xl">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Tìm kiếm theo tiêu đề, số hiệu..."
                value={filter.keyword}
                onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 pl-11 text-white focus:border-cyan-500 transition-all outline-none"
              />
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-600 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
            <button onClick={() => fetchDocuments(1)} className="bg-cyan-600 hover:bg-cyan-500 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-cyan-900/20">Tìm kiếm</button>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase">Thư viện pháp luật số</h3>
          <p className="text-xs text-gray-500">Tìm thấy <span className="text-cyan-500 font-bold">{pagination.totalDocs}</span> văn bản</p>
        </div>

        {/* Documents List */}
        <div className="space-y-4 mb-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <ArrowPathIcon className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
              <p className="text-gray-500 text-sm animate-pulse">Đang truy xuất dữ liệu từ AI Engine...</p>
            </div>
          ) : documents.length > 0 ? (
            documents.map((item, index) => (
              <div key={item.Id} className="group bg-[#0a0a0a] border border-white/5 p-6 rounded-2xl hover:border-cyan-500/30 transition-all shadow-sm flex flex-col md:flex-row gap-5">
                <div className="w-10 h-10 bg-[#111] rounded-lg flex items-center justify-center text-gray-600 font-bold border border-white/5 group-hover:text-cyan-500 transition-colors">
                  {(pagination.currentPage - 1) * 10 + index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="text-[20px] font-bold text-gray-200 group-hover:text-white mb-2 leading-relaxed italic">{item.Title}</h4>
                  <div className="flex gap-4 text-xs text-gray-500 mb-4">
                    <span>Số hiệu: <b className="text-gray-400">{item.DocumentNumber}</b></span>
                    <span>Năm: <b className="text-gray-400">{item.IssueYear}</b></span>
                    <span className={item.Status === "Còn hiệu lực" ? "text-emerald-500" : "text-rose-500"}>● {item.Status}</span>
                  </div>
                  <button onClick={() => navigate(`/van-ban/chi-tiet/${item.Id}`)} className="text-[10px] border border-white/10 px-4 py-1.5 rounded-lg hover:bg-cyan-500 hover:text-white transition-all uppercase font-bold tracking-tighter">Xem chi tiết</button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 text-gray-600">Không có dữ liệu phù hợp.</div>
          )}
        </div>

        {/* ================= PAGINATION UI ================= */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pb-10">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-20 transition-all"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>

            {/* Tạo danh sách số trang (Ví dụ: 1, 2, 3...) */}
            {[...Array(pagination.totalPages)].map((_, i) => {
              const p = i + 1;
              // Chỉ hiển thị vài trang đầu, trang hiện tại và trang cuối nếu quá nhiều
              if (p === 1 || p === pagination.totalPages || (p >= pagination.currentPage - 1 && p <= pagination.currentPage + 1)) {
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-10 h-10 rounded-lg border font-bold text-sm transition-all ${pagination.currentPage === p
                        ? "bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/40"
                        : "border-white/10 text-gray-500 hover:bg-white/5"
                      }`}
                  >
                    {p}
                  </button>
                );
              }
              if (p === pagination.currentPage - 2 || p === pagination.currentPage + 2) return <span key={p} className="text-gray-700">...</span>;
              return null;
            })}

            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-20 transition-all"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}