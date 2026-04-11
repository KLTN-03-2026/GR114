import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from "../components/PageHeader";
import FloatingLines from "../components/FloatingLines";
<<<<<<< HEAD
import FloatingButtons from "../components/FloatingButtons"; // Đây là viên ngọc Cyan mới
import ChatbotAI from "../components/ChatbotAI";           // Đây là giao diện kính mờ mới
=======
import FloatingButtons from "../components/FloatingButtons"; 
import ChatbotAI from "../components/ChatbotAI";           
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
import Preloader from '../components/Preloader';

const WAVES_CONFIG = ['top', 'middle', 'bottom'];

const MainLayout = ({ children }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const location = useLocation();

    const [isSplineLoaded, setIsSplineLoaded] = useState(false);
    const [isMinTimePassed, setIsMinTimePassed] = useState(false);
    const [renderPreloader, setRenderPreloader] = useState(true);

    const isHomePage = location.pathname === '/';
<<<<<<< HEAD

    // 1. Logic đếm ngược 5 giây (Giữ Robot làm đại sứ thương hiệu)
=======
    
    // THÊM DÒNG NÀY: Kiểm tra xem có phải trang Admin không
    const isAdminPage = location.pathname.startsWith('/admin');

>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
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
<<<<<<< HEAD
            // Ép trình duyệt resize nền sóng
=======
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
            const fixCanvas = setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);

<<<<<<< HEAD
            // CHIẾN THUẬT QUAN TRỌNG: Hủy Robot sau 1.5s để Section 4 mượt mà
=======
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
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

<<<<<<< HEAD
            {/* --- LỚP TRÊN CÙNG: PRELOADER (Tự hủy khi load xong) --- */}
=======
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
            {renderPreloader && (
                <Preloader
                    isLoading={showPreloader}
                    onRobotLoad={() => setIsSplineLoaded(true)}
                />
            )}

<<<<<<< HEAD
            {/* --- LỚP 1: NỀN SÓNG WEBGL --- */}
=======
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
            <div className="fixed inset-0 z-[1] w-full h-full pointer-events-none">
                <FloatingLines
                    enabledWaves={WAVES_CONFIG}
                    animationSpeed={0.3}
                    mixBlendMode="screen"
                />
                <div className="absolute inset-0 bg-black/50 -z-10 w-full h-full"></div>
            </div>

<<<<<<< HEAD
            {/* --- LỚP 2: HEADER (Đã tích hợp Mega Menu "Giải pháp AI") --- */}
=======
            {/* --- NẾU MUỐN ẨN LUÔN CẢ HEADER Ở TRANG ADMIN THÌ BỌC {!isAdminPage && (...)} Ở ĐÂY --- */}
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
            <div className="fixed top-0 left-0 right-0 z-[60]">
                <Header />
            </div>

<<<<<<< HEAD
            {/* --- LỚP 3: NỘI DUNG CHÍNH --- */}
=======
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
            <main className={`flex-grow relative z-10 pt-[80px] transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                {children}
            </main>

<<<<<<< HEAD
            {/* --- LỚP 4: CÔNG CỤ TRỢ LÝ (Viên ngọc Cyan lơ lửng) --- */}
            {/* Không bọc trong container cố định để FloatingButtons tự quản lý vị trí */}
            <FloatingButtons onBotClick={() => setIsChatOpen(!isChatOpen)} />
            <ChatbotAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
=======
            {/* SỬA TẠI ĐÂY: Chỉ hiển thị Chatbot & Nút nổi khi KHÔNG PHẢI trang Admin */}
            {!isAdminPage && (
                <>
                    <FloatingButtons onBotClick={() => setIsChatOpen(!isChatOpen)} />
                    <ChatbotAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                </>
            )}
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
            
        </div>
    );
};

export default MainLayout;