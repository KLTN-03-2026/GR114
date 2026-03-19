import React from 'react';
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline';

const FloatingButtons = ({ onBotClick }) => {
  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      {/* Nút Chatbot lơ lửng */}
      <button
        onClick={onBotClick}
        className="group relative w-16 h-16 flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-95"
      >
        {/* LỚP 1: QUẦNG SÁNG (GLOW) - Tạo độ rực rỡ lan tỏa ra nền */}
        <div className="absolute inset-0 rounded-full bg-cyan-500/40 blur-xl group-hover:bg-cyan-500/60 transition-all animate-pulse"></div>
        
        {/* LỚP 2: VIÊN NGỌC CHÍNH (THE GEM) */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-700 border border-white/30 shadow-[0_0_30px_rgba(34,211,238,0.6)] flex items-center justify-center overflow-hidden">
          
          {/* Hiệu ứng phản chiếu ánh sáng (Glass Reflection) */}
          <div className="absolute top-1 left-2 w-3/4 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-full blur-[1px] -rotate-12"></div>
          
          {/* Hiệu ứng tia sáng quét qua khi Hover */}
          <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"></div>

          {/* ICON CHÍNH */}
          <ChatBubbleLeftEllipsisIcon className="w-8 h-8 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] group-hover:rotate-12 transition-transform duration-300 z-10" />
        </div>

        {/* TOOLTIP NHỎ (Hiện lên khi hover) */}
        <div className="absolute right-20 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md text-cyan-400 text-[10px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          Hỏi Trợ lý AI
        </div>
      </button>
    </div>
  );
};

export default FloatingButtons;