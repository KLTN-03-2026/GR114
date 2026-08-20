// AI_Engine/src/classifyData.js
const { pool, poolConnect } = require('./config/db');
const geminiService = require('./services/geminiService');
const { CANONICAL_CATEGORIES, normalizeLegalCategory } = require('./constants/legalCategories');


const CONCURRENCY_LIMIT = 2;
// AI_Engine/src/classifyData.js

function resolveDeterministicCategory(title) {
    const normalizedTitle = String(title || '').normalize('NFC').toLocaleLowerCase('vi-VN');
    const informationTechnologyTerms = ['viễn thông', 'vô tuyến', 'tần số'];

    if (informationTechnologyTerms.some(term => normalizedTitle.includes(term))) {
        return 'Công nghệ thông tin';
    }

    return null;
}

async function classifySingleDoc(doc, index, total) {
    const prompt = `
    Bạn là một chuyên gia pháp luật Việt Nam cấp cao. 
    Nhiệm vụ: Phân loại văn bản dựa trên tiêu đề vào MỘT TRONG các nhóm sau: [${CANONICAL_CATEGORIES.join(", ")}].
    
    Quy tắc:
    1. Chỉ trả về đúng tên nhóm trong danh sách trên.
    2. Phân loại theo lĩnh vực điều chỉnh chính, không phân loại theo loại chế tài như "xử phạt".
    3. Nếu không chắc chắn, chọn "Lĩnh vực khác".
    
    Tiêu đề văn bản: "${doc.Title}"
    Kết quả:`;

    try {
        //  Đổi generateText thành generateAnswerWithGemini
        const rawResponse = await geminiService.generateAnswerWithGemini(prompt);

        // Xử lý chuỗi trả về
        const category = rawResponse.trim().replace(/[".*]/g, "");

        const deterministicCategory = resolveDeterministicCategory(doc.Title);
        const finalCategory = deterministicCategory || normalizeLegalCategory(category) || 'Lĩnh vực khác';

        await pool.request()
            .input('Id', doc.Id)
            .input('Category', finalCategory)
            .query(`UPDATE LegalDocuments SET Category = @Category WHERE Id = @Id`);

        console.log(`[${index + 1}/${total}]  ${doc.Title.substring(0, 45)}... -> ${finalCategory}`);
    } catch (error) {
        console.error(` Lỗi tại ${doc.Id}:`, error.message);
    }
}
async function startClassifying() {
    try {
        await poolConnect;
        const result = await pool.request().query("SELECT Id, Title FROM LegalDocuments WHERE Category = N'Chưa phân loại'");
        const docs = result.recordset;
        const total = docs.length;

        console.log(` Bắt đầu phân loại song song ${total} văn bản...`);

        // Xử lý theo từng cụm (Batch) để tận dụng tối đa băng thông API Pro
        for (let i = 0; i < total; i += CONCURRENCY_LIMIT) {
            const batch = docs.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map((doc, index) => classifySingleDoc(doc, i + index, total)));


            await new Promise(r => setTimeout(r, 200));
        }

        console.log("\n HOÀN THÀNH! .");
        process.exit(0);
    } catch (err) {
        console.error(" Lỗi hệ thống:", err);
        process.exit(1);
    }
}

startClassifying();
