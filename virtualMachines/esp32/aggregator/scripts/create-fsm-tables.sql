-- FSM Transaction State Tables
-- Run on the SQL Server that hosts PulseDB (currently Neptune).
-- Safe to re-run: each block is guarded by OBJECT_ID checks.
-- Table names match the backend defaults; override with
--   FSM_MSSQL_CURRENT_TABLE  and  FSM_MSSQL_HISTORY_TABLE  env vars if needed.

USE PulseDB;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- FsmEntityStateCurrent
-- One row per entity (transaction). Holds the *current* FSM state.
-- Updated in-place on every state transition.
-- ─────────────────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.FsmEntityStateCurrent', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FsmEntityStateCurrent (
        entity_id     NVARCHAR(128) NOT NULL
            CONSTRAINT PK_FsmEntityStateCurrent PRIMARY KEY CLUSTERED,
        machine_id    NVARCHAR(128) NOT NULL,        -- e.g. 'swift-mt103-lifecycle'
        state_id      NVARCHAR(128) NOT NULL,        -- e.g. 'pacs-created'
        state_label   NVARCHAR(256)     NULL,        -- human-readable label
        queue_name    NVARCHAR(256)     NULL,        -- queue the entity is currently in
        last_event_id NVARCHAR(128)     NULL,        -- last event that triggered the transition
        is_terminal   BIT          NOT NULL DEFAULT 0,
        payload_type  NVARCHAR(64)      NULL,
        updated_at    DATETIME2    NOT NULL
    );
    PRINT 'Created table dbo.FsmEntityStateCurrent';
END
ELSE
    PRINT 'Table dbo.FsmEntityStateCurrent already exists — skipped';
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- FsmEntityStateHistory
-- Append-only audit log. One row per state transition.
-- ─────────────────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.FsmEntityStateHistory', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FsmEntityStateHistory (
        id             BIGINT IDENTITY(1,1)
            CONSTRAINT PK_FsmEntityStateHistory PRIMARY KEY CLUSTERED,
        entity_id      NVARCHAR(128) NOT NULL,
        machine_id     NVARCHAR(128) NOT NULL,
        from_state     NVARCHAR(128)     NULL,       -- NULL on first transition
        to_state       NVARCHAR(128) NOT NULL,
        to_state_label NVARCHAR(256)     NULL,
        queue_name     NVARCHAR(256)     NULL,
        event_name     NVARCHAR(128)     NULL,
        is_terminal    BIT          NOT NULL DEFAULT 0,
        updated_at     DATETIME2    NOT NULL
    );

    -- Index used by the backend to retrieve history newest-first per entity.
    CREATE NONCLUSTERED INDEX IX_FsmEntityStateHistory_EntityId
        ON dbo.FsmEntityStateHistory (entity_id, id DESC);

    PRINT 'Created table dbo.FsmEntityStateHistory and index IX_FsmEntityStateHistory_EntityId';
END
ELSE
    PRINT 'Table dbo.FsmEntityStateHistory already exists — skipped';
GO
