# Query Page: Natural Language Solution Constructor

## Overview
The Query Page is a frontend interface that helps users construct solutions to integration problems by analyzing natural language queries and matching them against available APIs and resources.

## Features

### 1. Natural Language Query Input
- Users enter a description of what they want to accomplish
- Examples:
  - "Create a service to convert MT103 to CAMT message"
  - "Convert SWIFT MT942 to ISO 20022 CAMT.053"
  - "Build a payment validation service"

### 2. Intelligent Query Analysis
The system analyzes queries to extract:
- **Conversion patterns**: Identifies source and target message formats
- **Service creation intent**: Detects when building new services
- **Operations**: Identifies operations like validate, reconcile, parse, etc.
- **Message types**: Extracts message type references (MT103, CAMT, etc.)

### 3. API-Driven Resource Discovery
The Query Page fetches data from available APIs:
- `/api/librarian/data-types` - Available data types
- `/api/librarian/schemas` - Defined message schemas
- `/api/librarian/mapper-rulesets` - Mapper rule definitions
- `/api/mapper/maps` - Available mappers

### 4. Solution Generation
Based on analysis and available resources, the system generates:
- **Step-by-step solution plan**: Breaks down the problem into actionable steps
- **Resource recommendations**: Lists schemas, mappers, and data types matching the query
- **Verification requirements**: Highlights what needs user confirmation vs. what's automated

### 5. Verification Tags
Each solution step is tagged with verification status:
- **✓ Verified (Green)**: Information extracted from query or directly available from APIs
- **⚠ Verify (Orange)**: Recommendations that need user confirmation or custom implementation

### 6. Solution Export
- Export proposed solutions as JSON
- Share solutions with team members
- Integrate with external tools or documentation

## Workflow

### Step 1: Enter Query
```
"Create a service to convert MT103 to CAMT.053"
```

### Step 2: Analysis
The system:
1. Detects conversion intent
2. Identifies source (MT103) and target (CAMT.053) formats
3. Searches APIs for matching schemas

### Step 3: Resource Discovery
Results include:
- Available MT103 schema definitions
- Available CAMT.053 schema definitions
- Existing mappers that might help
- Related data types

### Step 4: Solution Steps
Generated solution includes:
1. Identify Source and Target Formats (✓ Verified from query)
2. Select Source Schema (⚠ Verify - needs selection from options)
3. Select Target Schema (⚠ Verify - needs selection from options)
4. Create or Select Mapper (⚠ Verify - may need new mapper creation)
5. Implement Service (⚠ Verify - custom code required)

### Step 5: Export & Execute
- Export solution as JSON
- Use recommendations to implement
- Track in project workspace

## API Integration

### Required APIs
For optimal Query Page functionality, ensure these endpoints are available:

```javascript
// Get all data types
GET /api/librarian/data-types
Response: { types: [...] }

// Get all schemas
GET /api/librarian/schemas
Response: { schemas: [...] }

// Get mapper rulesets
GET /api/librarian/mapper-rulesets
Response: { rulesets: [...] }

// Get available mappers
GET /api/mapper/maps
Response: { maps: [...] } or [...]
```

### Fallback Behavior
- If APIs are unavailable, the Query Page gracefully handles errors
- Users can still analyze queries but may see fewer resource matches
- "Refresh API Data" button allows retry after API recovery

## Example Queries

### Conversion Service
**Query**: "Convert MT103 to CAMT message"
**Result**: 5-step solution covering schema selection, mapper creation, and service implementation

### Validation Service
**Query**: "Create a payment message validation service for MT103"
**Result**: Steps for defining validation rules, selecting schemas, and building validators

### Data Transformation
**Query**: "Map SWIFT to ISO 20022 format"
**Result**: Steps for format identification, mapper selection, and transformation logic

### Multi-Step Integration
**Query**: "Receive MT103, validate it, convert to CAMT.053, and send to correspondent"
**Result**: Complex multi-step solution with several service components

## Query Hints for Users

### Best Practices
1. **Be specific about message types**: Use full names (MT103, CAMT.053) or aliases (SWIFT, ISO 20022)
2. **Include both source and target**: For conversions, specify both formats
3. **Mention operations**: Use verbs like convert, validate, map, transform
4. **Reference existing services**: If building on existing services, mention them

### Query Templates
- "Convert [source format] to [target format]"
- "Create a [service type] service for [message type]"
- "Map [source format] fields to [target format]"
- "Build a validation service that checks [message type]"

## Advanced Usage

### Query History
- Recent queries are stored in a history section
- Click any history item to view its solution
- Solutions are not persisted (refresh resets history)

### Solution Refinement
- Modify your query and re-analyze
- Export multiple solutions for comparison
- Track changes across iterations

### Integration with Other Tools
- Export solutions and import into Flow Designer
- Create mappers from query recommendations
- Use in project workspace documentation

## Limitations & Constraints

### What the Query Page Does
✓ Analyzes natural language and extracts patterns
✓ Searches available APIs for matching resources
✓ Generates recommended solution steps
✓ Highlights what needs verification vs. what's automated
✓ Exports solutions as structured JSON

### What the Query Page Does NOT Do
✗ Execute code or generate executable services (that's for Flow Designer)
✗ Access APIs beyond those available at `/api/`
✗ Automatically create new schemas or mappers
✗ Validate that proposed solutions are technically feasible
✗ Require manual verification beyond the system's recommendations

## Troubleshooting

### No Results Found
- Check that APIs are responding (click "Refresh API Data")
- Try more specific message type names
- Ensure message types match those in available schemas

### Missing Resources
- Click "Refresh API Data" to reload from backends
- Verify APIs are running (backend, librarian service)
- Check API response format matches expected structure

### Query Analysis Unclear
- Use more specific terminology
- Include both source and target formats for conversions
- Reference known message types (MT103, CAMT, etc.)

## Future Enhancements
- AI-powered natural language understanding
- Integration with Flow Designer for direct execution
- Persistent solution storage and versioning
- Collaborative solution review workflows
- Real-time API schema validation
- Suggested query templates based on common patterns
