import axios from "axios";

// 1. Cấu hình Axios Instance (Kết nối đến AI Server)
// Lưu ý: Đảm bảo biến môi trường VITE_AI_API_URL="http://localhost:8000/api"
const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_AI_API_URL || "http://localhost:8000/api",
    headers: {
        "Content-Type": "application/json",
    },
});

// 2. Định nghĩa các chức năng
const aiClient = {
    /**
     * Chức năng 1: Chat với Bot (Dùng cho ChatbotAI.jsx)
     * Endpoint: /api/chat/ask
     */
    ask: async (question) => {
        try {
            const response = await axiosInstance.post('/chat/ask', { question });
            return response.data;
        } catch (error) {
            console.error("Lỗi khi gọi API Chat:", error);
            throw error;
        }
    },

    /**
     * Chức năng 2: Thẩm định Hợp đồng (Dùng cho trang Booking/ContractReview mới)
     * Endpoint: /api/ai/analyze-contract
     * Input: contractText (Nội dung hợp đồng dạng chữ)
     * Output: JSON { risk_score, risks, ... }
     */
    analyzeContract: async (fileObjectOrFiles) => {
        try {
            const formData = new FormData();
            const files = Array.isArray(fileObjectOrFiles) ? fileObjectOrFiles : [fileObjectOrFiles];
            if (files.length === 1) {
                formData.append('file', files[0]);
            } else {
                files.forEach((file) => {
                    formData.append('files', file);
                });
            }

            // Gọi axiosInstance nhưng GHI ĐÈ header Content-Type
            const response = await axiosInstance.post('/ai/analyze-contract', formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            return response.data;
        } catch (error) {
            console.error("Lỗi khi gọi API Phân tích:", error);
            throw error;
        }
    }
};

export default aiClient;
