// File: check_json.js
const fs = require('fs');

try {
    console.log("Đang đọc file legal_data_old.json...");
    // Đọc file (nhớ sửa đúng tên file của bạn)
    const rawData = fs.readFileSync('./legal_data_old.json', 'utf8');

    console.log("Đang phân tích cú pháp JSON...");
    const data = JSON.parse(rawData);

    console.log("✅ TUYỆT VỜI! File JSON hợp lệ.");
    console.log(`📊 Tổng số văn bản tìm thấy: ${data.legaldocuments ? data.legaldocuments.length : 'Không rõ cấu trúc'}`);

} catch (error) {
    console.error("❌ LỖI RỒI! File JSON bị sai cú pháp:");
    console.error(error.message);
    // Mẹo: Nó sẽ báo lỗi ở dòng nào (vị trí ký tự nào) để bạn sửa.
}