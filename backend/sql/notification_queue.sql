/*
  Restaurant notification schema — normalized version
  ----------------------------------------------------
  Header table: dbo.Tbl_AppNotifications
  Item lines : dbo.Tbl_AppNotificationItems

  NotificationType:
    OP = Operational notification
    IT = Item-availability notification

  TargetDeviceId:
    actual device ID = one device
    *                = all active signed-in devices

  PayloadJson is intentionally not used. Item details are stored in the child
  table so they can be queried, indexed and displayed without parsing JSON.
*/

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.Tbl_AppNotifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_AppNotifications (
        NotificationId BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_AppNotifications PRIMARY KEY,
        TargetDeviceId NVARCHAR(128) NOT NULL,
        NotificationType NVARCHAR(40) NOT NULL
            CONSTRAINT DF_AppNotifications_Type DEFAULT N'general',
        NotificationKind NVARCHAR(50) NULL,
        StatusCode NVARCHAR(10) NULL,
        Title NVARCHAR(160) NOT NULL,
        Message NVARCHAR(500) NOT NULL,
        TableNo NVARCHAR(50) NULL,
        InvoiceNo NVARCHAR(50) NULL,
        ItemCode NVARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL
            CONSTRAINT DF_AppNotifications_CreatedAt DEFAULT SYSDATETIME(),
        ExpiresAt DATETIME2 NULL
    );
END;
GO

/* Add the normalized header fields to a pre-existing notification table. */
IF COL_LENGTH(N'dbo.Tbl_AppNotifications', N'NotificationKind') IS NULL
BEGIN
    ALTER TABLE dbo.Tbl_AppNotifications
    ADD NotificationKind NVARCHAR(50) NULL;
END;

IF COL_LENGTH(N'dbo.Tbl_AppNotifications', N'StatusCode') IS NULL
BEGIN
    ALTER TABLE dbo.Tbl_AppNotifications
    ADD StatusCode NVARCHAR(10) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Tbl_AppNotifications')
      AND name = N'IX_AppNotifications_Device_Id'
)
BEGIN
    CREATE INDEX IX_AppNotifications_Device_Id
        ON dbo.Tbl_AppNotifications (TargetDeviceId, NotificationId);
END;
GO

/* One notification can own zero, one or many item lines. */
IF OBJECT_ID(N'dbo.Tbl_AppNotificationItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_AppNotificationItems (
        NotificationItemId BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_AppNotificationItems PRIMARY KEY,
        NotificationId BIGINT NOT NULL,
        ItemCode NVARCHAR(50) NOT NULL,
        ItemName NVARCHAR(160) NOT NULL,
        Quantity FLOAT NULL,
        ItemRemarks NVARCHAR(1500) NULL,
        ItemType NVARCHAR(10) NULL,
        CONSTRAINT FK_AppNotificationItems_Notification
            FOREIGN KEY (NotificationId)
            REFERENCES dbo.Tbl_AppNotifications (NotificationId)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Tbl_AppNotificationItems')
      AND name = N'IX_AppNotificationItems_NotificationId'
)
BEGIN
    CREATE INDEX IX_AppNotificationItems_NotificationId
        ON dbo.Tbl_AppNotificationItems (NotificationId, NotificationItemId);
END;
GO

/*
  PayloadJson is no longer required: its former item list is now held in
  Tbl_AppNotificationItems. Run this final block after deploying the updated
  backend. It removes only the unused column, not notification history.
*/
IF COL_LENGTH(N'dbo.Tbl_AppNotifications', N'PayloadJson') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Tbl_AppNotifications
    DROP COLUMN PayloadJson;
END;
GO
