import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/PageHeader";
import ActionBar from "../components/ActionBar";
import UploadBox from "../components/UploadBox";
import ProgressBar from "../components/ProgressBar";
import axiosClient from "../api/axiosClient";
export default function Legal() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");

    const navigate = useNavigate();

    const handleCancel = () => {
        setFile(null);
        setTitle("");
        setDescription("");
        setCategory("");
    };

    const handleSave = async () => {
        if (!file) return alert("Vui lòng tải lên hợp đồng");

        setLoading(true);
        const formData = new FormData();
        formData.append("user_id", 1);
        formData.append("contract", file);

        try {
            const response = await axiosClient.post("/upload-contract", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const data = response.data;
            console.log("Upload thành công:", data);

            navigate("/ket-qua", {
                state: {
                    resultData: {
                        summary: "Hợp đồng có 3 điều khoản cần lưu ý",
                        risk_score: 80,
                        warnings: [
                            "Điều 5 sai luật lao động",
                            "Điều 7 thiếu thông tin về quyền lợi",
                            "Điều 12 mâu thuẫn với điều 4",
                        ],
                    },
                },
            });
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <Header />
            <ActionBar />

            <div className="max-w-7xl mx-auto px-6 py-8 grid md:grid-cols-2 gap-10">
                <div>
                    <label className="block mb-2 font-medium">Tiêu đề</label>
                    <input
                        className="w-full border rounded px-3 py-2"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    <label className="block mt-6 mb-2 font-medium">Mô tả</label>
                    <textarea
                        className="w-full border rounded px-3 py-2 h-32"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                <div className="space-y-8">
                    <div className="bg-white rounded-xl border p-6 space-y-4">
                        <label className="block mb-2 font-medium">Danh mục</label>
                        <select
                            className="w-full border rounded-lg px-3 py-2"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <option>Chọn danh mục</option>
                            <option>Hợp đồng lao động</option>
                            <option>Hợp đồng thuê nhà</option>
                            <option>Hợp đồng kinh doanh</option>
                        </select>
                    </div>

                    <div className="bg-white rounded-xl border p-6 space-y-4">
                        <h3 className="text-lg font-semibold">Tải lên hợp đồng</h3>
                        <UploadBox onFileSelect={setFile} />

                        {file && (
                            <p className="text-sm text-gray-600">
                                Đã chọn: <span className="font-medium">{file.name}</span>
                            </p>
                        )}

                        {loading && <ProgressBar progress={progress} />}
                    </div>
                </div>
            </div>

            <div className="flex justify-center gap-4 border-t pt-6">
                <button
                    onClick={handleCancel}
                    className="px-6 py-2 rounded-lg border bg-gray-300 text-black hover:bg-gray-400"
                >
                    Hủy
                </button>
                <button
                    onClick={handleSave}
                    className="px-6 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                >
                    Lưu thay đổi
                </button>
            </div>
        </div>
    );
}
