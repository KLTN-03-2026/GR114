import React, { useState } from 'react';
import Header from "../../components/PageHeader";
import {
    CalendarDaysIcon,
    UserGroupIcon,
    ClockIcon,
    VideoCameraIcon,
    MapPinIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';

export default function Booking() {
    const [step, setStep] = useState(1);
    const [bookingData, setBookingData] = useState({
        lawyer: "",
        service: "",
        date: "",
        time: "",
        type: "Trực tuyến"
    });

    const lawyers = [
        { id: 1, name: "Luật sư Nguyễn Văn A", specialty: "Luật Dân sự & Đất đai" },
        { id: 2, name: "Luật sư Trần Thị B", specialty: "Luật Doanh nghiệp & Thương mại" },
        { id: 3, name: "Luật sư Lê Văn C", specialty: "Luật Hình sự" },
    ];

    const services = [
        "Tư vấn hợp đồng chuyên sâu",
        "Giải quyết tranh chấp đất đai",
        "Thủ tục thành lập doanh nghiệp",
        "Tư vấn thừa kế và tài sản"
    ];

    const handleCompleteBooking = () => {
        alert("Yêu cầu đặt lịch của bạn đã được gửi thành công!");
        setStep(1);
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
            <Header />

            <main className="max-w-5xl mx-auto px-4 py-12">
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900">
                        Đặt lịch tư vấn pháp lý
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Kết nối trực tiếp với chuyên gia pháp lý hàng đầu</p>
                </div>
                <div className="flex justify-center items-center mb-12 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step >= i ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                {i}
                            </div>
                            {i !== 3 && <div className={`w-12 h-1 ${step > i ? 'bg-slate-900' : 'bg-slate-200'}`}></div>}
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden min-h-[500px] flex flex-col">
                    {step === 1 && (
                        <div className="p-10 space-y-10 animate-fadeIn">
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <UserGroupIcon className="w-4 h-4" /> Chọn luật sư tư vấn
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {lawyers.map((lawyer) => (
                                        <button
                                            key={lawyer.id}
                                            onClick={() => setBookingData({ ...bookingData, lawyer: lawyer.name })}
                                            className={`p-6 rounded-2xl border-2 text-left transition-all ${bookingData.lawyer === lawyer.name ? 'border-slate-900 bg-slate-50 shadow-md' : 'border-slate-100 hover:border-slate-300'}`}
                                        >
                                            <p className="font-bold text-slate-800">{lawyer.name}</p>
                                            <p className="text-xs text-slate-400 mt-1">{lawyer.specialty}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dịch vụ cần hỗ trợ</label>
                                <select
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 appearance-none"
                                    onChange={(e) => setBookingData({ ...bookingData, service: e.target.value })}
                                >
                                    <option value="">Chọn loại dịch vụ</option>
                                    {services.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="p-10 space-y-10 animate-fadeIn">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <CalendarDaysIcon className="w-4 h-4" /> Ngày tư vấn
                                    </label>
                                    <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })} />
                                </div>
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <ClockIcon className="w-4 h-4" /> Khung giờ
                                    </label>
                                    <input type="time" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hình thức gặp mặt</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setBookingData({ ...bookingData, type: "Trực tuyến" })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all ${bookingData.type === "Trực tuyến" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-100 text-slate-500 hover:border-slate-300"}`}
                                    >
                                        <VideoCameraIcon className="w-5 h-5" /> Tư vấn Trực tuyến
                                    </button>
                                    <button
                                        onClick={() => setBookingData({ ...bookingData, type: "Trực tiếp" })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all ${bookingData.type === "Trực tiếp" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-100 text-slate-500 hover:border-slate-300"}`}
                                    >
                                        <MapPinIcon className="w-5 h-5" /> Tại văn phòng
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-10 text-center space-y-8 animate-fadeIn">
                            <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto" />
                            <h2 className="text-2xl font-black uppercase italic">Xác nhận thông tin</h2>
                            <div className="max-w-sm mx-auto p-6 bg-slate-50 rounded-2xl space-y-4 text-left">
                                <p className="text-sm"><strong>Luật sư:</strong> {bookingData.lawyer}</p>
                                <p className="text-sm"><strong>Dịch vụ:</strong> {bookingData.service}</p>
                                <p className="text-sm"><strong>Thời gian:</strong> {bookingData.time} - {bookingData.date}</p>
                                <p className="text-sm"><strong>Hình thức:</strong> {bookingData.type}</p>
                            </div>
                        </div>
                    )}

                    <div className="p-8 border-t border-slate-100 flex justify-between bg-white mt-auto">
                        <button
                            disabled={step === 1}
                            onClick={() => setStep(step - 1)}
                            className="px-8 py-2.5 rounded-xl font-bold text-sm text-slate-400 hover:text-slate-900 disabled:opacity-0"
                        >
                            Quay lại
                        </button>
                        <button
                            onClick={() => step === 3 ? handleCompleteBooking() : setStep(step + 1)}
                            className="px-10 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                        >
                            {step === 3 ? "Hoàn tất đặt lịch" : "Tiếp theo"}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}