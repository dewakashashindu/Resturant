/*
  KDS — menu item availability

  Physical column used by the restaurant database:
    ItemNotAvailable = 0  -> available (default)
    ItemNotAvailable = 1  -> unavailable

  The app/API keeps its client response as ItemAvailable for compatibility,
  but writes the inverted value to this physical column.

  Run this in the SAME database used by backend/server.js.
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
    /* Add the exact field shown in the Table Designer if it is not present. */
    IF COL_LENGTH(N'dbo.Tbl_MenuItems', N'ItemNotAvailable') IS NULL
    BEGIN
        ALTER TABLE dbo.Tbl_MenuItems
        ADD ItemNotAvailable bit NOT NULL
            CONSTRAINT DF_Tbl_MenuItems_ItemNotAvailable DEFAULT (0);
    END
    ELSE
    BEGIN
        /* Ensure future inserts default to available: ItemNotAvailable = 0. */
        DECLARE @DefaultConstraint sysname;
        DECLARE @Sql nvarchar(max);

        SELECT @DefaultConstraint = dc.name
        FROM sys.default_constraints AS dc
        INNER JOIN sys.columns AS c
            ON c.object_id = dc.parent_object_id
           AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Tbl_MenuItems')
          AND c.name = N'ItemNotAvailable';

        IF @DefaultConstraint IS NOT NULL
        BEGIN
            SET @Sql = N'ALTER TABLE dbo.Tbl_MenuItems DROP CONSTRAINT '
                + QUOTENAME(@DefaultConstraint) + N';';
            EXEC sys.sp_executesql @Sql;
        END;

        ALTER TABLE dbo.Tbl_MenuItems
        ADD CONSTRAINT DF_Tbl_MenuItems_ItemNotAvailable
            DEFAULT (0) FOR ItemNotAvailable;
    END;
END;
GO

/*
  OPTIONAL ONE-TIME INITIALISATION

  Only run this if all existing menu items should be available initially:

  UPDATE dbo.Tbl_MenuItems
  SET ItemNotAvailable = 0;
*/
