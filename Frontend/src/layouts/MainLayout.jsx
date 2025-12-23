import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from "../components/PageHeader";
import FloatingLines from "../components/FloatingLines";
import FloatingButtons from "../components/FloatingButtons";
import ChatbotAI from "../components/ChatbotAI";

// 👇 Import Video nền (Chỉ import 1 lần duy nhất ở đây)
import video_bg from '../assets/videos/video_bg.mp4';

const MainLayout = ({ children }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const location = useLocation();

  // 👇 Logic: Chỉ hiện Video khi đường dẫn là '/contract-analysis'
  const isContractPage = location.pathname === '/contract-analysis';

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-x-hidden text-white">
      
      {/* --- LỚP 1: GLOBAL VIDEO LAYER (Luôn tồn tại trong DOM) --- */}
      {/* Sử dụng CSS Opacity để ẩn/hiện thay vì Unmount/Mount -> KHẮC PHỤC ĐỘ TRỄ 0.5s */}
      <div 
        className={`fixed inset-0 z-0 transition-opacity duration-500 ease-in-out ${
          isContractPage ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="w-full h-full object-cover opacity-80"
        >
          <source src={video_bg} type="video/mp4" />
        </video>
        {/* Overlay gradient cho video */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent"></div>
      </div>

      {/* --- LỚP 2: NỀN SÓNG WEBGL (Cho các trang khác) --- */}
      {/* Chỉ hiển thị khi KHÔNG PHẢI trang Contract */}
      {!isContractPage && (
        <div className="fixed inset-0 z-[1] pointer-events-none">
            <FloatingLines 
              enabledWaves={['top', 'middle', 'bottom']}
              animationSpeed={0.3}
              mixBlendMode="screen" 
            />
            {/* Lớp phủ tối cho nền sóng để chữ dễ đọc */}
            <div className="absolute inset-0 bg-black/50 -z-10"></div>
        </div>
      )}

      {/* --- LỚP 3: HEADER --- */}
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <Header />
      </div>

      {/* --- LỚP 4: NỘI DUNG TRANG CON --- */}
      {/* Padding top 80px để nội dung không bị Header che */}
      <main className="flex-grow relative z-10 pt-[80px]">
        {children}
      </main>

      {/* --- LỚP 5: CÔNG CỤ HỖ TRỢ --- */}
      <div className="relative z-[100]">
        <FloatingButtons onBotClick={() => setIsChatOpen(!isChatOpen)} />
        <ChatbotAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>
    </div>
  );
};

export default MainLayout;