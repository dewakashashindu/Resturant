/*
  KDS — menu item availability

  Meaning used by the KDS unavailable-items screen:
    ItemAvailable = 1  -> available (default)
    ItemAvailable = 0  -> unavailable

  Run this only after dbo.Tbl_MenuItems has been created in the SAME database
  used by the Node backend.
*/

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.Tbl_MenuItems', N'U') IS NULL
BEGIN
    RAISERROR(
        'dbo.Tbl_MenuItems was not found in the current database. Create the table first, or change to the correct database, then run this script again.',
        16,
        1
    );
END
ELSE
BEGIN
    /* New/old databases that do not have the column yet. */
    IF COL_LENGTH(N'dbo.Tbl_MenuItems', N'ItemAvailable') IS NULL
    BEGIN
        ALTER TABLE dbo.Tbl_MenuItems
        ADD ItemAvailable bit NOT NULL
            CONSTRAINT DF_Tbl_MenuItems_ItemAvailable DEFAULT (1);
    END
    ELSE
    BEGIN
        /*
          Replace any existing default constraint. The original table script
          creates DEFAULT (0), but the KDS rule is DEFAULT (1).
        */
        DECLARE @DefaultConstraint sysname;
        DECLARE @Sql nvarchar(max);

        SELECT @DefaultConstraint = dc.name
        FROM sys.default_constraints AS dc
        INNER JOIN sys.columns AS c
            ON c.object_id = dc.parent_object_id
           AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Tbl_MenuItems')
          AND c.name = N'ItemAvailable';

        IF @DefaultConstraint IS NOT NULL
        BEGIN
            SET @Sql = N'ALTER TABLE dbo.Tbl_MenuItems DROP CONSTRAINT '
                + QUOTENAME(@DefaultConstraint) + N';';
            EXEC sys.sp_executesql @Sql;
        END;

        ALTER TABLE dbo.Tbl_MenuItems
        ADD CONSTRAINT DF_Tbl_MenuItems_ItemAvailable DEFAULT (1) FOR ItemAvailable;
    END;
END;
GO

/*
  OPTIONAL ONE-TIME INITIALISATION

  Only run this if the table has never stored real unavailable choices and all
  existing rows should start available:

  UPDATE dbo.Tbl_MenuItems
  SET ItemAvailable = 1;
*/
