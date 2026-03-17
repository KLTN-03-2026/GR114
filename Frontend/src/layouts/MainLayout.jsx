import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from "../components/PageHeader";
import FloatingLines from "../components/FloatingLines";
import FloatingButtons from "../components/FloatingButtons";
import ChatbotAI from "../components/ChatbotAI";
import Spline from '@splinetool/react-spline';

const MainLayout = ({ children }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const location = useLocation();
    
    // Chỉ cần giữ lại kiểm tra trang chủ cho con Robot 3D
    const isHomePage = location.pathname === '/';

    return (
        <div className="min-h-screen bg-black flex flex-col relative overflow-x-hidden text-white">

            {/* --- LỚP 1: NỀN SÓNG WEBGL (HIỂN THỊ XUYÊN SUỐT MỌI TRANG) --- */}
            {/* Đã xóa lớp Video và bỏ điều kiện chặn trang Contract để sóng điện từ phủ toàn bộ ứng dụng */}
            <div className="fixed inset-0 z-[1] pointer-events-none">
                <FloatingLines
                    enabledWaves={['top', 'middle', 'bottom']}
                    animationSpeed={0.3}
                    mixBlendMode="screen"
                />
                <div className="absolute inset-0 bg-black/50 -z-10"></div>
            </div>
            
            {/* --- LỚP 2: HEADER --- */}
            <div className="fixed top-0 left-0 right-0 z-[60] bg-black border-b border-white/10">
                <Header />
            </div>

           {/* --- LỚP 3: NỘI DUNG TRANG CON --- */}
            <main className="flex-grow relative z-10 pt-[80px]">
                
                {/* --- LỚP 3.5: ROBOT 3D TOÀN CỤC --- */}
                <div className={`absolute top-[80px] left-0 w-full h-[calc(100vh-80px)] z-[40] pointer-events-none flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${isHomePage ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                    
                    {/* 1. KHỐI CHỨA ROBOT: Đặt cố định chiều cao để KHÔNG BAO GIỜ bị cắt đầu/bụng */}
                    <div className="w-full max-w-3xl h-[280px] sm:h-[320px] md:h-[380px] lg:h-[450px] flex justify-center items-end pointer-events-auto z-20">
                        <Spline scene="https://prod.spline.design/dMx4Jy6SuNlBOCdL/scene.splinecode" />
                    </div>

                    {/* 2. GHOST TEXT: Dùng margin âm (-mt) để kéo chữ cắm vào robot */}
                    <div className="w-full flex justify-center opacity-0 pointer-events-none -mt-[4vw] sm:-mt-[3.5vw] md:-mt-[3vw] lg:-mt-[2.5vw] z-10">
                        <h1 className="text-[18vw] md:text-[16vw] font-black uppercase tracking-tighter leading-none m-0 p-0">
                            LEGALAI
                        </h1>
                    </div>
                </div>

                {children}
            </main>

            {/* --- LỚP 4: CÔNG CỤ HỖ TRỢ --- */}
            <div className="fixed bottom-0 right-0 z-[100]">
                <FloatingButtons onBotClick={() => setIsChatOpen(!isChatOpen)} />
                <ChatbotAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            </div>
        </div>
    );
};

export default MainLayout;