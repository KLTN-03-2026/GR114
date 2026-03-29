// AI_Engine/src/classifyData.js
const { pool, poolConnect } = require('./config/db');
const geminiService = require('./services/geminiService');

const VALID_CATEGORIES = [
    "Bộ máy hành chính", "Tài chính nhà nước", "Văn hóa - Xã hội", "Tài nguyên - Môi trường",
    "Bất động sản", "Xây dựng - Đô thị", "Thương mại", "Thể thao - Y tế", "Giáo dục",
    "Thuế - Phí - Lệ phí", "Giao thông - Vận tải", "Lao động - Tiền lương", "Công nghệ thông tin",
    "Đầu tư", "Doanh nghiệp", "Xuất nhập khẩu", "Sở hữu trí tuệ", "Tiền tệ - Ngân hàng",
    "Bảo hiểm", "Thủ tục Tố tụng", "Hình sự", "Dân sự", "Chứng khoán", "Lĩnh vực khác"
];

// Cấu hình cho bản PRO
const CONCURRENCY_LIMIT = 10; // Xử lý song song 10 văn bản cùng lúc
// AI_Engine/src/classifyData.js

async function classifySingleDoc(doc, index, total) {
    const prompt = `
    Bạn là một chuyên gia pháp luật Việt Nam cấp cao. 
    Nhiệm vụ: Phân loại văn bản dựa trên tiêu đề vào MỘT TRONG các nhóm sau: [${VALID_CATEGORIES.join(", ")}].
    
    Quy tắc:
    1. Chỉ trả về đúng tên nhóm trong danh sách trên.
    2. Nếu tiêu đề mang tính chất chung chung về xử phạt hoặc tổ chức bộ máy, chọn "Bộ máy hành chính".
    3. Nếu không chắc chắn, chọn "Lĩnh vực khác".
    
    Tiêu đề văn bản: "${doc.Title}"
    Kết quả:`;

    try {
        // 🟢 ĐÃ FIX: Đổi generateText thành generateAnswerWithGemini
        const rawResponse = await geminiService.generateAnswerWithGemini(prompt);

        // Xử lý chuỗi trả về (trim và xóa các ký tự thừa nếu có)
        const category = rawResponse.trim().replace(/[".*]/g, "");

        const finalCategory = VALID_CATEGORIES.includes(category) ? category : "Lĩnh vực khác";

        await pool.request()
            .input('Id', doc.Id)
            .input('Category', finalCategory)
            .query(`UPDATE LegalDocuments SET Category = @Category WHERE Id = @Id`);

        console.log(`[${index + 1}/${total}] ✅ ${doc.Title.substring(0, 45)}... -> ${finalCategory}`);
    } catch (error) {
        console.error(`❌ Lỗi tại ${doc.Id}:`, error.message);
    }
}
async function startClassifying() {
    try {
        await poolConnect;
        const result = await pool.request().query("SELECT Id, Title FROM LegalDocuments WHERE Category = N'Chưa phân loại'");
        const docs = result.recordset;
        const total = docs.length;

        console.log(`🔥 ĐẲNG CẤP PRO: Bắt đầu phân loại song song ${total} văn bản...`);

        // Xử lý theo từng cụm (Batch) để tận dụng tối đa băng thông API Pro
        for (let i = 0; i < total; i += CONCURRENCY_LIMIT) {
            const batch = docs.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map((doc, index) => classifySingleDoc(doc, i + index, total)));

            // Với bản Pro, Duy chỉ cần nghỉ 200ms giữa các batch là quá an toàn
            await new Promise(r => setTimeout(r, 200));
        }

        console.log("\n✨ HOÀN THÀNH! Database của Duy đã sạch bóng quân thù.");
        process.exit(0);
    } catch (err) {
        console.error("🚨 Lỗi hệ thống:", err);
        process.exit(1);
    }
}

startClassifying();