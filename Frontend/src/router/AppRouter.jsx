import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Booking from "../pages/Booking";
import Legal from "../pages/Legal";
import About from "../pages/About";
import Contact from "../pages/Contact";
import ResultPage from "../pages/ResultPage";

export default function AppRouter() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dat-lich" element={<Booking />} />
            <Route path="/phap-ly" element={<Legal />} />
            <Route path="/ket-qua" element={<ResultPage />} />
            <Route path="/gioi-thieu" element={<About />} />
            <Route path="/lien-he" element={<Contact />} />
        </Routes>
    );
}
