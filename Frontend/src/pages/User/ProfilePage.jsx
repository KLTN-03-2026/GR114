import React, { useState } from 'react';
import EditProfileModal from "../../components/EditProfileModal";
import { useNavigate } from 'react-router-dom';
import {
    UserIcon,
    CalendarDaysIcon,
    KeyIcon,
    ClockIcon,
    ChevronRightIcon,
    ScaleIcon,
    ChatBubbleBottomCenterTextIcon,
    EyeIcon,
    EyeSlashIcon,
    MapPinIcon,
    VideoCameraIcon
} from '@heroicons/react/24/outline';

export default function ProfilePage() {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');

    const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
    const [passData, setPassData] = useState({ current: "", new: "", confirm: "" });
    const navigate = useNavigate();
    const user = {
        username: "vanquy263",
        fullName: "Huỳnh Văn Quý",
        email: "vanquy263@gmail.com",
        phone: "033 444 5555",
        address: "Thanh Khê Thạc Gián, Đà Nẵng",
        bio: "Đam mê pháp luật và công nghệ. Thích tìm hiểu các giải pháp AI trong tư vấn lý.",
        joinDate: "09/04/2025"
    };

    const appointments = [
        { id: 1, lawyer: "Luật sư Nguyễn Văn A", service: "Tư vấn Dân sự", date: "25/10/2025", time: "09:00", status: "Đã xác nhận", type: "Trực tuyến" },
        { id: 2, lawyer: "Luật sư Trần Thị B", service: "Luật Doanh nghiệp", date: "30/10/2025", time: "14:30", status: "Đang chờ", type: "Tại văn phòng" },
    ];

    const navItems = [
        { id: 'profile', label: 'Thông tin cá nhân', icon: UserIcon },
        { id: 'appointments', label: 'Quản lý lịch hẹn', icon: CalendarDaysIcon },
        { id: 'password', label: 'Đổi mật khẩu', icon: KeyIcon },
        { id: 'activity', label: 'Hoạt động gần đây', icon: ClockIcon },
    ];

    const handlePasswordChange = (e) => {
        e.preventDefault();
        if (!passData.current || !passData.new || !passData.confirm) return alert("Vui lòng nhập đủ thông tin");
        if (passData.new !== passData.confirm) return alert("Mật khẩu không trùng khớp");
        alert("Đổi mật khẩu thành công");
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <>
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 rounded-t-2xl z-10">
                            <h2 className="text-2xl font-extrabold text-slate-800">Thông Tin Cá Nhân</h2>
                            <button onClick={() => setIsEditModalOpen(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all hover:shadow-lg active:scale-95">Chỉnh sửa</button>
                        </div>
                        <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
                            {[
                                { label: "Tên người dùng", value: `@${user.username}` },
                                { label: "Email", value: user.email },
                                { label: "Họ và tên", value: user.fullName },
                                { label: "Số điện thoại", value: user.phone },
                                { label: "Địa chỉ", value: user.address, fullWidth: true },
                                { label: "Giới thiệu", value: user.bio, fullWidth: true, isItalic: true },
                            ].map((field, index) => (
                                <div key={index} className={`${field.fullWidth ? "md:col-span-2" : ""}`}>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{field.label}</p>
                                    <p className={`text-[17px] font-medium text-slate-700 ${field.isItalic ? "italic text-slate-500" : ""}`}>{field.value}</p>
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 'appointments':
                return (
                    <>
                        <div className="p-8 border-b border-slate-100 bg-white sticky top-0 rounded-t-2xl z-10">
                            <h2 className="text-2xl font-extrabold text-slate-800">Lịch Hẹn Của Tôi</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            {appointments.map((app) => (
                                <div key={app.id} className="p-6 border border-slate-100 rounded-2xl bg-white hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${app.status === 'Đã xác nhận' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{app.status}</span>
                                            <span className="flex items-center gap-1 text-slate-400 text-sm">
                                                {app.type === "Trực tuyến" ? <VideoCameraIcon className="w-4 h-4" /> : <MapPinIcon className="w-4 h-4" />}
                                                {app.type}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-800">{app.service}</h3>
                                        <p className="text-slate-500 text-sm font-medium">{app.lawyer}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center md:justify-end gap-2 text-slate-900 font-bold">
                                            <ClockIcon className="w-5 h-5 text-slate-400" />
                                            {app.time} - {app.date}
                                        </div>
                                        <button className="mt-3 text-sm font-bold text-slate-400 hover:text-red-500 transition-colors">Hủy lịch hẹn</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 'password':
                return (
                    <div className="p-10 flex flex-col items-center animate-fadeIn">
                        <h2 className="text-2xl font-bold text-slate-800 mb-10 tracking-tight">Đổi mật khẩu</h2>

                        <form onSubmit={handlePasswordChange} className="w-full max-w-xl space-y-5">
                            {['current', 'new', 'confirm'].map((field) => (
                                <div key={field} className="relative">
                                    <KeyIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />

                                    <input
                                        type={showPass[field] ? "text" : "password"}
                                        placeholder={
                                            field === 'current' ? "Mật khẩu hiện tại" :
                                                field === 'new' ? "Mật khẩu mới" :
                                                    "Nhập lại mật khẩu mới"
                                        }
                                        className="w-full pl-16 pr-16 py-5 bg-[#eeeeee] border-none rounded-full outline-none focus:ring-2 focus:ring-slate-300 transition-all text-slate-600 placeholder:text-slate-400"
                                        onChange={(e) => setPassData({ ...passData, [field]: e.target.value })}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPass({ ...showPass, [field]: !showPass[field] })}
                                        className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPass[field] ? <EyeSlashIcon className="w-6 h-6" /> : <EyeIcon className="w-6 h-6" />}
                                    </button>
                                </div>
                            ))}

                            <div className="flex flex-col md:flex-row justify-between items-start gap-6 px-6 pt-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/quen-mat-khau')} // Lệnh chuyển trang
                                    className="text-sm font-medium text-slate-500 hover:text-slate-800 underline decoration-slate-300 underline-offset-4 transition-all"
                                >
                                    Bạn đã quên mật khẩu hiện tại?
                                </button>

                                <p className="text-[10px] text-slate-400 leading-relaxed max-w-[280px] md:text-right italic font-medium">
                                    Mật khẩu bạn của bạn phải có tối thiểu 6 ký tự, đồng thời bao gồm cả chữ và số, chữ cái và ký tự đặc biệt.
                                </p>
                            </div>

                            <div className="flex justify-center pt-8">
                                <button
                                    type="submit"
                                    className="px-20 py-4 bg-[#b2a4a3] text-slate-800 rounded-full font-bold text-lg hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                                >
                                    Đổi mật khẩu
                                </button>
                            </div>
                        </form>
                    </div>
                );
                return (
                    <>
                        <div className="p-8 border-b border-slate-100 bg-white sticky top-0 rounded-t-2xl z-10 text-center text-2xl font-extrabold text-slate-800">Đổi Mật Khẩu</div>
                        <form onSubmit={handlePasswordChange} className="p-10 max-w-xl mx-auto w-full space-y-6">
                            {['current', 'new', 'confirm'].map((field) => (
                                <div key={field} className="relative">
                                    <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type={showPass[field] ? "text" : "password"}
                                        placeholder={field === 'current' ? "Mật khẩu hiện tại" : field === 'new' ? "Mật khẩu mới" : "Nhập lại mật khẩu mới"}
                                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                                        onChange={(e) => setPassData({ ...passData, [field]: e.target.value })}
                                    />
                                    <button type="button" onClick={() => setShowPass({ ...showPass, [field]: !showPass[field] })} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPass[field] ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            ))}
                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98]">Cập nhật mật khẩu</button>
                        </form>
                    </>
                );
            case 'activity':
                return (
                    <>
                        <div className="p-8 border-b border-slate-100 bg-white sticky top-0 rounded-t-2xl z-10 text-2xl font-extrabold text-slate-800">Hoạt Động Cá Nhân</div>
                        <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8 text-center uppercase tracking-widest font-bold">
                            <div className="p-10 bg-white border border-slate-200 rounded-2xl hover:border-slate-900 transition-all group">
                                <ScaleIcon className="w-12 h-12 mx-auto mb-4 text-slate-300 group-hover:text-slate-900" />
                                <div className="text-4xl mb-1">03</div><div className="text-xs text-slate-400">Vụ án</div>
                            </div>
                            <div className="p-10 bg-white border border-slate-200 rounded-2xl hover:border-slate-900 transition-all group">
                                <CalendarDaysIcon className="w-12 h-12 mx-auto mb-4 text-slate-300 group-hover:text-slate-900" />
                                <div className="text-4xl mb-1">05</div><div className="text-xs text-slate-400">Cuộc hẹn</div>
                            </div>
                            <div className="md:col-span-2 p-10 bg-white border border-slate-200 rounded-2xl hover:border-slate-900 transition-all group">
                                <ChatBubbleBottomCenterTextIcon className="w-12 h-12 mx-auto mb-4 text-slate-300 group-hover:text-slate-900" />
                                <div className="text-4xl mb-1">02</div><div className="text-xs text-slate-400">Tư vấn</div>
                            </div>
                        </div>
                    </>
                );
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
            <main className="max-w-6xl mx-auto px-4 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <aside className="lg:col-span-4 space-y-6 text-center">
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                            <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center border border-slate-200 shadow-inner">
                                <UserIcon className="w-12 h-12 text-slate-300" />
                            </div>
                            <h2 className="font-bold text-xl">{user.fullName}</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase mt-1">Khách hàng</p>
                            <div className="mt-6 pt-6 border-t border-slate-100 flex justify-around text-xs font-semibold">
                                <div><p className="text-slate-400">Tham gia</p><p>{user.joinDate}</p></div>
                                <div><p className="text-slate-400">Trạng thái</p><p className="text-green-600">Đã xác thực</p></div>
                            </div>
                        </div>
                        <nav className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm overflow-hidden text-left">
                            {navItems.map((item) => (
                                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center justify-between px-4 py-4 rounded-xl transition-all ${activeTab === item.id ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "text-slate-600 hover:bg-slate-50"}`}>
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-5 h-5" />
                                        <span className="font-bold text-sm">{item.label}</span>
                                    </div>
                                    {activeTab === item.id && <ChevronRightIcon className="w-4 h-4" />}
                                </button>
                            ))}
                        </nav>
                    </aside>
                    <section className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 min-h-[600px] shadow-sm overflow-hidden">
                        {renderTabContent()}
                    </section>
                </div>
            </main>
            <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} userData={user} />
        </div>
    );
}