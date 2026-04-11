import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";

export default function AuthPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [mode, setMode] = useState("LOGIN"); // LOGIN | REGISTER | FORGOT
    const [loading, setLoading] = useState(false);
<<<<<<< HEAD
=======
    const [errorMessage, setErrorMessage] = useState("");
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
    const [form, setForm] = useState({
        fullName: "",
        email: "",
        password: "",
    });

    // If some pages navigate with state.mode
    React.useEffect(() => {
        if (location.state?.mode === "register") setMode("REGISTER");
        if (location.state?.mode === "forgot") setMode("FORGOT");
    }, [location]);

    const onChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const backendBase = "http://localhost:8000/api";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (mode === "LOGIN") {
                const { email, password } = form;
<<<<<<< HEAD
                if (!email || !password) return alert("Vui lòng nhập email và mật khẩu");
                const res = await axios.post(`${backendBase}/auth/login`, { email, password });
                if (res.data?.user) {
                    // Ensure token is saved first so header can detect login
                    const token = res.data.token || res.data.accessToken || (res.data.data && res.data.data.token);
                    if (token) {
                        localStorage.setItem("accessToken", token);
                    } else {
                        // Fallback flag if backend doesn't return a token
                        localStorage.setItem("accessToken", "true");
                    }

                    localStorage.setItem("user", JSON.stringify(res.data.user));
                    localStorage.setItem("isLoggedIn", "true");
                    if (res.data.user.role) localStorage.setItem("userRole", res.data.user.role);
                    alert("Đăng nhập thành công");
                    // Force full reload so header reads LocalStorage synchronously
                    window.location.href = "/";
                } else {
                    alert(res.data?.message || "Đăng nhập thất bại");
=======
                if (!email || !password) {
                    setErrorMessage("Vui lòng nhập email và mật khẩu");
                    return;
                }
                const res = await axios.post(`${backendBase}/auth/login`, { email, password });
                if (res.data?.user) {
                    setErrorMessage("");
                    // 1. Lưu Token (Ưu tiên lấy từ đúng key Backend trả về)
                    const token = res.data.token || res.data.accessToken;
                    if (token) localStorage.setItem("accessToken", token);

                    // 2. Lưu thông tin User & Trạng thái
                    localStorage.setItem("user", JSON.stringify(res.data.user));
                    localStorage.setItem("isLoggedIn", "true");

                    // 3. Lưu Role 
                    const userRole = res.data.user.role; // Giả sử Backend trả về 'ADMIN' hoặc 'USER'
                    if (userRole) localStorage.setItem("userRole", userRole);

                    alert(`Chào mừng ${res.data.user.fullName || 'bạn'} quay trở lại!`);

                    //  4. ĐIỀU HƯỚNG THEO ROLE
                    if (userRole === "ADMIN") {
                        window.location.href = "/admin/dashboard";
                    } else {
                        window.location.href = "/"; // Trang chủ cho User thường
                    }
                } else {
                    setErrorMessage(res.data?.message || "Đăng nhập thất bại");
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                }
            } else if (mode === "REGISTER") {
                const { fullName, email, password } = form;
                if (!fullName || !email || !password) return alert("Vui lòng điền đầy đủ thông tin");
                const res = await axios.post(`${backendBase}/auth/register`, { fullName, email, password });
                // Gửi đúng key "fullName" khớp với Backend.
                if (res.data?.user) {
                    alert("Đăng ký thành công. Vui lòng đăng nhập");
                    setMode("LOGIN");
                    setForm({ fullName: "", email: "", password: "" });
                } else {
                    alert(res.data?.message || "Đăng ký thất bại");
                }
            } else if (mode === "FORGOT") {
                const { email } = form;
                if (!email) return alert("Vui lòng nhập email");
                const res = await axios.post(`${backendBase}/auth/forgot-password`, { email });

                if (res.data.success) {
                    alert(res.data.message);
                    setMode("RESET"); // Chuyển sang bước nhập mã PIN & mật khẩu mới
                } else {
                    alert(res.data.message || "Không thể thực hiện yêu cầu.");
                }
            } else if (mode === "RESET") {

                const { email, pin, newPassword } = form;
                if (!pin || !newPassword) return alert("Vui lòng nhập mã PIN và mật khẩu mới");
                const res = await axios.post(`${backendBase}/auth/reset-password`, { email, pin, newPassword });

                if (res.data.success) {
                    alert("Đổi mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.");
                    setMode("LOGIN");
                    setForm({ ...form, password: "", pin: "", newPassword: "" });
                } else {
                    alert(res.data.message || "Mã PIN không chính xác hoặc đã hết hạn.");
                }

            }
        } catch (err) {
            console.error(err);
<<<<<<< HEAD
            alert(err.response?.data?.message || err.message || "Lỗi server");
=======
            const message = err.response?.data?.message || err.message || "Lỗi server";
            setErrorMessage(message);
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-extrabold text-white uppercase">
                        {mode === "LOGIN" && "Đăng nhập"}
                        {mode === "REGISTER" && "Đăng ký"}
                        {mode === "FORGOT" && "Quên mật khẩu"}
                    </h1>
                    <p className="text-xs text-gray-300 mt-2">
                        {mode === "LOGIN" && "Đăng nhập để sử dụng dịch vụ LegalAI"}
                        {mode === "REGISTER" && "Tạo tài khoản mới"}
                        {mode === "FORGOT" && "Nhập email để nhận hướng dẫn khôi phục"}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "REGISTER" && (
                        <div>
                            <label className="block text-xs text-gray-300 mb-2">Họ và tên</label>
                            <input
                                name="fullName"
                                value={form.fullName}
                                onChange={onChange}
                                className="w-full px-4 py-3 bg-[#080808] text-white rounded-xl border border-white/5 outline-none"
                                placeholder="Nguyễn Văn A"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-gray-300 mb-2">Email</label>
                        <input
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={onChange}
                            className="w-full px-4 py-3 bg-[#080808] text-white rounded-xl border border-white/5 outline-none"
                            placeholder="email@domain.com"
                        />
                    </div>

                    {mode !== "FORGOT" && (
                        <div>
                            <label className="block text-xs text-gray-300 mb-2">Mật khẩu</label>
                            <input
                                name="password"
                                type="password"
                                value={form.password}
                                onChange={onChange}
                                className="w-full px-4 py-3 bg-[#080808] text-white rounded-xl border border-white/5 outline-none"
                                placeholder="Mật khẩu"
                            />
                        </div>
                    )}
                    {/* Chế độ RESET: Nhập mã PIN và Mật khẩu mới */}
                    {mode === "RESET" && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-300 mb-2">Mã PIN (6 số)</label>
                                <input
                                    name="pin"
                                    value={form.pin || ""}
                                    onChange={onChange}
                                    className="w-full px-4 py-3 bg-[#080808] text-white rounded-xl border border-white/5 outline-none text-center text-2xl tracking-[10px] font-bold"
                                    placeholder="000000"
                                    maxLength={6}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-300 mb-2">Mật khẩu mới</label>
                                <input
                                    name="newPassword"
                                    type="password"
                                    value={form.newPassword || ""}
                                    onChange={onChange}
                                    className="w-full px-4 py-3 bg-[#080808] text-white rounded-xl border border-white/5 outline-none"
                                    placeholder="Nhập mật khẩu mới"
                                />
                            </div>
                        </div>
                    )}

<<<<<<< HEAD
=======
                    {errorMessage && mode === 'LOGIN' && (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 text-red-200 px-4 py-3 text-sm font-medium mb-3">
                            {errorMessage}
                        </div>
                    )}
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 rounded-xl font-bold uppercase tracking-wider ${loading ? "bg-gray-600 text-white cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
                                }`}
                        >
                            {loading ? (
                                "Đang xử lý..."
                            ) : mode === "LOGIN" ? (
                                "Xác nhận truy cập"
                            ) : mode === "REGISTER" ? (
                                "Hoàn tất đăng ký"
                            ) : mode === "FORGOT" ? (
                                "Gửi email khôi phục"
                            ) : (
                                "Cập nhật mật khẩu mới" // Đây là chữ cho mode "RESET"
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-6 text-center text-sm text-gray-300">
                    {mode === "LOGIN" && (
                        <>
                            <p>
                                Người dùng mới?{" "}
                                <button className="text-cyan-400 font-bold" onClick={() => setMode("REGISTER")}>Đăng ký</button>
                            </p>
                            <p className="mt-2">
                                <button className="text-gray-300 underline" onClick={() => setMode("FORGOT")}>Quên mật khẩu?</button>
                            </p>
                        </>
                    )}

                    {mode === "REGISTER" && (
                        <p>
                            Đã có tài khoản?{" "}
                            <button className="text-cyan-400 font-bold" onClick={() => setMode("LOGIN")}>Đăng nhập</button>
                        </p>
                    )}

                    {mode === "FORGOT" && (
                        <p>
                            <button className="text-cyan-400 font-bold" onClick={() => setMode("LOGIN")}>Quay lại đăng nhập</button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}