import axios from "axios";

// 1. Cấu hình Axios Instance
const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_AI_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

const aiClient = {
    /**
     * Chức năng 1: Chat với Bot
     */
    ask: async (question, signal) => {
        try {
            const response = await axiosInstance.post('/chat/ask', 
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
                console.warn("Bạn đã hủy yêu cầu thẩm định hợp đồng.");
                return null; 
            }
            console.error("Lỗi khi gọi API Phân tích:", error);
            throw error;
        }
    },

    /*
     *  Chức năng 3: Sinh Biểu mẫu AI (AI Form Generator)
     */
    generateForm: async (payload, signal) => {
        try {
            // Route bên Node.js  (VD: /ai/generate-form)
            const response = await axiosInstance.post('/ai/generate-form', payload, { signal });
            return response; 
        } catch (error) {
            if (axios.isCancel(error)) {
                console.log("Form generation canceled");
            } else {
                console.error("Lỗi khi gọi API Generate Form:", error);
                throw error;
            }
        }
    }
};

export default aiClient;