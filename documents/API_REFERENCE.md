# Unified API Reference

This document consolidates API documentation across the repository:
- Visual Workflow Graph Service API
- Aggregator Develop Workspace API (Pascalish/COBOLISH/WFL files)
- Aggregator Platform API domains

## 1) Visual Workflow Graph Service API

Source: `documents/graph-service-api.ts`

### Templates
- `GET /api/templates`
- `POST /api/templates`
- `GET /api/templates/:id`
- `DELETE /api/templates/:id`

### Graphs
- `GET /api/graphs`
- `POST /api/graphs`
- `GET /api/graphs/:id`
- `DELETE /api/graphs/:id`

### Nodes
- `POST /api/graphs/:id/nodes`
- `GET /api/graphs/:id/nodes`
- `PUT /api/graphs/:id/nodes/:nodeId`
- `DELETE /api/graphs/:id/nodes/:nodeId`

### Edges
- `POST /api/graphs/:id/edges`
- `GET /api/graphs/:id/edges`
- `DELETE /api/graphs/:id/edges/:edgeId`

### Export / Validation
- `GET /api/graphs/:id/export/mermaid`
- `GET /api/graphs/:id/export/dsl`
- `GET /api/graphs/:id/export/pcode`
- `POST /api/graphs/:id/export/json`
- `POST /api/graphs/:id/validate`

### Node Type Registry
- `GET /api/node-types`
- `GET /api/node-types/:category`

### Health / Metadata
- `GET /api/health`
- `GET /api/info`

## 2) Aggregator Develop Workspace API

Source: `virtualMachines/esp32/aggregator/src/backend/developDocumentRoutes.mjs`

### Document Types
- `GET /api/develop/document-types`

Returns available types from document registry:
- Pascalish (`.pas`)
- Workflow/WFL (`.wfl`)
- COBOLISH (`.cob`)

### File Workspace
- `GET /api/develop/files`
- `GET /api/develop/files/:fileName`
- `POST /api/develop/files`
- `PUT /api/develop/files/:fileName`
- `PATCH /api/develop/files/:fileName`
- `DELETE /api/develop/files/:fileName`

### Compile / Run
- `POST /api/develop/compile`

Body fields:
- `fileName` (optional when `content` provided)
- `content` (optional when `fileName` provided)
- `mode`: `compile` | `compile-run` | `compile-debug`

Language behavior:
- Pascalish: compile supported
- COBOLISH: compile supported
- WFL: compile endpoint currently rejects (not supported by `/api/develop/compile`)

## 3) Aggregator Platform API Domains

Primary source files:
- `virtualMachines/esp32/aggregator/backend.mjs`
- `virtualMachines/esp32/aggregator/src/backend/routes.manifest.mjs`

The platform exposes a large route surface across these domains:
- authentication/authorization (`/api/auth*`, `/api/authz*`, `/api/users*`)
- queue and broker (`/api/queue*`, `/api/queues*`, `/api/broker*`)
- registry and topology (`/api/registry*`, `/api/remote-*`, `/api/local-queue-managers*`)
- lifecycle and governance (`/api/lifecycle*`, `/api/governance*`, `/api/supervisor*`)
- observability and system (`/api/metrics*`, `/api/system*`, `/api/events/mermaid`)
- replication (`/api/replication*`)
- FSM and NLP inquiry routes (`/api/fsm*`, `/api/nlp*`)

For operational usage examples and selected endpoint payloads, see:
- `virtualMachines/esp32/aggregator/README.md`

## 4) Keeping API Docs Current

Use these commands to re-inventory routes whenever backend code changes.

PowerShell (aggregator backend route definitions):

```powershell
Set-Location c:\dev\pulse-new-repo
rg "app\.(get|post|put|patch|delete)\('/api" virtualMachines/esp32/aggregator/backend.mjs
```

PowerShell (graph service API route definitions):

```powershell
Set-Location c:\dev\pulse-new-repo
rg "app\.(get|post|put|patch|delete)\('/api" documents/graph-service-api.ts
```

## 5) Drag-and-Drop FSM / Workflow Tool

Use the Visual Workflow Editor:
- `documents/visual-workflow-editor.html`

Details:
- `documents/VISUAL_EDITOR_README.md`
