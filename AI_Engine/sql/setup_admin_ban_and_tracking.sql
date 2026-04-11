-- SQL Server schema updates for admin ban support and AI tracking

-- 1) Add Status column to existing Users table
ALTER TABLE Users
ADD Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_Status DEFAULT 'Active';

-- 2) Create AI history tracking table
CREATE TABLE AIHistory (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    QueryText NVARCHAR(MAX) NOT NULL,
    ResponseText NVARCHAR(MAX) NULL,
    OperationType NVARCHAR(100) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AIHistory_Users_UserId FOREIGN KEY (UserId) REFERENCES Users(Id)
);
GO

CREATE INDEX IX_AIHistory_UserId_CreatedAt ON AIHistory(UserId, CreatedAt DESC);

-- 3) Create feature usage summary table
CREATE TABLE AIFeatureUsage (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    FeatureName NVARCHAR(100) NOT NULL,
    UsageCount INT NOT NULL DEFAULT 0,
    LastUsed DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AIFeatureUsage_Users_UserId FOREIGN KEY (UserId) REFERENCES Users(Id)
);
GO

CREATE INDEX IX_AIFeatureUsage_FeatureName ON AIFeatureUsage(FeatureName);
CREATE INDEX IX_AIFeatureUsage_UserId ON AIFeatureUsage(UserId);

-- 4) Example insert for initial usage tracking (optional)
-- INSERT INTO AIFeatureUsage (UserId, FeatureName, UsageCount)
-- VALUES (1, 'Document Search', 1);
