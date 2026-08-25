import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeftIcon, Bars3BottomLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { parseLegalDocument } from "../../utils/legalDocumentParser";
import LegalDocumentContent from '../../components/LegalDocumentContent';

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
  const [tocOpen, setTocOpen] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState('');

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
  const tocItems = useMemo(() => parsedDocument.blocks
    .filter(block => ['chapter', 'section', 'article'].includes(block.type))
    .map((block) => {
      if (block.type !== 'chapter') return block;
      const blockIndex = parsedDocument.blocks.findIndex(candidate => candidate.id === block.id);
      const nextBlock = parsedDocument.blocks[blockIndex + 1];
      return nextBlock?.type === 'center-heading'
        ? { ...block, text: `${block.text} — ${nextBlock.text}` }
        : block;
    }), [parsedDocument]);

  useEffect(() => {
    if (!tocItems.length) return undefined;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveBlockId(visible.target.id.replace('legal-', ''));
    }, { rootMargin: '-18% 0px -70% 0px', threshold: 0 });
    tocItems.forEach(item => {
      const element = document.getElementById(`legal-${item.id}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [tocItems]);

  const scrollToBlock = (blockId) => {
    const element = document.getElementById(`legal-${blockId}`);
    if (!element) return;
    setActiveBlockId(blockId);
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.innerWidth < 1024) setTocOpen(false);
  };

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

      <main className="flex-grow p-3 pl-14 sm:p-6 sm:pl-20 md:p-10 md:pl-24 lg:p-10 flex justify-center">
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

          <LegalDocumentContent content={doc.Content} title={doc.Title} parsedDocument={parsedDocument} />

          <footer className="mt-20 pt-8 border-t border-gray-200 flex justify-between text-[10px] text-gray-500 font-mono italic">
            <span>Hệ thống LegAI - Xác thực điện tử</span>
            <span>Mã bản ghi: {id}</span>
          </footer>
        </article>
      </main>

      {createPortal(<>
        <button
          type="button"
          onClick={() => setTocOpen(current => !current)}
          className="fixed left-3 bottom-8 lg:left-5 z-50 flex items-center gap-1.5 rounded-full border border-[#B8985D]/40 bg-[#B8985D] p-2.5 sm:px-3 sm:py-2 text-xs font-bold text-white shadow-lg shadow-[#B8985D]/20 hover:bg-[#9f7d4f] focus:outline-none focus:ring-2 focus:ring-[#B8985D]/40"
          aria-expanded={tocOpen}
          aria-controls="legal-document-toc"
        >
          <Bars3BottomLeftIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Mục lục</span>
          <span className="sr-only sm:hidden">Mục lục</span>
        </button>

        {tocOpen && (
          <aside
            id="legal-document-toc"
            className="fixed left-3 top-36 lg:left-5 z-50 flex max-h-[calc(100vh-10rem)] w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
            aria-label="Mục lục văn bản"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8E6D45]">Mục lục</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{tocItems.length} đề mục</p>
              </div>
              <button type="button" onClick={() => setTocOpen(false)} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label="Đóng mục lục">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <nav className="overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin] [scrollbar-color:#d4d4d8_transparent]">
              {tocItems.map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => scrollToBlock(item.id)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-xs leading-5 transition-colors ${item.type === 'article' ? 'pl-6' : 'font-bold'} ${activeBlockId === item.id ? 'bg-[#B8985D]/15 text-[#8E6D45]' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}
                >
                  {item.text}
                </button>
              ))}
            </nav>
          </aside>
        )}
      </>, document.body)}
    </div>
  );
}
