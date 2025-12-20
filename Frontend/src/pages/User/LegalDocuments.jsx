import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from "../../components/PageHeader";

export default function LegalDocuments() {
    const navigate = useNavigate();

    const [filter, setFilter] = useState({
        keyword: "",
        type: "",
        fromDate: "",
        toDate: ""
    });

    const [documents, setDocuments] = useState([
        { id: 1, title: "Nghị quyết 41/2017/QH14", date: "10/09/2025", desc: "Nghị quyết nêu rõ các điều ..." },
        { id: 2, title: "Nghị quyết 42/2017/QH14", date: "11/10/2025", desc: "Nghị quyết nêu rõ các điều ..." }
    ]);

    const handleSearch = () => {
        console.log("Đang tìm kiếm với:", filter);
        alert("Hệ thống hiển thị danh sách văn bản dựa trên bộ lọc");
    };

    const handleViewDetail = (id) => {
        navigate(`/van-ban/chi-tiet/${id}`);
    };

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Header />

            <main className="max-w-6xl mx-auto w-full px-6 py-10 flex-grow">
                <h2 className="text-3xl font-black text-center mb-10 uppercase tracking-tighter text-gray-900 border-b pb-4">
                    Văn bản pháp luật
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    <div>
                        <label className="block font-bold text-sm mb-2 text-gray-800">Từ khoá </label>
                        <input
                            type="text"
                            className="w-full bg-gray-100 border-none rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                            onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block font-bold text-sm mb-2 text-gray-800">Loại văn bản </label>
                        <select
                            className="w-full bg-gray-100 border-none rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none appearance-none"
                            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                        >
                            <option value="">Chọn loại</option>
                            <option>Nghị quyết</option>
                            <option>Nghị định</option>
                            <option>Thông tư</option>
                        </select>
                    </div>
                    <div>
                        <label className="block font-bold text-sm mb-2 text-gray-800">Từ ngày </label>
                        <input
                            type="text"
                            placeholder="dd/mm/yyyy"
                            className="w-full bg-gray-100 border-none rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                            onChange={(e) => setFilter({ ...filter, fromDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block font-bold text-sm mb-2 text-gray-800">Đến ngày </label>
                        <input
                            type="text"
                            placeholder="dd/mm/yyyy"
                            className="w-full bg-gray-100 border-none rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                            onChange={(e) => setFilter({ ...filter, toDate: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex justify-center mb-12">
                    <button
                        onClick={handleSearch}
                        className="bg-[#48bfff] text-white px-16 py-2.5 rounded-full font-bold text-lg hover:bg-blue-500 transition shadow-md"
                    >
                        Tìm kiếm
                    </button>
                </div>

                <p className="text-gray-600 italic mb-6">Tìm thấy {documents.length} văn bản pháp luật</p>

                <div className="space-y-6">
                    {documents.map((doc) => (
                        <div key={doc.id} className="border-2 border-gray-300 rounded-xl p-6 relative bg-white hover:border-blue-300 transition-colors">
                            <h3 className="font-black text-gray-900 text-lg mb-2 uppercase italic">{doc.title}</h3>
                            <div className="text-gray-600 space-y-1 mb-12">
                                <p>Ngày ban hành: {doc.date}</p>
                                <p>{doc.desc}</p>
                            </div>

                            <div className="absolute bottom-4 right-4">
                                <button
                                    onClick={() => handleViewDetail(doc.id)}
                                    className="bg-[#48bfff] text-white pl-8 pr-4 py-2 rounded-full font-bold flex items-center gap-4 hover:bg-blue-500 transition group"
                                >
                                    Xem chi tiết
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6 group-hover:translate-x-1 transition-transform">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}