# LegAI Engine Core Logic

## AnalyzeContract

### Completeness Score
- `completeness_score = (filled_fields_count / total_fields_required) * 100`
- Contract status mapping:
  - `< 20%` → `Draft_Template`
  - `20% <= score <= 85%` → `Incomplete_Data`
  - `> 85%` → `Fully_Executed`

### Risk Score / Business Audit
- Base score: `100`
- Penalty categories:
  - `Dangerous` = lỗi cấu trúc/thiếu điều khoản lớn
  - `High Risk` = điều khoản sai luật/thiếu cân đối quan trọng
  - `Advisory` = điểm cần lưu ý nhỏ hơn
- CAP rule:
  - nếu hợp đồng vừa thiếu mảng nghĩa vụ lớn vừa có điều khoản phạt sai luật → `risk_score` tối đa không vượt quá `40`

### Decision Logic
- Phân tích hai luồng song song:
  - kiểm tra thiếu sót / thiếu điều khoản
  - kiểm tra điều khoản sai luật hiện hữu
- Nếu phát hiện đánh số Điều nhảy số hoặc bỏ trống lớn → severity `High Risk`/`Dangerous`
- Nếu phát hiện điều khoản phạt không hợp pháp → ghi nhận riêng và trừ điểm

---

## GenerateForm

### Quy trình xác định căn cứ luật
- Ưu tiên 1: dùng `RAG nội bộ` nếu có văn bản luật chi tiết.
- Ưu tiên 2: mở `Google Search Grounding` khi RAG thiếu chi tiết.
- Nếu RAG chứa luật cũ nhưng hệ thống có bản luật mới hơn → dùng luật mới nhất.
- Nếu RAG đã là phiên bản mới nhất → giữ nguyên dữ liệu RAG.
- Nếu dùng tri thức nội tại mà không nhớ chính xác số hiệu → chỉ ghi `Tên Luật + Năm`.

### Dynamic Length Controller
- Mức cơ bản / phổ thông:
  - phải triển khai tối thiểu `10 Điều`.
- Mức phức tạp / công nghệ cao:
  - bắt buộc `14-15 Điều` chuyên sâu.
- Quy tắc trình bày:
  - mỗi tiểu mục `1.1`, `1.2` phải xuống dòng riêng.
  - mỗi điểm nhỏ `(a)`, `(b)`, `(c)` phải xuống dòng riêng.
- Template chọn theo quy mô:
  - hợp đồng mua bán: ≥10 Điều.
  - hợp đồng dịch vụ/phần mềm: 10 Điều cho phổ thông, 14-15 Điều cho công nghệ cao.

---

## GeneratePlan

### Logic phân rã Tasks
- Task count:
  - `min = 12`
  - `max = 30`
- Phase count:
  - `min = 3`
  - `max = 6`
- Nếu tổng task < 12 → tự động tách nhỏ hơn.
- Nếu tổng task > 30 → tự động gộp hoặc loại bỏ dư thừa.

### Nguyên tắc assignee
- Trích xuất vai trò thực tế từ hồ sơ đầu vào.
- Gán đúng vai trò cho task.
- Nếu không xác định được → `Chưa phân công`.
- Cấm gán vai trò chung chung, máy móc hoặc không liên quan.

### Thiết lập deadline
- Nếu user cung cấp mốc thời gian → quy về ngày cụ thể.
- Nếu không → bắt đầu từ ngày hiện tại.
- Quy tắc thời gian:
  - `deadline[i] >= deadline[i-1]`
  - khoảng cách hợp lý `1–5 ngày`
- Định dạng: `DD/MM/YYYY`

### Decision Logic
- Luồng xử lý:
  - phân tích hồ sơ
  - đối chiếu RAG + tri thức nội tại 2026
  - trích xuất vai trò
  - xây timeline
  - đếm task
  - tạo task vi mô
  - gán deadline + assignee
  - self-check
  - output JSON

---

## Grounding Logic

### Quy trình ưu tiên
- Ưu tiên 1: `RAG nội bộ`
- Ưu tiên 2: `Google Search Grounding` khi RAG thiếu hoặc cũ
- Fallback LLM chỉ nếu:
  - RAG = `FAILED` / `EMPTY` / `TIMEOUT`
  - và search không đủ thông tin

### Chế độ grounding
- `VERIFIED` khi RAG đủ
- `PARTIAL` khi RAG có nhưng không đầy đủ
- `DEGRADED` khi RAG thất bại / không có

### Decision logic
- Nếu context_type là `LEGAL` và RAG có kết quả → giữ RAG.
- Nếu RAG thiếu chi tiết quan trọng hoặc cần điều khoản cụ thể → mở Search.
- Nếu RAG không có → bật `DEGRADED` và chỉ dùng tri thức nội tại 2026, không invent số hiệu văn bản.

---

## AI Chatbot Flow

### Entry point
- Client POSTs vào `/api/ai/ask`
- Route định nghĩa tại `AI_Engine/src/routes/aiRoutes.js`
- Controller handler: `AI_Engine/src/controllers/aiController.js` → `exports.ask`

### Controller logic
1. Đọc request body: `question` hoặc `message`
2. Xác thực input
3. Gọi `ragService.query(userQuery)` để truy vấn Pinecone
4. Log nguồn dữ liệu
5. Gọi `geminiService.generateAnswerWithGemini(userQuery, relatedDocs, [], true)`
6. Format và trả response JSON chứa:
   - `success`
   - `answer`
   - `citations`
   - `sources`

### RAG service
- File: `AI_Engine/src/services/ragService.js`
- Embed câu hỏi bằng `gemini-embedding-2` với `taskType: 'RETRIEVAL_QUERY'`
- Cắt embedding xuống 768 chiều
- Query Pinecone với `topK` và `includeMetadata: true`
- Map kết quả thành object chứa:
  - `id`
  - `title`
  - `law_name`
  - `content`
  - `dieu`
  - `source`
  - `sourceUrl`
  - `score`

### Gemini service
- File: `AI_Engine/src/services/geminiService.js`
- Sử dụng hàm `generateAnswerWithGemini(..., [], true)` để kích hoạt structured citation mode
- Prompt đính kèm:
  - strict RAG boundary instructions
  - conversation history
  - RAG document context
  - JSON output schema
- Sử dụng `responseMimeType: 'application/json'`
- Parse response JSON và trả về object `{ answer, citations }`
- Nếu parse lỗi, fallback qua `{ answer, citations: [] }`

### Metadata notes
- Data import file: `AI_Engine/scripts/import_json_data.js`
  - `smartChunk()` gán nhãn non-Điều là `Căn cứ/Mở đầu`
  - Pinecone metadata bổ sung `law_name`
- `ragService.query()` ưu tiên `metadata.law_name` hoặc `metadata.title`
- `generateAnswerWithGemini(..., [], true)` yêu cầu Gemini map chính xác `lawName` trong citations

### RAG architecture summary
- Chunking
  - `AI_Engine/scripts/import_json_data.js` chia văn bản pháp luật theo `Điều \d+` ở đầu dòng.
  - Nếu một đoạn không khớp `Điều`, chunk vẫn được tạo và gán `dieu = "Căn cứ/Mở đầu"`.
  - Chunk dài >2500 ký tự sẽ tiếp tục được chia thành các sub-chunks nhỏ hơn (~1500 ký tự).
- Search
  - `AI_Engine/src/services/ragService.js` tạo embedding câu hỏi với model `gemini-embedding-2` và `taskType: 'RETRIEVAL_QUERY'`.
  - Kết quả embedding bị cắt xuống 768 chiều để dùng với Pinecone index.
  - Pinecone trả các top-k document có metadata bao gồm `law_name`, `dieu`, `text`, `source`.
- LLM flow
  - `aiController.ask` lấy các kết quả RAG và gọi `geminiService.generateAnswerWithGemini(..., [], true)`.
  - Gemini dùng prompt chứa strict RAG boundary, lịch sử chat và context RAG.
  - Model trả về JSON structured gồm `answer` và `citations`.
  - Nếu JSON không parse được, hệ thống fallback giữ `answer` và `citations: []`.

### Expected API response
```json
{
  "success": true,
  "answer": "...",
  "citations": [
    {
      "lawName": "...",
      "dieu": "...",
      "khoan": "...",
      "quoteSnippet": "...",
      "sourceUrl": "..."
    }
  ],
  "sources": [
    {
      "title": "...",
      "source": "...",
      "dieu": "...",
      "khoan": "..."
    }
  ]
}
```

### Summary flow
1. Client → `/api/ai/ask`
2. `aiController.ask`
3. `ragService.query(userQuery)`
4. Pinecone trả candidate docs
5. `geminiService.generateAnswerWithGemini(..., [], true)`
6. Gemini trả structured JSON
7. Controller format và gửi response

