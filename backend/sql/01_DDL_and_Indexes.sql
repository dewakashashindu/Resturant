/*
  Restaurant POS - Schema DDL
  Exact legacy column names requested:
  - TabelNo
  - TabelGrpID
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Tbl_HoldUpsCloud', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_HoldUpsCloud
    (
        TabelNo     NVARCHAR(50)   NOT NULL,
        ItemCode    NVARCHAR(50)   NOT NULL,
        QTY         FLOAT          NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloud_QTY DEFAULT (0),
        SalesPrice  DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloud_SalesPrice DEFAULT (0),
        ItemRemarks NVARCHAR(500)  NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloud_ItemRemarks DEFAULT (N''),
        UserID      NVARCHAR(50)   NOT NULL,
        TabelGrpID  NVARCHAR(50)   NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloud_TabelGrpID DEFAULT (N''),
        LPax        FLOAT          NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloud_LPax DEFAULT (0),
        FPax        FLOAT          NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloud_FPax DEFAULT (0),
        TxnDateTime DATETIME       NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloud_TxnDateTime DEFAULT (GETDATE()),
        CONSTRAINT PK_Tbl_HoldUpsCloud PRIMARY KEY CLUSTERED (TabelNo, ItemCode),
        CONSTRAINT CK_Tbl_HoldUpsCloud_QTY CHECK (QTY >= 0),
        CONSTRAINT CK_Tbl_HoldUpsCloud_SalesPrice CHECK (SalesPrice >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.Tbl_HoldUpsCloudTemp', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_HoldUpsCloudTemp
    (
        LogID       INT            IDENTITY(1,1) NOT NULL,
        TabelNo     NVARCHAR(50)   NOT NULL,
        UserID      NVARCHAR(50)   NOT NULL,
        AoR         CHAR(1)        NOT NULL,
        ItemCode    NVARCHAR(50)   NOT NULL,
        QTY         FLOAT          NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloudTemp_QTY DEFAULT (0),
        SalesPrice  DECIMAL(18,2)  NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloudTemp_SalesPrice DEFAULT (0),
        ItemRemarks NVARCHAR(500)  NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloudTemp_ItemRemarks DEFAULT (N''),
        TabelGrpID  NVARCHAR(50)   NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloudTemp_TabelGrpID DEFAULT (N''),
        TxnDateTime DATETIME       NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloudTemp_TxnDateTime DEFAULT (GETDATE()),
        LPax        FLOAT          NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloudTemp_LPax DEFAULT (0),
        FPax        FLOAT          NOT NULL CONSTRAINT DF_Tbl_HoldUpsCloudTemp_FPax DEFAULT (0),
        MgrID       NVARCHAR(50)   NULL,
        CONSTRAINT PK_Tbl_HoldUpsCloudTemp PRIMARY KEY CLUSTERED (LogID),
        CONSTRAINT CK_Tbl_HoldUpsCloudTemp_AoR CHECK (AoR IN ('A', 'R')),
        CONSTRAINT CK_Tbl_HoldUpsCloudTemp_QTY CHECK (QTY > 0),
        CONSTRAINT CK_Tbl_HoldUpsCloudTemp_SalesPrice CHECK (SalesPrice >= 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Tbl_HoldUpsCloudTemp_TableNo_ItemCode_TxnDateTime'
      AND object_id = OBJECT_ID(N'dbo.Tbl_HoldUpsCloudTemp')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Tbl_HoldUpsCloudTemp_TableNo_ItemCode_TxnDateTime
    ON dbo.Tbl_HoldUpsCloudTemp (TabelNo, ItemCode, TxnDateTime DESC)
    INCLUDE (AoR, QTY, SalesPrice, UserID, MgrID, TabelGrpID);
END;
GO
