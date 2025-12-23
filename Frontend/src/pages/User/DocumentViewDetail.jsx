import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeftIcon,
    PrinterIcon,
    ShareIcon,
    ArrowDownTrayIcon,
    ArrowsRightLeftIcon,
    MagnifyingGlassCircleIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline';

export default function DocumentViewDetail() {
    const navigate = useNavigate();
    const { id } = useParams();

    const doc = {
        title: "GIẤY MUA BÁN NHÀ ĐẤT",
        subTitle: "NGHỊ ĐỊNH",
        description: "SỬA ĐỔI, BỔ SUNG MỘT SỐ NGHỊ ĐỊNH QUY ĐỊNH CHI TIẾT THI HÀNH LUẬT ĐẤT ĐAI",
        number: "Số: 01/2017/NĐ-CP",
        date: "Hà Nội, ngày 06 tháng 01 năm 2017"
    };

    const handleBack = () => navigate(-1);
    const handlePrint = () => window.print();
    const handleShare = () => alert("Hiển thị cửa sổ chia sẻ văn bản");
    const handleDownload = () => alert("Văn bản đang được tải xuống dạng PDF...");
    const handleCompare = () => navigate(`/van-ban/so-sanh/${id}`);
    const handleResearch = () => navigate(`/van-ban/nghien-cuu/${id}`);

    return (
        <div className="min-h-screen bg-white flex flex-col">

            <main className="max-w-6xl mx-auto w-full px-6 py-10 flex-grow">
                <div className="mb-6">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 px-6 py-1.5 bg-gray-100 text-gray-700 rounded-full font-bold text-sm hover:bg-gray-200 transition"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> Quay lại
                    </button>
                </div>

                <div className="border border-gray-300 rounded-2xl shadow-sm bg-white overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-center bg-[#fafafa]">
                        <div className="flex items-center gap-4">
                            <DocumentTextIcon className="w-8 h-8 text-gray-400" />
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic">
                                {doc.title}
                            </h2>
                        </div>

                        <div className="flex items-center gap-4 text-gray-600">
                            <button onClick={handlePrint} title="In văn bản (2)" className="hover:text-blue-600 transition">
                                <PrinterIcon className="w-7 h-7" />
                            </button>
                            <button onClick={handleShare} title="Chia sẻ văn bản (3)" className="hover:text-green-600 transition">
                                <ShareIcon className="w-7 h-7" />
                            </button>
                            <button onClick={handleDownload} title="Tải xuống PDF (4)" className="hover:text-red-600 transition">
                                <ArrowDownTrayIcon className="w-7 h-7" />
                            </button>
                            <button onClick={handleCompare} title="So sánh văn bản (5)" className="hover:text-indigo-600 transition">
                                <ArrowsRightLeftIcon className="w-7 h-7" />
                            </button>
                            <button onClick={handleResearch} title="Nghiên cứu văn bản (6)" className="hover:text-orange-600 transition">
                                <MagnifyingGlassCircleIcon className="w-7 h-7" />
                            </button>
                        </div>
                    </div>

                    <div className="p-12 md:p-20 flex flex-col items-center">
                        <div className="w-full max-w-4xl border border-gray-200 p-12 bg-white min-h-[800px] text-gray-800">
                            <div className="flex justify-between mb-12 text-sm font-medium">
                                <div className="text-center italic">
                                    <p className="uppercase">CHÍNH PHỦ</p>
                                    <p className="border-t border-gray-400 mt-1 pt-1 tracking-widest">-------</p>
                                    <p className="mt-2">{doc.number}</p>
                                </div>
                                <div className="text-center italic">
                                    <p className="uppercase font-bold tracking-tight">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                                    <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
                                    <p className="border-t border-gray-400 mt-1 pt-1 tracking-widest">---------------</p>
                                    <p className="mt-2 text-xs">{doc.date}</p>
                                </div>
                            </div>

                            <div className="text-center mb-10">
                                <h3 className="font-bold text-lg mb-2 uppercase tracking-widest">{doc.subTitle}</h3>
                                <p className="font-bold uppercase leading-relaxed max-w-2xl mx-auto italic">
                                    {doc.description}
                                </p>
                            </div>

                            <div className="space-y-6 text-sm leading-relaxed">
                                <p>Căn cứ Luật tổ chức Chính phủ ngày 19 tháng 6 năm 2015;</p>
                                <p>Căn cứ Luật đất đai ngày 29 tháng 11 năm 2013;</p>
                                <p className="italic text-gray-400 mt-20 text-center">[Phần nội dung văn bản chi tiết sẽ được tải tại đây...]</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}