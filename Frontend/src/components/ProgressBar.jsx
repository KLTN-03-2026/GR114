export default function ProgressBar({ progress }) {
    return (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
}
