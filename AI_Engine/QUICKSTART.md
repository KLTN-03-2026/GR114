# 🚀 QUICK START - UPLOAD 40K DOCUMENTS IN 5 STEPS

## ⏱️ Thời gian chuẩn bị: ~10 phút

---

## BƯỚC 1️⃣ : Lấy API Keys (5 phút)

### Google Gemini

```
1. Truy cập: https://makersuite.google.com/app/apikey
2. Click "Create API Key" 
3. Copy key → Lưu vào temp file
4. Enable "Generative Language API" (nếu cần)
```

### Pinecone

```
1. Truy cập: https://www.pinecone.io/
2. Tạo Index: "legai-index"
   - Metric: cosine
   - Dimension: 3072
   - Pod type: s1.x1
3. Copy API Key → Lưu vào temp file
```

**✅ Lúc này bạn đã có:**
- `GEMINI_API_KEY=AIzaSyD...`
- `PINECONE_API_KEY=abc123xyz...`

---

## BƯỚC 2️⃣ : Setup Environment (2 phút)

### A. Tạo file .env

```bash
cd AI_Engine
cp .env.example .env
```

### B. Mở .env và điền API keys

```bash
# Windows: Dùng Notepad hoặc VS Code
code .env

# Mac/Linux: Dùng nano
nano .env
```

**Nội dung .env cần update:**
```env
GEMINI_API_KEY=AIzaSyD_YOUR_KEY_HERE
PINECONE_API_KEY=abc-123-YOUR_KEY_HERE
NODE_ENV=production
```

**💾 Lưu file**

---

## BƯỚC 3️⃣ : Cài Dependencies (3 phút)

```bash
cd AI_Engine
npm install
```

**Đợi khoảng 2-3 phút cho npm hoàn thành**

✅ Xác nhận thành công:
```
added 150 packages in 60s
0 vulnerabilities
```

---

## BƯỚC 4️⃣ : Chạy Script (40-80 giờ ⏳)

```bash
cd scripts
node uploadToPinecone_V2.js
```

**Output lúc khởi động:**
```
╔═══════════════════════════════════════════════════════════╗
║  LEGAL DOCUMENTS PINECONE UPLOADER - v2.0 PRODUCTION      ║
║  Processing 40,000 Vietnamese legal documents             ║
╚═══════════════════════════════════════════════════════════╝

📍 Starting from document index: 0
📊 Configuration:
   - Chunk size: 1500 chars
   - Chunk overlap: 200 chars
   - Batch size: 50 vectors
   - Gemini rate limit: 500ms between calls
```

**⏳ Script sẽ chạy liên tục - KHÔNG được interrupt!**

---

## BƯỚC 5️⃣ : Theo Dõi Tiến Độ (Continuous ⚡)

### Terminal 1 (chạy script) - GIỮ NỀN

```bash
# Giữ script chạy, đừng bấm Ctrl+C
...mỗi lúc in ra progress
```

### Terminal 2 (theo dõi logs)

```bash
# Mở Terminal mới, cd vào scripts folder
tail -f upload.log

# Hoặc xem file progress:
cat progress.txt  # In ra dòng số document đang xử lý
```

### Terminal 3 (kiểm tra Pinecone)

- **Dự kiến**: 40,000 docs → ~500,000 vectors
- **Thời gian**: 40-80 giờ (tùy speed)
- **Chi phí**: ~$8-12 (Gemini) + $20-50/tháng (Pinecone)

---

## ⚡ CHỈ GTRCOP NHỎ - KIỂM TRA LẦN ĐẦU

Nếu muốn test với 100 documents trước:

### Cách 1: Chỉnh JSON file

```bash
# Tạo test file chỉ 100 docs
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('D:/01_Projects/KLTN_DTU_2026/Repo_thamkhao/legal-ai-agent/data/uts_vlc_processed.json'));
fs.writeFileSync('test_data_100.json', JSON.stringify(data.slice(0, 100)));
console.log('Created test_data_100.json with 100 docs');
"
```

### Cách 2: Edit Strack script

```bash
# Sửa dòng này trong uploadToPinecone_V2.js:
// DATA_PATH: 'D:/..../uts_vlc_processed.json',
// → Thành
// DATA_PATH: 'test_data_100.json',

# Rồi chạy
node uploadToPinecone_V2.js
```

---

## ✅ KIỂM SORACLE SCRIPT HOẠT ĐỘNG ĐÚNG

Khi chạy, bạn sẽ thấy:

```
📄 Document [0]: Bộ Luật dân sự...
✂️  Created 247 chunks
📤 Batch 1: Uploading 50 vectors to Pinecone...
✅ Batch 1: Successfully uploaded 50 vectors
⏳ Waiting 1000ms before retry...

📄 Document [1]: Luật Lao Động...
✂️  Created 182 chunks
📤 Batch 2: Uploading 50 vectors to Pinecone...
✅ Batch 2: Successfully uploaded 50 vectors
```

**Nếu thấy được output này = ✅ SCRIPT ĐẶLỰ HOẠT ĐỘNG!**

---

## ⚠️ ALERT: 3 Lỗi Phổ Biến

### ❌ Error 1: "GEMINI_API_KEY is not defined"

**Nguyên nhân**: Chưa tạo .env hoặc .env sai  
**Fix**:
```bash
# Kiểm tra tệp .env tồn tại
ls -la AI_Engine/.env

# Kiểm tra nội dung
cat AI_Engine/.env | grep GEMINI
```

### ❌ Error 2: "Must pass in at least 1 record to upsert"

**Nguyên nhân**: Vector rỗng  
**Fix**:
```bash
# Kiểm tra Gemini hoạt động:
node -e "
const {GoogleGenerativeAI} = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
genAI.getGenerativeModel({model:'gemini-embedding-001'})
  .embedContent('test')
  .then(() => console.log('✅ Gemini OK'))
  .catch(e => console.log('❌ Error:', e.message));
"
```

### ❌ Error 3: "Connection timeout"

**Nguyên nhân**: Internet yếu  
**Fix**:
```bash
# Tăng timeout trong script hoặc tăng delay:
GEMINI_DELAY_MS=1000
BATCH_DELAY_MS=2000
```

---

## 🎯 CHIẾN LƯỢC TỐI ƯU

### Để Script Chạy Nhanh Nhất

```env
# AI_Engine/.env
GEMINI_DELAY_MS=300      # Giảm từ 500 (nhưng có thể gặp rate limit)
BATCH_SIZE=100           # Tăng từ 50 (nhưng dùng more RAM)
MAX_RETRIES=2            # Giảm từ 3 (nếu network ổn định)
```

### Để Script Chạy Ổn Định Nhất

```env
GEMINI_DELAY_MS=1000     # Tăng 2x (safe mode)
BATCH_SIZE=25            # Giảm nize (safe mode)
MAX_RETRIES=5            # Tăng (tự động retry nhiều)
```

---

## 📋 CHECKLIST TRƯỚC CHẠY

- ✅ Đã tạo Google Gemini API Key?
- ✅ Đã tạo Pinecone Index "legai-index"?
- ✅ Đã tạo file .env với 2 keys?
- ✅ Đã chạy `npm install`?
- ✅ Data file tồn tại: `D:/01_Projects/KLTN_DTU_2026/Repo_thamkhao/legal-ai-agent/data/uts_vlc_processed.json`?
- ✅ RAM đủ (4GB minimum, 8GB+ better)?
- ✅ Kết nối mạng ổn định?

**Nếu check ✅ tất cả → BẢY GIỜ CÓ THỂ CHẠY!**

---

## 🎬 LỆNH CUỐI CÙNG

```bash
# 1. Vào thư mục
cd "D:\01_Projects\DTU_HK1_2025\CS445_AW\LegalBot_Code\AI_Engine\scripts"

# 2. Chạy
node uploadToPinecone_V2.js

# 3. CỚN ĐÓ GIỮ NỀN! ✅
```

**Để tắt script**: `Ctrl+C` (nếu cần dừng để resume sau)

---

## 📞 SUPPORT

Nếu gặp issue:

1. **Kiểm tra logs**:
   ```bash
   tail -f upload.log
   ```

2. **Xem progress**:
   ```bash
   cat progress.txt
   ```

3. **Kiểm tra Pinecone**:
   - https://www.pinecone.io/ → Xem số vectors uploaded

4. **Nếu vẫn lỗi**:
   - Kiểm tra từng bước trong SETUP_GUIDE.md
   - Đọc section TROUBLESHOOTING

---

**TIÊU CHÍ THÀNH CÔNG:**

Khi upload hoàn thành, bạn sẽ thấy:

```
╔═══════════════════════════════════════════════════════════╗
║                    ✅ UPLOAD COMPLETED                    ║
╚═══════════════════════════════════════════════════════════╝

📊 Final Statistics:
   - Documents processed: 40000
   - Total chunks created: ~500000
   - Total vectors uploaded: ~500000
   - Time elapsed: 60 hours (hoặc bao lâu tùy hardware)
```

**Lúc đó, bạn đã có 500K+ vectors trong Pinecone sẵn sàng cho RAG! 🎉**

---

**Version**: 2.0  
**Status**: ✅ Ready to Use  
**Last Update**: 25/03/2026
