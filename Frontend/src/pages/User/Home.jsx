import React from 'react';
import HeroSection from "../../components/HeroSection";



export default function Home() {


  return (
    // Container chính: Layout đã có background đen và padding-top
    <div className="w-full h-full flex flex-col justify-between min-h-[80vh]">

      {/* Phần Hero Section (Nội dung chính) */}
      <div className="flex-grow flex items-center justify-center">
        <HeroSection />
      </div>

      {/* Mũi tên cuộn xuống (Giữ lại vì nó là đặc trưng của trang chủ) */}
      <div className="flex justify-center pb-8 opacity-20 animate-bounce">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

    </div>
  );
}