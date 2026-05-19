# Group Provider Multi-Backend Roadmap

This document defines how Group Management can run on multiple storage backends without changing business logic or API routes.

## Current Status

- Implemented provider contract in `src/group-provider.mjs`
- Implemented adapters:
  - `file` (default): JSON-backed provider (`./data/user-groups.json`)
  - `mssql`: SQL Server provider (table auto-create)
- Registered API routes in backend:
  - `GET /api/users/groups?includeDeleted=1`
  - `POST /api/users/groups`
  - `PATCH /api/users/groups/:groupId`
  - `DELETE /api/users/groups/:groupId` (soft delete)

## Provider Contract

Every provider must implement the same async methods:

- `listGroups({ includeDeleted })`
- `getGroupById(groupId)`
- `createGroup(groupInput)`
- `updateGroup(groupId, updates)`
- `softDeleteGroup(groupId, { deletedBy })`

## Canonical Group Model

```json
{
  "groupId": "operations",
  "label": "Operations",
  "description": "Operations users",
  "privileges": ["queue.view", "lifecycle.manage"],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "deletedAt": null,
  "deletedBy": null
}
```

Soft delete is mandatory. No hard delete endpoint is exposed.

## Configuration

Environment variables:

- `GROUP_PROVIDER=file|mssql|oracle|azure-storage|excel`
- `GROUP_MSSQL_CONNECTION_STRING=<connection string>`
- `GROUP_MSSQL_TABLE=UserGroups`

If provider init fails, backend falls back to `file` provider.

## Next Adapters

1. Oracle adapter
- Storage choices:
  - `CLOB` column for `privileges` JSON, or
  - normalized table `group_privileges(groupId, privilege)`
- Suggested keys:
  - PK: `group_id`
  - Indexes: `deleted_at`, `updated_at`

2. Azure Storage adapter
- Preferred option: Azure Table Storage
  - `PartitionKey`: fixed value such as `groups`
  - `RowKey`: `groupId`
  - Store privileges as JSON string
- Alternative: Blob Storage with one JSON document per group

3. Excel adapter
- Best suited for low-scale operations/testing
- Provider should load workbook into memory and commit atomically
- Keep a strict sheet schema (`groups` sheet)

## Operational Guidance

- Start with `file` for local/dev.
- Use `mssql` for production first (already implemented).
- Add Oracle and Azure adapters next if required by environment.
- Keep API and UI unchanged while swapping providers.
