/*
  KDS status migration for the supplied Tbl_KOTBOTHeder schema

  ProStatus mapping:
    S = waiting / TO DO
    P = PROCESSING
    D = DONE

  This script only corrects the default for future KOT/BOT rows. It does not
  overwrite existing P or D progress records.
*/

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.Tbl_KOTBOTHeder', N'U') IS NULL
BEGIN
    RAISERROR('dbo.Tbl_KOTBOTHeder was not found. Create the KOT/BOT table first.', 16, 1);
END
ELSE
BEGIN
    DECLARE @DefaultConstraint sysname;
    DECLARE @Sql nvarchar(max);

    SELECT @DefaultConstraint = dc.name
    FROM sys.default_constraints AS dc
    INNER JOIN sys.columns AS c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Tbl_KOTBOTHeder')
      AND c.name = N'ProStatus';

    IF @DefaultConstraint IS NOT NULL
    BEGIN
        SET @Sql = N'ALTER TABLE dbo.Tbl_KOTBOTHeder DROP CONSTRAINT '
            + QUOTENAME(@DefaultConstraint) + N';';
        EXEC sys.sp_executesql @Sql;
    END;

    ALTER TABLE dbo.Tbl_KOTBOTHeder
    ADD CONSTRAINT DF_Tbl_KOTBOTHeder_ProStatus DEFAULT ('S') FOR ProStatus;
END;
GO

/* Optional legacy-data repair: only run after checking the old values.
UPDATE dbo.Tbl_KOTBOTHeder
SET ProStatus = 'S'
WHERE LTRIM(RTRIM(ISNULL(ProStatus, ''))) NOT IN ('S', 'P', 'D');
*/
