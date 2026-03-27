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
     * Thêm signal để có thể hủy chat giữa chừng nếu cần
     */
    ask: async (question, signal) => {
        try {
            const response = await axiosInstance.post('/chat/ask', 
                { question }, 
                { signal } // Thêm signal vào đây
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
     * QUAN TRỌNG: Nhận signal từ UI để ngắt request
     */
    analyzeContract: async (fileObject, signal) => {
        try {
            const formData = new FormData();
            formData.append('file', fileObject);

            // Truyền signal vào tham số thứ 3 (config) của axios.post
            const response = await axiosInstance.post('/ai/analyze-contract', formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
                signal, 
            });

            return response.data;
        } catch (error) {
            // Kiểm tra nếu lỗi là do người dùng chủ động hủy
            if (axios.isCancel(error)) {
                console.warn(" bạn đã hủy yêu cầu thẩm định hợp đồng.");
                return null; 
            }
            console.error("Lỗi khi gọi API Phân tích:", error);
            throw error;
        }
    }
};

export default aiClient;