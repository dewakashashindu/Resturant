/*
  Restaurant POS - Transactional Stored Procedures
  Exact legacy naming contract requested:
  - TabelNo
  - TabelGrpID
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_AddAdditionalItem
    @TabelNo      NVARCHAR(50),
    @ItemCode     NVARCHAR(50),
    @QTY          FLOAT,
    @SalesPrice   DECIMAL(18,2),
    @ItemRemarks  NVARCHAR(500) = N'',
    @UserID       NVARCHAR(50),
    @TabelGrpID   NVARCHAR(50),
    @LPax         FLOAT = 0,
    @FPax         FLOAT = 0,
    @MgrID        NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME = GETDATE();
    DECLARE @Delta FLOAT = ABS(@QTY);

    IF NULLIF(LTRIM(RTRIM(@TabelNo)), N'') IS NULL
        THROW 50010, 'TabelNo is required.', 1;

    IF NULLIF(LTRIM(RTRIM(@ItemCode)), N'') IS NULL
        THROW 50011, 'ItemCode is required.', 1;

    IF @Delta <= 0
        THROW 50012, 'QTY must be greater than zero.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.Tbl_HoldUpsCloudTemp
            (TabelNo, UserID, AoR, ItemCode, QTY, SalesPrice, ItemRemarks, TabelGrpID, TxnDateTime, LPax, FPax, MgrID)
        VALUES
            (@TabelNo, @UserID, 'A', @ItemCode, @Delta, @SalesPrice, COALESCE(@ItemRemarks, N''), @TabelGrpID, @Now, @LPax, @FPax, @MgrID);

        IF EXISTS (
            SELECT 1
            FROM dbo.Tbl_HoldUpsCloud WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
            WHERE TabelNo = @TabelNo
              AND ItemCode = @ItemCode
        )
        BEGIN
            UPDATE dbo.Tbl_HoldUpsCloud
            SET QTY = QTY + @Delta,
                SalesPrice = @SalesPrice,
                ItemRemarks = COALESCE(@ItemRemarks, ItemRemarks),
                UserID = @UserID,
                TabelGrpID = @TabelGrpID,
                LPax = @LPax,
                FPax = @FPax,
                TxnDateTime = @Now
            WHERE TabelNo = @TabelNo
              AND ItemCode = @ItemCode;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Tbl_HoldUpsCloud
                (TabelNo, ItemCode, QTY, SalesPrice, ItemRemarks, UserID, TabelGrpID, LPax, FPax, TxnDateTime)
            VALUES
                (@TabelNo, @ItemCode, @Delta, @SalesPrice, COALESCE(@ItemRemarks, N''), @UserID, @TabelGrpID, @LPax, @FPax, @Now);
        END

        COMMIT TRANSACTION;

        SELECT CAST(1 AS BIT) AS Ok, N'Item added successfully.' AS Message;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RemoveItem
    @TabelNo      NVARCHAR(50),
    @ItemCode     NVARCHAR(50),
    @QTY          FLOAT,
    @SalesPrice   DECIMAL(18,2),
    @ItemRemarks  NVARCHAR(500),
    @UserID       NVARCHAR(50),
    @TabelGrpID   NVARCHAR(50),
    @LPax         FLOAT = 0,
    @FPax         FLOAT = 0,
    @MgrID        NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME = GETDATE();
    DECLARE @Delta FLOAT = ABS(@QTY);
    DECLARE @CurrentQTY FLOAT;

    IF NULLIF(LTRIM(RTRIM(@TabelNo)), N'') IS NULL
        THROW 50013, 'TabelNo is required.', 1;

    IF NULLIF(LTRIM(RTRIM(@ItemCode)), N'') IS NULL
        THROW 50014, 'ItemCode is required.', 1;

    IF @Delta <= 0
        THROW 50015, 'QTY must be greater than zero.', 1;

    IF NULLIF(LTRIM(RTRIM(@MgrID)), N'') IS NULL
        THROW 50018, 'Manager authorization is required for void operations.', 1;

    IF NULLIF(LTRIM(RTRIM(@ItemRemarks)), N'') IS NULL
        THROW 50019, 'Void reason is required for void operations.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @CurrentQTY = QTY
        FROM dbo.Tbl_HoldUpsCloud WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TabelNo = @TabelNo
          AND ItemCode = @ItemCode;

        IF @CurrentQTY IS NULL
            THROW 50016, 'Item line not found on the active bill.', 1;

        IF @Delta > @CurrentQTY
            THROW 50017, 'Transaction Denied: Cannot void more items than what is currently active.', 1;

        INSERT INTO dbo.Tbl_HoldUpsCloudTemp
            (TabelNo, UserID, AoR, ItemCode, QTY, SalesPrice, ItemRemarks, TabelGrpID, TxnDateTime, LPax, FPax, MgrID)
        VALUES
            (@TabelNo, @UserID, 'R', @ItemCode, @Delta, @SalesPrice, @ItemRemarks, @TabelGrpID, @Now, @LPax, @FPax, @MgrID);

        UPDATE dbo.Tbl_HoldUpsCloud
        SET QTY = QTY - @Delta,
            SalesPrice = @SalesPrice,
            ItemRemarks = @ItemRemarks,
            UserID = @UserID,
            TabelGrpID = @TabelGrpID,
            LPax = @LPax,
            FPax = @FPax,
            TxnDateTime = @Now
        WHERE TabelNo = @TabelNo
          AND ItemCode = @ItemCode;

        DELETE FROM dbo.Tbl_HoldUpsCloud
        WHERE TabelNo = @TabelNo
          AND ItemCode = @ItemCode
          AND QTY <= 0;

        COMMIT TRANSACTION;

        SELECT CAST(1 AS BIT) AS Ok, N'Item removed successfully.' AS Message;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
