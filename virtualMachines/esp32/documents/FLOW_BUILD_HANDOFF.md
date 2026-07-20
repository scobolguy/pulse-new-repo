# Flow Build Handoff

## Purpose
Use this document to quickly brief any Copilot session on how to design flows in the current Flow Designer, what works now, and what needs decisions next.

## Target Model Reference
- Canonical target model spec:
  - documents/GENERIC_FLOW_NODE_MODEL_RUNTIME_SEMANTICS.md

## Current UX Entry Point
- Open Flow Designer from the app nav.
- File reference: aggregator/src/main.jsx

## Deployment And Cluster Source Of Truth

The deployment pane is backed by the Aggregator topology runtime, not by static documentation.

- Topology runtime routes:
  - `aggregator/src/backend/roles/topologyRuntimeRoutes.mjs`
- Persisted topology inputs:
  - `aggregator/data/cluster-registry.json`
  - `aggregator/data/site-registry.json`
  - `aggregator/data/node-topology-overrides.json`
  - `aggregator/data/node-rename-overrides.json`

Current runtime behavior that matters when designing flow deployment:

- explicit clusters are created through backend APIs
- unassigned nodes are auto-placed into managed free pools
- free pools are split into generic, JS, and ESP32 variants
- cluster/site metadata feeds deployment-tree topology and active cluster assignment

## Current Flow Designer Capabilities
- Left palette:
  - compact icon + name tiles
  - icon size is fixed at 0.5in x 0.5in
  - small text (about 8pt)
  - bottom tab strip (All, Hardware, Daemons, Services, Devices, Maps, Queues, Sites)
  - search across id, name, kind, type, description, usage notes
- Canvas:
  - drag from palette to place nodes
  - click tile to add node
  - select node, link nodes with typed edges
  - edge types: message-broker-call, file-feed, service-call
  - run and step playback highlighting
- Right deployment pane:
  - tree structure with lazy loading on expand
  - each node initially shows only summary (name + IP)
  - details load when expanded first time
  - bind selected workflow node to target
  - compatibility checks for required capabilities, wiring, and build profile issues

## Files That Matter Most
- Flow page behavior and tree loading:
  - aggregator/src/FlowDesignerPage.jsx
- Topology and cluster runtime backing the deployment pane:
  - aggregator/src/backend/roles/topologyRuntimeRoutes.mjs
- Flow styling (palette density, tabs, target tree):
  - aggregator/src/index.css
- Variant and build compatibility sources:
  - aggregator/src/catalogStudio/nodeVariantRegistry.json
  - aggregator/src/catalogStudio/platformioProfiles.json
- Situation to resolution concept doc:
  - documents/SITUATION_RESOLUTION_SCHEMA.md
- Generic target vocabulary and runtime semantics:
  - documents/GENERIC_FLOW_NODE_MODEL_RUNTIME_SEMANTICS.md

## Current vs Target Delta
This section captures implementation gaps between current behavior and the target model.

1. Node vocabulary
   - Current: catalog-derived kinds and generic nodes on canvas.
   - Target: first-class node taxonomy (Mapper, Compute, Gateway, Queue, Service, Daemon, Contract, State).
2. Edge semantics
   - Current: message-broker-call, file-feed, service-call.
   - Target: full edge set (transform, compute, gateway-call, queue, daemon-trigger, state, contract, retry, completion).
3. Edge validation
   - Current: edges are typed but no strict source/target matrix enforcement.
   - Target: each edge type enforces valid source and destination node classes.
4. Node configuration panels
   - Current: selected node supports required capabilities and required wiring text fields.
   - Target: type-specific config editors for schemas, routes, policies, contracts, schedules, and state schema.
5. Compatibility diagnostics
   - Current: capability, wiring, and build profile checks.
   - Target: add protocol/schema/SLA validation and contract-aware checks.
6. Binding strategy
   - Current: manual bind to a selected target.
  - Target: optional auto-bind with scoring (environment, SLA profile, load, locality) and awareness of cluster/site topology.
7. Artifact output
   - Current: visual flow + playback only.
   - Target: runtime plan JSON export and downstream artifact generation (for example pcode/runtime plan/audit specs).

## Prioritized Implementation Checklist
Implement in order so each phase is testable and reviewable.

1. Phase 1: Formal node and edge enums
   - Scope:
     - Add target node types and edge types to Flow Designer constants.
     - Keep backward compatibility for existing 3 edge types.
   - Acceptance criteria:
     - Palette can create each target node type.
     - Canvas can create and store each target edge type.
     - Existing flows using current edge types still load and run.

2. Phase 2: Edge validation matrix
   - Scope:
     - Add source/target validation table by edge type.
     - Prevent invalid links in UI with clear reason text.
   - Acceptance criteria:
     - Invalid edge attempts are blocked and explain why.
     - Valid edges are created without regressions.
     - Validation rules are unit-tested for all edge types.

3. Phase 3: Type-specific node config panels
   - Scope:
     - Introduce typed config schema per node type.
     - Add editors for mapper ruleset, compute routing, gateway endpoint/contract, queue policy, daemon schedule, state schema.
   - Acceptance criteria:
     - Selecting a node shows the correct config editor.
     - Config persists in node model and survives refresh/export-import.
     - Required fields validate before run/export.

4. Phase 4: Contract-aware compatibility engine
   - Scope:
     - Extend compatibility from capability/wiring/build to include protocol/schema/SLA.
     - Integrate contract data into match diagnostics.
   - Acceptance criteria:
     - Deployment tree diagnostics show protocol/schema/SLA mismatches.
     - Compatible targets are correctly identified from contract + platform metadata.
     - Existing capability/wiring/build checks still pass.

5. Phase 5: Binding policy and auto-bind
   - Scope:
     - Add optional auto-bind mode with scoring (environment, SLA profile, load, locality).
     - Keep manual bind as override.
   - Acceptance criteria:
     - Auto-bind assigns deterministic best target for each selected node.
     - User can override with manual bind.
     - Score explanation is visible for troubleshooting.

6. Phase 6: Runtime plan export
   - Scope:
     - Serialize canvas to runtime plan format from target model doc.
     - Add validation before export.
   - Acceptance criteria:
     - Exported JSON matches documented schema fields.
     - Entry/termination nodes and node configs are present.
     - Invalid plans show actionable validation errors.

7. Phase 7: Situation to resolution integration
   - Scope:
     - Connect flow events and failures to situation->resolution contracts.
     - Add policy hooks and verification references.
   - Acceptance criteria:
     - Flow failure can emit a normalized Situation envelope.
     - Resolution policy references can be attached and exported.
     - At least one end-to-end scenario is executable in test mode.

## How To Build A Flow (Current Workflow)
1. Open Flow Designer.
2. Use palette tabs to narrow object class (for example Hardware or Services).
3. Search for reusable objects and place nodes on the canvas.
4. Create typed edges between nodes based on execution/data intent.
5. Select each node and tune:
   - Required capabilities
   - Required wiring
6. Expand deployment targets in the right tree (lazy loads details).
7. Bind selected node to a compatible target.
8. Resolve incompatibilities shown in diagnostics (capability, wiring, build flags/env).
9. Use Run or Step to verify sequence behavior visually.

## Practical Modeling Pattern
- Start with intent-first lanes:
  - Inbound
  - Transform
  - Route
  - Dispatch
  - Observe/Recover
- For each node, define:
  - What capability it needs
  - What wiring or hardware contract it assumes
  - What failure should trigger situation->resolution policy

## Recommended Discussion Agenda (Next Session)
1. Domain intent:
   - What business outcome does the flow guarantee?
2. Node vocabulary:
   - Which kinds must exist as first-class palette tabs?
3. Edge semantics:
   - Do we need additional edge types (for example retry path, compensation path, approval path)?
4. Execution model:
   - Strict sequence vs conditional branches vs event-driven fan-out
5. Deployment policy:
   - Auto-bind strategy vs manual bind only
   - How to score best target when several are compatible
6. Failure strategy:
   - Which situations should auto-resolve vs escalate
7. Artifact output:
   - What should be generated from the flow (JSON, pcode, runtime plan, audit spec)?

## Decision Log Template
Use this in future sessions.

```text
Decision:
Why:
Alternatives considered:
Chosen rule:
Impacted files:
Validation done:
```

## Prompt To Reuse In A New Copilot Session
Copy this prompt when starting fresh:

"Read documents/FLOW_BUILD_HANDOFF.md first. We are designing flows in aggregator/src/FlowDesignerPage.jsx. Keep current compact palette and lazy deployment target tree behavior. Help me define node vocabulary, edge semantics, execution model, and deployment/binding policy for [your use case]. Propose concrete changes and implement them incrementally with validation after each step."
