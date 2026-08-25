IF COL_LENGTH('dbo.LegalDocuments', 'ContentHash') IS NULL
BEGIN
    ALTER TABLE dbo.LegalDocuments
    ADD ContentHash NVARCHAR(64) NULL;
END;
