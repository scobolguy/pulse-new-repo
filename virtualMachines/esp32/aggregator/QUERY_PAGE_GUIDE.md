# Query Page: Natural Language Command Interface

## Overview

The Query Page is a frontend interface that lets users issue natural language commands and queries to the aggregator backend. It routes requests directly to deterministic backend actions before falling back to Ollama for general-purpose answers.

## How Routing Works

The query is processed in a strict priority order. The first matching path wins:

1. **Queue create command** — deterministic; calls `/api/queues/:managerId/create`
2. **Gateway bridge command** — deterministic; creates queues then starts a bridge worker
3. **Ollama ask** — sends query to `/api/ollama/ask` which applies its own layered routing (see below)

Ollama ask applies this sub-routing:
1. Queue type assignment command
2. Project rename command
3. Subproject rename command
4. Project deploy command
5. Gateway/queue state query
6. Queue create command (server-side duplicate guard)
7. Gateway bridge command (server-side duplicate guard)
8. Pre-computed answer check (topology, node count, ESP device list, Neptune info)
9. Device control query (LED/GPIO on known child nodes)
10. General Ollama generate with knowledge context

## Natural Language Commands

### Create a Queue

**Trigger patterns** (client-side):
- `create queue <name>`
- `add queue <name>`
- `make queue <name>`
- `build queue <name>`
- `I need a queue called <name>`

**Example**:
```
create queue swift.mt103.inbound
```

**Result**: Queue created in the active queue manager. Response includes `managerId`, `queueName`, `created`, `alreadyExists`.

---

### Create a Gateway Bridge

A gateway bridge moves messages from one queue to another via a bridge worker.

**Trigger**: Query must contain `gateway` and specify input/output queues.

**Example patterns**:
```
create gateway from queue swift.mt103.inbound to queue swift.mt103.processed
create gateway myBridge from queue q.alpha to queue q.beta in project tradecore subproject settlement/v1
```

**What happens**:
1. Input and output queues are created if they do not exist.
2. A bridge worker is started at `/api/lifecycle/bridge-workers/start`.
3. A Pascalish source (`.pas`), pcode text (`.pcode`), and program map (`.program.json`) are persisted under `data/projects/<projectId>/gateways/`.

**Response includes**: `workerId`, `inputQueue`, `outputQueue`, `inputQueueCreated`, `outputQueueCreated`, `projectId`, `subprojectPath`, `pascalishFile`, `pcodeFile`, `programMapFile`.

---

### Assign Data Types to a Queue

**Trigger pattern**:
```
assign <dataTypeId[, dataTypeId]> to queue <name>
assign <dataTypeId[, dataTypeId]> to queue <name> in project <projectId> subproject <path>
```

**Example**:
```
assign swift-mt103, iso20022-camt053 to queue swift.mt103.inbound in project tradecore subproject settlement/v1
```

**What happens**:
- Validates type IDs against `/api/librarian/data-types`.
- Creates or updates queue config via `/api/queues/:managerId/create` or `/update`.
- Persists a `queue-type-assignments.json` artifact in the project workspace.

---

### Rename a Project

**Trigger pattern**:
```
rename project <oldId> to <newId>
```

**Example**:
```
rename project mytestgateway to myproductiongateway
```

Renames the project directory under `data/projects/`.

---

### Rename a Subproject

**Trigger pattern**:
```
rename subproject <oldPath> to <newPath> in project <projectId>
```

**Example**:
```
rename subproject settlement/v1 to settlement/v2 in project tradecore
```

---

### Deploy a Project to a Node

**Trigger pattern**:
```
deploy project <projectId> to node <nodeId>
deploy project <projectId> subproject <path> to node <nodeId>
deploy subproject <path> in project <projectId> to node <nodeId>
```

**Example**:
```
deploy project tradecore subproject settlement/v1 to node neptune
```

**What happens**:
1. Resolves node ID (supports partial/alias names and dotted hierarchy paths like `neptune.child1`).
2. Reads all files from the project artifact directory recursively.
3. Posts the file bundle to `/api/nodes/:nodeId/deploy`.

---

### Gateway and Queue State Query

Ask about the current runtime state of gateways and queues.

**Trigger**: Query contains words like `state`, `status`, `health`, `show`, `display`, `graphic`, or `dashboard` combined with `gateway` and `queue`.

**Example**:
```
show gateway and queue state
dashboard status gateways and queues
```

**Response includes**: `runtimeState` with `gateways` (id, running, quiesced, mode, processed count), `topQueues` (name, depth), `queueCount`.

---

### Device Control (LED/GPIO)

**Trigger**: Query mentions a known child node name (`child1`, `child2`, `child3`, `neptune.child1`, etc.) and an action (`turn on`, `turn off`, `toggle`, `activate`, `deactivate`).

**Example**:
```
turn on the LED on child1
turn off neptune.child1 LED
```

Routes to `/api/ollama/device-control` which calls `POST /devices/ledpin/action?action=on|off` on the device directly.

---

### Relay Control

**Trigger**: Query type returned by Ollama is `relay-control` and the answer contains a JSON relay command (`{ action, node, pin, duration }`).

Routes to `POST /api/ollama/relay/control` for hardware relay execution.

---

### Reload Knowledge Context

Button in the UI calls `POST /api/ollama/reload` to reload `data/general-knowledge.md` into the Ollama prompt context.

---

### General Query (Ollama)

Anything not matched by the above falls through to `/api/ollama/ask` which uses `data/general-knowledge.md` as system context plus the ANTLR grammar corpus and Pascal few-shot examples.

---

## Pre-Computed Instant Answers

The backend answers certain topology queries without calling Ollama (zero-latency):

| Query pattern | Answer |
|---|---|
| show tree / network topology / node hierarchy | Full 8-node tree with Neptune's children |
| how many nodes / node count / total nodes | Node count summary |
| list ESP32 / ESP32 devices | child1/2/3 IP list |
| what is Neptune | Neptune cluster controller info |

These are hardcoded in `ollamaRoutes.mjs` and intended to be updated as the network changes.

---

## Response Cache

Responses are cached in memory with a 5-minute TTL. Cache is invalidated on write operations (queue create, gateway create, project rename, deploy).

Slow queries (> 60 seconds) are logged to `logs/slow-queries.jsonl`.

---

## Project Workspace Artifacts

Gateway and queue-type-assignment artifacts are written to:

```
aggregator/data/projects/<projectId>/
  gateways/
    <workerId>.pas          # Pascalish source
    <workerId>.pcode        # pcode text (ESP32-compatible subset)
    <workerId>.program.json # program map with metadata
  gateway-bridges.json      # index of all gateways in this project
  queue-type-assignments.json

aggregator/data/projects/<projectId>/subprojects/<path>/
  gateways/
  gateway-bridges.json
  queue-type-assignments.json
```

`data/projects/` is an operational runtime directory. It follows the same hygiene rules as other `aggregator/data/` subdirectories.

---

## Query History

- Last 10 queries are stored in component state.
- History is not persisted across page refresh.

---

## Limitations

- Ollama queue/gateway/project commands also fire on the server side in `ollamaRoutes.mjs`; the client-side parsing in `QueryPage.jsx` intercepts a subset of them before the Ollama round-trip.
- Device control only recognises the three hardcoded child nodes (`child1`, `child2`, `child3`) plus nodes discovered via `/api/nodes`.
- Relay control depends on Ollama correctly identifying the query type as `relay-control` and returning a valid JSON command in its answer.
- Project deploy requires the target node to have an active `/api/nodes/:nodeId/deploy` handler.
