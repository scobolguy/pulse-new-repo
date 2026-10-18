# Aggregator Service

Aggregator is a control plane and routing layer for distributed services.

Main capabilities:
- [GitHub-backed issue tracking and Kanban board](docs/issue-board.md) at `/issues`
- Queue manager registry and routing
- Service instance registry for any service type (for example webapi or broker)
- Node lifecycle controls (quiesce, drain, maintenance, return-service)
- Service resolution and proxy to active instances only
- Cluster, site, and node-topology management for JS and ESP32 nodes

`GET /api/nodes` lists currently discovered nodes only. ESP32 boards must send a
live UDP beacon or PMachine announcement; stale and probe-only entries are
excluded, and no ESP32 addresses or sample nodes are seeded into the inventory.

## Port-only LAN discovery

Standalone lifecycle-aware services without `PULSE_AGGREGATOR_URLS` broadcast a
version-1 discovery request on `UDP_PORT` (default `4210`). The aggregator replies
with its identity and actual bound HTTP listener ports. Correlated replies must
advertise a LAN address matching their packet source; wildcard and loopback
addresses are not remote endpoints. No HTTP port scan or localhost fallback is
used. Discovery validation, jitter, scheduling and expiry live in
[`discovery.pas`](../src/service-lifecycle/discovery.pas); the host supplies socket
I/O and interface/listener facts.

The JavaScript node CLI uses this bootstrap by default. Its explicit `--backend`,
`--udp-announce-host`, and corresponding environment settings remain legacy
overrides. `JS_PMACHINE_UDP_ANNOUNCE_PORT=0` disables its announcements. Queue
managers without `--aggregator` use discovered targets for their heartbeats.
Lifecycle services use actual listener addresses on each discovered LAN, so a
wildcard bind does not require a manual advertised IP in this mode. An explicitly
loopback-bound service is deliberately not advertised as remotely reachable.

Discovery targets expire after 30 seconds without a correlated response. Nodes
still expire under the existing inventory freshness policy, and service readiness
still requires fresh lifecycle reports. Nodes report to every discovered
aggregator; discovery does not choose a deployment owner or replace dependency
bindings. `PULSE_OWNER_AGGREGATOR_ID` remains deployment intent, not a discovered
address. Without it, a node can appear in discovery but lifecycle reporting emits
an explicit missing-owner error rather than claiming allocation readiness.
Existing report permissions and bearer-token requirements are unchanged.

### Prebuilt SQL Server and RabbitMQ

Bundle [`infrastructure-adapter.mjs`](./infrastructure-adapter.mjs) beside an
existing provider. Its readiness program is
[`infrastructure-adapter.pas`](../src/service-lifecycle/infrastructure-adapter.pas).
The adapter discovers aggregators using the UDP port and reports a separate
external instance. SQL checks are read-only; AMQP checks open and close an
authenticated channel without publishing or declaring queues. Provider failures
are explicit, credentials are not advertised, and the adapter never starts or
stops the provider.

Local deployment configuration supplies:

- `PULSE_INFRASTRUCTURE_PROVIDER=database` or `rabbitmq`
- Stable `PULSE_SERVICE_INSTANCE_ID` and `PULSE_OWNER_AGGREGATOR_ID`
- `FSM_MSSQL_CONNECTION_STRING` (optional `FSM_MSSQL_DRIVER=msnodesqlv8`) or
  `RABBITMQ_URL`, including credentials only in private deployment configuration
- `UDP_PORT` when the aggregator does not use `4210`

The adapter HTTP port defaults to an ephemeral bound port. It reports a readiness
endpoint, but no fabricated provider listener ports or allocatable HTTP work
listener. Pulse broker/database-facing services remain the application-facing
interfaces; this is not automatic credential distribution or transparent native
SQL/AMQP connection configuration.

[`docker-compose.infrastructure-adapters.yml`](./deploy/cluster/docker-compose.infrastructure-adapters.yml)
bundles either companion using the `database` and `rabbitmq` profiles. Supply
private `sql-adapter.env` / `rabbitmq-adapter.env` files beside the compose file
(or set `SQL_ADAPTER_ENV_FILE` / `RABBITMQ_ADAPTER_ENV_FILE`). Do not commit these
files. Host networking is intentional: ordinary Docker bridge networking does
not carry LAN broadcasts. This packaging does not deploy the provider itself.
On Windows, the same adapter entry point can run beside the existing provider
with environment variables from the service's private deployment configuration.

Broadcast discovery requires a LAN-visible IPv4 interface and allowed UDP
traffic. It does not traverse routed subnets, NAT, AP client isolation or
broadcast-blocking firewalls. No router/firewall settings are changed. New
discovery authorization and trust enrollment are deferred.

### Discovery verification

From the ESP32 project directory, run the focused policy, transport, adapter and
compatibility tests:

```powershell
node --test --test-concurrency=1 testing\aggregator\lan-discovery.test.mjs testing\pmachines\javascript-node-announcement.test.mjs testing\aggregator\node-discovery.test.mjs testing\aggregator\infrastructure-readiness.test.mjs
```

The opt-in socket test uses actual local IPv4 broadcast and an ephemeral HTTP
listener; it does not change firewall settings or contact SQL Server/RabbitMQ:

```powershell
$env:PULSE_TEST_LAN_DISCOVERY = '1'
node --test testing\aggregator\lan-discovery-network.test.mjs
Remove-Item Env:\PULSE_TEST_LAN_DISCOVERY
```

This proves the local host's broadcast/reply plumbing, not reachability between
two physical hosts. Separately verify discovery across the deployment LAN and
provider readiness with the deployment's private credentials before rollout.
Each aggregator must have a distinct identity; discovery does not assign one.

## Service lifecycle and logical routing

VS Code is a client, not a service launcher. Opening a workspace does not start
services, and missing network services do not trigger a localhost fallback.

Policy lives in Pascalish under [`src/service-lifecycle`](../src/service-lifecycle):
dependency order, readiness, ownership, recovery, report acceptance and expiry,
allocation, and transaction transitions. JavaScript and native hosts provide
process, socket, HTTP and durable storage primitives.

- Pascalish services declare intrinsic requirements with
  `requires service 'pulse-filesystem';`. WFL `HOSTED SERVICE` resources bind those
  requirements to explicit instances and declare an owner and report target.
  Existing queue-based WFL resources keep their original meaning.
- Only the configured owner manages a deployment. Observer aggregators do not
  replace external instances or take ownership automatically.
- Core startup follows Filesystem -> Data Librarian -> Data Mapper. A live
  dependent stays running and reporting, but not-ready, while a prerequisite is
  unavailable. A readiness timeout does not kill an otherwise live child.
- Explicit start/stop requests and configured startup intent use one supervisor.
  Desired intent survives owner restarts. Stopping an in-use prerequisite requires
  explicit cascade, which stops dependents first.
- Instances POST version-1 reports to `/api/runtime/instances/report`. Reports
  identify service, instance, node, boot incarnation, monotonically increasing
  sequence, owner, readiness and dependency bindings, and announce actual bound
  `listeners: [{protocol, host, port}]`. Endpoint hints never supply missing ports.
  Reports expire after 30 seconds; unobserved, stale or blocked instances are not
  allocated. Legacy discovery records remain diagnostics, not allocation evidence.

Configure deployment identity and bindings with
`PULSE_OWNER_AGGREGATOR_ID`, `PULSE_SERVICE_INSTANCE_ID`, and
`PULSE_SERVICE_BINDINGS` (JSON object). `PULSE_AGGREGATOR_URLS` (JSON array) is an
optional explicit endpoint override, not required for LAN bootstrap.
Use `PULSE_SERVICE_ADVERTISE_HOST` when a wildcard listener uses an explicit
remote aggregator override. Remote reporting requires the
normal runtime permissions; `PULSE_RUNTIME_REPORT_TOKEN` supplies bearer
authentication. Local runtime bypass can be disabled with
`PULSE_SERVICE_CONTROL_LOCAL_BYPASS=false`.

Consumers request a **logical service**, not an instance or port:

```text
POST /api/runtime/services/pulse-data-librarian/transactions
{"method":"GET","path":"/api/librarian/catalogs"}
```

The aggregator durably accepts work and returns HTTP 202 with `transactionId`,
`status` and `statusUrl`. Poll `/api/runtime/transactions/<transactionId>` for
`held`, `allocated`, `waiting-child`, `completed`, or `uncertain`. Completion has
`result: {status, body}`. Clients time out after 30 seconds without deleting or
replaying durable work. Ambiguous delivery remains uncertain for reconciliation;
it is **never automatically replayed**.

Native continuation replies identify a downstream transaction rather than keeping
an ESP32 worker occupied. The aggregator persists the parent-child relationship,
validates the declared dependency, and completes the original response when the
child completes. Restarting the aggregator does not resend the parent.
Native installs identify reporting targets as `{aggregatorId, endpoint}` records.
Only the target matching the explicit owner supplies readiness. Dispatch carries
`x-pulse-ingress-aggregator-id` alongside the parent transaction ID; continuation
submission uses that configured target so parent and child share the same durable
store. Missing or unknown ingress identities fail explicitly.

Existing Librarian upload and Mapper proxy URLs use the same allocator. Ready
requests preserve binary upload bytes and NDJSON streaming; unavailable requests
return HTTP 202 tracking information instead of contacting a guessed endpoint.
The Librarian and Mapper browser views poll held work using Pascalish-provided
decisions, preserve tracking IDs on failure, and never resubmit the original
request. Immediate responses retain live streaming and binary bodies.
Pascalish bounds dispatch at 15 seconds, or 180 seconds for Mapper and MCP work
to accommodate long-running queries and streams. Ordinary JSON requests are bounded at 64 KiB,
ordinary results at 1 MB, uploads at approximately 50 MB, and proxy results at
50 MB. A failed or oversized dispatched response is uncertain, not retried.
Durable storage is currently capped at 10,000 records; there is no automatic
deletion or operator replay API. Reconciliation and retention remain explicit
operational work.

Open `/public/service-deployment.html` on the aggregator for the live dependency
graph, including external SQL Server and RabbitMQ observations. SQL readiness
uses `SELECT 1` against the configured database; RabbitMQ readiness opens and
closes an authenticated AMQP channel without declaring queues or publishing.
External infrastructure is never launched or stopped by the process supervisor.
Its headless reports do not invent listener ports or accept logical HTTP work.
The Pascalish policy binds a RabbitMQ-backed Pulse Broker to RabbitMQ; legacy
brokers are not falsely gated on RabbitMQ. Other consumers must explicitly declare
their database requirements in the deployment manifest.

The live dependency
graph. It shows owned processes, reported instances, bound prerequisites,
readiness, stale observations, transitions and instance details, including actual
listeners. It works without VS Code and refreshes every five seconds. The graph
is read-only and does not deploy services.

Source changes do not install an extension, restart a running aggregator, or
flash an ESP32. Those are separate, explicitly authorized rollout operations.

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

### Deploy a MAPL map to a discovered ESP32

The Mapper API can compile executable MAPL map definitions, sign a compact program
map, and upload both artifacts to a node through the live node deployment route.
Pass a node ID returned by `GET /api/nodes`; the backend resolves its current
address and rejects nodes that are no longer discovered.

```powershell
$mapl = @'
map NormalizeNode from Input to Output;
  target.id := source.id;
  target.name := upper(source.name);
end;
'@
$body = @{
  nodeId = '<discovered-node-id>'
  mapl = $mapl
  smokeTest = @{
    inputQueue = 'mapper.smoke.in'
    message = '{"id":"sample-1","name":"pulse node"}'
  }
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/mapper/authoring/deploy-esp32 `
  -ContentType 'application/json' -Body $body
```

The smoke test is optional, and each deployment request accepts one map. MAPL
constructs that the ESP32 `OP_MAP` runtime does not execute (including defaults,
conditionals, loops, and validation) are rejected with HTTP 422 rather than
silently omitted. The supported compiler subset and deployment request are covered
by `npm run test:mapl:esp32-deploy`.

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

Edge routing selects from ESP32 boards discovered by live UDP beacons. A matching
`deviceRole` is preferred when available; otherwise any recently discovered,
available ESP32 may be selected. No static ESP32 host list or startup seed is
used. If no live ESP32 has been discovered, edge routing fails explicitly
instead of sending to a placeholder address.

`EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES` (default `8192`) controls automatic
role selection.

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

## Data Hygiene Warning

`aggregator/data/` is currently mixed-use. It contains:

- hand-authored DSL and reference fixtures
- generated compiler outputs
- runtime registries and state files
- queue message persistence and operational logs

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
