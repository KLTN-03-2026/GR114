import React from 'react';
import { CpuChipIcon, UserCircleIcon } from '@heroicons/react/24/outline';

const FloatingButtons = ({ onBotClick, onLawyerClick }) => {
  return (
    <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-40">
      <button 
        onClick={onBotClick}
        title="Trò chuyện với BotAI"
        className="p-3 bg-white rounded-full shadow-lg border border-gray-100 hover:scale-110 transition-all text-gray-700 hover:text-blue-600 group"
      >
        <CpuChipIcon className="w-8 h-8" />
      </button>

      <button 
        onClick={onLawyerClick || (() => alert("Đang kết nối với Luật sư..."))}
        title="Chat trực tiếp với Luật sư"
        className="p-3 bg-white rounded-full shadow-lg border border-gray-100 hover:scale-110 transition-all text-gray-700 hover:text-red-600"
      >
        <UserCircleIcon className="w-8 h-8" />
      </button>
    </div>
  );
};

export default FloatingButtons;