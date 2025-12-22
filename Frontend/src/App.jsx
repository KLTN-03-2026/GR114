import { useState } from "react";
import AppRouter from "./router/AppRouter";
import ChatbotAI from "./components/ChatbotAI"; // 👇 1. Import Chatbot
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline"; // Icon nút chat

export default function App() {
   // 👇 2. Quản lý trạng thái Bật/Tắt Chatbot tại đây
   const [isChatOpen, setIsChatOpen] = useState(false);

   return (
      <div className="relative min-h-screen">
         {/* --- PHẦN 1: GIAO DIỆN CHÍNH (Giữ nguyên) --- */}
         <AppRouter />

         {/* --- PHẦN 2: CHATBOT AI --- */}

         {/* A. Cửa sổ Chat (Chỉ hiện khi isChatOpen = true) */}
         <ChatbotAI
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
         />

         {/* B. Nút tròn nổi để Mở Chat (Chỉ hiện khi Chat đang đóng) */}
         {!isChatOpen && (
            <button
               onClick={() => setIsChatOpen(true)}
               className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-110 z-50 animate-bounce"
               title="Chat với Trợ lý luật sư"
            >
               <ChatBubbleLeftRightIcon className="w-8 h-8" />
            </button>
         )}
      </div>
   );
}