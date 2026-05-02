// Mock data cho LegalRecordPage
export const mockRecords = [
  {
    id: "29",
    name: 'Lập kế hoạch: "Lập kế hoạch chi tiết cho đợt ra quân t..."',
    date: "28/4/2026",
    type: "PLANNING",
    riskScore: null,
    fullData: {
      Id: "29",
      UserId: "4",
      FileName: "Plan_1777372938709.json",
      OriginalFileName: null,
      FilePath: null,
      Title: 'Lập kế hoạch: "Lập kế hoạch chi tiết cho đợt ra quân t..."',
      RecordType: "PLANNING",
      RiskScore: null,
      CreatedAt: "2026-04-28T10:30:00Z",
    },
  },
  {
    id: "25",
    name: "Biểu mẫu: HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC)",
    date: "23/4/2026",
    type: "FORM",
    riskScore: null,
    fullData: {
      Id: "25",
      UserId: "4",
      FileName: "HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC).docx",
      OriginalFileName: null,
      FilePath: null,
      Title: "Biểu mẫu: HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC)",
      RecordType: "FORM",
      RiskScore: null,
      CreatedAt: "2026-04-23T14:20:00Z",
    },
  },
  {
    id: "21",
    name: "Thảo luận: Quy định về thời gian thử việc theo...",
    date: "20/4/2026",
    type: "CHAT",
    riskScore: null,
    fullData: {
      Id: "21",
      UserId: "4",
      FileName: null,
      OriginalFileName: null,
      FilePath: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo...",
      RecordType: "CHAT",
      RiskScore: null,
      CreatedAt: "2026-04-20T09:15:00Z",
    },
  },
  {
    id: "20",
    name: "Thảo luận: Quy định về thời gian thử việc theo...",
    date: "20/4/2026",
    type: "CHAT",
    riskScore: null,
    fullData: {
      Id: "20",
      UserId: "4",
      FileName: null,
      OriginalFileName: null,
      FilePath: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo...",
      RecordType: "CHAT",
      RiskScore: null,
      CreatedAt: "2026-04-20T08:45:00Z",
    },
  },
  {
    id: "19",
    name: "Thảo luận: Quy định về thời gian thử việc theo...",
    date: "20/4/2026",
    type: "CHAT",
    riskScore: null,
    fullData: {
      Id: "19",
      UserId: "4",
      FileName: null,
      OriginalFileName: null,
      FilePath: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo...",
      RecordType: "CHAT",
      RiskScore: null,
      CreatedAt: "2026-04-20T08:30:00Z",
    },
  },
  {
    id: "18",
    name: "Thảo luận: Quy định về thời gian thử việc theo...",
    date: "20/4/2026",
    type: "CHAT",
    riskScore: null,
    fullData: {
      Id: "18",
      UserId: "4",
      FileName: null,
      OriginalFileName: null,
      FilePath: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo...",
      RecordType: "CHAT",
      RiskScore: null,
      CreatedAt: "2026-04-20T08:00:00Z",
    },
  },
];

// Mock data cho pagination
export const mockPagination = {
  currentPage: 1,
  totalPages: 5,
  totalDocs: 28,
};

// Hàm helper để lấy mock data (mô phỏng API response)
export const getMockRecordsResponse = (page = 1, limit = 6, search = "") => {
  let filtered = mockRecords;

  if (search) {
    filtered = mockRecords.filter(
      (record) =>
        record.name.toLowerCase().includes(search.toLowerCase()) ||
        record.type.toLowerCase().includes(search.toLowerCase()),
    );
  }

  return {
    success: true,
    data: filtered.slice((page - 1) * limit, page * limit),
    currentPage: page,
    totalPages: Math.ceil(filtered.length / limit),
    totalDocs: filtered.length,
  };
};

// Mock data chi tiết cho từng record
const mockDetailedRecords = {
  29: {
    success: true,
    data: {
      Id: "29",
      UserId: "4",
      FileName: "Plan_1777372938709.json",
      OriginalFileName: null,
      FilePath: null,
      Title: 'Lập kế hoạch: "Lập kế hoạch chi tiết cho đợt ra quân t..."',
      Description:
        "Kế hoạch chi tiết cho đợt ra quân và thực hiện các hoạt động nội bộ.",
      RecordType: "PLANNING",
      RiskScore: 45,
      CreatedAt: "2026-04-28T10:30:00Z",
      AnalysisJson: JSON.stringify({
        summary: "Kế hoạch lập chiến lược kinh doanh",
        risks: [
          {
            level: "medium",
            description: "Chưa xác định rõ các rủi ro tiềm ẩn",
          },
        ],
        analysis: "Tài liệu cần bổ sung thêm các điều khoản bảo vệ",
      }),
    },
  },
  25: {
    success: true,
    data: {
      Id: "25",
      UserId: "4",
      FileName: "HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC).docx",
      OriginalFileName: null,
      FilePath: null,
      Title: "Biểu mẫu: HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC)",
      Description: "Mẫu hợp đồng hợp tác kinh doanh giữa các bên.",
      RecordType: "FORM",
      RiskScore: 65,
      CreatedAt: "2026-04-23T14:20:00Z",
      AnalysisJson: JSON.stringify({
        summary: "Hợp đồng hợp tác kinh doanh tiêu chuẩn",
        risks: [
          {
            level: "high",
            description: "Cần thêm điều khoản liên quan đến bảo mật thông tin",
          },
          {
            level: "medium",
            description: "Cần rõ ràng về quyền sở hữu trí tuệ",
          },
        ],
        analysis: "Hợp đồng cần được tư vấn thêm bởi chuyên gia pháp lý",
      }),
    },
  },
  21: {
    success: true,
    data: {
      Id: "21",
      UserId: "4",
      FileName: null,
      OriginalFileName: null,
      FilePath: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo Bộ luật Lao động",
      Description:
        "Cuộc thảo luận về các quy định liên quan đến thời gian thử việc.",
      RecordType: "CHAT",
      RiskScore: 30,
      CreatedAt: "2026-04-20T09:15:00Z",
      AnalysisJson: JSON.stringify({
        summary: "Thảo luận quy định lao động",
        risks: [],
        analysis: "Nội dung thảo luận hợp pháp, tuân theo quy định hiện hành",
      }),
    },
  },
};

// Hàm lấy mock detail by ID
export const getMockDetailResponse = (id) => {
  return (
    mockDetailedRecords[id] || {
      success: false,
      message: "Không tìm thấy hồ sơ",
    }
  );
};

// CONFIG: Bật/tắt mock mode tại đây
export const USE_MOCK_DATA = true; // Đổi thành true để dùng mock data
