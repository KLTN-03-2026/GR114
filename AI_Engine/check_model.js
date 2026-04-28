// File: AI_Engine/check_model.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listAvailableModels() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("❌ LỖI: Chưa thấy Key trong file .env");
    return;
  }
  console.log("🔑 Đang dùng Key bắt đầu bằng:", key.substring(0, 8) + "...");
  console.log("📡 Đang hỏi Google danh sách Model khả dụng...");

  try {
    // Gọi trực tiếp API REST để lấy danh sách (vì SDK đôi khi giấu lỗi)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();

    if (data.error) {
      console.error("❌ GOOGLE BÁO LỖI:", data.error.message);
      console.log("👉 Gợi ý: Key này có thể chưa bật API 'Generative Language API'.");
    } else if (data.models) {
      console.log("\n✅ THÀNH CÔNG! DANH SÁCH MODEL BẠN ĐƯỢC DÙNG:");
      console.log("------------------------------------------------");
      data.models.forEach(m => {
        // Chỉ hiện các model tạo nội dung (generateContent)
        if (m.supportedGenerationMethods.includes("embedContent")) {
          console.log(`🔹 Tên chuẩn: ${m.name.replace('models/', '')}`);
        }
      });
      console.log("------------------------------------------------");
      console.log("👉 Hãy copy một cái tên ở trên (ví dụ: gemini-1.5-flash) và dán vào file geminiService.js");
    } else {
      console.log("⚠️ Lạ quá, không có lỗi nhưng cũng không có danh sách model.");
    }
  } catch (error) {
    console.error("❌ Lỗi kết nối mạng:", error);
  }
}

listAvailableModels();