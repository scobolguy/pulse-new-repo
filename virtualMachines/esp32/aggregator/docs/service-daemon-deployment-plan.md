# Service and Daemon Deployment Plan

## Purpose

This document defines how PULSE packages, validates, deploys, and restores project programs, services, and daemons across JavaScript PMachines and ESP32 PMachines. It is both the implementation plan and the review checklist for the deployment control plane.

## Deployment Model

A project owns source and generated assets in these folders:

```text
<project>/
  programs/       # one-shot or reusable PMachine programs
  services/       # resident request/route handlers
  daemons/        # resident scheduled/event-driven workers
  artifacts/      # generated pcode, program maps, manifests, and package outputs
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

The current ESP32 boot reader validates and reports the startup manifest. Runtime loading and daemon scheduling remain the next firmware execution phase and must not be described as complete until an end-to-end boot test proves them.

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

- `GET /api/deployments/startup-manifests`
- `GET /api/nodes/:nodeId/startup-manifest`
- `POST /api/deployments/startup-manifests`

The POST endpoint persists the backend manifest and, for an addressable ESP32, uploads `/startup/deployments.json` to the node.

### Node Deployment

- `POST /api/nodes/:nodeId/deploy`
  - Uploads files to an addressable node.
  - Registers an optional deployment record.
  - May execute a supplied program.

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
- [ ] Program one-shot lifecycle and automatic unload.
- [ ] Health checks after deployment.
- [x] Deployment records retain recent package history and expose rollback.

### Phase 4: Verification and operations

- [x] Parser test for valid service and daemon WFL deployment declarations.
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

## Known Current Limitation

The control plane and manifest distribution are implemented. The remaining work is runtime consumption: a manifest currently reaches an ESP32 and is validated/logged at boot, but it does not yet automatically load and schedule every referenced service or daemon. That firmware/supervisor phase is the next implementation priority.
