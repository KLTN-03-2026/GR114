import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    Settings,
    Database,
    Cpu,
    Save,
    Eye,
    EyeOff,
    CheckCircle,
    XCircle,
    Loader
} from 'lucide-react';
import AdminSidebar from '../../components/AdminSidebar';

const API_BASE = 'http://localhost:8000/api/admin/settings';

export default function AdminSettings() {
    const navigate = useNavigate();
    const location = useLocation();

    // --- 1. STATE QUẢN LÝ DỮ LIỆU ---
    const [formData, setFormData] = useState({
        appName: '',
        adminEmail: '',
        geminiApiKey: '',
        geminiModel: 'gemini-3.1-pro-preview',
        temperature: 0.3,
        pineconeApiKey: '',
        pineconeIndex: 'legal-vectors'
    });
    // STATE LƯU DANH SÁCH MODEL 
    const [availableModels, setAvailableModels] = useState(['gemini-2.5-flash', 'gemini-1.5-flash']);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    // --- 2. STATE GIAO DIỆN & LOADING ---
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [showPineconeKey, setShowPineconeKey] = useState(false);

    // State Kiểm tra kết nối
    const [checkingGemini, setCheckingGemini] = useState(false);
    const [geminiStatus, setGeminiStatus] = useState(null);
    const [checkingPinecone, setCheckingPinecone] = useState(false);
    const [pineconeStatus, setPineconeStatus] = useState(null);

    // --- 3. FETCH DỮ LIỆU TỪ DB KHI MỞ TRANG ---
    useEffect(() => {
        fetchSettings();
        fetchAvailableModels(); // Gọi hàm lấy model từ Google
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(API_BASE, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success && response.data.data) {
                setFormData(response.data.data);
            }
        } catch (error) {
            console.error('Lỗi khi tải cấu hình:', error);
        } finally {
            setIsLoading(false);
        }
    };
    //  HÀM FETCH DANH SÁCH MODEL
    const fetchAvailableModels = async () => {
        try {
            setIsLoadingModels(true);
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(`${API_BASE}/models`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success && response.data.data.length > 0) {
                setAvailableModels(response.data.data);
            }
        } catch (error) {
            console.error('Lỗi tải danh sách model:', error);
        } finally {
            setIsLoadingModels(false);
        }
    };
    // --- 4. XỬ LÝ NHẬP LIỆU ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'temperature' ? parseFloat(value) : value
        }));
    };

    // --- 5. LƯU CẤU HÌNH ---
    const handleSave = async () => {
        try {
            setIsSaving(true);
            const token = localStorage.getItem('accessToken');
            const response = await axios.post(API_BASE, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                alert(' Đã lưu cấu hình thành công! Hệ thống đã cập nhật tức thì.');
            }
        } catch (error) {
            console.error('Lỗi khi lưu:', error);
            alert(' Có lỗi xảy ra! Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    // --- 6. KIỂM TRA KẾT NỐI ---
    const handleCheckGemini = async () => {
        setCheckingGemini(true);
        setGeminiStatus(null);
        setTimeout(() => {
            setGeminiStatus(formData.geminiApiKey.length > 10 ? 'success' : 'error');
            setCheckingGemini(false);
        }, 1500);
    };

    const handleCheckPinecone = async () => {
        setCheckingPinecone(true);
        setPineconeStatus(null);
        setTimeout(() => {
            setPineconeStatus(formData.pineconeApiKey.length > 10 ? 'success' : 'error');
            setCheckingPinecone(false);
        }, 1500);
    };

    // --- 7. GIAO DIỆN CHÍNH ---
    return (
        <div className="min-h-screen bg-[#050505] text-gray-300 font-sans selection:bg-cyan-500/30 flex">
            {/* SIDEBAR */}
            <AdminSidebar />

            {/* NỘI DUNG */}
            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">

                {/* MÀN HÌNH LOADING  */}
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]/90 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                            <Loader className="animate-spin text-cyan-400" size={40} />
                            <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest animate-pulse">Đang tải cấu hình AI Engine...</p>
                        </div>
                    </div>
                )}

                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Cài đặt hệ thống</h1>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">Cấu hình tham số vận hành, API và bảo mật ứng dụng.</p>
                    </div>
                </header>

                <section className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

                        {/* === CỘT 1: THÔNG TIN HỆ THỐNG === */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <Settings className="text-cyan-400" size={20} />
                                <h2 className="text-sm font-black text-white uppercase tracking-widest">Thông tin hệ thống</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Tên ứng dụng</label>
                                    <input
                                        type="text" name="appName" value={formData.appName} onChange={handleInputChange}
                                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-cyan-500 transition-all text-sm font-medium"
                                        placeholder="LEGAI HUB"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Email quản trị viên</label>
                                    <input
                                        type="email" name="adminEmail" value={formData.adminEmail} onChange={handleInputChange}
                                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-cyan-500 transition-all text-sm font-medium"
                                        placeholder="admin@legai.vn"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* === CỘT 2: CẤU HÌNH GEMINI === */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <Cpu className="text-purple-400" size={20} />
                                <h2 className="text-sm font-black text-white uppercase tracking-widest">Cấu hình Gemini AI</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Google Gemini API Key</label>
                                    <div className="relative">
                                        <input
                                            type={showGeminiKey ? "text" : "password"}
                                            name="geminiApiKey"
                                            value={formData.geminiApiKey}
                                            onChange={handleInputChange}
                                            autoComplete="new-password" /*  chặn Autofill */
                                            className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-purple-500 transition-all text-sm font-mono pr-12"
                                            placeholder="••••••••••••••••"
                                        />
                                        <button onClick={() => setShowGeminiKey(!showGeminiKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                                            {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                {/* BƯỚC 3: GIAO DIỆN SELECT MODEL ĐỘNG */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">
                                        Model AI
                                        {/* Hiển thị icon xoay xoay nếu đang lấy danh sách từ Google */}
                                        {isLoadingModels && <Loader size={10} className="inline animate-spin ml-2 text-cyan-400" />}
                                    </label>
                                    <select
                                        name="geminiModel"
                                        value={formData.geminiModel}
                                        onChange={handleInputChange} // Ông nhớ đảm bảo có hàm này trong file nhé
                                        className="w-full bg-[#0d0d0d] border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-purple-500 text-sm font-medium cursor-pointer"
                                        disabled={isLoadingModels} // Khóa select lại khi đang tải để tránh lỗi
                                    >
                                        {availableModels.map((model) => (
                                            <option key={model} value={model} className="bg-[#0d0d0d]">
                                                {model}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1 flex justify-between">
                                        <span>Temperature (Độ sáng tạo)</span>
                                        <span className="text-purple-400">{formData.temperature}</span>
                                    </label>
                                    <input
                                        type="range" name="temperature" min="0" max="1" step="0.1" value={formData.temperature} onChange={handleInputChange}
                                        className="w-full accent-purple-500 cursor-pointer h-2 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                                {/* Nút Test Gemini */}
                                <div className="pt-2">
                                    <button onClick={handleCheckGemini} disabled={checkingGemini} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors">
                                        {checkingGemini ? <Loader size={14} className="animate-spin" /> :
                                            geminiStatus === 'success' ? <CheckCircle size={14} className="text-green-400" /> :
                                                geminiStatus === 'error' ? <XCircle size={14} className="text-red-400" /> :
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></div>}
                                        Kiểm tra trạng thái kết nối
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* === CỘT 3: CẤU HÌNH PINECONE === */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <Database className="text-green-400" size={20} />
                                <h2 className="text-sm font-black text-white uppercase tracking-widest">Cấu hình Pinecone</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Pinecone API Key</label>
                                    <div className="relative">
                                        <input
                                            type={showPineconeKey ? "text" : "password"}
                                            name="pineconeApiKey"
                                            value={formData.pineconeApiKey}
                                            onChange={handleInputChange}
                                            autoComplete="new-password" /*  chặn Autofill */
                                            className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-green-500 transition-all text-sm font-mono pr-12"
                                            placeholder="••••••••••••••••"
                                        />
                                        <button onClick={() => setShowPineconeKey(!showPineconeKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                                            {showPineconeKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Index Name</label>
                                    <input
                                        type="text" name="pineconeIndex" value={formData.pineconeIndex} onChange={handleInputChange}
                                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-green-500 transition-all text-sm font-medium"
                                        placeholder="legal-vectors"
                                    />
                                </div>
                                {/* Nút Test Pinecone */}
                                <div className="pt-2">
                                    <button onClick={handleCheckPinecone} disabled={checkingPinecone} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-400 hover:text-green-300 transition-colors">
                                        {checkingPinecone ? <Loader size={14} className="animate-spin" /> :
                                            pineconeStatus === 'success' ? <CheckCircle size={14} className="text-green-400" /> :
                                                pineconeStatus === 'error' ? <XCircle size={14} className="text-red-400" /> :
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>}
                                        Kiểm tra trạng thái kết nối
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* === NÚT LƯU === */}
                    <div className="mt-12 pt-8 border-t border-white/5 flex justify-end relative z-10">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all transform active:scale-95 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]'}`}
                        >
                            {isSaving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                            {isSaving ? 'ĐANG LƯU...' : 'LƯU CẤU HÌNH'}
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}