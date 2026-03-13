import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Header from "../components/PageHeader";
import FloatingLines from "../components/FloatingLines";
import FloatingButtons from "../components/FloatingButtons";
import ChatbotAI from "../components/ChatbotAI";
import video_bg from '../assets/videos/video_bg.mp4';

const MainLayout = ({ children }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const location = useLocation();
    const isContractPage = location.pathname === '/contract-analysis';

    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            if (isContractPage) {
                videoRef.current.play().catch(error => console.log("Video play interrupted:", error));
            } else {
                videoRef.current.pause();
            }
        }
    }, [isContractPage]);

    return (
        <div className="min-h-screen bg-black flex flex-col relative overflow-x-hidden text-white">

            {/* --- LỚP 1: GLOBAL VIDEO LAYER --- */}
            <div
                className={`fixed inset-0 z-0 transition-opacity duration-500 ease-in-out ${isContractPage ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
                    }`}
            >
                <video
                    ref={videoRef}
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover opacity-80"
                >
                    <source src={video_bg} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent"></div>
            </div>

            {/* --- LỚP 2: NỀN SÓNG WEBGL --- */}
            {!isContractPage && (
                <div className="fixed inset-0 z-[1] pointer-events-none">
                    <FloatingLines
                        enabledWaves={['top', 'middle', 'bottom']}
                        animationSpeed={0.3}
                        mixBlendMode="screen"
                    />
                    <div className="absolute inset-0 bg-black/50 -z-10"></div>
                </div>
            )}

            {/* --- LỚP 3: HEADER --- */}
            {}
            <div className="fixed top-0 left-0 right-0 z-[60] bg-black border-b border-white/10">
                <Header />
            </div>

            {/* --- LỚP 4: NỘI DUNG TRANG CON --- */}
            <main className="flex-grow relative z-10 pt-[80px]">
                {children}
            </main>

            {/* --- LỚP 5: CÔNG CỤ HỖ TRỢ --- */}
            {/* 🔴 Đã sửa: Thay relative bằng fixed bottom-0 right-0 để không chiếm diện tích thực */}
            <div className="fixed bottom-0 right-0 z-[100]">
                <FloatingButtons onBotClick={() => setIsChatOpen(!isChatOpen)} />
                <ChatbotAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            </div>
        </div>
    );
};

export default MainLayout;