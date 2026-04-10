import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from "../components/PageHeader";
import FloatingLines from "../components/FloatingLines";
import FloatingButtons from "../components/FloatingButtons"; 
import ChatbotAI from "../components/ChatbotAI";           
import Preloader from '../components/Preloader';

const WAVES_CONFIG = ['top', 'middle', 'bottom'];

const MainLayout = ({ children }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const location = useLocation();

    const [isSplineLoaded, setIsSplineLoaded] = useState(false);
    const [isMinTimePassed, setIsMinTimePassed] = useState(false);
    const [renderPreloader, setRenderPreloader] = useState(true);

    const isHomePage = location.pathname === '/';
    
    // THÊM DÒNG NÀY: Kiểm tra xem có phải trang Admin không
    const isAdminPage = location.pathname.startsWith('/admin');

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
            const fixCanvas = setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);

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

            {renderPreloader && (
                <Preloader
                    isLoading={showPreloader}
                    onRobotLoad={() => setIsSplineLoaded(true)}
                />
            )}

            <div className="fixed inset-0 z-[1] w-full h-full pointer-events-none">
                <FloatingLines
                    enabledWaves={WAVES_CONFIG}
                    animationSpeed={0.3}
                    mixBlendMode="screen"
                />
                <div className="absolute inset-0 bg-black/50 -z-10 w-full h-full"></div>
            </div>

            {/* --- NẾU MUỐN ẨN LUÔN CẢ HEADER Ở TRANG ADMIN THÌ BỌC {!isAdminPage && (...)} Ở ĐÂY --- */}
            <div className="fixed top-0 left-0 right-0 z-[60]">
                <Header />
            </div>

            <main className={`flex-grow relative z-10 pt-[80px] transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                {children}
            </main>

            {/* SỬA TẠI ĐÂY: Chỉ hiển thị Chatbot & Nút nổi khi KHÔNG PHẢI trang Admin */}
            {!isAdminPage && (
                <>
                    <FloatingButtons onBotClick={() => setIsChatOpen(!isChatOpen)} />
                    <ChatbotAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                </>
            )}
            
        </div>
    );
};

export default MainLayout;