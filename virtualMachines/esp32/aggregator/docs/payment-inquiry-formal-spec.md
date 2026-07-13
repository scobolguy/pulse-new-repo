# Payment Inquiry Formal Specification

This specification defines how to formally describe and reconstruct payment processing behavior for support questions such as: "What happened to payment 1234?"

## 1. Formal Method Stack

The method uses existing repo DSLs as a layered formalism.

1. Transaction Lifecycle DSL: state machine and queue-connected process flow.
2. Workflow DSL: deterministic routing policy for outcomes including error and timeout.
3. Pascalish or Cobolish compiled to pcode: stage execution logic and decision evaluation.
4. Journal event contract: immutable evidence for inquiry reconstruction.

Mapper requirement.

- Mapper identifiers used by lifecycle actions MUST resolve to concrete MAPPER blocks in DSL artifacts.
- This scenario uses `payment-to-transaction-inquiry` as the canonical intake mapper.

## 2. Normative Requirements

1. All inter-process communication MUST occur through queues.
2. Every process stage MUST implement try logic plus explicit onError and timeout outcomes.
3. External payment reference MUST be linkable to internal transactionId.
4. Inquiry reconstruction MUST be event-evidence based and MUST NOT infer unstamped stage outcomes.
5. Transaction completion MUST be recognized only after SWIFT send success.
6. Every external/system interaction MUST pass through a designated gateway.
7. If a required gateway is down or quiesced, messages MUST NOT be sent to or received from that service path.

## 3. Correlation Contract

Each journal event MUST include the following fields.

- externalPaymentRef
- transactionId
- parentTransactionId (nullable)
- processId
- stageName
- queueName
- eventKind
- occurredAt

Recommended fields.

- nodeId
- workerId
- managerId
- attemptNo
- timeoutMs
- errorCode
- errorMessage

## 4. Stage and Branch Semantics

Canonical branch model.

1. Payment received and mapped to transactionId.
2. One or more decision stages execute in sequence.
3. If RTGS window is open, submit to RTGS.
4. If RTGS accepted, send to SWIFT.
5. SWIFT send success marks transaction complete.
6. If RTGS window is closed, defer and schedule Monday requeue.
7. Monday requeue restarts at beginning of configured pre-RTGS decision chain.
8. If a required gateway is down, transition to blocked/deferred handling according to policy and publish a gateway-down reason in inquiry responses.

## 5. Required Journal Event Kinds

- payment_received
- transaction_created
- queue_enqueued
- worker_started
- stage_try_started
- stage_try_succeeded
- stage_try_failed
- stage_timeout
- rtgs_availability_checked
- rtgs_down_detected
- rtgs_submit_succeeded
- swift_send_started
- swift_send_succeeded
- business_rule_scheduled_requeue
- requeue_executed
- transaction_completed
- reply_sent

## 6. Support Inquiry Output Contract

Response payload SHOULD include.

- paymentReference
- transactionId
- receivedAt
- replySentAt
- currentStatus
- blockingReason
- nextAction
- stageSummary

Rules.

1. If replySentAt exists, response is terminal-complete narrative.
2. If replySentAt is absent, response MUST include precise blockingReason and nextAction.
3. Sunday RTGS closure response MUST include deferred-until-Monday explanation.

## 7. Reference Artifacts

- Lifecycle reference: [aggregator/data/payment-inquiry-lifecycle.tsl](../data/payment-inquiry-lifecycle.tsl)
- Workflow routing reference: [aggregator/data/payment-inquiry-policy.wfl](../data/payment-inquiry-policy.wfl)
- Mapper reference: [aggregator/data/payment-inquiry-mapper.dsl](../data/payment-inquiry-mapper.dsl)
- Existing runtime anchors: [aggregator/backend.mjs](../backend.mjs), [aggregator/src/backend/roles/lifecycleInquiryRoutes.mjs](../src/backend/roles/lifecycleInquiryRoutes.mjs)

## 8. Scenario Conformance Example

Input scenario.

1. payment 1234 received.
2. Decision chain approves.
3. RTGS unavailable because today is Sunday.
4. No reply sent yet.
5. Monday morning policy requeues to decision chain before RTGS retry.

Expected inquiry answer constraints.

1. receivedAt MUST be present.
2. replySentAt MUST be null before completion.
3. stageSummary MUST include decision approvals and RTGS down reason.
4. nextAction MUST identify Monday requeue schedule.
5. After Monday successful RTGS and SWIFT send, replySentAt and completed status MUST be present.
