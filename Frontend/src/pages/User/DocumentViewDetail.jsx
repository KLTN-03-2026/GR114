import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

export default function DocumentViewDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = async (docId) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/documents/${docId}`);
      if (res.data && res.data.success) {
        setDoc(res.data.data);
      }
    } catch (err) {
      console.error("Get document detail error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetail(id);
  }, [id]);

  const handleBack = () => navigate(-1);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Đã sao chép link văn bản!");
    } catch {
      alert("Không thể sao chép link.");
    }
  };

  // FIX LỖI NaN: Hàm định dạng ngày tháng an toàn
  const formatDate = (dateStr) => {
    if (!dateStr) return "..........";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return ".........."; // Nếu ngày không hợp lệ
    return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  };

  // HÀM RENDER NỘI DUNG CHUẨN FORM
  const renderFormattedContent = (content) => {
    if (!content) return <p className="italic text-gray-400">Nội dung đang được cập nhật...</p>;

    // 1. Làm sạch nội dung: Xóa ký tự Markdown (#, **) và các đoạn lặp lại Quốc hiệu
    const cleanContent = content
      .replace(/[#*]/g, "") // Xóa dấu # và *
      .split('\n')
      .filter(line => {
        const l = line.toUpperCase();
        // Lọc bỏ các dòng lặp lại Quốc hiệu/Tiêu ngữ bên trong thân bài
        return !l.includes("CỘNG HÒA XÃ HỘI") && !l.includes("ĐỘC LẬP - TỰ DO");
      });

    return cleanContent.map((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return <div key={index} className="h-2"></div>;

      // Tiêu đề Điều (Điều 1. ...)
      if (trimmedLine.startsWith("Điều") || trimmedLine.startsWith("Chương")) {
        return <p key={index} className="font-bold text-gray-900 mt-6 mb-2 text-[16px]">{trimmedLine}</p>;
      }

      // Các Khoản (1., 2. ...) -> Lùi lề pl-8
      if (/^\d+\./.test(trimmedLine)) {
        return <p key={index} className="pl-8 text-justify mb-3">{trimmedLine}</p>;
      }

      // Các Căn cứ -> In nghiêng, lùi lề pl-4
      if (trimmedLine.toLowerCase().startsWith("căn cứ")) {
        return <p key={index} className="pl-4 italic text-gray-700 mb-2">{trimmedLine}</p>;
      }

      // Văn bản bình thường khác -> pl-12 (Form chuẩn)
      return <p key={index} className="pl-12 text-justify mb-2">{trimmedLine}</p>;
    });
  };

  if (loading)
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-gray-800 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm font-medium tracking-widest uppercase">ĐANG XỬ LÝ...</p>
      </div>
    );

  if (!doc) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col text-gray-300 font-sans selection:bg-cyan-500/30">

      {/* 1. TOOLBAR */}
      <header className="bg-black border-b border-white/5 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="p-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex flex-col border-l border-white/10 pl-4">
              <h1 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest line-clamp-1 max-w-xs">
                {doc.Title}
              </h1>
              <span className="text-[10px] text-cyan-600 font-mono italic">
                {doc.DocumentNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleShare} className="p-2 text-gray-400 hover:text-cyan-400 transition-all">
              <ShareIcon className="w-5 h-5" />
            </button>
            <div className="h-4 w-px bg-white/10 mx-1"></div>
            <button className="flex items-center gap-2 bg-white text-black px-5 py-1.5 rounded-full text-xs font-bold hover:bg-gray-200 transition-all shadow-lg">
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>XUẤT FILE</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN VIEWER */}
      <main className="flex-grow p-4 md:p-12 overflow-y-auto flex justify-center bg-[#050505]">
        <div className="w-full max-w-[900px] bg-white text-[#1a1a1a] rounded-sm shadow-2xl min-h-screen flex flex-col">

          {/* HEADER GIẤY */}
          <div className="px-16 pt-16 pb-10">
            <div className="flex justify-between items-start mb-10">
              <div className="text-center w-fit">
                <p className="font-bold text-[13px] uppercase">{doc.Agency || "CƠ QUAN BAN HÀNH"}</p>
                <div className="w-16 h-[1px] bg-black mx-auto mt-1 mb-2"></div>
                <p className="text-[12px] font-medium tracking-tighter">Số: {doc.DocumentNumber}</p>
              </div>

              <div className="text-center w-fit">
                <p className="font-bold text-[16px] uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="font-bold text-[16px]">Độc lập - Tự do - Hạnh phúc</p>
                <div className="w-32 h-[1.5px] bg-black mx-auto mt-1 mb-2"></div>
                {/* ĐÃ FIX: Không còn Ngày NaN nữa */}
                <p className="text-[12px] italic mt-3 text-right">Hà Nội, {formatDate(doc.IssueDate)}</p>
              </div>
            </div>

            <div className="text-center mt-12 mb-10">
              <h2 className="text-[20px] font-bold leading-tight uppercase max-w-2xl mx-auto">
                {doc.Title}
              </h2>
            </div>

            {/* NỘI DUNG VĂN BẢN (SẠCH & CHUẨN) */}
            <div className="mt-8 text-[15.5px] leading-[1.8] font-sans">
              {renderFormattedContent(doc.Content)}
            </div>

            {/* CHỮ KÝ GIẢ ĐỊNH */}
            <div className="mt-20 flex justify-between items-start">
              <div className="text-[12px] italic">
                <p className="font-bold not-italic font-sans">Nơi nhận:</p>
                <p>- Như Điều 3;</p>
                <p>- Lưu văn thư.</p>
              </div>
              <div className="text-center mr-10 min-w-[220px]">
                <p className="font-bold uppercase text-[13px] mb-20">CHỦ TỊCH QUỐC HỘI</p>
                <p className="font-bold text-[16px] font-sans">Trần Thanh Mẫn</p>
              </div>
            </div>
          </div>

          <div className="px-16 py-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-[9px] text-gray-400 font-mono tracking-widest uppercase mt-auto">
            <span>LegAI Digital System © 2026</span>
            <span>Mã: {id}</span>
          </div>
        </div>
      </main>
    </div>
  );
}