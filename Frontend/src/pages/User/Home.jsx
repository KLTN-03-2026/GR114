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

     
    </div>
  );
}