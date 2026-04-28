import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  MagnifyingGlassCircleIcon,
  ShareIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

export default function DocumentViewDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Logic giữ nguyên ---
  const fetchDetail = async (docId) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/documents/${docId}`);
      if (res.data && res.data.success) {
        setDoc(res.data.data);
      } else {
        setDoc(null);
      }
    } catch (err) {
      console.error("Get document detail error:", err);
      setDoc(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetail(id);
  }, [id]);

  const handleBack = () => navigate(-1);
  const handleDownload = () => alert("Tải xuống đang được xử lý...");
  const handleCompare = () => alert("Chuyển sang chức năng so sánh (tạm).");
  const handleResearch = () => alert("Chuyển sang chức năng nghiên cứu (tạm).");
  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/van-ban/chi-tiet/${id}`;
      await navigator.clipboard.writeText(url);
      alert("Đã sao chép link văn bản!");
    } catch {
      alert("Không thể sao chép link.");
    }
  };

  const formatDate = (d) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("vi-VN");
    } catch {
      return d;
    }
  };

  // --- Giao diện Loading / Error (Dark Mode) ---
  if (loading)
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-gray-800 border-t-white rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm font-medium">Đang tải dữ liệu...</p>
      </div>
    );

  if (!doc)
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-gray-500">
        <DocumentTextIcon className="w-16 h-16 text-gray-700 mb-4" />
        <p>Không tìm thấy văn bản hoặc văn bản đã bị xóa.</p>
        <button onClick={handleBack} className="mt-4 text-cyan-500 hover:text-cyan-400 transition">
          Quay lại danh sách
        </button>
      </div>
    );

  return (
    // Nền chính: Đen (bg-black)
    <div className="min-h-screen bg-black flex flex-col text-gray-300 font-sans">
      
      {/* 1. HEADER / TOOLBAR (Dark Mode: Border đậm, nền đen) */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Left: Back & Title Snippet */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-gray-400 hover:bg-gray-900 hover:text-white rounded-full transition-colors"
              title="Quay lại"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-gray-800 mx-1 hidden sm:block"></div>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold text-gray-100 line-clamp-1 max-w-[200px] sm:max-w-md uppercase">
                {doc.Title}
              </h1>
              <span className="text-xs text-gray-500">
                {doc.DocumentNumber || "Chưa có số hiệu"}
              </span>
            </div>
          </div>

          {/* Right: Actions Toolbar */}
          <div className="flex items-center gap-1 sm:gap-2">
            <ActionButton icon={<MagnifyingGlassCircleIcon />} onClick={handleResearch} tooltip="Nghiên cứu" />
            <ActionButton icon={<ArrowsRightLeftIcon />} onClick={handleCompare} tooltip="So sánh" />
            <ActionButton icon={<ShareIcon />} onClick={handleShare} tooltip="Chia sẻ" />
            <div className="h-6 w-px bg-gray-800 mx-2"></div>
            {/* Nút tải xuống nổi bật (Trắng trên nền đen) */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-200 transition shadow-sm"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Tải về</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN DOCUMENT VIEWER (Giả lập tờ giấy màu tối - Dark Reader style) */}
      <main className="flex-grow p-4 sm:p-8 overflow-y-auto flex justify-center">
        {/* Tờ giấy: Màu xám rất tối (bg-[#111]) để tách biệt với nền đen, viền xám đậm */}
        <div className="w-full max-w-[850px] bg-[#111] border border-gray-800 rounded-sm min-h-[1000px] flex flex-col shadow-2xl shadow-black">
          
          {/* Header của Văn bản */}
          <div className="px-10 pt-12 pb-8 border-b border-gray-800">
            <div className="flex justify-between items-start mb-6 text-sm text-gray-400 uppercase tracking-wider font-semibold">
              <div className="text-left">
                <p className="text-gray-200">{doc.Agency || "Cơ quan ban hành"}</p>
                <p className="mt-1 text-xs font-normal text-gray-600">Số: {doc.DocumentNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-200">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
                <p className="mt-1 text-xs font-normal normal-case text-gray-500">Độc lập - Tự do - Hạnh phúc</p>
              </div>
            </div>

            <div className="text-center mt-8 mb-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug uppercase mb-2">
                {doc.Title}
              </h2>
              <p className="text-sm text-gray-500 italic">
                Ngày ban hành: {formatDate(doc.IssueDate)}
              </p>
            </div>
          </div>

          {/* Nội dung chính (Body) */}
          <div className="px-10 py-8 flex-grow">
            <article className="prose prose-invert prose-sm sm:prose-base max-w-none text-justify text-gray-300 leading-relaxed whitespace-pre-line font-serif">
              {doc.Content || (
                <span className="text-gray-600 italic">Nội dung văn bản chưa được cập nhật...</span>
              )}
            </article>
          </div>

          {/* Footer của tờ giấy */}
          <div className="px-10 py-6 mt-auto border-t border-gray-800 bg-[#0a0a0a]">
             <div className="flex justify-between items-end text-xs text-gray-600">
                <span>ID: {doc.id || id}</span>
                <span>Hệ thống quản lý văn bản</span>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper Button (Dark Mode style)
function ActionButton({ icon, onClick, tooltip }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className="p-2 text-gray-500 hover:text-white hover:bg-gray-900 rounded-lg transition-all"
    >
      <div className="w-6 h-6">{icon}</div>
    </button>
  );
}