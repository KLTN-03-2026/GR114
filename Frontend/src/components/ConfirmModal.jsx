import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function ConfirmModal({
    isOpen,
    title = 'Xác nhận thao tác',
    message = 'Bạn có chắc muốn tiếp tục?',
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    loading = false,
    tone = 'danger',
    onClose,
    onConfirm
}) {
    if (!isOpen) return null;

    const confirmClass = tone === 'danger'
        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500/30'
        : 'bg-[#1A2530] hover:bg-[#263442] focus:ring-[#B8985D]/30';

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1A2530]/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(26,37,48,0.18)]">
                <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-red-100 bg-red-50 p-2.5">
                            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 stroke-2" />
                        </div>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-wide text-[#1A2530]">{title}</h3>
                            <p className="mt-1 text-xs font-medium uppercase tracking-widest text-[#B8985D]">Hồ sơ pháp lý</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-50 hover:text-[#1A2530] disabled:opacity-50"
                    >
                        <XMarkIcon className="h-5 w-5 stroke-2" />
                    </button>
                </div>

                <div className="px-6 py-6">
                    <p className="text-sm font-medium leading-6 text-zinc-600">{message}</p>
                </div>

                <div className="flex justify-end gap-3 border-t border-zinc-100 bg-zinc-50/70 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-[#1A2530] disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70 ${confirmClass}`}
                    >
                        {loading ? 'Đang xử lý...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
