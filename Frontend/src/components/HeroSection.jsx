import React from 'react';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
    const navigate = useNavigate();

    return (
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center py-10">
            <div className="space-y-6">
                {/* Badge nhỏ phía trên */}
                <h3 className="text-gray-300 text-sm md:text-base font-medium tracking-[0.4em] uppercase opacity-80 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                    Giải pháp công nghệ pháp lý hiện đại
                </h3>
                
                {/* Tiêu đề chính */}
                <h1 className="text-3xl md:text-6xl font-black leading-[1.1] uppercase tracking-tighter">
                    <span className="text-white drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
                        Ứng dụng tư vấn pháp lý
                    </span> <br />
                    
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                        Tích hợp AI
                    </span> <br />
                    
                    <span className="text-white drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
                        Phân tích hợp đồng
                    </span>
                </h1>

                {/* Dòng mô tả đã được đổi sang màu Gradient giống "Tích hợp AI" để tăng độ hiển thị */}
                <p className="max-w-3xl mx-auto text-base md:text-lg font-bold leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300">
                       
                    </span>
                </p>

                {/* Nút bấm hành động */}
                <div className="pt-8 flex justify-center">
                    <button
                        onClick={() => navigate('/contract-analysis')}
                        className="group flex items-center gap-3 px-8 py-4 border border-white/40 text-white rounded-full bg-black/40 backdrop-blur-md hover:bg-white hover:text-black transition-all duration-500 hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                    >
                        <span className="font-bold uppercase tracking-widest text-sm text-white group-hover:text-black">
                            Bắt đầu phân tích
                        </span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeroSection;