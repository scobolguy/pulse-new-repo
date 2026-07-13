# Generic Flow Designer Node Model and Runtime Semantics

## 1. Generic Node Vocabulary
This document defines generic node types, edge types, contracts, runtime plan format, build compatibility rules, and deployment binding rules for the Flow Designer.

### 1.1 Core Node Types
- Mapper: Transforms data between schemas using Data Librarian and MAPL rules.
- Compute: Performs decisioning, routing, SLA logic, and conditional branching.
- Gateway: Represents any external system as a black-box request/response endpoint.
- Queue: Holds, delays, retries, or manually queues work.
- Service: Long-running process that offers contracts and executes operations.
- Daemon: Background worker for timers, schedules, and event triggers.
- Contract: Defines inputs, outputs, capabilities, protocol, and SLA of a Service, Gateway, Daemon, or Compute node.
- State: Records transaction state and supports transaction locator queries.

## 2. Generic Edge Types
- transform-edge: Connects Mapper to the next node with transformed data.
- compute-edge: Connects Compute to the next node with decision outcomes.
- gateway-call-edge: Connects any node to a Gateway for request/response.
- queue-edge: Connects any node to a Queue for buffering or delay.
- service-call-edge: Connects any node to a Service.
- daemon-trigger-edge: Connects a Daemon to nodes it triggers.
- state-edge: Connects any node to a State node to record transitions.
- contract-edge: Connects nodes to Contract definitions.
- retry-path: Connects Queue back to nodes for retries.
- completion-edge: Connects final nodes to completion Services or Gateways.

## 3. Runtime Plan Format
The runtime plan is the executable representation of a flow.

```json
{
  "planId": "string",
  "version": "string",
  "nodes": [
    {
      "id": "nodeId",
      "type": "mapper|compute|gateway|queue|service|daemon|state|contract",
      "config": {}
    }
  ],
  "edges": [
    {
      "id": "edgeId",
      "type": "transform|compute|gateway-call|queue|service-call|daemon-trigger|state|contract|retry|completion",
      "from": "nodeId",
      "to": "nodeId",
      "conditions": {}
    }
  ],
  "entryNode": "nodeId",
  "terminationNodes": ["nodeId"],
  "metadata": {
    "domain": "payments|hardware|generic",
    "createdBy": "userId",
    "createdAt": "timestamp"
  }
}
```

### 3.1 Node Config Examples
Mapper node:

```json
{
  "type": "mapper",
  "id": "mapper_MT_to_PACS",
  "config": {
    "inputSchema": "MT103",
    "outputSchema": "PACS.008",
    "ruleset": "CBDS_MT103_TO_PACS008"
  }
}
```

Compute node:

```json
{
  "type": "compute",
  "id": "compute_RTGS_SLA",
  "config": {
    "policies": ["RTGS_SLA_MON_FRI_9_17"],
    "conditions": ["now in slaWindow"],
    "routes": {
      "IN_WINDOW": "gateway_RTGS",
      "OUT_OF_WINDOW": "queue_RTGS_weekend_hold"
    }
  }
}
```

## 4. Generic Contract Model
Contracts define what nodes offer and require.

```json
{
  "contractId": "string",
  "inputSchema": "schemaRef",
  "outputSchema": "schemaRef",
  "capabilities": ["capabilityName"],
  "protocol": "http|grpc|mq|file|custom",
  "sla": {
    "window": "cron or time-range",
    "maxLatencyMs": "number",
    "retryPolicy": "policyRef"
  }
}
```

## 5. Build Compatibility Rules
Compatibility is evaluated using nodeVariantRegistry.json and platformioProfiles.json.

- Platform must support the node type.
- Platform must support all capabilities declared in contracts.
- Platform must support required protocols.
- Platform must support required schemas.
- Platform must support SLA features if used.

If any check fails, the flow is marked as build-incompatible.

## 6. Deployment Binding Rules
Nodes are bound to deployment targets based on capabilities and contracts.

- Mapper -> targets with mapper-engine.
- Compute -> targets with rule-engine or compute-engine.
- Gateway -> targets with gateway-client and matching contract.
- Queue -> targets with queue-engine.
- Service -> targets with service-host.
- Daemon -> targets with scheduler or daemon-runner.
- State -> targets with audit-store or state-store.

When multiple targets are compatible, the system prefers matching environment, SLA profile, lower load, and locality.

## 7. FlowDesignerPage.jsx Implementation Notes
### 7.1 Palette
- Transform: Mapper
- Decision: Compute
- External: Gateway, Contract
- Temporal / Buffer: Queue, Daemon
- Runtime: Service
- State / Observability: State

### 7.2 Canvas
Nodes are placed on the canvas and connected with typed edges. Each edge type enforces valid source/target combinations.

### 7.3 Node Configuration
Each node type has a configuration panel for schemas, policies, endpoints, contracts, schedules, and state schemas.

### 7.4 Deployment Pane
The right-hand deployment pane shows targets and their capabilities. Selecting a node shows compatible targets and allows auto-bind or manual bind. Diagnostics highlight capability, protocol, schema, and SLA mismatches.

## 8. Example: Payment Flow Using Generic Nodes
A payment flow with MT->PACS conversion, Fraud, Sanctions, RTGS, Balance check, weekend hold, and legacy completion can be modeled using only:

- Gateway (legacy inbound, external systems)
- Mapper (MT->PACS, PACS->service formats)
- Compute (decisioning, SLA logic, routing)
- Queue (weekend hold, operator manual review)
- Service (correspondent dispatch, legacy completion)
- State (transaction state and locator)
- Contract (service and gateway contracts)
