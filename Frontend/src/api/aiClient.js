// File: Frontend/src/api/aiClient.js
import axios from "axios";

// Tạo kết nối chuyên dụng đến (Port 8000)
const aiClient = axios.create({
    baseURL: import.meta.env.VITE_AI_API_URL, // Lấy từ .env
    headers: {
        "Content-Type": "application/json",
    },
});

export default aiClient;