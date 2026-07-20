# Validation Pattern

## Keywords
- validate
- validation
- verify
- check
- compliance
- rule
- policy
- enforce

## Message Types
- Any: MT103, MT202, CAMT, PAIN, PACS, ISO 20022

## Pattern Description
Detects requests to validate messages against rules, policies, or schemas. Validation ensures incoming data meets business and regulatory requirements before processing.

## Detection Rules
- Query contains validation keywords: "validate", "verify", "check", "compliance", "rule"
- Query mentions message type to validate
- Query may specify compliance rules or policies
- If validation criteria unclear, ask what should be checked

## Solution Steps

### Step 1: Define Validation Scope
- **Automated**: Extract validation intent
- **Verification**: ✓ Confirmed from query keywords
- **API Resources**: None
- **Output**: Service type = "validation", Scope = ["schema", "business rules", "policy", "compliance"]

### Step 2: Select Message Schema
- **Automated**: Query schemas for message type
- **Verification**: ⚠ User selects appropriate schema version
- **API Resources**: `/api/librarian/schemas`
- **Output**: Schema definition

### Step 3: Define Validation Rules
- **Automated**: Extract schema-based validations (required fields, data types)
- **Verification**: ⚠ Business analyst defines business-specific rules
- **API Resources**: `/api/librarian/mapper-rulesets`, `/api/librarian/data-types`
- **Output**: Validation rule set

### Step 4: Design Error Handling
- **Automated**: Suggest error categories (schema violation, rule violation, policy breach)
- **Verification**: ⚠ Analyst defines handling per error type
- **API Resources**: None
- **Output**: Error handling procedures

### Step 5: Implement Validation Service
- **Automated**: Generate service skeleton with validation flows
- **Verification**: ⚠ Developer implements rule execution engine
- **API Resources**: None (custom implementation)
- **Output**: Validation service, error reports

## API Resources Required
- `/api/librarian/schemas` - Message schema definitions
- `/api/librarian/data-types` - Field validation rules
- `/api/librarian/mapper-rulesets` - Business rule templates

## Verification Requirements
- **Developer**: Rule execution correctness, error categorization, performance
- **Analyst**: Rule completeness, compliance coverage, error messaging
- **Architect**: Scalability, rule versioning, audit trail

## Role-Specific Guidance

### Developer
- Focus on: rule engine, error handling, performance
- Questions to ask:
  - What's the validation order?
  - Should validation fail-fast or collect all errors?
  - How are rule violations categorized?
  - What's the error return format?

### Analyst
- Focus on: rule coverage, compliance
- Questions to ask:
  - What compliance rules apply?
  - Are there business rule overrides?
  - What's the escalation path for violations?
  - What audit trail is needed?

### Architect
- Focus on: rule management, versioning, integration
- Questions to ask:
  - How are rules versioned?
  - Can rules be updated without redeployment?
  - What's the rule audit trail?
  - How does this scale with rule complexity?

## Example Queries Matching This Pattern
- "Validate MT103 messages for SWIFT compliance"
- "Create a payment validation service for ISO 20022"
- "Check CAMT.053 messages against business rules"
- "Build validator to enforce payment policy"
- "Validate incoming PAIN instructions"
