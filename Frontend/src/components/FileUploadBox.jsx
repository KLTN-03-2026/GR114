import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";

export default function UploadContract() {
  return (
    <div className="min-h-screen bg-red-600 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-xl p-6 shadow-lg">

        <h1 className="text-xl font-semibold text-gray-800 mb-4">
          Upload Contract
        </h1>

        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">
            Contract name
          </label>
          <input
            type="text"
            placeholder="Enter contract name"
            className="w-full rounded-md border border-gray-300 px-3 py-2
                       text-sm focus:outline-none focus:ring-2
                       focus:ring-red-400"
          />
        </div>

        <label
          className="mb-6 flex cursor-pointer flex-col items-center
                     justify-center rounded-md border-2 border-dashed
                     border-gray-300 py-8 text-center
                     hover:border-red-400 transition"
        >
          <ArrowUpTrayIcon className="h-8 w-8 text-gray-500 mb-2" />
          <p className="text-sm text-gray-600">
            Click to upload or drag & drop
          </p>
          <p className="text-xs text-gray-400 mt-1">
            PDF or DOCX
          </p>
          <input type="file" className="hidden" />
        </label>

        <button
          className="w-full rounded-md bg-red-600 py-2
                     text-sm font-medium text-white
                     hover:bg-red-700 transition"
        >
          Analyze
        </button>
      </div>
    </div>
  );
}
