import React from 'react';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
    const navigate = useNavigate();

    return (
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center w-full py-20">
            <div className="space-y-6">
                <h3 className="text-gray-500 text-lg font-medium tracking-wide">
                    Lựa chọn của bạn
                </h3>
                <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-[1.1] uppercase">
                    Chào mừng đến <br />
                    với pháp luật & <br />
                    nhân văn
                </h1>
                <p className="text-gray-600 max-w-md">
                    Hệ thống cung cấp giải pháp tư vấn pháp lý và tra cứu tích hợp trí tuệ nhân tạo (AI) giúp bạn giải quyết vấn đề nhanh chóng.
                </p>

                <button
                    onClick={() => navigate('/phap-ly')}
                    className="group flex items-center justify-center w-14 h-14 border-2 border-black rounded-full hover:bg-black hover:text-white transition-all"
                >
                    <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                </button>
            </div>

            <div className="flex justify-center">
                <img
                    src="https://png.pngtree.com/thumb_back/fh260/background/20230704/pngtree-a-stack-of-legal-books-with-a-miniature-courtroom-balanced-on-image_3721827.jpg"
                    alt="Legal AI Overview"
                    className="w-full max-w-md rounded-2xl shadow-2xl grayscale-[0.2] hover:grayscale-0 transition-all duration-500"
                />
            </div>
        </div>
    );
};

export default HeroSection;