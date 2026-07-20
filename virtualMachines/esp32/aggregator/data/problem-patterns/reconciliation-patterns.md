# Reconciliation Pattern

## Keywords
- reconcile
- reconciliation
- match
- compare
- outstanding
- against
- verify
- cross-check

## Message Types
- Any: MT103, MT202, CAMT.053, PAIN, PACS
- Reference data: Outstanding messages, master records, transaction ledger

## Pattern Description
Detects requests to reconcile messages or transactions. Reconciliation involves comparing incoming messages against a reference set (outstanding messages, master records, transaction log) to identify matches, exceptions, and discrepancies.

## Detection Rules
- Query contains reconciliation keywords: "reconcile", "match", "compare", "outstanding"
- Query mentions two entities to reconcile (e.g., "CAMT messages" and "outstanding messages")
- Query implies validation against a reference set
- If reference set unclear, ask for clarification

## Solution Steps

### Step 1: Define Service Purpose
- **Automated**: Extract reconciliation intent
- **Verification**: ✓ Confirmed from query keywords
- **API Resources**: None
- **Output**: Service type = "reconciliation", Operations = ["match", "compare", "exception handling"]

### Step 2: Identify Reference Sets
- **Automated**: Extract both message types to reconcile
- **Verification**: ⚠ Clarify which is incoming, which is reference
- **API Resources**: `/api/librarian/schemas`
- **Output**: Primary set, Reference set, Match criteria

### Step 3: Select Data Schemas
- **Automated**: Query schemas for each message type
- **Verification**: ⚠ User selects appropriate versions
- **API Resources**: `/api/librarian/schemas`, `/api/librarian/data-types`
- **Output**: Schema definitions for both sets

### Step 4: Define Match Rules
- **Automated**: Suggest common match criteria (amount, date, reference number)
- **Verification**: ⚠ Business analyst confirms matching logic
- **API Resources**: `/api/librarian/mapper-rulesets`
- **Output**: Match criteria specification

### Step 5: Design Exception Handling
- **Automated**: Suggest exception categories (not found, amount mismatch, date variance)
- **Verification**: ⚠ Analyst defines business rules for each exception
- **API Resources**: None
- **Output**: Exception handling procedures

### Step 6: Implement Reconciliation Service
- **Automated**: Generate service skeleton with match/exception flows
- **Verification**: ⚠ Developer implements matching logic and reporting
- **API Resources**: None (custom implementation)
- **Output**: Reconciliation service, exception reports

## API Resources Required
- `/api/librarian/schemas` - Message schema definitions
- `/api/librarian/data-types` - Field type definitions
- `/api/queue-manager/queues` - Reference message queue access
- `/api/librarian/mapper-rulesets` - Transformation rule templates

## Verification Requirements
- **Developer**: Match algorithm correctness, exception categorization, performance
- **Analyst**: Business rule accuracy, exception handling procedures, reporting requirements
- **Architect**: Scalability, data persistence, audit trail, concurrent matching logic

## Role-Specific Guidance

### Developer
- Focus on: match algorithm, exception handling, performance
- Questions to ask:
  - What's the match key? (Single field or composite?)
  - How are amount tolerances handled?
  - How are date variations handled?
  - How is state managed during matching?
  - What's the rollback strategy for failed reconciliations?

### Analyst
- Focus on: business rules, exceptions, compliance
- Questions to ask:
  - What defines a "match"?
  - How are exceptions prioritized?
  - What's the SLA for reconciliation completion?
  - What reports are needed?
  - How are reconciliation breaks escalated?

### Architect
- Focus on: data flows, integration, maintainability
- Questions to ask:
  - How many messages are reconciled daily?
  - Is real-time or batch reconciliation needed?
  - How long should reference data be retained?
  - Can this scale to multi-site reconciliation?
  - How is data lineage tracked?

## Common Issues

### Issue: Unclear reference set
- Resolution: Ask user to specify which is "incoming" vs "master/outstanding"
- Fallback: Assume most recently mentioned is reference

### Issue: No unique key for matching
- Resolution: Allow composite matching (amount + date + party)
- Fallback: Manual matching required

### Issue: Tolerances vary by message type
- Resolution: Define per-type rules in `/api/librarian/mapper-rulesets`
- Fallback: Use single tolerance across all types

### Issue: High exception rate
- Resolution: Audit match rules, review exception categories
- Fallback: Implement manual review workflow

## Example Queries Matching This Pattern
- "Create a reconciliation service where CAMT messages are reconciled against outstanding messages"
- "Reconcile MT940 against transaction ledger"
- "Match incoming PAIN payments against payables master"
- "Reconcile CAMT.053 statement against internal transactions"
- "Compare 94* messages with pending transactions"
- "Build reconciliation service for payments and confirmations"
