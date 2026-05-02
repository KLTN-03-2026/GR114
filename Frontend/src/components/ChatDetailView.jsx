import {
  ChatBubbleLeftEllipsisIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { parseAnalysisJson } from "../utils/legalRecordUtils";

export default function ChatDetailView({ record }) {
  const content = parseAnalysisJson(record.Content);
  const messages = content?.messages || [];

  return (
    <section className="lg:col-span-3">
      <div className="mb-6 flex items-center gap-2">
        <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-emerald-600 stroke-2" />
        <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
          Lịch sử trò chuyện
        </h2>
        <span className="ml-auto text-[11px] font-bold text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-md">
          {messages.length} tin nhắn
        </span>
      </div>

      {messages.length > 0 ? (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3">
          {messages.map((msg, idx) => (
            <div
              key={`msg-${idx}`}
              className={`flex gap-3 ${msg.isBot ? "flex-row" : "flex-row-reverse"}`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center ${
                  msg.isBot
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-blue-50 border-blue-200"
                }`}
              >
                {msg.isBot ? (
                  <ChatBubbleLeftEllipsisIcon className="h-4 w-4 text-emerald-600 stroke-2" />
                ) : (
                  <UserIcon className="h-4 w-4 text-blue-600 stroke-2" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`flex-1 ${msg.isBot ? "items-start" : "items-end flex flex-col"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    msg.isBot
                      ? "bg-emerald-50 border border-emerald-200 text-zinc-800 rounded-tl-none"
                      : "bg-blue-500 text-white rounded-tr-none"
                  }`}
                >
                  <p className="text-sm leading-6">{msg.text}</p>
                </div>
                {msg.timestamp && (
                  <p
                    className={`text-[10px] text-zinc-400 mt-1.5 ${msg.isBot ? "ml-11" : "mr-11"}`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <ChatBubbleLeftEllipsisIcon className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-600">Không có tin nhắn</p>
          <p className="text-xs text-zinc-500 mt-1">
            Lịch sử cuộc trò chuyện sẽ hiển thị ở đây.
          </p>
        </div>
      )}

      {/* Summary */}
      {content?.summary && (
        <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-2">
            Tóm tắt nội dung
          </p>
          <p className="text-sm font-medium text-blue-900">{content.summary}</p>
        </div>
      )}
    </section>
  );
}
