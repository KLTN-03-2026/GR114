/**
 * Module này cung cấp các hàm mã hóa và giải mã sử dụng thuật toán AES-256-CBC.
 * Khóa mã hóa được tạo từ biến môi trường MASTER_KEY trong file .env.
 * Hàm encrypt sẽ trả về một chuỗi chứa cả IV và dữ liệu đã mã hóa, được phân tách bằng dấu ':'.
 * Hàm decrypt sẽ tách IV và dữ liệu mã hóa, sau đó giải mã để trả về văn bản gốc.
 */
const crypto = require('crypto');
require('dotenv').config();

const algorithm = 'aes-256-cbc';
// Khóa 32 byte được băm từ MASTER_KEY trong .env
const key = crypto.scryptSync(process.env.MASTER_KEY, 'salt', 32); 

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Lưu cả IV và chuỗi mã hóa
    return iv.toString('hex') + ':' + encrypted; 
}

function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { encrypt, decrypt };