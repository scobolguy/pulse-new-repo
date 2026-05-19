SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.NlpInteractionLog', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.NlpInteractionLog (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    actor_user_id NVARCHAR(128) NOT NULL,
    language_code NVARCHAR(32) NULL,
    user_message NVARCHAR(MAX) NOT NULL,
    normalized_intent NVARCHAR(64) NULL,
    intent_confidence DECIMAL(5,4) NULL,
    response_kind NVARCHAR(64) NULL,
    clarification_requested BIT NOT NULL CONSTRAINT DF_NlpInteractionLog_ClarificationRequested DEFAULT (0),
    was_successful BIT NOT NULL CONSTRAINT DF_NlpInteractionLog_WasSuccessful DEFAULT (1),
    screen_context_json NVARCHAR(MAX) NULL,
    suggestions_json NVARCHAR(MAX) NULL,
    metadata_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_NlpInteractionLog_CreatedAt DEFAULT (SYSUTCDATETIME())
  );

  CREATE INDEX IX_NlpInteractionLog_Actor_CreatedAt
    ON dbo.NlpInteractionLog(actor_user_id, created_at DESC);
END
GO

IF OBJECT_ID('dbo.NlpUserProfile', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.NlpUserProfile (
    actor_user_id NVARCHAR(128) NOT NULL PRIMARY KEY,
    preferred_language NVARCHAR(32) NULL,
    preferred_prompt_style NVARCHAR(64) NULL,
    learned_preferences_json NVARCHAR(MAX) NULL,
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_NlpUserProfile_UpdatedAt DEFAULT (SYSUTCDATETIME())
  );
END
GO
