import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard,
    Database,
    Users,
    Scale,
    Settings,
    ShieldCheck,
    Save,
    Cpu,
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

    // State quản lý form data
    const [formData, setFormData] = useState({
        appName: 'LEGAI HUB',
        adminEmail: 'admin@legai.vn',
        geminiApiKey: '',
        geminiModel: 'gemini-1.5-flash',
        geminiTemperature: 0.3,
        geminiSystemPrompt: 'Bạn là một trợ lý AI chuyên về luật pháp Việt Nam. Hãy trả lời chính xác, dựa trên dữ liệu pháp luật được cung cấp.',
        pineconeApiKey: '',
        pineconeEnvironment: 'us-east-1',
        pineconeIndexName: 'legal-vectors'
    });

    // State cho toggle hiển thị mật khẩu
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [showPineconeKey, setShowPineconeKey] = useState(false);

    // State cho kiểm tra kết nối
    const [checkingGemini, setCheckingGemini] = useState(false);
    const [geminiStatus, setGeminiStatus] = useState(null);
    const [checkingPinecone, setCheckingPinecone] = useState(false);
    const [pineconeStatus, setPineconeStatus] = useState(null);

    // Hàm cập nhật form data
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Hàm kiểm tra kết nối Gemini
    const handleCheckGeminiConnection = async () => {
        setCheckingGemini(true);
        setGeminiStatus(null);

        try {
            const response = await axios.post(`${API_BASE}/check-gemini`, {
                apiKey: formData.geminiApiKey,
                model: formData.geminiModel,
                temperature: formData.geminiTemperature,
                systemPrompt: formData.geminiSystemPrompt
            }, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
                }
            });

            setGeminiStatus('success');
        } catch (error) {
            console.error('Gemini check failed:', error);
            setGeminiStatus('error');
        } finally {
            setCheckingGemini(false);
        }
    };

    // Hàm kiểm tra kết nối Pinecone
    const handleCheckPineconeConnection = async () => {
        setCheckingPinecone(true);
        setPineconeStatus(null);

        try {
            const response = await axios.post(`${API_BASE}/check-pinecone`, {
                apiKey: formData.pineconeApiKey,
                environment: formData.pineconeEnvironment,
                indexName: formData.pineconeIndexName
            }, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
                }
            });

            setPineconeStatus('success');
        } catch (error) {
            console.error('Pinecone check failed:', error);
            setPineconeStatus('error');
        } finally {
            setCheckingPinecone(false);
        }
    };

    // Hàm lưu cấu hình
    const handleSave = async () => {
        try {
            const response = await axios.put(API_BASE, formData, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
                }
            });

            alert('Cấu hình đã được lưu thành công!');
        } catch (error) {
            console.error('Save failed:', error);
            alert('Lỗi khi lưu cấu hình. Vui lòng thử lại.');
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-gray-300 font-sans selection:bg-cyan-500/30 flex">
            {/* --- SIDEBAR ADMIN --- */}
            <AdminSidebar />
            {/* --- NỘI DUNG CHÍNH --- */}
            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Cài đặt hệ thống</h1>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">Cấu hình tham số vận hành, API và bảo mật ứng dụng.</p>
                    </div>
                </header>

                <section className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Nhóm 1: Thông tin hệ thống */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <Settings className="text-cyan-400" size={20} />
                                <h2 className="text-sm font-black text-white uppercase tracking-widest">Thông tin hệ thống</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Tên ứng dụng</label>
                                    <input
                                        type="text"
                                        value={formData.appName}
                                        onChange={(e) => handleInputChange('appName', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-cyan-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Email quản trị viên</label>
                                    <input
                                        type="email"
                                        value={formData.adminEmail}
                                        onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-cyan-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Nhóm 2: Cấu hình Gemini AI */}
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
                                            value={formData.geminiApiKey}
                                            onChange={(e) => handleInputChange('geminiApiKey', e.target.value)}
                                            placeholder="••••••••••••••••••••••••"
                                            className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 pr-12 rounded-xl outline-none focus:border-purple-500 transition-all text-sm font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                        >
                                            {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Model AI</label>
                                    <select
                                        value={formData.geminiModel}
                                        onChange={(e) => handleInputChange('geminiModel', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-purple-500 transition-all text-sm font-medium"
                                    >
                                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Temperature (Độ sáng tạo: {formData.geminiTemperature})</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={formData.geminiTemperature}
                                        onChange={(e) => handleInputChange('geminiTemperature', parseFloat(e.target.value))}
                                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">System Prompt</label>
                                    <textarea
                                        value={formData.geminiSystemPrompt}
                                        onChange={(e) => handleInputChange('geminiSystemPrompt', e.target.value)}
                                        rows={4}
                                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-purple-500 transition-all text-sm font-medium resize-none"
                                        placeholder="Nhập system prompt cho AI..."
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleCheckGeminiConnection}
                                        disabled={checkingGemini}
                                        className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {checkingGemini ? (
                                            <Loader size={12} className="animate-spin" />
                                        ) : geminiStatus === 'success' ? (
                                            <CheckCircle size={12} className="text-green-400" />
                                        ) : geminiStatus === 'error' ? (
                                            <XCircle size={12} className="text-red-400" />
                                        ) : (
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></div>
                                        )}
                                        {checkingGemini ? 'Đang kiểm tra...' : geminiStatus === 'success' ? 'Kết nối thành công' : geminiStatus === 'error' ? 'Kết nối thất bại' : 'Kiểm tra trạng thái kết nối'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Nhóm 3: Cấu hình Pinecone */}
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
                                            value={formData.pineconeApiKey}
                                            onChange={(e) => handleInputChange('pineconeApiKey', e.target.value)}
                                            placeholder="••••••••••••••••••••••••"
                                            className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 pr-12 rounded-xl outline-none focus:border-green-500 transition-all text-sm font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPineconeKey(!showPineconeKey)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                        >
                                            {showPineconeKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Environment</label>
                                    <select
                                        value={formData.pineconeEnvironment}
                                        onChange={(e) => handleInputChange('pineconeEnvironment', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-green-500 transition-all text-sm font-medium"
                                    >
                                        <option value="us-east-1">US East 1</option>
                                        <option value="us-west-2">US West 2</option>
                                        <option value="eu-west-1">EU West 1</option>
                                        <option value="asia-southeast-1">Asia Southeast 1</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Index Name</label>
                                    <input
                                        type="text"
                                        value={formData.pineconeIndexName}
                                        onChange={(e) => handleInputChange('pineconeIndexName', e.target.value)}
                                        placeholder="legal-vectors"
                                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl outline-none focus:border-green-500 transition-all text-sm font-medium"
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleCheckPineconeConnection}
                                        disabled={checkingPinecone}
                                        className="text-[10px] font-black uppercase tracking-widest text-green-400 hover:text-green-300 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {checkingPinecone ? (
                                            <Loader size={12} className="animate-spin" />
                                        ) : pineconeStatus === 'success' ? (
                                            <CheckCircle size={12} className="text-green-400" />
                                        ) : pineconeStatus === 'error' ? (
                                            <XCircle size={12} className="text-red-400" />
                                        ) : (
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                                        )}
                                        {checkingPinecone ? 'Đang kiểm tra...' : pineconeStatus === 'success' ? 'Kết nối thành công' : pineconeStatus === 'error' ? 'Kết nối thất bại' : 'Kiểm tra trạng thái kết nối'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-white/5 flex justify-end">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all transform active:scale-95"
                        >
                            <Save size={18} />
                            Lưu cấu hình
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}