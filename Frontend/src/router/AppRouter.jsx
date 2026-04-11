import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

<<<<<<< HEAD
//  (Pages)
=======
// (Pages)
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
import Home from "../pages/User/Home";
import ContractAnalysis from "../pages/User/ContractAnalysis";
import EditLegalRecord from "../pages/User/EditLegalRecord";
import About from "../pages/User/About";
import Contact from "../pages/User/Contact";
import LegalRecordPage from "../pages/User/LegalRecordPage";
import LegalDocuments from "../pages/User/LegalDocuments";
import DocumentViewDetail from "../pages/User/DocumentViewDetail";
import ProfilePage from "../pages/User/ProfilePage";
import FeedbackPage from "../pages/User/FeedbackPage";
import AuthPage from "../pages/User/AuthPage";
<<<<<<< HEAD
import FormGeneration from "../components/FormGeneration";  
import RecordDetailPage from "../pages/User/RecordDetailPage"; 
import AIPlanning from "../pages/User/AIPlanning";
import VideoLegalAnalysis from "../pages/User/VideoLegalAnalysis";
=======
import FormGeneration from "../components/FormGeneration";
import RecordDetailPage from "../pages/User/RecordDetailPage";
import AIPlanning from "../pages/User/AIPlanning";
import VideoLegalAnalysis from "../pages/User/VideoLegalAnalysis";
import AdminDashboard from "../pages/Admin/AdminDashboard";
import AdminUsers from "../pages/Admin/AdminUsers";
import AdminCrawler from "../pages/Admin/AdminCrawler";
// ========================================================
//  (ADMIN GUARD)

// ========================================================
const AdminRoute = ({ children }) => {
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;

    // 1. Nếu chưa login thì đuổi về nhà luôn
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // 2. Dùng lưới bắt cá quét mọi loại key/value của Role
    const rawRole = user.Role || user.role || user.ROLE || "";
    const isAdmin = String(rawRole).toUpperCase() === 'ADMIN';

    // 3. Nếu KHÔNG phải Admin -> Trục xuất
    if (!isAdmin) {
        console.warn("⛔ CẢNH BÁO: Phát hiện truy cập trái phép vào khu vực Admin!");
        return <Navigate to="/" replace />;
    }

    // Nếu đúng là Admin -> Mở cửa!
    return children;
};

>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
export default function AppRouter() {
    return (
        <MainLayout>
            <Routes>
                {/* === NHÓM AUTH === */}
                <Route path="/login" element={<AuthPage />} />
                <Route path="/register" element={<Navigate to="/login" replace />} />
                <Route path="/dang-ky" element={<Navigate to="/login" replace />} />
                <Route path="/quen-mat-khau" element={<Navigate to="/login" replace />} />

                {/* === NHÓM CORE === */}
                <Route path="/" element={<Home />} />
                <Route path="/gioi-thieu" element={<About />} />
                <Route path="/lien-he" element={<Contact />} />
                <Route path="/gui-phan-hoi" element={<FeedbackPage />} />
<<<<<<< HEAD
                
=======

>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                {/* === NHÓM DỊCH VỤ === */}
                <Route path="/contract-analysis" element={<ContractAnalysis />} />
                <Route path="/dat-lich" element={<Navigate to="/contract-analysis" replace />} />
                <Route path="/phan-tich-video" element={<VideoLegalAnalysis />} />
<<<<<<< HEAD

=======
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                <Route path="/soan-thao" element={<FormGeneration />} />

                {/* === NHÓM USER === */}
                <Route path="/tai-khoan" element={<ProfilePage />} />
                <Route path="/ho-so-phap-ly" element={<LegalRecordPage />} />
<<<<<<< HEAD
                
               
                <Route path="/ho-so/chi-tiet/:id" element={<RecordDetailPage />} />
                
                <Route path="/ho-so/chinh-sua/:id" element={<EditLegalRecord />} />
                <Route path="/ke-hoach-bao-cao" element={<AIPlanning />} />
                {/* === NHÓM VĂN BẢN === */}
                <Route path="/van-ban-phap-luat" element={<LegalDocuments />} />
                <Route path="/van-ban/chi-tiet/:id" element={<DocumentViewDetail />} />
               

=======
                <Route path="/ho-so/chi-tiet/:id" element={<RecordDetailPage />} />
                <Route path="/ho-so/chinh-sua/:id" element={<EditLegalRecord />} />
                <Route path="/ke-hoach-bao-cao" element={<AIPlanning />} />

                {/* === NHÓM VĂN BẢN === */}
                <Route path="/van-ban-phap-luat" element={<LegalDocuments />} />
                <Route path="/van-ban/chi-tiet/:id" element={<DocumentViewDetail />} />

                {/* === NHÓM ADMIN === */}
                {/* Hứng từ nút Header (/admin) và đẩy sang đường dẫn chuẩn (/admin/dashboard) */}
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

                {/* Tuyến đường AdminDashboard đã được bọc khiên bảo vệ */}
                <Route
                    path="/admin/dashboard"
                    element={
                        <AdminRoute>
                            <AdminDashboard />
                        </AdminRoute>
                    }
                />
                <Route
                    path="/admin/users"
                    element={
                        <AdminRoute>
                            <AdminUsers />
                        </AdminRoute>
                    }
                />


                <Route
                    path="/admin/crawl"
                    element={
                        <AdminRoute>
                            <AdminCrawler />
                        </AdminRoute>
                    }
                />
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
                {/* 404 - Redirect về Home */}
                {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
            </Routes>
        </MainLayout>
    );
}