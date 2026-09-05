# Aggregator Service

Aggregator is a control plane and routing layer for distributed services.

## Terminology

Use the terms below consistently across UI, NLI, and docs:

- Router: consumes a message and emits one or more queue deliveries based on routing rules.
- Transformer (Mapper): converts payload shape or content from one schema/form to another.
- Flow: a larger pipeline that can include router stages, transformer stages, and other runtime logic.
- Deployment: binds a runtime artifact or service instance to a node or cluster target.

## Project Build Tree Model

Projects are recursive containers. Every project can contain subprojects, and each subproject can contain more subprojects.

- Root project: top-level delivery boundary (domain, ownership, release intent).
- Subproject: independently buildable unit under a parent project.
- Leaf subproject: lowest-level unit that emits deployable artifacts.

Tree rules:

- Each node in the tree has a unique id within its parent scope.
- Each node records parent id (root uses null parent).
- Build order is bottom-up by default: build leaves first, then parents.
- Deployment targeting is inherited downward unless overridden at a child.
- Contract compatibility is validated upward: child outputs must satisfy parent inputs.

Recommended node shape:

- id
- parentId
- kind (project | subproject)
- name
- children[]
- flows[]
- routerStages[]
- transformerStages[]
- artifacts[]
- deploymentDefaults

Operational behavior:

- Local changes can be built at the nearest subtree root.
- Promotion to higher environments can move recursively up the tree.
- Health and readiness can be evaluated per subtree, then aggregated to parent status.

Main capabilities:
- Queue manager registry and routing
- Service instance registry for any service type (for example webapi or broker)
- Node lifecycle controls (quiesce, drain, maintenance, return-service)
- Service resolution and proxy to active instances only
- Cluster, site, and node-topology management for JS and ESP32 nodes

## Current Source Of Truth

The Aggregator backend is the source of truth for runtime clustering and topology behavior.

- Topology runtime implementation:
  - `src/backend/roles/topologyRuntimeRoutes.mjs`
- Cluster state files:
  - `data/cluster-registry.json`
  - `data/site-registry.json`
  - `data/node-topology-overrides.json`
  - `data/node-rename-overrides.json`

### Cluster Model In Production Today

- explicit cluster management via `/api/clusters`
- three automatically managed free pools:
  - `free-pool`
  - `free-pool-js`
  - `free-pool-esp`
- per-cluster deterministic UDP parent/sibling port pairs beginning at `4200`
- lifecycle actions for quiesce, restart-to-up, announce, and deploy

The batch files in the repo start local roles. They do not replace the persisted backend cluster registry.

## Run

Backend:

```powershell
node backend.mjs
```

Librarian service for mapper and schema-driven UI flows:

```powershell
npm run dev:librarian
```

Set `LIBRARIAN_DATA_ROOT` to select the catalog directory. It defaults to the
platform operational-data root when started directly, while `start-backend.bat`
defaults it to `aggregator/data`. `PULSE_LIBRARIAN_DATA_ROOT` remains accepted
for existing deployments.

Backend with auxiliary child services enabled:

```powershell
npm run dev:backend:aux
```

The Data Librarian now defaults to port `4300` so it does not conflict with the queue manager on `4100`.

Standalone queue manager node:

```powershell
node queue-manager-node.mjs --aggregator=http://localhost:4000 --port=4100 --manager-id=qm-local-4100 --node-id=WindowsNode --advertise-ip=127.0.0.1
```

Webpage launcher:
- Open the app UI
- Go to the Queue Manager Launcher screen
- Fill in Manager ID, Node ID, Port, Advertise IP, and Aggregator URL
- Press Start Queue Manager

Frontend:

```powershell
npm run dev
```

## Local NLI On The T490

The MCP-backed NLI uses local Ollama and is configured in `data/nli-config.json`.
Intent and slot routing remains deterministic in `data/agent-routes.json`; Ollama
handles unmatched natural-language requests.

The backend starts and supervises the local MCP companion on port `4011` by
default. It adopts an already healthy MCP process, restarts an owned process
after a crash, and recycles it after repeated health-check failures. Set
`PULSE_MCP_AUTOSTART=false` only when MCP is managed by an external service.
The check and restart timing can be changed with `PULSE_MCP_CHECK_INTERVAL_MS`
and `PULSE_MCP_RESTART_DELAY_MS`.

### Windows MCP Service

To run MCP independently at boot, first add these values to `.env.local` so
the backend and frontend do not launch competing MCP processes:

```dotenv
PULSE_MCP_AUTOSTART=false
FRONTEND_FSM_MCP_AUTOSTART=false
```

Then install the auto-starting `PulseMcpService` from an elevated PowerShell:

```powershell
npm run service:mcp:install
Invoke-RestMethod http://127.0.0.1:4011/health
```

The service uses the current Node executable, loads `.env.local` when present,
and restarts after unexpected exits. Remove it from an elevated PowerShell with:

```powershell
npm run service:mcp:uninstall
```

The default `t490-fast` profile uses `phi3:latest`, a 1024-token context, an
8-thread CPU setting, and a 64-token response limit. The model stays resident
for 30 minutes to avoid repeated load latency. This is sized for the T490's
16 GB RAM and CPU-only inference. The installed 23 GB `qwen3.6:latest` model is
too large for this laptop.

To select the slower, higher-quality installed model, change `activeProfile` to
`t490-quality`. For a temporary override, set `NLI_PROFILE` or `OLLAMA_MODEL` in
`.env.local`. Any Ollama model can be used; it does not have to be Phi-3.

Run the configuration test with:

```powershell
npm run test:nli:config
```

## Startup (Backend First)

Canonical ordered startup command:

```powershell
npm run startup:fsm:ordered
```

This command enforces backend first, frontend second, and exits non-zero unless both FSM status files report READY.

Detailed procedure and troubleshooting are documented in [startup.md](startup.md).

## Cluster Bootstrap

From the workspace root:

```powershell
./start-cluster.bat
./start-cluster.bat backup 192.168.2.101
./stop-cluster.bat
```

Use the backend APIs to inspect or mutate actual cluster membership after startup.

## ESP32 Deploy (Map + Firmware)

### Profile Builds (Cool Names Kept)

The firmware now supports role-targeted profiles:
- `esp32_bonecrusher`: larger message handling focus, lower task concurrency.
- `esp32_drone`: high-throughput microtask focus, smaller message limit.

Build either profile directly:

```powershell
C:\Users\scobo\.platformio\penv\Scripts\platformio.exe run --environment esp32_bonecrusher
C:\Users\scobo\.platformio\penv\Scripts\platformio.exe run --environment esp32_drone
```

Each node reports profile capabilities in `/status` and `/services/describe`:
- `deviceRole`
- `maxMessageBytes`
- `maxConcurrentTasks`
- `preferredTaskType`
- `firmwareTrack`

### 1) Deploy updated map artifact to ESP32

If you changed mapping artifacts (for example `data/router-mapper.program.json`), upload the LittleFS image:

```powershell
C:\Users\scobo\.platformio\penv\Scripts\platformio.exe run --target uploadfs --environment esp32dev
```

Then clear edge ingress caches on the board so new map entries are used immediately:

```powershell
node aggregator/scripts/clear-edge-ingress-cache.mjs
```

### 2) Deploy firmware over serial (kills COM5 holders first)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-esp32.ps1 -Mode serial -Port COM5 -Version 1.1.0
```

To also push filesystem first in the same command:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-esp32.ps1 -Mode serial -Port COM5 -UploadFs -Version 1.1.0
```

### 3) Deliver Runtime Data Through FFS

Use FederatedFileSystem upload routes for runtime payloads, routing rules, and mappings.

```powershell
Invoke-RestMethod -Method Post -Uri http://<node-ip>/ffs/upload -ContentType 'application/x-www-form-urlencoded' -Body @{ file = '/hrr.json'; body = $rulesJson }
Invoke-RestMethod -Method Post -Uri http://<node-ip>/ffs/upload -ContentType 'application/x-www-form-urlencoded' -Body @{ file = '/hdm.json'; body = $mappingsJson }
```

Notes:
- OTA is removed from firmware and PlatformIO environments in this repository.
- Use serial firmware upload plus FFS file upload for deployment.
- Legacy router terminology may still appear in older artifacts, but the runtime behavior is queue/routing based.
- OTA deploy updates firmware; filesystem artifacts are handled separately.
- Node firmware version is published by `/status` and `/services/describe` as `firmwareVersion`.

### Role-Aware Edge Routing (Backend)

`/api/router/ingest` and `/api/edge/ingest` are compatibility endpoint names and now accept an optional `edgeRole` value:
- `bonecrusher`
- `drone`

If `edgeRole` is not provided, backend auto-selects role by message size.

Environment variables for pool routing:
- `EDGE_ESP32_BONECRUSHER_NODES=192.168.2.115:80,192.168.2.116:80`
- `EDGE_ESP32_DRONE_NODES=192.168.2.117:80,192.168.2.118:80`
- `EDGE_ESP32_NODES=...` (generic fallback pool)
- `EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES=8192`

Forced evolution mode (optional):
- `EDGE_ESP32_FORCED_EVOLUTION_RATE=0.05`

When forced evolution is enabled, a small percentage of requests intentionally routes to the opposite role to test adaptive behavior.

### Edge Ingress Queue Tuning (ESP32)

Read current async ingress config:

```http
GET /pmachine/edge_ingress_config
```

Persist updated config (applies after reboot):

```http
POST /pmachine/edge_ingress_config
Content-Type: application/x-www-form-urlencoded

workerCount=2&queueLength=48&resultLimit=64&workerStackBytes=12288&workerPriority=1&preferredCore=1
```

Persist and reboot immediately:

```http
POST /pmachine/edge_ingress_config
Content-Type: application/x-www-form-urlencoded

queueLength=48&reboot=1
```

Notes:
- Queue capacity changes require reboot to take effect.
- Current runtime queue depth/capacity are returned in the config response.

### Bonecrusher Central Queue Worker (ESP32)

Bonecrusher firmware can now pull from the central queue manager using lease-safe claims.

Worker status:

```http
GET /bonecrusher/worker/status
```

Worker config update:

```http
POST /bonecrusher/worker/config
Content-Type: application/x-www-form-urlencoded

enabled=1&queueManagerUrl=http://192.168.2.11:4100&queueName=swift.mt103.inbound&leaseMs=30000&heartbeatMs=4000&pollIntervalMs=250&processTimeoutMs=60000&retryDelayMs=1000&maxAttempts=5
```

Worker behavior:
- Claims work from queue manager `/claim`.
- Extends lease via `/claim/heartbeat` while processing.
- On success calls `/claim/complete`.
- On failure calls `/claim/fail` with retry metadata.

Quick distributed setup files:
- Shared broker env template: [.env.shared-broker.example](.env.shared-broker.example)
- MacBook processing env template: [.env.macbook-processing.example](.env.macbook-processing.example)
- End-to-end MacBook node guide: [docs/macbook-processing-node.md](docs/macbook-processing-node.md)
- MacBook worker-only env template: [.env.macbook-worker-only.example](.env.macbook-worker-only.example)
- MacBook worker-only guide: [docs/macbook-worker-only.md](docs/macbook-worker-only.md)

## HAProxy Failover (Low-Fuss)

This project now supports a low-fuss failover setup with HAProxy and no backend code rewrites.

### 1) Configure HAProxy backends

Edit [deploy/haproxy/haproxy.cfg](deploy/haproxy/haproxy.cfg) and set your real backend host IPs:

```text
server backend_a 192.168.2.101:4000 check
server backend_b 192.168.2.102:4000 check
```

Health check uses `GET /status` on each backend.

### 2) Run HAProxy (Docker)

From the `aggregator` folder:

```powershell
$cfg = (Resolve-Path .\deploy\haproxy\haproxy.cfg).Path
docker run --rm --name pulse-haproxy -p 4100:4100 -v "${cfg}:/usr/local/etc/haproxy/haproxy.cfg:ro" haproxy:2.9
```

### 3) Point frontend dev proxy to HAProxy

Copy `.env.failover.example` to `.env.local` and use:

```text
VITE_API_PROXY_TARGET=http://localhost:4100
```

Then restart `npm run dev`.

Result:
- Frontend calls HAProxy on port `4100`
- HAProxy routes to healthy backend(s)
- If one backend fails, traffic fails over to the other

### 4) Remove HAProxy as a single point of failure

Run a second HAProxy instance on another machine with the same backend list.

Example:
- Gateway A: `http://192.168.2.101:4100`
- Gateway B: `http://192.168.2.102:4100`

Then set browser-side gateway failover in `.env.local`:

```text
VITE_API_BASES=http://192.168.2.101:4100,http://192.168.2.102:4100
```

## BOB Console HTTPS (Caddy)

Caddy terminates HTTPS while Vite, the API, MCP, and ESP32 devices continue using private HTTP connections.

```powershell
winget install --id CaddyServer.Caddy -e
npm run startup:fsm:ordered
npm run edge:https
```

Open `https://localhost/bob-console.html`. Port 80 is not required; use the `https://` URL explicitly. On first use, trust Caddy's local certificate authority from an elevated terminal:

```powershell
npm run edge:https:trust
```

For LAN access, set the hostname before starting Caddy:

```powershell
$env:BOB_HTTPS_HOST = "neptune"
npm run edge:https
```

Optional upstream overrides are `BOB_FRONTEND_UPSTREAM`, `BOB_API_UPSTREAM`, and `BOB_MCP_UPSTREAM`. ESP32 devices remain on the private HTTP API and do not require certificate changes.

## Natural Language Command Interface

The Query Page and `/api/ollama/ask` support deterministic natural language commands in addition to general-purpose Ollama queries.

Commands handled without an LLM call:
- `create queue <name>` — creates a queue in the active queue manager
- `create gateway from queue <a> to queue <b>` — starts a bridge worker and persists Pascalish/pcode artifacts
- `assign <dataTypeIds> to queue <name>` — assigns data types to a queue and persists artifact
- `rename project <old> to <new>` — renames a project workspace directory
- `rename subproject <old> to <new> in project <id>`
- `deploy project <id> to node <nodeId>` — deploys project artifacts to a cluster node
- Gateway/queue state queries — returns live dashboard of gateways and queue depths
- Device control (LED/GPIO) — routes to known child ESP32 nodes directly

Project workspace artifacts are written to `data/projects/<projectId>/`. See `QUERY_PAGE_GUIDE.md` for full documentation.

## Service Provider Registry

`src/backend/providers/serviceProviderRegistry.mjs` exposes ten named service providers for use in the workbench and API catalog:
- broker, router, queue, lifecycle, observability, topology, librarian, mapper, platform, iam

Providers are discoverable via `/api/service-providers` and `/api/service-providers/actions`.

## Data Hygiene Warning

`aggregator/data/` is currently mixed-use. It contains:

- hand-authored DSL and reference fixtures
- generated compiler outputs
- runtime registries and state files
- queue message persistence and operational logs
- Ollama mentor session output and escalation packets (`ollama-mentor-*`, `ollama-copilot-escalations/`)
- project workspace artifacts (`projects/`)

Do not assume every JSON or JSONL file under `data/` is canonical source. The cleanup plan that separates source, generated artifacts, and runtime output is documented in `../documents/REPOSITORY_HYGIENE_PLAN.md`.

Behavior:
- For `/api`, `/status`, and `/services`, the browser tries one gateway first.
- On network error or 5xx response, it retries the next gateway.
- This gives failover even if one HAProxy host is down.

For local testing on one machine, keep using:

```text
VITE_API_PROXY_TARGET=http://localhost:4100
```

DSL compilers:

```powershell
npm run compile:dsl
npm run compile:workflow
npm run interpret:workflow
```

## Lifecycle States

States used by queue managers and generic service instances:
- up: routable
- degraded: routable
- quiesced: not routable
- draining: not routable for new work, waiting for inflight queue work to clear
- maintenance: not routable
- down: not routable

## API Reference

For consolidated API docs and language guides, see:
- `../../../documents/API_REFERENCE.md`
- `../../../documents/PASCALISH_USER_GUIDE.md`
- `../../../documents/COBOLISH_USER_GUIDE.md`
- `../../../documents/WFL_USER_GUIDE.md`

### Queue Manager Registry

Get queue managers:

```http
GET /api/registry/queue-managers
```

Queue manager heartbeat:

```http
POST /api/registry/heartbeat
Content-Type: application/json

{
	"managerId": "qm-nodeA",
	"name": "queue-manager-A",
	"ip": "192.168.1.50",
	"port": 4000,
	"status": "up",
	"queues": ["jobs", "events"]
}
```

Standalone queue manager HTTP endpoints:

```http
GET  /health
POST /enqueue
POST /dequeue
GET  /queues
GET  /queues/:queueName/status
POST /claim
POST /claim/heartbeat
POST /claim/complete
POST /claim/fail
POST /claim/reap-expired
GET  /claim/metrics
```

Lease-based worker pattern (recommended for Bonecrusher pools):
- `POST /claim` with `queueName`, `workerId`, optional `leaseMs`.
- Worker processes message and periodically calls `POST /claim/heartbeat`.
- On success call `POST /claim/complete`.
- On failure call `POST /claim/fail` with retry/backoff fields (`delayMs`, `maxAttempts`) or `deadLetter=true`.
- Expired leases are re-queued automatically by the queue manager reaper.

Local launcher control endpoints:

```http
GET  /api/local-queue-managers
POST /api/local-queue-managers/start
POST /api/local-queue-managers/:managerId/stop
```

Per-manager lifecycle controls:

```http
POST /api/registry/queue-managers/:managerId/quiesce
POST /api/registry/queue-managers/:managerId/maintenance
POST /api/registry/queue-managers/:managerId/return-service
```

Queue assignment view:

```http
GET /api/registry/queues
```

### Generic Service Registry

Service instance heartbeat:

```http
POST /api/registry/service-instances/heartbeat
Content-Type: application/json

{
	"serviceName": "webapi",
	"instanceId": "webapi-nodeA",
	"nodeId": "NodeA",
	"ip": "192.168.1.50",
	"port": 8080,
	"status": "up",
	"metadata": {
		"version": "1.2.3"
	}
}
```

List all service instances:

```http
GET /api/registry/services
```

Resolve one active instance:

```http
GET /api/services/resolve/:serviceName
```

Proxy to resolved active instance:

```http
ALL /api/service-proxy/:serviceName?path=/status
```

### Node Lifecycle Controls

Node quiesce (stop new routing):

```http
POST /api/registry/nodes/:nodeId/quiesce
```

Node graceful drain:

```http
POST /api/registry/nodes/:nodeId/drain
GET /api/registry/nodes/:nodeId/drain-status
```

Drain behavior:
- Sets services on node to draining
- Excludes node from new routing
- Reports pending queue work (known local queue depth)

Node maintenance (gated by drain):

```http
POST /api/registry/nodes/:nodeId/maintenance
POST /api/registry/nodes/:nodeId/maintenance?force=true
```

If drain is not complete and force is not true, maintenance returns HTTP 409.

Return node to service:

```http
POST /api/registry/nodes/:nodeId/return-service
```

### Broker and Queue APIs

Broker state:

```http
GET /api/broker/state
```

Broker publish:

```http
POST /api/broker/publish
Content-Type: application/json

{
	"queueName": "jobs",
	"message": "hello",
	"sourceService": "producerA"
}
```

Route table:

```http
GET /api/broker/routes
```

Queue operations:

```http
POST /api/queue/:queueName/enqueue
POST /api/queue/:queueName/dequeue
GET  /api/queue/:queueName/length
POST /api/queue/:queueName/freeze
POST /api/queue/:queueName/thaw
GET  /api/queue/:queueName/status
POST /api/queue/:queueName/config
GET  /api/queue/:queueName/config
```

## Test Plan: Local + MacBook Service Instances

## Queue Manager Replication (Backup/Failover)

### Overview

Queue managers support **primary-replica replication** where:
- A **primary** queue manager handles all writes
- One or more **replicas** receive replicated operations
- Changes on instance A automatically sync to instance B

This enables fault tolerance: if the primary fails, a replica can take over.

### Replication Architecture

- **Operation Log**: Each write (enqueue, dequeue, freeze, thaw) is logged
- **Replica Sync**: Replicas poll for new operations and apply them locally
- **Version Tracking**: Each operation has a version number for consistency
- **Registry Tracking**: Primary's `replicas` array lists all replicas; each replica's `replicaOf` field points to its primary

### Creating a Replica Instance

**Step 1: Create the replica manager in the registry**

```http
POST /api/replication/create-replica
Content-Type: application/json

{
  "primaryManagerId": "qm-primary",
  "replicaManagerId": "qm-primary-replica-macbook",
  "replicaNodeId": "MacBookNode",
  "replicaIp": "192.168.2.35",
  "replicaPort": 4101
}
```

Response:
```json
{
  "status": "replica-created",
  "primary": {
    "managerId": "qm-primary",
    "replicas": ["qm-primary-replica-macbook"]
  },
  "replica": {
    "managerId": "qm-primary-replica-macbook",
    "replicaOf": "qm-primary"
  }
}
```

**Step 2: Start the replica queue manager process**

```bash
# On the MacBook
node queue-manager-node.mjs \
  --aggregator=http://192.168.2.11:4000 \
  --port=4101 \
  --manager-id=qm-primary-replica-macbook \
  --node-id=MacBookNode \
  --advertise-ip=192.168.2.35
```

### Synchronizing Replica State

Replicas must periodically sync with the primary to catch up on missed operations.

**Get primary's current version and operations**

```http
GET /api/replication/operations/qm-primary?since=0
```

Response:
```json
{
  "managerId": "qm-primary",
  "currentVersion": 42,
  "operations": [
    {
      "version": 1,
      "timestamp": 1672531200000,
      "type": "enqueue",
      "queueName": "order-queue",
      "message": {"orderId": 123},
      "sourceService": "api-gateway"
    },
    ...
  ],
  "operationCount": 42
}
```

**Apply operations on the replica**

```http
POST /api/replication/apply-operations/qm-primary-replica-macbook
Content-Type: application/json

{
  "operations": [
    {
      "version": 1,
      "timestamp": 1672531200000,
      "type": "enqueue",
      "queueName": "order-queue",
      "message": {"orderId": 123},
      "sourceService": "api-gateway"
    },
    ...
  ]
}
```

Response:
```json
{
  "status": "operations-applied",
  "targetManagerId": "qm-primary-replica-macbook",
  "applied": 42,
  "total": 42,
  "newVersion": 42
}
```

### Checking Replication Status

**Get replica sync status**

```http
GET /api/replication/status/qm-primary
```

Primary response (shows replica lag):
```json
{
  "managerId": "qm-primary",
  "isReplica": false,
  "replicaOf": null,
  "replicas": ["qm-primary-replica-macbook"],
  "operationVersion": 42,
  "replicaStatuses": [
    {
      "replicaId": "qm-primary-replica-macbook",
      "status": "up",
      "syncLag": 5,
      "lastHeartbeat": 1672534800000
    }
  ]
}
```

Replica response:
```json
{
  "managerId": "qm-primary-replica-macbook",
  "isReplica": true,
  "replicaOf": "qm-primary",
  "replicas": [],
  "operationVersion": 37,
  "primarySyncVersion": 37,
  "syncLag": 0
}
```

### Full State Snapshot (Recovery)

If a replica needs to recover from a stale state, get a full snapshot:

```http
GET /api/replication/snapshot/qm-primary
```

Response:
```json
{
  "managerId": "qm-primary",
  "snapshot": {
    "name": "primary",
    "version": 42,
    "queues": {
      "order-queue": {
        "messages": [
          {"message": {"orderId": 124}, "sourceService": "api-gateway"}
        ]
      },
      "notification-queue": {
        "messages": []
      }
    },
    "timestamp": 1672534800000
  }
}
```

### Failover Workflow (When Primary Goes Down)

1. **Detect primary failure**: Monitor heartbeat timeout (30 seconds)
2. **Promote replica**: Update the route registry to use replica for new writes
3. **Redirect reads**: Clients query replica instead of primary
4. **Recovery**: When primary comes back up, it can become a replica of the new primary

Detailed failover logic is client-side; the registry updates when status changes.

### Example: Sync Script

Here's a pattern for a replica to periodically sync from its primary:

```javascript
async function syncReplicaFromPrimary() {
  const replicaId = 'qm-primary-replica-macbook';
  const primaryId = 'qm-primary';
  
  // 1. Get current version
  const statusRes = await fetch(`http://aggregator:4000/api/replication/status/${replicaId}`);
  const status = await statusRes.json();
  const currentVersion = status.primarySyncVersion || 0;
  
  // 2. Get new operations from primary
  const opsRes = await fetch(
    `http://aggregator:4000/api/replication/operations/${primaryId}?since=${currentVersion}`
  );
  const { operations } = await opsRes.json();
  
  if (operations.length === 0) {
    console.log('Replica already up-to-date');
    return;
  }
  
  // 3. Apply to replica
  const applyRes = await fetch(
    `http://aggregator:4000/api/replication/apply-operations/${replicaId}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations })
    }
  );
  const result = await applyRes.json();
  console.log(`Applied ${result.applied} operations`);
}

// Run every 5 seconds
setInterval(syncReplicaFromPrimary, 5000);
```

## Run Another Queue Manager On A MacBook


1. Clone or copy this repository to the MacBook.
2. Install dependencies:

```bash
npm install
```

3. Start the standalone queue manager process and point it at the Windows aggregator:

```bash
node queue-manager-node.mjs \
	--aggregator=http://<windows-aggregator-ip>:4000 \
	--port=4100 \
	--manager-id=qm-macbook-4100 \
	--node-id=MacBookNode \
	--advertise-ip=<macbook-ip>
```

Example:

```bash
node queue-manager-node.mjs \
	--aggregator=http://192.168.2.11:4000 \
	--port=4100 \
	--manager-id=qm-macbook-4100 \
	--node-id=MacBookNode \
	--advertise-ip=192.168.2.35
```

4. Verify registration from the Windows machine:

```powershell
Invoke-RestMethod -Uri http://localhost:4000/api/registry/queue-managers | ConvertTo-Json -Depth 8
```

5. Publish a queue to confirm it can be routed to the additional manager:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/broker/publish -ContentType application/json -Body '{"queueName":"jobs","message":"hello from broker","sourceService":"manual-test"}' | ConvertTo-Json -Depth 8
```

Notes:
- The MacBook must be able to reach the Windows machine on port 4000.
- The Windows machine must be able to reach the MacBook on the queue manager port, for example 4100.
- Use the MacBook LAN IP for `--advertise-ip`, not `127.0.0.1`.
- The aggregator currently forwards remote queue deliveries to `POST /enqueue` on the queue manager node.

### 1) Register local service instance

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/registry/service-instances/heartbeat -ContentType application/json -Body '{"serviceName":"broker","instanceId":"broker-win","nodeId":"WindowsNode","ip":"127.0.0.1","port":4000,"status":"up"}'
```

### 2) Register MacBook service instance

Run from MacBook (replace aggregator host and local service port):

```bash
curl -X POST http://<aggregator-host>:4000/api/registry/service-instances/heartbeat \
	-H 'content-type: application/json' \
	-d '{"serviceName":"broker","instanceId":"broker-mac","nodeId":"MacBookNode","ip":"<macbook-ip>","port":4000,"status":"up"}'
```

### 3) Verify both are visible

```powershell
Invoke-RestMethod -Uri http://localhost:4000/api/registry/services | ConvertTo-Json -Depth 8
```

### 4) Drain one node gracefully before maintenance

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/registry/nodes/WindowsNode/drain
Invoke-RestMethod -Uri http://localhost:4000/api/registry/nodes/WindowsNode/drain-status | ConvertTo-Json -Depth 8
```

When drain-status shows pendingMessagesKnown = 0, move to maintenance:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/registry/nodes/WindowsNode/maintenance
```

### 5) Bring node back

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/registry/nodes/WindowsNode/return-service
```

## Notes

- Service resolution only returns active states (up, degraded).
- Draining and maintenance states are excluded from routing.
- Node lifecycle controls apply to queue managers and generic service instances on that node.
