-- Script tạo bảng SystemSettings cho SQL Server
-- Chạy trong SQL Server Management Studio hoặc qua query

CREATE TABLE SystemSettings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Đảm bảo chỉ có 1 dòng duy nhất
    appName NVARCHAR(255) NOT NULL,
    adminEmail NVARCHAR(255) NOT NULL,
    geminiApiKey NVARCHAR(500) NOT NULL,  -- Lưu dưới dạng secret
    geminiModel NVARCHAR(100) NOT NULL,
    temperature DECIMAL(3,2) NOT NULL CHECK (temperature >= 0 AND temperature <= 1),  -- DECIMAL để tránh sai số
    pineconeApiKey NVARCHAR(500) NOT NULL,
    pineconeIndex NVARCHAR(255) NOT NULL,
    createdAt DATETIME DEFAULT GETDATE(),
    updatedAt DATETIME DEFAULT GETDATE()
);