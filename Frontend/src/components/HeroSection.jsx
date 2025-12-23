import React from 'react';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
    const navigate = useNavigate();

    // 1. Dải màu Cyan-White cho tiêu đề (Tạo sự bùng nổ)
    const titleGradient = {
        background: 'linear-gradient(to right, #00f2fe 0%, #ffffff 50%, #7fadff 100%)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shinyFlow 3s linear infinite',
    };

    // 2. Dải màu Bạc Titan cho mô tả (Sang trọng, dễ đọc, tương phản cao)
    const silverGradient = {
        background: 'linear-gradient(to right, #94a3b8 0%, #ffffff 50%, #94a3b8 100%)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shinyFlow 5s linear infinite',
    };

    return (
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center py-10">
            {/* Nhúng Keyframes và Filter để tối ưu hiển thị */}
            <style>
                {`
                    @keyframes shinyFlow {
                        0% { background-position: 0% 50%; }
                        100% { background-position: 200% 50%; }
                    }
                    .text-glow-cyan {
                        filter: drop-shadow(0 0 15px rgba(0, 242, 254, 0.4));
                    }
                    .text-shadow-deep {
                        /* Tạo lớp bóng đổ đen dày để "cứu" chữ khi gặp dải sáng trắng WebGL */
                        filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.9));
                    }
                `}
            </style>

            <div className="space-y-6">
                {/* Badge nhỏ phía trên */}
                <h3 className="text-gray-400 text-sm md:text-base font-medium tracking-[0.4em] uppercase opacity-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    Giải pháp công nghệ pháp lý hiện đại
                </h3>
                
                {/* Tiêu đề chính */}
                <h1 className="text-4xl md:text-7xl font-black leading-[1.1] uppercase tracking-tighter">
                    <span className="text-white drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">
                        Ứng dụng tư vấn pháp lý
                    </span> <br />
                    
                    <span 
                        className="inline-block text-glow-cyan"
                        style={titleGradient}
                    >
                        Tích hợp AI
                    </span> <br />
                    
                    <span className="text-white drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">
                        Phân tích hợp đồng
                    </span>
                </h1>

                {/* Dòng mô tả: Sử dụng màu Bạc Titan và Shadow sâu */}
                <p className="max-w-4xl mx-auto text-base md:text-xl font-bold leading-relaxed px-4 mt-6">
                    <span 
                        className="inline-block text-shadow-deep"
                        style={silverGradient}
                    >
                        Hệ thống cung cấp giải pháp tư vấn pháp lý và tra cứu tích hợp trí tuệ nhân tạo (AI) 
                        giúp bạn giải quyết vấn đề nhanh chóng.
                    </span>
                </p>

                {/* Nút bấm hành động (Học hỏi từ bản tham khảo: Bo tròn, có shadow lan tỏa) */}
                <div className="pt-10 flex justify-center">
                    <button
                        onClick={() => navigate('/contract-analysis')}
                        className="group relative flex items-center gap-3 px-10 py-4 text-white rounded-full overflow-hidden transition-all duration-500 hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(0,242,254,0.2)]"
                    >
                        {/* Background Layer */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-cyan-500 group-hover:from-cyan-500 group-hover:to-blue-700 transition-all duration-500"></div>
                        
                        {/* Content Layer */}
                        <span className="relative font-bold uppercase tracking-widest text-sm z-10">
                            Dùng Ngay
                        </span>
                        <div className="relative z-10 bg-white/20 p-1 rounded-full group-hover:bg-white/40 transition-colors">
                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeroSection;