import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from "../components/PageHeader";
import FloatingLines from "../components/FloatingLines";
import FloatingButtons from "../components/FloatingButtons"; // Đây là viên ngọc Cyan mới
import ChatbotAI from "../components/ChatbotAI";           // Đây là giao diện kính mờ mới
import Preloader from '../components/Preloader';

const WAVES_CONFIG = ['top', 'middle', 'bottom'];

const MainLayout = ({ children }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const location = useLocation();

    const [isSplineLoaded, setIsSplineLoaded] = useState(false);
    const [isMinTimePassed, setIsMinTimePassed] = useState(false);
    const [renderPreloader, setRenderPreloader] = useState(true);

    const isHomePage = location.pathname === '/';

    // 1. Logic đếm ngược 5 giây (Giữ Robot làm đại sứ thương hiệu)
    useEffect(() => {
        if (isHomePage) {
            const timer = setTimeout(() => setIsMinTimePassed(true), 5000);
            return () => clearTimeout(timer);
        } else {
            setIsMinTimePassed(true);
            setIsSplineLoaded(true);
            setRenderPreloader(false); 
        }
    }, [isHomePage]);

    const isReady = isMinTimePassed && isSplineLoaded;
    const showPreloader = isHomePage && !isReady;

    useEffect(() => {
        if (isReady) {
            // Ép trình duyệt resize nền sóng
            const fixCanvas = setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);

            // CHIẾN THUẬT QUAN TRỌNG: Hủy Robot sau 1.5s để Section 4 mượt mà
            const clearMemory = setTimeout(() => {
                setRenderPreloader(false);
            }, 1500);

            return () => {
                clearTimeout(fixCanvas);
                clearTimeout(clearMemory);
            };
        }
    }, [isReady]);

    return (
        <div className="min-h-screen bg-black flex flex-col relative w-full overflow-x-hidden text-white selection:bg-cyan-500/30">

            {/* --- LỚP TRÊN CÙNG: PRELOADER (Tự hủy khi load xong) --- */}
            {renderPreloader && (
                <Preloader
                    isLoading={showPreloader}
                    onRobotLoad={() => setIsSplineLoaded(true)}
                />
            )}

            {/* --- LỚP 1: NỀN SÓNG WEBGL --- */}
            <div className="fixed inset-0 z-[1] w-full h-full pointer-events-none">
                <FloatingLines
                    enabledWaves={WAVES_CONFIG}
                    animationSpeed={0.3}
                    mixBlendMode="screen"
                />
                <div className="absolute inset-0 bg-black/50 -z-10 w-full h-full"></div>
            </div>

            {/* --- LỚP 2: HEADER (Đã tích hợp Mega Menu "Giải pháp AI") --- */}
            <div className="fixed top-0 left-0 right-0 z-[60]">
                <Header />
            </div>

            {/* --- LỚP 3: NỘI DUNG CHÍNH --- */}
            <main className={`flex-grow relative z-10 pt-[80px] transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                {children}
            </main>

            {/* --- LỚP 4: CÔNG CỤ TRỢ LÝ (Viên ngọc Cyan lơ lửng) --- */}
            {/* Không bọc trong container cố định để FloatingButtons tự quản lý vị trí */}
            <FloatingButtons onBotClick={() => setIsChatOpen(!isChatOpen)} />
            <ChatbotAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            
        </div>
    );
};

export default MainLayout;