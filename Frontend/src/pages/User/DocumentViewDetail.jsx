import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

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

  const formatDate = (dateStr) => {
    if (!dateStr) return "..........";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? ".........." : `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  };

  const renderFormattedContent = (content) => {
    if (!content) return <p className="italic text-gray-400">Nội dung đang được cập nhật...</p>;

    const lines = content.split('\n');
    
    // 🛠️ BƯỚC A: LỌC BỎ HEADER LẶP LẠI (The "2 Quốc Hội" Fix)
    // Chiến thuật: Tìm điểm bắt đầu của văn bản thật (Chương I hoặc Điều 1)
    const firstChapterIndex = lines.findIndex(l => {
        const line = l.trim().toUpperCase();
        return line.startsWith("CHƯƠNG") || line.startsWith("PHẦN") || line.startsWith("ĐIỀU 1.") || /^\d+\.\s/.test(line);
    });

    let validLines = [];
    if (firstChapterIndex > -1) {
        // Lấy từ cái Chương/Điều đầu tiên trở đi, bỏ sạch mấy cái rác lặp lại ở đầu
        validLines = lines.slice(firstChapterIndex);
    } else {
        validLines = lines.filter((line, index) => {
             const l = line.toUpperCase().trim();
             if (index < 25) { // Quét 25 dòng đầu để bỏ rác lặp
                const isMotto = l.includes("CỘNG HÒA XÃ HỘI") || l.includes("ĐỘC LẬP") || 
                                l.includes("NGÂN SÁCH NHÀ NƯỚC") || l.includes("-------") ||
                                l === "QUỐC HỘI";
                return !isMotto;
             }
             return true;
        });
    }

    // 🛠️ BƯỚC B: MAPPING & RENDER CSS CHUẨN A4
    return validLines.map((line, index) => {
      const trimmedLine = line.trim(); // 🎯 XÓA TẠP ÂM KHOẢNG TRẮNG, TAB Ở ĐẦU DÒNG
      if (!trimmedLine) return <div key={index} className="h-4"></div>;

      // Chapter titles (Căn giữa)
      if (trimmedLine.toUpperCase().startsWith("CHƯƠNG")) {
        return <p key={index} className="text-center font-bold text-[17.5px] mt-10 mb-2 uppercase text-cyan-800">{trimmedLine}</p>;
      }

      // Article titles or primary list items (In đậm)
      if (trimmedLine.startsWith("Điều") || /^\d+\.\s/.test(trimmedLine)) {
        return <p key={index} className="font-bold text-gray-900 mt-6 mb-3 text-[16px]">{trimmedLine}</p>;
      }

      // Final signature line
      if (index > validLines.length - 10 && trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length < 40) {
        return <p key={index} className="text-right font-bold pr-10 mt-6 uppercase text-[16.5px]">{trimmedLine}</p>;
      }

      // Standard paragraph body (Justify, indent)
      return (
        <p key={index} className="indent-8 text-justify leading-[1.85] mb-4 text-[#222]">
          {trimmedLine}
        </p>
      );
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-t-cyan-500 rounded-full animate-spin"></div>
    </div>
  );

  if (!doc) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col text-gray-300 font-sans">
      <header className="bg-black/80 border-b border-white/5 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-cyan-500">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex flex-col border-l border-white/10 pl-4">
              <h1 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em]">{doc.Category || "VĂN BẢN PHÁP LUẬT"}</h1>
              <p className="text-[12px] text-white font-medium truncate max-w-[400px]">{doc.Title}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 md:p-10 overflow-y-auto flex justify-center bg-[#050505] scroll-smooth">
        <div
          className="w-full max-w-[900px] bg-[#fdfdfd] text-[#1a1a1a] shadow-2xl flex flex-col"
          style={{ 
            fontFamily: "'Times New Roman', Times, serif", 
            padding: '2cm 1.5cm' // Padding chuẩn A4
          }}
        >
          {/* HEADER CHUẨN */}
          <div className="flex justify-between items-start mb-12">
            <div className="text-center min-w-[200px]">
              <p className="font-bold text-[13px] uppercase">{doc.Agency || "CƠ QUAN BAN HÀNH"}</p>
              <p className="text-[13px] font-bold">-------</p>
              <p className="text-[12px] mt-1">Số: {doc.DocumentNumber}</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-[14px] uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="font-bold text-[14px]">Độc lập - Tự do - Hạnh phúc</p>
              <div className="w-32 h-[1.5px] bg-black mx-auto mt-1 mb-2"></div>
              <p className="text-[12px] italic mt-4 text-right">Hà Nội, {formatDate(doc.IssueDate)}</p>
            </div>
          </div>

          {/* TIÊU ĐỀ */}
          <div className="text-center mt-12 mb-12">
            <h2 className="text-[20px] font-bold leading-tight uppercase px-12">{doc.Title}</h2>
          </div>

          {/* NỘI DUNG SẠCH */}
          <div className="law-content-display text-[16px] md:text-[16.5px]">
            {renderFormattedContent(doc.Content)}
          </div>

          <footer className="mt-20 pt-8 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-mono mt-auto italic">
            <span>Hệ thống LegAI - Dữ liệu đã mã hóa xác thực</span>
            <span>Mã bản ghi: {id}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}