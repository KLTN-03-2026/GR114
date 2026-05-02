import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";
import { parseAnalysisJson } from "../utils/legalRecordUtils";

export default function PlanningDetailView({ record }) {
  const content = parseAnalysisJson(record.Content);
  const steps = content?.steps || [];

  const statusConfig = {
    completed: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      icon: "✓",
    },
    "in-progress": {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      icon: "⟳",
    },
    pending: {
      bg: "bg-zinc-50",
      border: "border-zinc-200",
      text: "text-zinc-700",
      icon: "○",
    },
  };

  return (
    <section className="lg:col-span-3">
      <div className="mb-6 flex items-center gap-2">
        <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-600 stroke-2" />
        <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
          Quy trình kế hoạch
        </h2>
        <span className="ml-auto text-[11px] font-bold text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-md">
          {steps.length} bước
        </span>
      </div>

      {steps.length > 0 ? (
        <div className="space-y-4">
          {/* Timeline Container */}
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 via-blue-300 to-zinc-200"></div>

            {/* Steps */}
            <div className="space-y-6">
              {steps.map((step, idx) => {
                const config =
                  statusConfig[step.status] || statusConfig.pending;
                const isLast = idx === steps.length - 1;

                return (
                  <div key={step.id} className="relative pl-28">
                    {/* Timeline Dot */}
                    <div className="absolute left-0 top-1 w-16 h-16 flex items-center justify-center">
                      <div
                        className={`w-12 h-12 rounded-full border-4 ${config.border} ${config.bg} flex items-center justify-center text-lg font-bold ${config.text} z-10 bg-white`}
                      >
                        {step.id}
                      </div>
                    </div>

                    {/* Content Card */}
                    <article
                      className={`rounded-2xl border-2 ${config.border} ${config.bg} p-5 transition hover:shadow-md`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-[#1A2530]">
                            {step.title}
                          </h3>
                          <p className="text-[11px] font-medium text-zinc-500 mt-1 uppercase tracking-wider">
                            ⏱️ {step.timeline}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.text} border ${config.border}`}
                        >
                          {step.status === "completed" && "✓ Hoàn thành"}
                          {step.status === "in-progress" && "⟳ Đang thực hiện"}
                          {step.status === "pending" && "○ Chờ xử lý"}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-zinc-700 leading-6">
                        {step.description}
                      </p>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          {content?.summary && (
            <div className="mt-8 p-5 bg-blue-50 border border-blue-200 rounded-2xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-2">
                Tóm tắt kế hoạch
              </p>
              <p className="text-sm font-medium text-blue-900">
                {content.summary}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <ClipboardDocumentCheckIcon className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-600">Chưa có kế hoạch</p>
          <p className="text-xs text-zinc-500 mt-1">
            Kế hoạch chi tiết sẽ hiển thị ở đây.
          </p>
        </div>
      )}
    </section>
  );
}
