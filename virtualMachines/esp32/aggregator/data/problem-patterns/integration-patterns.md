# Integration Pattern

## Keywords
- service
- build
- create
- integration
- flow
- process
- pipeline
- orchestrate

## Pattern Description
Detects requests to build complete integration services combining multiple operations. Integration services typically involve receiving messages, processing them through multiple steps, and delivering results.

## Detection Rules
- Query contains integration keywords: "service", "build", "create", "integration", "pipeline"
- Query mentions multiple message types or operations
- Query implies a workflow or process
- If workflow steps unclear, ask for clarification

## Solution Steps

### Step 1: Define Integration Purpose
- **Automated**: Extract integration intent
- **Verification**: ✓ Confirmed from query keywords
- **API Resources**: None
- **Output**: Service type, Primary operations, Input/output types

### Step 2: Identify Message Types and Flows
- **Automated**: Extract all message types mentioned
- **Verification**: ⚠ Clarify flow direction and sequence
- **API Resources**: `/api/librarian/schemas`
- **Output**: Message flow diagram, Input/output schemas

### Step 3: Design Service Components
- **Automated**: Suggest component breakdown (receiver, transformer, validator, sender)
- **Verification**: ⚠ Architect reviews component boundaries
- **API Resources**: `/api/librarian/schemas`, `/api/mapper/maps`
- **Output**: Service architecture, component interfaces

### Step 4: Select or Create Mappers
- **Automated**: Query existing mappers for required transformations
- **Verification**: ⚠ Architect decides reuse vs. new mapper creation
- **API Resources**: `/api/mapper/maps`, `/api/mapper/test-cases`
- **Output**: Mapper configuration

### Step 5: Design Error Handling and Recovery
- **Automated**: Suggest error handling patterns (retry, dead-letter, circuit breaker)
- **Verification**: ⚠ Architect defines per-component strategy
- **API Resources**: None
- **Output**: Error handling procedures, recovery strategies

### Step 6: Implement Integration Service
- **Automated**: Generate service skeleton with all components
- **Verification**: ⚠ Developer implements component logic
- **API Resources**: None (custom implementation)
- **Output**: Integration service, test cases, documentation

## API Resources Required
- `/api/librarian/schemas` - Message schema definitions
- `/api/mapper/maps` - Existing mappers
- `/api/mapper/test-cases` - Mapper validation test cases
- `/api/librarian/mapper-rulesets` - Transformation rules

## Verification Requirements
- **Developer**: Component correctness, error handling, integration testing
- **Analyst**: Business flow accuracy, data accuracy at each step
- **Architect**: Scalability, reliability, maintainability, monitoring

## Role-Specific Guidance

### Developer
- Focus on: component implementation, error handling, testing
- Questions to ask:
  - What's the expected throughput?
  - How are retries handled?
  - What's the timeout strategy?
  - How is state managed across components?
  - What's the test coverage requirement?

### Analyst
- Focus on: business flow, data accuracy, compliance
- Questions to ask:
  - Does flow meet business requirements?
  - How are exceptions reported?
  - What's the SLA for service?
  - What audit trail is needed?
  - How are approvals handled?

### Architect
- Focus on: scalability, reliability, maintainability
- Questions to ask:
  - What's the scaling strategy?
  - How are component dependencies managed?
  - What's the deployment strategy?
  - How is monitoring/alerting set up?
  - Can this service be decomposed further?

## Example Queries Matching This Pattern
- "Create an integration service that receives MT103, validates it, converts to CAMT.056, and sends to correspondent"
- "Build a payment routing service that reconciles and forwards"
- "Create end-to-end payment processing pipeline"
- "Build integration between SWIFT and ISO 20022 systems"
