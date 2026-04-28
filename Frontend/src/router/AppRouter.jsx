import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

//  (Pages)
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
import FormGeneration from "../components/FormGeneration";  
import RecordDetailPage from "../pages/User/RecordDetailPage"; 
import AIPlanning from "../pages/AIPlanning";
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
                
                {/* === NHÓM DỊCH VỤ === */}
                <Route path="/contract-analysis" element={<ContractAnalysis />} />
                <Route path="/dat-lich" element={<Navigate to="/contract-analysis" replace />} />


                <Route path="/soan-thao" element={<FormGeneration />} />

                {/* === NHÓM USER === */}
                <Route path="/tai-khoan" element={<ProfilePage />} />
                <Route path="/ho-so-phap-ly" element={<LegalRecordPage />} />
                
               
                <Route path="/ho-so/chi-tiet/:id" element={<RecordDetailPage />} />
                
                <Route path="/ho-so/chinh-sua/:id" element={<EditLegalRecord />} />
                <Route path="/ke-hoach-bao-cao" element={<AIPlanning />} />
                {/* === NHÓM VĂN BẢN === */}
                <Route path="/van-ban-phap-luat" element={<LegalDocuments />} />
                <Route path="/van-ban/chi-tiet/:id" element={<DocumentViewDetail />} />
               

                {/* 404 - Redirect về Home */}
                {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
            </Routes>
        </MainLayout>
    );
}