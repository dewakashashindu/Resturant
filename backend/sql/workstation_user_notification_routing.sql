/*
  Workstation user-routing migration
  ----------------------------------
  Purpose:
  - Tbl_Warkstation.Warkstation is the app's registered device ID.
  - Tbl_Warkstation.UserID is the currently authenticated user/steward on
    that device.
  - KDS status notifications use this mapping to send an OP notification to
    the matching steward's device only.

  The supplied table definition already includes UserID VARCHAR(10) NULL.
  This script is safe on older installations where it has not been added.
*/

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.Tbl_Warkstation', N'U') IS NULL
BEGIN
    RAISERROR('dbo.Tbl_Warkstation was not found. Create/restore the workstation table first.', 16, 1);
    RETURN;
END;
GO

IF COL_LENGTH(N'dbo.Tbl_Warkstation', N'UserID') IS NULL
BEGIN
    ALTER TABLE dbo.Tbl_Warkstation
    ADD UserID VARCHAR(10) NULL;
END;
GO

/*
  KDS looks up the active approved device by UserID. This index makes that
  lookup efficient while Warkstation remains the returned device ID.
*/
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Tbl_Warkstation')
      AND name = N'IX_Tbl_Warkstation_UserID_Approved'
)
BEGIN
    CREATE INDEX IX_Tbl_Warkstation_UserID_Approved
        ON dbo.Tbl_Warkstation (UserID, IsApproved)
        INCLUDE (Warkstation);
END;
GO

/*
  No data update is required. On the next successful Username/Password,
  Fingerprint, or Face Unlock authentication, the backend automatically:

    1. Clears the same UserID from any earlier workstation row.
    2. Sets the approved current device's UserID to the authenticated UserId.

  Therefore each steward maps to the one device they most recently used.
*/
