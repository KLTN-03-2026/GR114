import React, { useState } from 'react';
import Header from "../../components/PageHeader";
import HeroSection from "../../components/HeroSection";
import FloatingButtons from "../../components/FloatingButtons";
import ChatbotAI from "../../components/ChatbotAI";
import FloatingLines from "../../components/FloatingLines";

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      
      {/* Nền hiệu ứng sóng uốn lượn */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <FloatingLines 
          enabledWaves={['top', 'middle', 'bottom']}
          lineCount={[10, 15, 20]}
          lineDistance={[8, 6, 4]}
          bendRadius={5.0}
          bendStrength={-0.5}
          interactive={true}
          parallax={true}
          animationSpeed={0.4}
        />
      </div>

      <div className="relative z-50">
        <Header />
      </div>

      <main className="flex-grow flex items-center justify-center relative z-10 bg-transparent">
        <HeroSection />
      </main>

      {/* Mũi tên cuộn xuống */}
      <div className="flex justify-center pb-8 opacity-20 animate-bounce relative z-10">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <div className="relative z-[100]">
        <FloatingButtons onBotClick={() => setIsChatOpen(!isChatOpen)} />
        <ChatbotAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>
    </div>
  );
}