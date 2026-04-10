export default function ActionBar() {
    return (
        <div className="flex flex-col md:flex-row gap-4 md:gap-0 md:justify-between bg-white px-6 md:px-8 py-4 border-b">
            <button className="rounded-full bg-gray-200 px-5 py-2 text-sm w-fit">
                Quay lại
            </button>

            <div className="flex flex-wrap gap-3">
                <button className="bg-green-500 text-white px-4 py-2 rounded">
                    Tải xuống
                </button>
                <button className="bg-blue-400 text-white px-4 py-2 rounded">
                    Chia sẻ
                </button>
                <button className="bg-pink-400 text-white px-4 py-2 rounded">
                    Phân tích
                </button>
                <button className="bg-red-500 text-white px-4 py-2 rounded">
                    Xóa
                </button>
            </div>
        </div>
    );
}
