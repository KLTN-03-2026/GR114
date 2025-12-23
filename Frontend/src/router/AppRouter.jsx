import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

// Các trang (Pages)
import Home from "../pages/User/Home";
import ContractAnalysis from "../pages/User/ContractAnalysis";
import EditLegalRecord from "../pages/User/EditLegalRecord";
import About from "../pages/User/About";
import Contact from "../pages/User/Contact";
// ❌ Đã xóa import ResultPage vì không dùng nữa

import LegalRecordPage from "../pages/User/LegalRecordPage";
import RecordDetailPage from "../pages/User/RecordDetailPage";
import LegalDocuments from "../pages/User/LegalDocuments";
import DocumentViewDetail from "../pages/User/DocumentViewDetail";
import ProfilePage from "../pages/User/ProfilePage";
import FeedbackPage from "../pages/User/FeedbackPage";
import ForgotPassword from "../pages/User/ForgotPassword";

export default function AppRouter() {
    return (
        <MainLayout>
            <Routes>
                {/* NHÓM TRANG CHỦ & THÔNG TIN CHUNG  */}
                <Route path="/" element={<Home />} />
                <Route path="/gioi-thieu" element={<About />} />
                <Route path="/lien-he" element={<Contact />} />
                <Route path="/gui-phan-hoi" element={<FeedbackPage />} />

                {/* NHÓM DỊCH VỤ KẾT QUẢ AI */}
                <Route path="/contract-analysis" element={<ContractAnalysis />} />
                <Route path="/dat-lich" element={<Navigate to="/contract-analysis" replace />} />
                
                {/* ❌ Đã xóa Route /ket-qua vì kết quả giờ hiện ngay ở /contract-analysis */}
                
                {/* NHÓM TÀI KHOẢN (USER & AUTH)  */}
                <Route path="/tai-khoan" element={<ProfilePage />} />
                <Route path="/quen-mat-khau" element={<ForgotPassword />} />

                {/* NHÓM HỒ SƠ PHÁP LÝ (QUẢN LÝ FILE) */}
                <Route path="/ho-so-phap-ly" element={<LegalRecordPage />} />
                <Route path="/ho-so/chi-tiet/:id" element={<RecordDetailPage />} />
                <Route path="/ho-so/chinh-sua/:id" element={<EditLegalRecord />} />

                {/* NHÓM VĂN BẢN PHÁP LUẬT (TRA CỨU) */}
                <Route path="/van-ban-phap-luat" element={<LegalDocuments />} />
                <Route path="/van-ban/chi-tiet/:id" element={<DocumentViewDetail />} />

            </Routes>
        </MainLayout>
    );
}