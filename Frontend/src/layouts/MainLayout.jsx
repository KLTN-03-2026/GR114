import React, { useState } from 'react';
import Header from "../components/PageHeader";
import FloatingLines from "../components/FloatingLines";
import FloatingButtons from "../components/FloatingButtons";
import ChatbotAI from "../components/ChatbotAI";

const MainLayout = ({ children }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-x-hidden text-white">
      {/* 1. Nền WebGL cố định toàn bộ ứng dụng */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <FloatingLines 
          enabledWaves={['top', 'middle', 'bottom']}
          animationSpeed={0.3}
          // Bạn có thể chỉnh độ mờ của lines ở đây nếu trang con quá khó đọc
          mixBlendMode="screen" 
        />
      </div>

      {/* 2. Header cố định phía trên */}
      <div className="relative z-[60]">
        <Header />
      </div>

      {/* 3. Nội dung trang con: Thêm z-10 và padding-top để không bị Header đè */}
      <main className="flex-grow relative z-10 pt-24 pb-12">
        {children}
      </main>

      {/* 4. Các công cụ hỗ trợ luôn nổi lên trên cùng */}
      <div className="relative z-[100]">
        <FloatingButtons onBotClick={() => setIsChatOpen(!isChatOpen)} />
        <ChatbotAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>
    </div>
  );
};

export default MainLayout;