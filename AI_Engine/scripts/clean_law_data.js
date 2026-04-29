require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. Cấu hình
const GENAI_API_KEY = process.env.GEMINI_API_KEY;
const INPUT_FILE = "D:/01_Projects/KLTN_DTU_2026/Repo_thamkhao/legal-ai-agent/data/uts_vlc_processed.json";
const OUTPUT_FILE = "data/law_status_map.json"; // File kết quả cuối cùng
const CHECKPOINT_FILE = "data/cleaning_progress.json"; // Lưu lại bài đã làm để chạy tiếp nếu lỗi

const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
const BATCH_SIZE = 80; // Mỗi lần gửi 80 tiêu đề cho Gemini (Paid tier chạy rất mượt)

async function cleanData() {
    console.log("🚀 Bắt đầu quy trình Thanh tẩy dữ liệu...");

    // Bước 1: Đọc file (Dùng stream để tránh tràn RAM nếu file quá lớn)
    let allLaws = [];
    try {
        const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
        allLaws = JSON.parse(rawData);
    } catch (e) {
        console.error("❌ File quá lớn hoặc lỗi định dạng. Hãy đảm bảo con MSI của bạn đủ RAM!");
        return;
    }

    // Bước 2: Nạp Checkpoint (Nếu đã chạy dở trước đó)
    let statusMap = {};
    if (fs.existsSync(OUTPUT_FILE)) {
        statusMap = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    }

    const lawsToProcess = allLaws.filter(l => !statusMap[l.id]);
    console.log(`📊 Tổng: ${allLaws.length} bài. Cần xử lý mới: ${lawsToProcess.length} bài.`);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Bước 3: Vòng lặp xử lý theo Batch
    for (let i = 0; i < lawsToProcess.length; i += BATCH_SIZE) {
        const batch = lawsToProcess.slice(i, i + BATCH_SIZE);
        const batchData = batch.map(l => ({ id: l.id, title: l.title }));

        const prompt = `
            Bạn là chuyên gia pháp luật VN. Kiểm tra trạng thái hiệu lực của danh sách này đến năm 2026.
            Chỉ trả về JSON Array: [{"id": "...", "status": "Còn hiệu lực" hoặc "Hết hiệu lực"}]
            Danh sách: ${JSON.stringify(batchData)}
        `;

        try {
            console.log(`⏳ Đang xử lý bài thứ ${i + 1} đến ${i + batch.length}...`);
            const result = await model.generateContent(prompt);
            const responseText = result.response.text().replace(/```json|```/g, "");
            const cleanedResults = JSON.parse(responseText);

            // Lưu vào Map
            cleanedResults.forEach(res => {
                statusMap[res.id] = res.status;
            });

            // Ghi file liên tục (Checkpoint an toàn)
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(statusMap, null, 2));

        } catch (error) {
            console.error(`⚠️ Lỗi ở batch ${i}:`, error.message);
            console.log("Nghỉ 5 giây rồi thử lại...");
            await new Promise(r => setTimeout(r, 5000));
            i -= BATCH_SIZE; // Chạy lại batch này
        }
    }

    console.log("✅ HOÀN THÀNH! File law_status_map.json đã sẵn sàng.");
}

cleanData();