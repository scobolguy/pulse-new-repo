# Process Flow Specification Standard (PFSS)

Purpose:
- Define one artifact that Business Analysts, Developers, Testers, and Auditors can all read and approve.
- Describe where transactions come from, what steps they go through, what can fail, and what must happen next.

## 1. Design Goals

1. Business-readable: clear names and plain-language intent.
2. Runtime-mappable: each step maps to queues, services, gateways, and events.
3. Audit-ready: every requirement links to evidence and controls.
4. Testable: each path has verifiable acceptance criteria.

## 2. Canonical Structure

Every process flow spec must include the following sections.

1. Metadata
- flowId
- version
- owner
- changeApprovers
- status (draft, review, approved)

2. Scope
- inScope
- outOfScope
- assumptions

3. Inputs and Triggers
- transaction sources
- trigger conditions
- required inbound fields

4. Process Steps
For each step:
- stepId
- businessPurpose
- systemComponent
- inboundQueue
- outboundQueueOnSuccess
- processingRuleSummary
- tryBehavior
- onErrorBehavior
- onTimeoutBehavior
- expectedJournalEvents

5. Decision Gates
For each gate:
- gateId
- decisionRule (plain language)
- ruleExpression (machine-readable)
- passPath
- failPath

6. External Dependencies and Gateways
For each dependency:
- gatewayId
- targetSystem
- allowedOperations (send, receive)
- availabilityPolicy
- behaviorWhenDown

7. Business Time Windows
- calendarId
- openSchedule
- closedBehavior
- deferredQueue
- retrySchedule

8. Completion Criteria
- terminalSuccessEvent
- replySentCondition
- terminalFailureEvents

9. Inquiry Contract (Support View)
- mandatory answer fields (receivedAt, replySentAt, currentState, blockingReason, nextAction)
- narrative template constraints

10. Controls and Audit
- controlIds
- segregationOfDuties points
- mandatory evidence fields
- retention requirements

11. Test Scenarios
- happy path
- gateway down path
- timeout path
- deferred and requeue path

12. Traceability Matrix
Map each requirement to:
- implementation component
- runtime event evidence
- test case id

## 3. Review Workflow

1. BA writes sections 1-7.
2. Dev maps sections 4-8 to runtime components and queues.
3. QA writes section 11 and validates section 12 links.
4. Audit verifies section 10 controls and section 12 evidence.
5. Final status changes to approved only when all 4 sign off.

## 4. Approval Decision Rule

Use this strict decision model:

- "That's it": all required sections complete, all mandatory fields present, all matrix rows linked to executable evidence.
- "Not quite": any missing section, ambiguous decision rule, untestable path, or no evidence mapping.

## 5. Mapping to Existing DSLs

PFSS is the business/system contract. Existing DSLs remain execution artifacts.

- Transaction lifecycle DSL: state machine and transitions.
- Workflow DSL: routing and policy.
- Mapper DSL or runtime mappers: transformation logic.

PFSS should reference those generated/executable artifacts, but stays the approval source document.
