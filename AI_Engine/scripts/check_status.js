require('dotenv').config(); // Đưa lên đầu cho chuyên nghiệp
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. Cấu hình
const GENAI_API_KEY = process.env.GEMINI_API_KEY;
const DATA_FILE = "D:/01_Projects/KLTN_DTU_2026/Repo_thamkhao/legal-ai-agent/data/uts_vlc_processed.json";
const genAI = new GoogleGenerativeAI(GENAI_API_KEY);

async function checkLawStatus() {
    try {
        // 2. Đọc file JSON tổng
        console.log(`📂 Đang mở file dữ liệu: ${DATA_FILE}...`);
        const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
        const allLaws = JSON.parse(rawData); // Chuyển sang mảng Object

        // Lấy 30 văn bản đầu tiên để test
        const testBatch = allLaws.slice(0, 30);
        const lawList = testBatch.map(item => ({ id: item.id, title: item.title }));

        console.log(`🔍 Đã lấy ra ${lawList.length} tiêu đề để thẩm định...`);



        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Bạn là một chuyên gia pháp luật Việt Nam am hiểu sâu sắc hệ thống VBQPPL. 
            Dưới đây là danh sách các văn bản luật. Hãy kiểm tra trạng thái hiệu lực của chúng tính đến tháng 3 năm 2026.
            
            YÊU CẦU:
            1. Trả về kết quả DUY NHẤT dưới dạng JSON Array (không kèm văn bản dẫn chuyện).
            2. Cấu trúc JSON: [{"id": "...", "title": "...", "status": "Còn hiệu lực/Hết hiệu lực/Hết hiệu lực một phần", "replacement": "Tên luật mới thay thế nếu có"}].
            
            DANH SÁCH CẦN KIỂM TRA:
            ${JSON.stringify(lawList, null, 2)}
        `;

        console.log("🤖 Đang hỏi Gemini... Nhịp tim ổn định chứ Duy?");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("\n✨ KẾT QUẢ THẨM ĐỊNH TỪ AI:");
        console.log("-----------------------------------------");
        console.log(text);
        console.log("-----------------------------------------");

    } catch (error) {
        console.error("❌ Lỗi rồi kỹ sư ơi:", error.message);
    }
}

checkLawStatus();