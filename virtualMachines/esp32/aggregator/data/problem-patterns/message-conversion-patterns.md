# Message Conversion Pattern

## Keywords
- convert
- transform
- map
- translate
- from
- to

## Message Types
- MT103, MT102, MT202, MT203, MT900, MT910, MT920, MT940, MT941, MT942, MT950
- CAMT (CAMT.053, CAMT.054, CAMT.055, CAMT.056)
- PAIN (PAIN.001, PAIN.002)
- PACS (PACS.008, PACS.009)
- ISO20022, SWIFT

## Pattern Description
Detects requests to convert between message formats. Conversion typically requires identifying both source and target formats, selecting appropriate schemas, creating or selecting mappers, and implementing transformation logic.

## Detection Rules
- Query contains conversion keywords: "convert", "transform", "map", "translate"
- Query mentions at least one source format (e.g., MT103)
- Query mentions at least one target format (e.g., CAMT.053)
- If only one format mentioned, ask for clarification

## Solution Steps

### Step 1: Identify Source and Target Formats
- **Automated**: Extract from query
- **Verification**: ✓ Confirmed if both formats clearly stated
- **API Resources**: None
- **Output**: Source format, Target format

### Step 2: Select Source Schema
- **Automated**: Query `/api/librarian/schemas` with source format filter
- **Verification**: ⚠ User selects appropriate schema version
- **API Resources**: `/api/librarian/schemas`
- **Output**: Selected source schema definition

### Step 3: Select Target Schema
- **Automated**: Query `/api/librarian/schemas` with target format filter
- **Verification**: ⚠ User selects appropriate schema version
- **API Resources**: `/api/librarian/schemas`
- **Output**: Selected target schema definition

### Step 4: Create or Select Mapper
- **Automated**: Query `/api/mapper/maps` to find existing mappers
- **Verification**: ⚠ User decides to reuse existing or create new
- **API Resources**: `/api/mapper/maps`, `/api/mapper/maps/:id`
- **Output**: Mapper configuration with field mappings

### Step 5: Define Conversion Rules
- **Automated**: Suggest transformation rules based on schema analysis
- **Verification**: ⚠ User reviews and refines transformation logic
- **API Resources**: `/api/librarian/mapper-rulesets`
- **Output**: PL/0 or custom transformation rules

### Step 6: Implement Service
- **Automated**: Generate service skeleton
- **Verification**: ⚠ Developer implements business logic
- **API Resources**: None (custom implementation)
- **Output**: Service code, test cases

## API Resources Required
- `/api/librarian/schemas` - List available message schemas
- `/api/librarian/data-types` - Available data type definitions
- `/api/mapper/maps` - Existing mapper configurations
- `/api/librarian/mapper-rulesets` - Transformation rule templates

## Verification Requirements
- **Developer**: Must verify mapper rules, schema compatibility, error handling
- **Analyst**: Must verify business requirements, data mappings align with policy
- **Architect**: Must review performance, security, maintainability implications

## Role-Specific Guidance

### Developer
- Focus on: schema versions, mapping rules, error handling
- Questions to ask:
  - What field mappings are required?
  - How should missing fields be handled?
  - What validation is needed before/after conversion?
  - Error retry strategy?

### Analyst
- Focus on: business requirements, regulatory compliance, data accuracy
- Questions to ask:
  - Does this conversion meet compliance requirements?
  - Are there business rules that affect mapping?
  - How should exceptions be handled?
  - What audit trail is needed?

### Architect
- Focus on: scalability, integration, maintainability
- Questions to ask:
  - What's the expected throughput?
  - How does this integrate with existing services?
  - What's the failure recovery strategy?
  - Can this be reused for similar conversions?

## Common Issues

### Issue: Schema versions incompatible
- Resolution: Check `/api/librarian/schemas` for compatible versions
- Fallback: Create schema adapter layer

### Issue: Field mapping not obvious
- Resolution: Use mapper test cases from `/api/mapper/test-cases`
- Fallback: Manual mapping specification required

### Issue: Complex business rules
- Resolution: Implement in PL/0 transformation rules or custom code
- Verification: Must be documented and tested

## Example Queries Matching This Pattern
- "Convert MT103 to CAMT.056"
- "Transform SWIFT payment to ISO 20022"
- "Map MT940 to CAMT.053"
- "Convert payment instruction from PAIN to Swift"
- "Create service to transform MT202 to CAMT.054"
