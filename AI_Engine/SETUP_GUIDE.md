# 📚 LEGALBOT PINECONE UPLOADER - SETUP GUIDE V2.0

## 🎯 概述

Hướng dẫn chi tiết để upload **40,000 văn bản pháp luật** từ JSON lên **Pinecone Vector Database** bằng script `uploadToPinecone_V2.js`.

**Phiên bản**: 2.0 (Production Ready)  
**Pinecone SDK**: v3.0.0  
**Gemini Model**: gemini-embedding-001 (3072 chiều)  
**Cập nhật**: 25 Tháng 3 năm 2026

---

## ⚙️ YÊU CẦU HỆ THỐNG

- **Node.js**: v14+ (v16+ khuyên dùng)
- **npm**: v7+
- **Dung lượng RAM**: 4GB minimum (8GB+ khuyên dùng)
- **Kết nối mạng**: Ổn định, 10Mbps+ preferred

---

## 📋 BƯỚC 1: CHUẨN BỊ API KEYS

### 1.1 Google Gemini API Key

> **Lý do**: Sử dụng `gemini-embedding-001` để tạo vector 3072 chiều từ text

1. Truy cập: https://makersuite.google.com/app/apikey
2. Click **"Create API Key"** → **"Create API key in new project"**
3. Copy API key (ví dụ: `AIzaSyD...`)
4. **QUAN TRỌNG**: Enable **Generative Language API** trong Google Cloud Console

### 1.2 Pinecone API Key

> **Lý do**: Lưu trữ vector embeddings để tìm kiếm semantic

1. Truy cập: https://www.pinecone.io/
2. Đăng nhập hoặc tạo tài khoản
3. Tạo **Index** với tên: `legai-index`
   - **Metric**: `cosine`
   - **Dimension**: `3072`
   - **Pods**: `s1.x1` hoặc `s1.x2` (tùy theo yêu cầu)
4. Copy **API Key** từ dashboard
5. Ghi nhớ **Environment** (ví dụ: `us-east1-aws`)

---

## 📝 BƯỚC 2: THIẾT LẬP FILE .env

### 2.1 Tạo file `.env`

```bash
cd AI_Engine
cp .env.example .env
```

### 2.2 Cập nhật chi tiết

Mở `AI_Engine/.env` và điền:

```env
# Google Gemini
GEMINI_API_KEY=AIzaSyD... (từ step 1.1)

# Pinecone
PINECONE_API_KEY=YOUR_PINECONE_KEY... (từ step 1.2)

# Performance
NODE_ENV=production
GEMINI_DELAY_MS=500
BATCH_SIZE=50
MAX_RETRIES=3
```

### 2.3 Kiểm tra File Bảo Mật

```bash
# KHÔNG commit .env vào Git
echo ".env" >> .gitignore
```

---

## 🔧 BƯỚC 3: CÀI ĐẶT DEPENDENCIES

```bash
cd AI_Engine
npm install
```

**Output dự kiến:**
```
added 150 packages in 45s
```

---

## 🚀 BƯỚC 4: CHẠY SCRIPT

### 4.1 Cách 1: Chạy lần đầu (Full Data)

```bash
cd scripts
node uploadToPinecone_V2.js
```

**Output dự kiến:**
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

📄 Document [0]: Bộ Luật dân sự...
✂️  Created 247 chunks
📤 Batch 1: Uploading 50 vectors to Pinecone...
✅ Batch 1: Successfully uploaded 50 vectors
...
```

### 4.2 Cách 2: Tiếp tục từ Checkpointcó sẵn

Nếu script bị dừng (lỗi mạng, timeout), nó sẽ tự động:
1. Lưu progress vào `scripts/progress.txt`
2. Lần chạy tiếp theo sẽ bắt đầu từ document đó

```bash
# Chỉ cần chạy lại - script sẽ tự resume
node uploadToPinecone_V2.js
```

---

## 📊 HIỂU SCRIPT HOẠT ĐỘNG

### Pipeline Xử Lý

```
Raw JSON (40K docs)
    ↓
[Document 0: Bộ Luật dân sự]
    ↓
📋 Smart Chunking
    └─→ Tìm "Điều 1", "Điều 2", ... (article-aware)
    └─→ Chia chunk: 1500 chars, overlap: 200 chars
    └─→ Tạo 247 chunks
    ↓
🔢 Generate Embeddings (Gemini)
    └─→ Mỗi chunk → 3072 chiều vector
    └─→ Rate limit: 500ms/chunk
    ↓
📤 Batch Upload to Pinecone
    └─→ 50 vectors/batch
    └─→ Retry 3 lần nếu fail
    ↓
💾 Save Checkpoint
    └─→ Lưu progress vào progress.txt
    ↓
[Document 1: Luật Lao Động]
    ↓ ... (lặp lại)
```

### Key Features

| Tính năng | Chi tiết |
|----------|---------|
| **Article-aware chunking** | Tôn trọng cấu trúc Điều luật |
| **Overlap** | 200 chars overlap giữa chunks (giữ ngữ cảnh) |
| **Rate limiting** | 500ms delay tránh Gemini API quota |
| **Batch processing** | 50 vectors/batch để tối ưu Pinecone upload |
| **Checkpoint** | Lưu progress.txt, có thể resume |
| **Logging** | File upload.log chi tiết |
| **Error handling** | Retry logic + detailed error messages |

---

## 📈 THEO DÕI TIẾN ĐỘ

### Real-time Monitoring

Script in ra console:
```
📄 Document [1250]: Nghị định số 43/2020/NĐ-CP...
✂️  Created 182 chunks
📤 Batch 25: Uploading 50 vectors to Pinecone...
✅ Batch 25: Successfully uploaded 50 vectors
```

### File Logs

```bash
# Xem log chi tiết
tail -f scripts/upload.log

# Kiểm tra progress
cat scripts/progress.txt  # In ra: 1250
```

### Pinecone Dashboard

Truy cập: https://www.pinecone.io/
- **Index stats**: Số vectors hiện có
- **Namespaces**: Phân chia dữ liệu (nếu có)
- **Query performance**: Latency của similarity search

---

## ⚠️ TROUBLESHOOTING

### Vấn đề 1: "Must pass in at least 1 record to upsert"

**Nguyên nhân**: Vectors rỗng hoặc invalid  
**Giải pháp**:
```bash
# Kiểm tra embedding
node -e "
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
model.embedContent('test').then(r => {
  console.log('Embedding OK:', r.embedding.values.length);
  process.exit(0);
});
"
```

### Vấn đề 2: "PINECONE_API_KEY is not defined"

**Nguyên nhân**: .env file không được load  
**Giải pháp**:
```bash
# Kiểm tra .env tồn tại
ls -la scripts/../.env

# Chắc chắn không có typo trong .env
grep PINECONE_API_KEY .env
```

### Vấn đề 3: "429 Too Many Requests" (Gemini)

**Nguyên nhân**: Rate limit - call quá nhanh  
**Giải pháp**:
```bash
# Tăng delay trong .env
GEMINI_DELAY_MS=1000  # từ 500 → 1000ms
```

### Vấn đề 4: "Connection timeout"

**Nguyên nhân**: Kết nối mạng yếu hoặc Pinecone server slow  
**Giải pháp**:
```bash
# Kiểm tra kết nối
ping 8.8.8.8

# Giảm batch size trong script
BATCH_SIZE=25  # từ 50 → 25
```

### Vấn đề 5: "ENOSPC: no space left on device"

**Nguyên nhân**: Ổ cứng đầy  
**Giải pháp**:
```bash
# Kiểm tra dung lượng
df -h

# Clear logs if needed
rm scripts/upload.log
```

---

## 📊 HIỆU SUẤT DỰ KIẾN

### Timeline

| Mốc | Thời gian | Ghi chú |
|-----|----------|--------|
| 1,000 docs | ~1-2 giờ | 247K vectors ≈ 13K vect/giờ |
| 10,000 docs | ~10-20 giờ | Stabilize rate |
| **40,000 docs** | **40-80 giờ** | **~500K-1M vectors** |

### Chi phí ước tính

| Dịch vụ | Chi phí |
|--------|--------|
| **Gemini Embeddings** | $8-12 (40K × ~250 mỗi doc) |
| **Pinecone Storage** | $20-50/tháng (tùy ao s1.x1 vs s1.x2) |
| **Pinecone Queries** | $0 (mình hosting vectors, không pay/query) |
| **TOTAL** | **~$30-60/tháng** |

---

## 🔒 SECURITY BEST PRACTICES

1. **API Keys**
   - ✅ Lưu trong .env (KHÔNG hardcode)
   - ✅ Rotate keys hàng tháng
   - ❌ KHÔNG commit .env vào Git
   - ❌ KHÔNG share qua chat/email

2. **Pinecone Index**
   - ✅ Enable API Key restrictions (nếu có)
   - ✅ Set rate limits
   - ❌ KHÔNG expose index publicly

3. **Data Privacy**
   - ✅ Legal documents là sensitive
   - ✅ Backup Pinecone regularly
   - ❌ KHÔNG store raw docs trong Pinecone metadata

---

## 📞 HỖ TRỢ & CẢM ƯNG

### Nếu Script ĐANG CHẠY

- ✅ Để nó chạy liên tục (không interrupt)
- ✅ Theo dõi qua logs: `tail -f scripts/upload.log`
- ✅ Kiểm tra Pinecone dashboard định kỳ

### Khi Hoàn Thành

Script sẽ in:
```
╔═══════════════════════════════════════════════════════════╗
║                    ✅ UPLOAD COMPLETED                    ║
╚═══════════════════════════════════════════════════════════╝

📊 Final Statistics:
   - Documents processed: 40000
   - Total chunks created: ~500000
   - Total vectors uploaded: ~500000
   - Time elapsed: ~60 hours (tùy hardware)
```

---

## 📚 TÀI LIỆU THAM KHẢO

- **Pinecone Docs**: https://docs.pinecone.io/
- **Google Gemini**: https://ai.google.dev/
- **Node.js Streaming**: https://nodejs.org/api/stream.html
- **JSONStream**: https://github.com/dominictarr/JSONStream

---

**Phiên bản**: 2.0  
**Cập nhật lần cuối**: 25/03/2026  
**Trạng thái**: ✅ Production Ready
