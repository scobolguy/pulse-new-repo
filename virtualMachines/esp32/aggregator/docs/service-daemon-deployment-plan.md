# Service and Daemon Deployment Plan

## Purpose

This document defines how PULSE packages, validates, deploys, and restores project programs, services, and daemons across JavaScript, Java, and ESP32 PMachines. It is both the implementation plan and the review checklist for the deployment control plane.

## Deployment Model

A project owns source and generated assets in these folders:

```text
<project>/
  programs/       # one-shot or reusable PMachine programs
  services/       # resident request/route handlers
  daemons/        # resident scheduled/event-driven workers
  object/      # generated pcode, program maps, manifests, and package outputs
  deployment/     # deployment-plan.json and deployment-plan.md
```

A deployment record identifies:

- `projectId` and optional subproject scope
- workload kind: `program`, `service`, or `daemon`
- source and generated artifact references
- package name and version
- input/output queue bindings
- target node IDs or addresses
- runtime state: `running`, `paused`, or `stopped`
- startup policy and rollback metadata

The structured deployment plan is canonical. The Markdown plan is a synchronized review artifact.

## WFL Control Plane

WFL is the reviewable source format for deployment intent. The active grammar supports declarations such as:

```wfl
DEPLOYMENT "mt103-pacs008" PROJECT "payments" TARGETS ("DisplayNode","magic-js-pmachine-01") BEGIN
  SERVICE "mt103-to-pacs008"
    FILE "programs/mt103-to-pacs008.pas"
    QUEUE "swift.mt103.parsed" -> "pacs.008.outbound"
    TARGETS ("DisplayNode","magic-js-pmachine-01")
    STARTUP true;
END;
```

WFL also translates logical resource bindings:

```wfl
DATABASE "SqlLedger" -> "PulseSqlLedger" TYPE "PaymentRecord" MANAGER "db-mssql" CONNECTION "env:MSSQL_DATABASE_CONNECTION_STRING";
QUEUE "Orders" -> "payments.orders" MANAGER "qm-primary" TYPE "PaymentRecord" MODE SYNC;
QUEUE "Audit" -> "payments.audit" MANAGER "qm-primary" TYPE "AuditTrail" MODE ASYNC;
```

Connection references point to host configuration and never embed credentials in WFL or p-code. Queue mode controls whether the host waits for acknowledgement.

The WFL flow is:

```text
WFL source
  -> ANTLR parser
  -> deployment AST
  -> deployment-plan.json / deployment-plan.md
  -> runtime deployment registry
  -> node startup manifest
```

Natural-language requests should generate this WFL representation before persistence or execution. This keeps NLI behavior deterministic, reviewable, and testable.

Application source is compiled independently from Pascalish, Cobolish, or VBish to p-code. WFL does not translate one application language into another.

## Runtime Targets

### JavaScript PMachine

1. Register the deployment at `POST /api/pmachine/deployments`.
2. Persist the deployment registry under the backend runtime data root.
3. Generate `<runtime>/startup-manifests/<node-id>.json`.
4. Restore deployments with `runtimeState: running` when the JS PMachine supervisor starts.
5. Route service invocations through the deployment registry and PMachine runtime endpoint.

### ESP32 PMachine

1. Upload source/generated artifacts through the ESP32 FFS API.
2. Upload `/startup/deployments.json` through the ESP32 FFS API.
3. At boot, read and validate `/startup/deployments.json` from FFS.
4. Load the referenced pcode/program maps for `service` and `daemon` workloads.
5. Keep services resident until explicit stop/unload.
6. Schedule daemon refresh cycles using compiled runtime metadata.
7. Treat programs as one-shot workloads and unload them after completion.

The current ESP32 boot reader validates and reports the startup manifest, but does not restore hosted units after reboot. The online `POST /api/nodes/:nodeId/deploy` path can upload and immediately install a hosted service with shared-context UDP daemons; installations remain RAM-resident until reboot.

The Data Mapper package in `../src/mapper-deployment/` uses this online path. From the `aggregator` directory, supply a MAPL file and a currently live-discovered node:

```powershell
npm run deploy:esp32:mapper:udp -- --node <discovered-node-id> --map-file <absolute-path-to-maps.mapl>
```

The script compiles and signs the hosted health service and MAPL-backed daemon, uploads all four artifacts, then calls `/pmachine/service_host/install`. The backend rechecks discovery freshness (three minutes), probes the hosted-runtime status endpoint before upload, and rejects stale/non-live targets. Set `PULSE_BACKEND_URL`, `PULSE_ESP32_HTTP_PORT`, `PCODE_SIGNING_KEY`, and `PCODE_SIGNING_KEY_ID` to match the running backend and firmware profile as needed. There is no static-IP fallback.

The daemon listens on UDP port 4211 by default (`--udp-port` overrides it). Each datagram is JSON shaped as `{"mapId":"MapName","source":{...}}`; a successful reply is the mapped JSON value. The daemon scheduler continues for the installed firmware runtime lifetime and is not capped by the refresh interval; each VM invocation remains bounded by the firmware's instruction budget. Invalid JSON or unknown map IDs fail that daemon turn and do not return a success-shaped reply.

## APIs

### Project and WFL

- `POST /api/deployments/wfl/compile`
  - Request: `{ projectId, source, persist: true }`
  - Response: parsed deployment declarations and persisted plan paths.
- `GET /api/projects/:projectId/deployment-plan`
- `PUT /api/projects/:projectId/deployment-plan`
- `GET /api/projects/:projectId/resources`
- `GET /api/projects/:projectId/resources/:folder`

### Deployment Registry

- `GET /api/pmachine/deployments`
- `POST /api/pmachine/deployments`
- `POST /api/pmachine/deployments/:deploymentRef/actions/start`
- `POST /api/pmachine/deployments/:deploymentRef/actions/pause`
- `POST /api/pmachine/deployments/:deploymentRef/actions/resume`
- `POST /api/pmachine/deployments/:deploymentRef/actions/stop`
- `DELETE /api/pmachine/deployments/:deploymentRef`

### Startup Manifests

`STARTUP FALSE` leaves a deployment stopped without checking or launching its
artifacts. Paused deployments likewise remain paused. An explicit start or resume
action changes `runtimeState` to `running` and can activate a deployment regardless
of its startup preference.

- `GET /api/deployments/startup-manifests`
- `GET /api/nodes/:nodeId/startup-manifest`
- `POST /api/deployments/startup-manifests`

The POST endpoint persists the backend manifest and, for an addressable ESP32, uploads `/startup/deployments.json` to the node.

### Node Deployment

- `POST /api/nodes/:nodeId/deploy`
  - Uploads files to an addressable node.
  - Registers an optional deployment record.
  - May execute a supplied program.
  - May install `hostedServiceInstall` after confirming a fresh live-discovery record and a responsive `/pmachine/service_host/status` endpoint. All referenced service/daemon p-code and program-map files must be included in `files`; daemon entries require explicit UDP ports.

## Execution Plan

### Phase 1: Contract and persistence

- [x] Fixed project folders.
- [x] Structured JSON and Markdown deployment plans.
- [x] Deployment registry and lifecycle actions.
- [x] Per-node backend startup manifests.
- [x] ESP32 FFS startup manifest upload path.
- [x] ANTLR WFL deployment declarations.
- [x] WFL compile endpoint.

### Phase 2: Operator workflow

- [x] Dedicated `/deployments` page.
- [x] Project/resource selection.
- [x] Target-node selection.
- [x] Deployment registration.
- [x] Startup-manifest generation.
- [x] Show generated manifest contents and per-target upload result in the page.
- [x] Add explicit workload-kind selection for programs, services, and daemons.
- [ ] Add queue binding fields to the deployment page instead of relying only on WFL.

### Phase 3: Runtime execution

- [x] JS PMachine deployment records and runtime state.
- [x] ESP32 startup manifest validation and boot logging.
- [x] Backend restores persisted JS PMachine deployment records and service instances on process start.
- [ ] ESP32 boot loads referenced pcode/program maps for resident services.
- [ ] ESP32 daemon scheduler restores refresh intervals.
- [x] Online ESP32 installation starts a RAM-resident hosted service and explicitly port-bound UDP daemon after artifact upload.
- [ ] Program one-shot lifecycle and automatic unload.
- [ ] Health checks after deployment.
- [x] Deployment records retain recent package history and expose rollback.

### Phase 4: Verification and operations

- [x] Parser test for valid service and daemon WFL deployment declarations.
- [x] Hosted WFL MAPL UDP daemon package/runtime test, including multi-map selection and invalid-map failures.
- [x] Node deployment API test using a board-compatible HTTP server, including live-discovery gating, preflight, upload, and hosted installation.
- [ ] API tests for plan persistence and manifest generation.
- [ ] Node upload tests using a temporary board-compatible HTTP server.
- [ ] JS PMachine boot/restore integration test.
- [ ] ESP32 reboot test proving service and daemon restoration.
- [ ] Deployment audit trail with actor, timestamp, target, package, and result.
- [ ] Document secrets, authorization, and destructive-operation policy.

## Acceptance Criteria

A service deployment is complete when:

1. Its source and generated artifacts are present in the project package.
2. The WFL declaration compiles without parser errors.
3. The deployment plan records queues, targets, workload kind, and startup policy.
4. The runtime registry reports the deployment and target state.
5. A startup manifest exists for every target.
6. Addressable ESP32 targets contain `/startup/deployments.json`.
7. A restart restores a resident service and reports a healthy runtime.
8. A daemon emits its configured refresh behavior after restore.
9. A program executes once and is released.
10. Failure produces a visible result and does not silently report success.

## Known Current Limitations

- The control plane and manifest distribution are implemented. A manifest currently reaches an ESP32 and is validated/logged at boot, but it does not automatically load and schedule every referenced service or daemon.
- Online hosted service installs run immediately but are RAM-resident; reboot restoration is not implemented.
- The deployment API validates current discovery and runtime reachability, but its deployment route remains part of the existing backend API. Protect it with the deployment authorization policy used by the hosting environment.
