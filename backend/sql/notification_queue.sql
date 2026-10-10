/*
  Restaurant LAN notification queue
  ---------------------------------
  server.js creates this table automatically at backend startup. This script is
  provided for DB administrators and Kitchen-system integration testing.
*/

IF OBJECT_ID(N'dbo.Tbl_AppNotifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_AppNotifications (
        NotificationId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TargetDeviceId NVARCHAR(128) NOT NULL,
        NotificationType NVARCHAR(40) NOT NULL
            CONSTRAINT DF_AppNotifications_Type DEFAULT N'general',
        Title NVARCHAR(160) NOT NULL,
        Message NVARCHAR(500) NOT NULL,
        TableNo NVARCHAR(50) NULL,
        InvoiceNo NVARCHAR(50) NULL,
        ItemCode NVARCHAR(50) NULL,
        PayloadJson NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL
            CONSTRAINT DF_AppNotifications_CreatedAt DEFAULT SYSDATETIME(),
        ExpiresAt DATETIME2 NULL
    );

    CREATE INDEX IX_AppNotifications_Device_Id
        ON dbo.Tbl_AppNotifications (TargetDeviceId, NotificationId);
END;
GO

/*
  Kitchen item-ready example.
  TargetDeviceId must be the actual approved order-device ID. For example,
  the device ID is visible in the backend check-in log when the staff logs in.
*/
INSERT INTO dbo.Tbl_AppNotifications
(
    TargetDeviceId,
    NotificationType,
    Title,
    Message,
    TableNo,
    InvoiceNo,
    ItemCode
)
VALUES
(
    N'84c402a02abbc7bf',
    N'kitchen-item-ready',
    N'Item Ready',
    N'2 × Chicken Fried Rice is ready to serve.',
    N'12',
    N'INV-20261010-001',
    N'FR001'
);
GO

/* Kitchen whole-order-ready example. */
INSERT INTO dbo.Tbl_AppNotifications
(
    TargetDeviceId,
    NotificationType,
    Title,
    Message,
    TableNo,
    InvoiceNo
)
VALUES
(
    N'84c402a02abbc7bf',
    N'kitchen-order-ready',
    N'Order Ready',
    N'All items for Table 12 are ready to serve.',
    N'12',
    N'INV-20261010-001'
);
GO
