import axios from "axios";


// (Nó sẽ tự lấy http://localhost:8081/api từ biến VITE_API_URL)
const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

export default axiosClient;