import React, { useState } from 'react';
import Header from "../../components/PageHeader";
import HeroSection from "../../components/HeroSection";
import FloatingButtons from "../../components/FloatingButtons";
import ChatbotAI from "../../components/ChatbotAI";

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => setIsChatOpen(!isChatOpen);

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col relative">
      <Header />

      <main className="flex-grow flex items-center">
        <HeroSection />
      </main>

      <div className="flex justify-center pb-8 opacity-30 animate-bounce">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <FloatingButtons onBotClick={toggleChat} />

      <ChatbotAI
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}