# 📋 HƯỚNG DẪN HOÀN THIỆN TÍNH NĂNG QUẢN LÝ HỒ SƠ PHÁP LỰC

## 🏗️ KIẾN TRÚC & PHÂN TÁCH COMPONENT

### 1️⃣ **RecordDetailPage.jsx** (Main Container)

- **Vai trò**: Trang chính để hiển thị chi tiết hồ sơ
- **Tính năng**:
  - Fetch dữ liệu từ API hoặc mock data (toggle qua `USE_MOCK_DATA`)
  - Conditional rendering dựa trên `record.type`
  - Header hiển thị badge, tiêu đề, mô tả
  - Info panel luôn hiển thị (bên trái)
  - Dynamic content panel (5 loại khác nhau)

### 2️⃣ **5 Sub-Components** (Dynamic Content Rendering)

| Component                   | Type             | Hiển thị                         | Đặc điểm                                                       |
| --------------------------- | ---------------- | -------------------------------- | -------------------------------------------------------------- |
| **AnalysisDetailView**      | `ANALYSIS`       | Risk Score, PieChart, Risk Items | Có biểu đồ rủi ro, danh sách điều khoản cần chú ý, khuyến nghị |
| **ChatDetailView**          | `CHAT`           | Chat Bubbles                     | Lịch sử tin nhắn giữa User & AI, **KHÔNG** hiển thị Risk Score |
| **PlanningDetailView**      | `PLANNING`       | Timeline Steps                   | Các bước kế hoạch với status (completed/in-progress/pending)   |
| **VideoAnalysisDetailView** | `VIDEO_ANALYSIS` | Video Player + Timestamps        | Embed video YouTube, danh sách các điểm đánh dấu rủi ro        |
| **FormDetailView**          | `FORM`           | Key-Value Fields                 | Hiển thị các trường dữ liệu biểu mẫu đã điền                   |

### 3️⃣ **EditRecordPage.jsx** (Form Chỉnh Sửa)

- **Vai trò**: Cho phép chỉnh sửa metadata hồ sơ
- **Chỉ có thể sửa**:
  - ✅ Tên hồ sơ (`name`)
  - ✅ Mô tả (`description`)
  - ❌ Loại hồ sơ (`type`) - chỉ đọc
  - ❌ ID và ngày tạo - chỉ đọc
- **Gọi API**: `PATCH /api/history/:id`

### 4️⃣ **LegalRecordItem.jsx** (List Item)

- **4 Buttons**:
  1. 👁️ **Xem chi tiết** → `/ho-so/chi-tiet/:id`
  2. 📤 **Chia sẻ** → ShareModal (copy link, social share)
  3. ✏️ **Chỉnh sửa** → `/ho-so/chinh-sua/:id`
  4. 🗑️ **Xóa** → ConfirmModal → API DELETE

### 5️⃣ **ShareModal.jsx** (Chia Sẻ)

- **Tính năng**:
  - Copy link vào clipboard
  - Share trên Facebook, Twitter/X, LinkedIn, Email
  - UX: Nút copy chuyển sang xanh "Đã sao" khi sao chép

### 6️⃣ **ConfirmModal.jsx** (Xác Nhận Xóa)

- **Đã có sẵn** ✅
- Dùng chung cho Delete

---

## 📊 DATA STRUCTURE & DYNAMIC MAPPING

### Cấu trúc normalizeRecord()

```javascript
{
  id: string,
  name: string,           // Tên hiển thị
  title: string,          // Title từ API
  fileName: string,       // Tên file gốc
  type: string,           // 'ANALYSIS' | 'CHAT' | 'PLANNING' | 'VIDEO_ANALYSIS' | 'FORM'
  date: string,           // Ngày tạo (dd/mm/yyyy)
  createdAt: ISO string,  // ISO datetime
  riskScore: number,      // 0-100 (null nếu không là ANALYSIS/VIDEO_ANALYSIS)
  description: string,    // Mô tả
  analysisJson: string,   // JSON string (deprecated - dùng Content)
  Content: string,        // JSON string chứa dữ liệu chi tiết per type
  fullData: object        // Toàn bộ dữ liệu gốc từ API
}
```

### Content Structure per Type:

```javascript
// ANALYSIS
{ summary, risks: [{clause, issue, description, severity, recommendation}] }

// CHAT
{ messages: [{id, text, isBot, timestamp}], summary }

// PLANNING
{ steps: [{id, title, description, timeline, status}], summary }

// VIDEO_ANALYSIS
{ videoUrl, summary, timestamps: [{time, title, issue, severity, description}] }

// FORM
{ fields: [{key, value}], summary }
```

---

## 🔌 INTEGRATION CHECKLIST

### ✅ Đã Hoàn Thành:

- [x] 5 Sub-components (Analysis, Chat, Planning, Video, Form)
- [x] RecordDetailPage với conditional rendering
- [x] EditRecordPage với form chỉnh sửa
- [x] ShareModal nâng cấp
- [x] LegalRecordItem tích hợp ShareModal
- [x] Mock data với 5 loại record khác nhau
- [x] console.log("🔍 Current Record Data:", record) ở đầu components

### ⚠️ Cần Làm Tiếp:

1. **Thêm Routes** (trong App.jsx hoặc router config):

```jsx
<Route path="/ho-so/chi-tiet/:id" element={<RecordDetailPage />} />
<Route path="/ho-so/chinh-sua/:id" element={<EditRecordPage />} />
```

2. **Test Mock Data**:
   - File: `src/mockData/legalRecordsMock.js`
   - Toggle: `USE_MOCK_DATA = true` để test
   - Mock IDs: 29, 25, 21, 20, 19, 18 (CHAT), 26 (ANALYSIS), 27 (VIDEO_ANALYSIS)

3. **Backend Endpoints** (nếu không dùng mock):
   - `GET /api/history/detail/:id` - Lấy chi tiết hồ sơ
   - `PATCH /api/history/:id` - Cập nhật hồ sơ
   - `DELETE /api/history/:id` - Xóa hồ sơ (có rồi)

---

## 🎨 STYLING & UI/UX

### Color Scheme:

- **Primary**: `#B8985D` (Gold) - Accent
- **Dark**: `#1A2530` (Almost black) - Main text
- **Background**: `#f8f9fa` (Light gray)
- **Per Type**:
  - PLANNING: Blue (blue-600)
  - ANALYSIS: Rose (rose-600)
  - VIDEO_ANALYSIS: Orange (orange-600)
  - FORM: Purple (purple-600)
  - CHAT: Emerald (emerald-600)

### Responsive Design:

- Mobile: Single column
- Tablet (lg): 3 columns (info | content span 2)
- Spacing: Tailwind gap-8, p-8

---

## 🧪 TESTING & DEBUGGING

### 1. Bật Mock Data:

```javascript
// src/mockData/legalRecordsMock.js
export const USE_MOCK_DATA = true;
```

### 2. Console Logs:

```javascript
console.log("🔍 Current Record Data:", record); // RecordDetailPage
console.log("🔍 Sử dụng MOCK DATA cho ID:", id); // Fetch info
```

### 3. Test IDs:

- **ID 29**: PLANNING type
- **ID 25**: FORM type
- **ID 21, 20, 19, 18**: CHAT type
- **ID 26**: ANALYSIS type (new)
- **ID 27**: VIDEO_ANALYSIS type (new)

### 4. Kiểm Tra Layout:

1. Xem chi tiết → Kiểm tra 5 layout khác nhau
2. Chỉnh sửa → Form cập nhật thành công
3. Chia sẻ → Modal hiển thị, copy link, social share
4. Xóa → ConfirmModal, request DELETE

---

## 📝 COMPONENT FILE LOCATIONS

```
src/
├── components/
│   ├── LegalRecordItem.jsx ✅ (Updated - 4 buttons)
│   ├── AnalysisDetailView.jsx ✅ (NEW)
│   ├── ChatDetailView.jsx ✅ (NEW)
│   ├── PlanningDetailView.jsx ✅ (NEW)
│   ├── VideoAnalysisDetailView.jsx ✅ (NEW)
│   ├── FormDetailView.jsx ✅ (NEW)
│   ├── ShareModal.jsx ✅ (NEW)
│   ├── ConfirmModal.jsx ✅ (Already exists)
│   └── ...
├── pages/
│   └── User/
│       ├── RecordDetailPage.jsx ✅ (Updated - conditional rendering)
│       ├── EditRecordPage.jsx ✅ (NEW)
│       └── LegalRecordPage.jsx ✅ (Existing - list view)
├── utils/
│   └── legalRecordUtils.jsx ✅ (Existing)
└── mockData/
    └── legalRecordsMock.js ✅ (Updated - 5 types + detail)
```

---

## 🚀 NEXT STEPS

1. **Thêm Routes** trong router chính của app
2. **Test Mock Mode** để verify tất cả 5 layouts
3. **Connect Real API** bằng cách set `USE_MOCK_DATA = false`
4. **Xử lý Edge Cases**:
   - Record không tồn tại
   - API errors
   - Network timeout
5. **Polish UX**:
   - Loading states
   - Error messages
   - Success toasts
   - Form validation

---

## 💡 KEY DESIGN DECISIONS

### ✨ Tại sao chia tách 5 Sub-components?

- **Maintainability**: Mỗi component quản lý logic riêng
- **Reusability**: Có thể import & dùng ở nơi khác
- **Scalability**: Dễ thêm type mới
- **Performance**: Lazy load components nếu cần

### 🎯 Tại sao không hiển thị Risk Score cho CHAT?

- CHAT type không có phân tích rủi ro
- Risk Score chỉ có ý nghĩa cho ANALYSIS & VIDEO_ANALYSIS

### 📱 Responsive Strategy:

- Desktop: 3 columns (info panel bên trái)
- Mobile: Responsive grid, collapse thành 1 column

---

**✅ Tất cả components đã sẵn sàng! Hãy thêm routes và test mock data 🚀**
