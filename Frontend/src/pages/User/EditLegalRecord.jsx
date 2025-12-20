import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/PageHeader";
import UploadBox from "../../components/UploadBox";
import axiosClient from "../../api/axiosClient";

export default function EditLegalRecord() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [title, setTitle] = useState(""); 
    const [category, setCategory] = useState(""); 
    const [description, setDescription] = useState(""); 
    const [file, setFile] = useState(null); 
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setTitle("GIẤY MUA BÁN NHÀ ĐẤT");
        setCategory("Hợp đồng kinh doanh");
        setDescription("Hồ sơ mua bán nhà đất tại quận 1");
    }, [id]);

    const handleCancel = () => {
        if (window.confirm("Bạn có chắc muốn huỷ các thay đổi?")) {
            navigate(-1); 
        }
    };

    const handleUpdate = async () => {
        if (!title.trim()) return alert("Vui lòng nhập tiêu đề");

        setLoading(true);
        const formData = new FormData();
        formData.append("title", title);
        formData.append("category", category);
        formData.append("description", description);
        if (file) formData.append("contract", file);

        try {
          
            
            alert("Hệ thống lưu thay đổi và hiển thị hồ sơ với bản đã chỉnh sửa thành công!");
            navigate("/ho-so-phap-ly"); 
        } catch (err) {
            alert("Lỗi: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Header />

            <main className="max-w-7xl mx-auto w-full px-6 py-10 flex-grow">
                <div className="flex justify-between items-center mb-10">
                    <button 
                        onClick={() => navigate(-1)}
                        className="px-6 py-1.5 bg-gray-100 rounded-full font-bold text-gray-600 hover:bg-gray-200"
                    >
                        Quay lại
                    </button>
                    <div className="flex gap-3">
                        <button className="px-6 py-2 bg-green-500 text-white rounded-lg font-bold text-sm">Tải xuống</button>
                        <button className="px-6 py-2 bg-blue-400 text-white rounded-lg font-bold text-sm">Chia sẻ</button>
                        <button className="px-6 py-2 bg-pink-400 text-white rounded-lg font-bold text-sm">Phân tích</button>
                        <button className="px-6 py-2 bg-red-500 text-white rounded-lg font-bold text-sm">Xoá</button>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-16">
                    <div className="space-y-8">
                        <div>
                            <label className="block font-black text-gray-800 mb-2 uppercase italic tracking-tighter">Tiêu đề</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Nhập tiêu đề hồ sơ"
                            />
                        </div>

                        <div>
                            <label className="block font-black text-gray-800 mb-2 uppercase italic tracking-tighter">Mô tả</label>
                            <textarea
                                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 h-48 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Nhập mô tả hồ sơ"
                            />
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <label className="block font-black text-gray-800 mb-2 uppercase italic tracking-tighter">Danh mục</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                <option value="">Chọn danh mục hồ sơ</option>
                                <option>Hợp đồng lao động</option>
                                <option>Hợp đồng thuê nhà</option>
                                <option>Hợp đồng kinh doanh</option>
                            </select>
                        </div>

                        <div>
                            <label className="block font-black text-gray-800 mb-2 uppercase italic tracking-tighter">Thay thế file</label>
                            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 p-2">
                                <UploadBox onFileSelect={setFile} />
                                {file && (
                                    <p className="mt-2 text-sm text-blue-600 font-medium text-center">
                                        File mới: {file.name}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center gap-6 mt-16 border-t pt-10">
                    <button
                        onClick={handleCancel}
                        className="px-12 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-black uppercase tracking-widest hover:bg-gray-300 transition"
                    >
                        Huỷ
                    </button>
                    <button
                        onClick={handleUpdate}
                        disabled={loading}
                        className="px-12 py-2.5 rounded-lg bg-blue-500 text-white font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg disabled:bg-gray-400"
                    >
                        {loading ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                </div>
            </main>
        </div>
    );
}