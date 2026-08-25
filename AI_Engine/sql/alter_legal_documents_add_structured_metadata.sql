IF COL_LENGTH('dbo.LegalDocuments', 'DocumentType') IS NULL
BEGIN
    ALTER TABLE dbo.LegalDocuments ADD DocumentType NVARCHAR(100) NULL;
END;

IF COL_LENGTH('dbo.LegalDocuments', 'IssueDate') IS NULL
BEGIN
    ALTER TABLE dbo.LegalDocuments ADD IssueDate DATE NULL;
END;

IF COL_LENGTH('dbo.LegalDocuments', 'EffectiveDate') IS NULL
BEGIN
    ALTER TABLE dbo.LegalDocuments ADD EffectiveDate DATE NULL;
END;
