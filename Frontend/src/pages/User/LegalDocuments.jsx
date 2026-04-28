// ...existing code...
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CalendarIcon,
  FunnelIcon,
  ArrowRightIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";

export default function LegalDocuments() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({
    keyword: "",
    type: "",
    fromDate: "",
    toDate: "",
  });
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const searchRef = useRef(null);

  const fetchDocuments = async (search = "") => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:8000/api/documents", {
        params: search ? { search } : {},
      });
      if (res.data && res.data.success) {
        setDocuments(res.data.data || []);
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.error("Fetch documents error:", err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Debounced search for keyword
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      const kw = filter.keyword?.trim();
      fetchDocuments(kw);
    }, 500);
    return () => clearTimeout(searchRef.current);
  }, [filter.keyword]);

  const handleViewDetail = (id) => {
    navigate(`/van-ban/chi-tiet/${id}`);
  };

  const formatDate = (d) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("vi-VN");
    } catch {
      return d;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">
      <main className="max-w-7xl mx-auto w-full px-6 py-24 relative z-10">
        <div className="text-center mb-12 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
            <BookOpenIcon className="w-4 h-4" /> Thư viện pháp luật số
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight uppercase leading-tight">
            Tra cứu <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Văn bản</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Hệ thống cơ sở dữ liệu pháp luật toàn diện, cập nhật nhanh chóng.
          </p>
        </div>

        {/* Filter / Search */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 mb-16 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Từ khoá</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nhập số hiệu, tên văn bản..."
                  value={filter.keyword}
                  onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                />
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Loại văn bản</label>
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
              >
                <option value="">Tất cả loại</option>
                <option>Nghị quyết</option>
                <option>Nghị định</option>
                <option>Thông tư</option>
                <option>Luật</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Từ ngày</label>
              <input
                type="date"
                value={filter.fromDate}
                onChange={(e) => setFilter({ ...filter, fromDate: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Đến ngày</label>
              <input
                type="date"
                value={filter.toDate}
                onChange={(e) => setFilter({ ...filter, toDate: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
              />
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => fetchDocuments(filter.keyword?.trim())}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-12 py-3 rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="w-5 h-5" /> Tìm kiếm ngay
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-6 px-2">
          <p className="text-gray-400 italic">
            Tìm thấy <span className="text-white font-bold not-italic">{documents.length}</span> văn bản phù hợp
          </p>
          <div className="h-[1px] flex-grow bg-white/10 ml-6"></div>
        </div>

        <div className="grid gap-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <ArrowRightIcon className="w-8 h-8 animate-spin mb-2 text-cyan-500" />
              <span className="text-sm">Đang đồng bộ dữ liệu...</span>
            </div>
          ) : documents.length > 0 ? (
            documents.map((item) => (
              <div
                key={item.Id}
                className="group relative bg-[#0a0a0a]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 hover:bg-white/5 hover:border-cyan-500/30 transition-all duration-300"
              >
                <div className="absolute left-0 top-6 bottom-6 w-1 bg-gradient-to-b from-blue-600 to-cyan-500 rounded-r-full opacity-50 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex flex-col md:flex-row gap-6 md:items-start">
                  <div className="hidden md:flex flex-shrink-0 w-16 h-16 bg-white/5 border border-white/5 rounded-2xl items-center justify-center group-hover:scale-110 transition-all">
                    <DocumentTextIcon className="w-8 h-8 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                  </div>

                  <div className="flex-grow">
                    <div className="flex flex-wrap gap-3 mb-3">
                      <span className="px-3 py-1 rounded-lg bg-blue-900/30 border border-blue-500/30 text-blue-300 text-xs font-mono font-bold uppercase">
                        {item.DocumentType || item.type}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-mono flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" /> {formatDate(item.IssueDate)}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-bold text-white mb-3 group-hover:text-cyan-400 transition-colors leading-tight">
                      {item.Title}
                    </h3>

                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-6 md:mb-0">
                      {item.Agency || item.Agency || ""}
                    </p>
                  </div>

                  <div className="flex-shrink-0 self-end md:self-center">
                    <button
                      onClick={() => handleViewDetail(item.Id)}
                      className="group/btn bg-white/5 border border-white/10 hover:bg-cyan-500 hover:border-cyan-500 text-white pl-6 pr-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all"
                    >
                      Xem chi tiết
                      <ArrowRightIcon className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
              <DocumentTextIcon className="w-16 h-16 text-gray-700 mb-4" />
              <p className="text-gray-500 font-medium italic">Không tìm thấy văn bản phù hợp</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
// ...existing code...