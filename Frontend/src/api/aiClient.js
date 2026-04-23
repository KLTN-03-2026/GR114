import axios from "axios";

// 1. Cấu hình Axios Instance
const axiosInstance = axios.create({
   
    baseURL: import.meta.env.VITE_AI_API_URL, 
    headers: {
        "Content-Type": "application/json",
    },
});

//  Tự động đính kèm Token cho mọi yêu cầu 
axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

const aiClient = {
    /**
     * Chức năng 1: Chat với Bot (RAG)
    
     */
    ask: async (question, signal) => {
        try {
            // SỬA TẠI ĐÂY: Đường dẫn mới khớp với aiRoutes.js
            const response = await axiosInstance.post('/ai/ask', 
                { question },
                { signal }
            );
            return response.data;
        } catch (error) {
            if (axios.isCancel(error)) {
                console.log("Chat request canceled");
            } else {
                console.error("Lỗi khi gọi API Chat:", error);
                throw error;
            }
        }
    },

    /**
     * Chức năng 2: Thẩm định Hợp đồng 
     */
    analyzeContract: async (fileObject, signal) => {
        try {
            const formData = new FormData();
            formData.append('file', fileObject);

            const response = await axiosInstance.post('/ai/analyze-contract', formData, {
                headers: { "Content-Type": "multipart/form-data" },
                signal,
            });

            return response.data;
        } catch (error) {
            if (axios.isCancel(error)) {
                console.warn("Hủy yêu cầu thẩm định.");
                return null;
            }
            console.error("Lỗi API Phân tích:", error);
            throw error;
        }
    },

    /**
     * Chức năng 3: Sinh Biểu mẫu AI
     */
    generateForm: async (payload, signal) => {
        try {
            const response = await axiosInstance.post('/ai/generate-form', payload, { signal });
            return response.data;
        } catch (error) {
            console.error("Lỗi API Generate Form:", error);
            throw error;
        }
    },

    /**
     * Chức năng 4: Lập kế hoạch thực thi (Planning)
     */
    generatePlan: async (formData, config = {}) => { 
        try {
            // Đã đổi route cho đồng bộ
            const response = await axiosInstance.post('/ai/generate-plan', formData, {
                ...config,
               
            });
            return response.data;
        } catch (error) {
            console.error("Lỗi API Generate Plan:", error);
            throw error;
        }
    }
};

export default aiClient;