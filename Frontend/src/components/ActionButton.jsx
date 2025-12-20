export default function ActionButton({ loading, onClick }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`
                px-6 py-3 rounded-lg text-white font-medium transition
                ${loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"}
            `}
        >
            {loading ? "Đang phân tích..." : "Phân tích hợp đồng"}
        </button>
    );
}
