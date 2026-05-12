# ESP32 Federated Router Tentative Design

## Goals

- Run routing logic on ESP32 for bounded JSON payloads.
- Use federated storage for artifact distribution and diagnostics.
- Preserve compatibility with existing queue manager and router rule model.

## Non-Goals

- General-purpose transformation runtime with unbounded compute.
- Full schema validation for all ISO 20022 families at edge.

## High-Level Architecture

- Compiler Service (existing backend toolchain)
  - Input: router/mapper DSL
  - Output: compact execution artifact
- Federated File System
  - Stores manifests, artifacts, and edge diagnostics
- ESP32 Router Agent
  - Loads artifacts
  - Executes p-machine
  - Talks to queue manager
- Queue Manager
  - Provides queue semantics and replication path

## Components on ESP32

### 1. Artifact Manager

Responsibilities:
- Fetch manifest from federated storage.
- Compare current and candidate versions.
- Download artifact chunks.
- Verify hash/signature.
- Atomically activate candidate artifact.
- Retain last-known-good artifact.

Data structures:
- activeArtifactMeta
- previousArtifactMeta
- artifactCacheIndex

### 2. p-Machine Execution Engine

Responsibilities:
- Evaluate compiled rule predicates.
- Execute transforms/map steps.
- Enforce execution budget.

Hard limits:
- maxPayloadBytes = 5120
- maxInstructionsPerMessage
- maxMapDepth
- maxOutputsPerRule
- maxTotalOutputsPerMessage

### 3. Queue Client

Responsibilities:
- Pull messages from input queue.
- Push transformed outputs.
- Ack/Nack input with reason.
- Retry with exponential backoff and jitter.

Interface (tentative):
- dequeue(queueName, consumerId) -> { messageId, message, sourceService }
- enqueue(queueName, message, sourceService, messageId)
- ack(queueName, messageId)
- nack(queueName, messageId, reason)

### 4. Validation and Diagnostics

Responsibilities:
- Validate message shape against queue type.
- Emit local structured validation events.
- Persist ring buffer and flush in batches to federated storage.

Error record fields:
- timestamp
- nodeId
- queueName
- expectedType
- detectedShape
- reason
- sourceService
- messageSummary
- artifactVersion

## Artifact Format (Tentative)

Top-level:
- formatVersion
- artifactId
- createdAt
- compilerVersion
- compatibility
- queueTypeHints
- ruleSet
- mapSet
- limits
- signature

Rule entry:
- ruleId
- inputQueue
- outputs[]

Output entry:
- queueName
- whenBytecode
- transformBytecode

Map entry:
- mapId
- operations[]

## Execution Flow

1. Startup
- Load active artifact from local storage.
- If none, load previous artifact; if none, fail closed.

2. Sync
- Poll manifest at interval.
- If newer compatible artifact exists, download and verify.
- Activate candidate; on failure, rollback.

3. Routing Loop
- dequeue input message
- validate input type
- execute rules
- validate output type(s)
- enqueue outputs
- ack input on success, nack/dead-letter on failure

4. Diagnostics Flush
- append local events immediately
- flush batched events opportunistically

## Queue Type Strategy

Queue configuration must explicitly carry dataTypeId(s).

Expected initial mappings:
- swift.mt103.parsed -> swift-mt103
- correspondent.pacs008.outbound -> pacs
- lynx.pacs009.outbound -> pacs

Fallback inference only for queue bootstrap; explicit config remains source of truth.

## Reliability Model

- At-least-once delivery.
- Idempotency through stable message ids.
- Local spool for transient network failures.
- Dead-letter queue for permanent validation/runtime failures.

## Security Model

- Signed artifacts and manifest integrity checks.
- Token-based queue API authentication.
- Optional TLS depending on deployment constraints.

## Observability

Node heartbeat payload should include:
- activeArtifactVersion
- messageRate
- queueLag
- validationErrorRate
- spoolDepth
- memoryWatermarks
- restartCount

## Integration Changes Needed in Aggregator

- Artifact publishing endpoint + manifest generation.
- Compatibility metadata in artifact.
- Fleet view for node status and artifact versions.
- Validation event ingestion and searchable history.

## Open Questions

1. Preferred transport between ESP32 and queue manager (HTTP vs MQTT bridge).
2. Signature scheme and key rotation process.
3. Required retention period for edge diagnostics.
4. Backpressure policy when output queue is unavailable.

## Tentative Milestones

M1
- p-machine runtime + static artifact + one queue path.

M2
- Manifest sync + signed artifact activation + rollback.

M3
- Multi-output fan-out + validation logging + dead-letter flow.

M4
- Fleet telemetry + centralized diagnostics search.
