import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from "../components/PageHeader";
//import FloatingLines from "../components/FloatingLines";
import FloatingButtons from "../components/FloatingButtons"; 
import ChatbotAI from "../components/ChatbotAI";           
import Preloader from '../components/Preloader';
import { Toaster } from 'react-hot-toast';

const WAVES_CONFIG = ['top', 'middle', 'bottom'];

const MainLayout = ({ children }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const location = useLocation();

    const [isSplineLoaded, setIsSplineLoaded] = useState(false);
    const [isMinTimePassed, setIsMinTimePassed] = useState(false);
    const [renderPreloader, setRenderPreloader] = useState(true);

    const isHomePage = location.pathname === '/';
    
    // Kiểm tra xem có phải trang Admin không
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

    // LỚP VỎ CHÍNH: Nền #f8f9fa, Chữ mặc định #1A2530, Bôi đen ra màu Vàng Đồng
    return (
        <div className="min-h-screen bg-[#f8f9fa] flex flex-col relative w-full overflow-x-hidden text-[#1A2530] selection:bg-[#B8985D]/30 selection:text-[#1A2530] antialiased">

            {renderPreloader && (
                <Preloader
                    isLoading={showPreloader}
                    onRobotLoad={() => setIsSplineLoaded(true)}
                />
            )}

            {/* HỆ THỐNG LỚP PHỦ TỐI ƯU CHO NỀN SÁNG */}
            <div className="fixed inset-0 z-[1] w-full h-full pointer-events-none overflow-hidden">
                {/* Vệt ánh sáng Vàng Đồng nhạt ở góc trên (thay cho bg-black/50) */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#B8985D]/10 rounded-full blur-[120px] -z-10"></div>
                {/* Vệt ánh sáng Xanh/Xám nhạt ở góc dưới tạo cân bằng */}
                <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-900/5 rounded-full blur-[100px] -z-10"></div>
            </div>

            {/* --- NẾU MUỐN ẨN LUÔN CẢ HEADER Ở TRANG ADMIN THÌ BỌC {!isAdminPage && (...)} Ở ĐÂY --- */}
            <div className="fixed top-0 left-0 right-0 z-[60]">
                <Header />
            </div>

            <main className={`flex-grow relative z-10 pt-[80px] transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                {children}
            </main>

            {!isAdminPage && (
                <Toaster
                    position="top-right"
                    toastOptions={{
                        className: 'text-sm font-semibold',
                        duration: 2800,
                        style: {
                            border: '1px solid #e4e4e7',
                            borderRadius: '12px',
                            color: '#1A2530'
                        }
                    }}
                />
            )}

            {/* Chỉ hiển thị Chatbot & Nút nổi khi KHÔNG PHẢI trang Admin */}
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
