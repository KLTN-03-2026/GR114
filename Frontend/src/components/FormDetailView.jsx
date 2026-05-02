import {
  DocumentDuplicateIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { parseAnalysisJson } from "../utils/legalRecordUtils";

export default function FormDetailView({ record }) {
  const content = parseAnalysisJson(record.Content);
  const fields = content?.fields || [];

  return (
    <section className="lg:col-span-3">
      <div className="mb-6 flex items-center gap-2">
        <DocumentDuplicateIcon className="h-5 w-5 text-purple-600 stroke-2" />
        <h2 className="text-sm font-black uppercase tracking-widest text-[#1A2530]">
          Nội dung biểu mẫu ({fields.length} trường)
        </h2>
      </div>

      {fields.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field, idx) => (
            <div
              key={`field-${idx}`}
              className="rounded-2xl border border-zinc-200 bg-white p-5 hover:border-[#B8985D]/40 hover:shadow-md transition"
            >
              <div className="mb-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  {field.key}
                </label>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                <p className="text-sm font-semibold text-[#1A2530] break-words leading-6">
                  {field.value || "(Trống)"}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <DocumentDuplicateIcon className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-600">
            Chưa có dữ liệu biểu mẫu
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Các trường của biểu mẫu sẽ hiển thị ở đây.
          </p>
        </div>
      )}

      {/* Summary */}
      {content?.summary && (
        <div className="mt-6 p-5 bg-purple-50 border border-purple-200 rounded-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 mb-2">
            Mô tả biểu mẫu
          </p>
          <p className="text-sm font-medium text-purple-900">
            {content.summary}
          </p>
        </div>
      )}

      {/* Ghi chú */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
        <CheckCircleIcon className="h-5 w-5 text-blue-600 stroke-2 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            Lưu ý
          </p>
          <p className="text-sm font-medium text-blue-900 mt-1">
            Dữ liệu biểu mẫu được lưu trữ dưới dạng cấu trúc đơn giản. Bạn có
            thể chỉnh sửa từng trường.
          </p>
        </div>
      </div>
    </section>
  );
}
