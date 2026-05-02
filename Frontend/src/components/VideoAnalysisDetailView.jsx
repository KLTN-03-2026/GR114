import {
  VideoCameraIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { parseAnalysisJson } from "../utils/legalRecordUtils";

export default function VideoAnalysisDetailView({ record }) {
  const content = parseAnalysisJson(record.Content);
  const timestamps = content?.timestamps || [];
  const videoUrl = content?.videoUrl;

  return (
    <section className="lg:col-span-3">
      {/* Video Player */}
      {videoUrl ? (
        <div className="mb-6 rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="aspect-video bg-black">
            <iframe
              width="100%"
              height="100%"
              src={videoUrl}
              title="Video Thẩm định"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-zinc-100 aspect-video flex items-center justify-center">
          <div className="text-center">
            <VideoCameraIcon className="h-12 w-12 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-zinc-500">Không có video</p>
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <VideoCameraIcon className="h-5 w-5 text-orange-600 stroke-2" />
          <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
            Các điểm đánh dấu ({timestamps.length})
          </h2>
        </div>

        {timestamps.length > 0 ? (
          <div className="space-y-3">
            {timestamps.map((ts, idx) => (
              <article
                key={`ts-${idx}`}
                className="rounded-2xl border border-zinc-200 bg-white p-4 hover:border-[#B8985D]/40 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-bold uppercase tracking-wider border border-zinc-200">
                        ⏱️ {ts.time}
                      </span>
                      <h3 className="font-bold text-sm text-[#1A2530]">
                        {ts.title}
                      </h3>
                    </div>
                    <p className="text-sm font-medium text-zinc-600 leading-6">
                      {ts.description}
                    </p>
                  </div>

                  {ts.issue && (
                    <div className="flex-shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          ts.severity === "high"
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : ts.severity === "medium"
                              ? "bg-amber-50 text-amber-600 border border-amber-200"
                              : "bg-blue-50 text-blue-600 border border-blue-200"
                        }`}
                      >
                        {ts.severity || "Info"}
                      </span>
                    </div>
                  )}
                </div>

                {ts.issue && (
                  <div className="mt-3 pt-3 border-t border-zinc-200">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-600 mb-1">
                      🚨 Vấn đề
                    </p>
                    <p className="text-sm font-medium text-zinc-700">
                      {ts.issue}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
            <VideoCameraIcon className="h-12 w-12 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-zinc-600">
              Chưa có điểm đánh dấu
            </p>
          </div>
        )}
      </div>

      {/* Summary */}
      {content?.summary && (
        <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-2">
            Tóm tắt video
          </p>
          <p className="text-sm font-medium text-blue-900">{content.summary}</p>
        </div>
      )}
    </section>
  );
}
