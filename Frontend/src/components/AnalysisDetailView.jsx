import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { parseAnalysisJson } from "../utils/legalRecordUtils";

export default function AnalysisDetailView({ record, riskScore }) {
  const analysis = parseAnalysisJson(record.Content);
  const chartData = [
    { name: "An toàn", value: riskScore, color: "#10b981" },
    { name: "Rủi ro", value: Math.max(100 - riskScore, 0), color: "#ef4444" },
  ];

  return (
    <>
      {/* Biểu đồ Rủi ro */}
      <aside className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mx-auto h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={58}
                  outerRadius={78}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center">
            <p className="text-3xl font-black text-[#B8985D]">{riskScore}%</p>
            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mt-1">
              Điểm An toàn
            </p>
          </div>
        </div>
      </aside>

      {/* Danh sách Rủi ro */}
      <section className="lg:col-span-2">
        <div className="mb-6 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-orange-500 stroke-2" />
          <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
            Các điều khoản cần chú ý ({analysis?.risks?.length || 0} rủi ro)
          </h2>
        </div>

        {Array.isArray(analysis?.risks) && analysis.risks.length > 0 ? (
          <div className="space-y-4">
            {analysis.risks.map((risk, idx) => {
              const severityColor = {
                high: "border-red-200 bg-red-50 text-red-600",
                medium: "border-amber-200 bg-amber-50 text-amber-600",
                low: "border-blue-200 bg-blue-50 text-blue-600",
              };
              const color =
                severityColor[String(risk.severity || "").toLowerCase()] ||
                severityColor.low;

              return (
                <article
                  key={`risk-${idx}`}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-[#B8985D]/40 transition"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                      <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                      Khoản: {risk.clause || "N/A"}
                    </span>
                    <span
                      className={`rounded-md border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${color}`}
                    >
                      {risk.severity || "Chú ý"}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#1A2530] mb-2">
                    {risk.issue}
                  </h3>
                  <p className="text-sm font-medium leading-6 text-zinc-600 mb-3">
                    {risk.description}
                  </p>

                  {risk.recommendation && (
                    <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-start gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-emerald-600 stroke-2 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            Khuyến nghị
                          </p>
                          <p className="text-sm font-medium text-emerald-700 mt-1">
                            {risk.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <CheckCircleIcon className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-zinc-600">Không có rủi ro</p>
            <p className="text-xs text-zinc-500 mt-1">
              Hồ sơ này đã được xác nhận an toàn.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
