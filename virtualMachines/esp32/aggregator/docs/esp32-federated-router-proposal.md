# ESP32 Federated Router Proposal

## Executive Summary

This proposal introduces an edge-capable router that can run on ESP32 nodes while remaining interoperable with the existing aggregator queue manager and router/mapping pipeline.

The approach is to keep the hot data path local on ESP32 and use the federated file system as a control-plane channel for artifact distribution, versioning, and diagnostics.

## Why This Matters

- Lower latency at edge ingress and egress.
- Continued routing during intermittent uplink outages.
- Controlled rollout of mapping and routing behavior by artifact version.
- Better operational analysis through structured edge error logs.

## Scope

In scope:
- JSON payload routing up to 5 KB per message.
- Edge execution of compiled router and mapper artifacts.
- Queue manager integration for dequeue, enqueue, and acknowledgement semantics.
- Validation/error logging with payload snapshots.

Out of scope for initial phase:
- Full XML schema validation on ESP32.
- Dynamic source parsing of complete DSL on-device.
- Arbitrary large payload support.

## Proposed Model

### Control Plane

- Compile router/mapper DSL centrally into compact artifacts.
- Publish signed, versioned artifacts to federated storage.
- ESP32 nodes poll or subscribe for manifest changes.
- Nodes fetch and activate only verified artifacts.

### Data Plane

- ESP32 dequeues from configured input queue.
- p-machine executes compiled rules and transforms.
- Outputs are published to destination queues.
- On failure, message is nacked or dead-lettered according to policy.

### Artifact Lifecycle

- Last-known-good artifact is retained locally.
- Activation is atomic with rollback on validation failure.
- Node reports active artifact version in heartbeat.

## Required Changes to ESP32 Code

1. Runtime and Memory
- Add a compact p-machine runtime with hard limits:
  - max script steps
  - max map depth
  - max fan-out per message
  - max payload bytes (5 KB)
- Use bounded buffers and avoid full-message cloning.

2. Queue Manager Client
- Implement queue API client with:
  - dequeue(inputQueue, consumer)
  - enqueue(outputQueue, message, sourceService)
  - ack(messageId)
  - nack(messageId, reason)
- Add retry with jitter and offline spool.

3. Federated File Client
- Add manifest fetch and artifact download.
- Verify signature/hash before activation.
- Persist active and last-known-good versions.

4. Validation and Diagnostics
- Apply queue type checks before enqueue.
- Emit structured error records including:
  - queue name
  - expected type
  - detected shape
  - reason
  - source service
  - message summary
- Batch and flush diagnostics to federated storage.

5. Telemetry
- Heartbeat should include:
  - node id
  - firmware version
  - active artifact version
  - queue lag
  - spool depth
  - validation error counters

## Changes to Aggregator/Backend

- Keep queue data-type enforcement at queue boundaries.
- Continue centralized artifact compilation and publication.
- Provide artifact manifest endpoint and signing metadata.
- Provide fleet-level diagnostics and edge status view.

## Risks and Mitigations

1. Memory fragmentation
- Mitigate with fixed buffers and capped message size.

2. Inconsistent behavior across node versions
- Mitigate with signed artifact version pinning and compatibility metadata.

3. Delivery duplication in unstable links
- Mitigate with idempotent message ids and at-least-once semantics.

4. Security overhead
- Mitigate with lightweight token auth and optional TLS offload where available.

## Delivery Plan

Phase 1: Local router runtime
- Single input queue, single output queue, static rule set.

Phase 2: Federated artifact updates
- Manifest polling, signed artifact install, rollback.

Phase 3: Multi-output fan-out and mapping chain
- Bounded nested maps and dead-letter handling.

Phase 4: Fleet operations
- Central dashboard for versions, lag, and validation diagnostics.

## Success Criteria

- Edge node can route 5 KB JSON messages reliably.
- Artifact updates can be rolled out and rolled back without reflashing firmware.
- Validation failures are visible with actionable context.
- Queue data types are enforced consistently across edge and core.
