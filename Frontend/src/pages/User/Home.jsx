import React from 'react';
import HeroSection from "../../components/HeroSection";

export default function Home() {
  return (
    // w-full và overflow-hidden để đảm bảo tràn viền nhưng không hiện thanh cuộn ngang
    <div className="w-full min-h-[85vh] flex flex-col justify-between relative overflow-x-hidden">

      {/* Phần Hero: Cho phép giãn tối đa */}
      <div className="w-full flex-grow flex flex-col justify-center">
        <HeroSection />
      </div>

      {/* Mũi tên cuộn xuống */}
      <div className="w-full flex justify-center pb-10 opacity-30 animate-bounce relative z-20 pointer-events-none">
        <svg className="w-8 h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

    </div>
  );
}