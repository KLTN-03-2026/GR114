import { useState } from "react";

export default function UploadBox({ onFileSelect }) {
    const [dragging, setDragging] = useState(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFileSelect(file);
    };

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition
                ${dragging ? "border-red-600 bg-red-50" : "border-gray-300 hover:border-red-500"}
            `}
        >
            <input
                type="file"
                hidden
                id="upload"
                onChange={(e) => onFileSelect(e.target.files[0])}
            />
            <label htmlFor="upload" className="cursor-pointer">
                <p className="text-gray-700">
                    Kéo & thả hợp đồng vào đây
                </p>
                <span className="text-xs text-gray-400">
                    hoặc click để chọn file (PDF, DOCX)
                </span>
            </label>
        </div>
    );
}
