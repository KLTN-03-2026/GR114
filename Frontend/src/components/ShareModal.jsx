import {
  CheckIcon,
  XMarkIcon,
  ShareIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import toast from "react-hot-toast";

export default function ShareModal({ isOpen, recordId, recordName, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/ho-so/chi-tiet/${recordId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Đã sao chép link!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Không thể sao chép link.");
    }
  };

  const handleShareSocial = (platform) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`Xem hồ sơ pháp lý: ${recordName}`);

    let shareLink = "";
    switch (platform) {
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
        break;
      case "linkedin":
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case "email":
        shareLink = `mailto:?subject=${encodedText}&body=${encodedUrl}`;
        break;
      default:
        break;
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "width=600,height=400");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1A2530]/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(26,37,48,0.18)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-2.5">
              <ShareIcon className="h-6 w-6 text-blue-600 stroke-2" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wide text-[#1A2530]">
                Chia sẻ hồ sơ
              </h3>
              <p className="mt-1 text-xs font-medium uppercase tracking-widest text-[#B8985D]">
                Hồ sơ pháp lý
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-50 hover:text-[#1A2530]"
          >
            <XMarkIcon className="h-5 w-5 stroke-2" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Link Copy Section */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Sao chép liên kết
            </p>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 flex items-center gap-2 truncate">
                <LinkIcon className="h-4 w-4 text-zinc-400 flex-shrink-0 stroke-2" />
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-xs text-zinc-600 font-mono outline-none truncate"
                />
              </div>
              <button
                onClick={handleCopyLink}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-1 flex-shrink-0 ${
                  copied
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                }`}
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-4 w-4 stroke-2" /> Đã sao
                  </>
                ) : (
                  "Sao chép"
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 my-4">
            <div className="flex-1 h-px bg-zinc-200"></div>
            <span>Hoặc chia sẻ trên</span>
            <div className="flex-1 h-px bg-zinc-200"></div>
          </div>

          {/* Social Share Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleShareSocial("facebook")}
              className="px-4 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 font-bold text-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition flex items-center justify-center gap-2"
            >
              <span className="text-lg">f</span> Facebook
            </button>
            <button
              onClick={() => handleShareSocial("twitter")}
              className="px-4 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 font-bold text-sm hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 transition flex items-center justify-center gap-2"
            >
              <span className="text-lg">𝕏</span> X
            </button>
            <button
              onClick={() => handleShareSocial("linkedin")}
              className="px-4 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 font-bold text-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition flex items-center justify-center gap-2"
            >
              <span className="text-lg">in</span> LinkedIn
            </button>
            <button
              onClick={() => handleShareSocial("email")}
              className="px-4 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 font-bold text-sm hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 transition flex items-center justify-center gap-2"
            >
              <span className="text-lg">✉️</span> Email
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 bg-zinc-50/70 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-[#1A2530]"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
