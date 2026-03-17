const fs = require('fs');
const path = require('path');

// --- SỬA LẠI ĐƯỜNG DẪN CHO ĐÚNG ---
// Vì file này nằm trong 'src', nên chỉ cần đi vào 'data' là thấy.
const VECTOR_STORE_PATH = path.join(__dirname, 'data', 'vector_store.json');

console.log(`🔍 Đang tìm file tại: ${VECTOR_STORE_PATH}`);

try {
    if (!fs.existsSync(VECTOR_STORE_PATH)) {
        console.log("❌ Vẫn không thấy file! Bạn hãy kiểm tra thủ công xem trong folder 'src/data' có file 'vector_store.json' không?");
        process.exit(1);
    }

    console.log("✅ Đã tìm thấy! Đang đọc dữ liệu...");
    const rawData = fs.readFileSync(VECTOR_STORE_PATH, 'utf8');
    const data = JSON.parse(rawData);
    
    // Kiểm tra cấu trúc dữ liệu
    const docs = data.documentMap || {}; 
    const totalChunks = Object.keys(docs).length;
    
    console.log(`🧠 AI đã học được tổng cộng: ${totalChunks} đoạn kiến thức.`);
    console.log("---------------------------------------------------");
    console.log("📂 DANH SÁCH CÁC VĂN BẢN ĐÃ HỌC:");
    
    const uniqueTitles = new Set();
    // Lặp qua để lấy tên tài liệu
    for (const key in docs) {
        if (docs[key].title) uniqueTitles.add(docs[key].title);
    }

    let index = 1;
    uniqueTitles.forEach(title => {
        console.log(`${index++}. ${title}`);
    });

    console.log("---------------------------------------------------");
    console.log(`📊 TỔNG KẾT: Có ${uniqueTitles.size} đầu tài liệu trong bộ nhớ.`);

} catch (error) {
    console.error("❌ Lỗi đọc file:", error.message);
}