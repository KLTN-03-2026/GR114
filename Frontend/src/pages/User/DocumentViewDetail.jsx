import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { parseLegalDocument } from "../../utils/legalDocumentParser";

const blockClasses = {
  'document-type': 'text-center font-bold uppercase text-[19px] mt-8 mb-1 tracking-wide',
  'center-heading': 'text-center font-bold uppercase text-[16px] mb-5 leading-snug',
  chapter: 'text-center font-bold text-[16px] mt-8 mb-2 leading-snug',
  section: 'text-center font-bold text-[15px] mt-6 mb-2 leading-snug',
  article: 'font-bold text-[15px] mt-6 mb-2 text-left',
  clause: 'pl-5 text-[14.5px] leading-7 text-justify mb-2',
  point: 'pl-10 text-[14.5px] leading-7 text-justify mb-2',
  preamble: 'text-[14.5px] leading-7 text-justify mb-2 italic',
  paragraph: 'text-[14.5px] leading-7 text-justify mb-2'
};

const formatDate = (dateStr) => {
  if (!dateStr) return "..........";
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? ".........." : `ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
};

const getLocationDate = (doc) => {
  const supplied = String(doc.IssueDateString || '').replace(/^\s*[A-ZĐ-]{1,8}\s+(?=[A-ZÀ-Ỹ])/u, '').trim();
  return supplied || `Hà Nội, ${formatDate(doc.IssueDate)}`;
};

export default function DocumentViewDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    setLoading(true);
    axios.get(`http://localhost:8000/api/documents/${id}`, { signal: controller.signal })
      .then(res => { if (res.data?.success) setDoc(res.data.data); })
      .catch(error => { if (!axios.isCancel(error)) console.error("Get document detail error:", error); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!id || !doc || !userStr) return;
    const token = localStorage.getItem("accessToken");
    axios.post("http://localhost:8000/api/user/record-view", {
      documentId: doc.Id,
      documentTitle: doc.Title,
      documentNumber: doc.DocumentNumber,
      issueYear: doc.IssueYear
    }, { headers: { Authorization: `Bearer ${token}` } })
      .catch(error => console.error("Lỗi ghi nhận lịch sử xem:", error));
  }, [id, doc]);

  const parsedDocument = useMemo(() => parseLegalDocument(doc?.Content, doc?.Title), [doc?.Content, doc?.Title]);

  if (loading) return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-zinc-200 border-t-[#B8985D] rounded-full animate-spin" />
    </div>
  );
  if (!doc) return <div className="min-h-screen bg-[#f8f9fa]" />;

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col text-[#1A2530] font-sans selection:bg-[#B8985D]/30">
      <header className="bg-white/90 border-b border-zinc-200 sticky top-0 z-20 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-500" aria-label="Quay lại">
            <ArrowLeftIcon className="w-5 h-5 stroke-2" />
          </button>
          <div className="flex flex-col border-l border-zinc-200 pl-4 ml-4 min-w-0">
            <h1 className="text-[10px] font-black text-[#B8985D] uppercase tracking-[0.2em]">{doc.Category || "Văn bản pháp luật"}</h1>
            <p className="text-[12px] font-bold truncate max-w-[65vw]">{doc.Title}</p>
          </div>
        </div>
      </header>

      <main className="flex-grow p-3 sm:p-6 md:p-10 flex justify-center">
        <article className="w-full max-w-[900px] bg-white text-black shadow-[0_15px_50px_rgba(0,0,0,0.08)] px-5 py-10 sm:px-10 md:p-[2cm_1.5cm]" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-4 mb-10 text-[13px]">
            <div className="flex flex-col items-center text-center">
              <p className="font-bold uppercase leading-tight min-h-[36px]">{doc.Agency || "CƠ QUAN BAN HÀNH"}</p>
              <div className="w-20 border-t border-black mt-2 mb-3" />
              <p>Số: {doc.DocumentNumber}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
              <div className="w-24 border-t border-black mt-2 mb-3" />
              <p className="italic">{getLocationDate(doc)}</p>
            </div>
          </div>

          {!parsedDocument.hasDocumentHeading && !parsedDocument.contentRepresentsTitle && (
            <h2 className="text-center text-[19px] font-bold uppercase mt-8 mb-10 leading-snug">{doc.Title}</h2>
          )}

          <div className="mx-auto max-w-[760px]">
            {parsedDocument.blocks.map(block => (
              <p key={block.id} className={blockClasses[block.type] || blockClasses.paragraph}>{block.text}</p>
            ))}
          </div>

          <footer className="mt-20 pt-8 border-t border-gray-200 flex justify-between text-[10px] text-gray-500 font-mono italic">
            <span>Hệ thống LegAI - Xác thực điện tử</span>
            <span>Mã bản ghi: {id}</span>
          </footer>
        </article>
      </main>
    </div>
  );
}
