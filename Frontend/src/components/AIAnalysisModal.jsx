import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import ProgressBar from './ProgressBar';

export default function AIAnalysisModal({ isOpen, onClose, recordName }) {
    const [progress, setProgress] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setProgress(0);
            setIsFinished(false);
            const interval = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        setIsFinished(true);
                        return 100;
                    }
                    return prev + 5;
                });
            }, 100);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const handleSaveAnalysis = () => {
        alert("Hệ thống đã lưu dữ liệu phân tích vào hồ sơ thành công!");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 tracking-tight">
                        Phân tích hồ sơ pháp lí bằng AI
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <h3 className="text-2xl font-black text-gray-900 uppercase">
                        {recordName || "Hồ sơ chưa đặt tên"}
                    </h3>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-bold text-gray-500 italic">
                            <span>{isFinished ? "Hoàn thành" : "Đang phân tích..."}</span>
                            <span>{progress}%</span>
                        </div>
                        <ProgressBar progress={progress} />
                    </div>

                    {isFinished && (
                        <div className="mt-6 border-2 border-gray-100 rounded-xl p-6 bg-gray-50 animate-fadeIn">
                            <div className="flex items-center gap-2 mb-4 text-green-600">
                                <CheckCircleIcon className="w-6 h-6" />
                                <span className="font-bold text-lg">Phân tích thành công</span>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-black text-gray-800 text-lg border-b pb-2">Tóm tắt</h4>
                                <div className="text-sm text-gray-600 leading-relaxed italic">
                                    Hồ sơ này bao gồm các thông tin chính về việc chuyển nhượng bất động sản.
                                    Căn cứ vào Luật đất đai 2013 và các nghị định hướng dẫn thi hành.
                                    Các điều khoản về thanh toán và bàn giao được quy định rõ tại Điều 5 và Điều 7.
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={handleSaveAnalysis}
                            disabled={!isFinished}
                            className={`px-8 py-2.5 rounded-lg font-bold transition shadow-md ${isFinished
                                ? "bg-blue-400 text-white hover:bg-blue-500"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                }`}
                        >
                            Hoàn thành
                        </button>
                        <button
                            onClick={onClose}
                            className="px-8 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}