# Problem-Solving Patterns for Query Analysis

This directory contains reusable problem-solving patterns in markdown format. Each pattern describes how to recognize and solve a specific class of problems.

## Pattern File Structure

Each pattern file (`.md`) contains structured sections:

```
# Pattern Name

## Keywords
- keyword1
- keyword2

## Detection Rules
Describe how to detect this pattern...

## Solution Steps
1. Step 1 description
2. Step 2 description

## API Resources
- /api/endpoint1 - what it provides
- /api/endpoint2 - what it provides

## Verification Requirements
- What needs manual verification
- What can be automated

## Role-Specific Guidance
### Developer
- Dev-specific considerations

### Analyst  
- Analyst-specific considerations

### Architect
- Architecture considerations
```

## Available Patterns

- `message-conversion-patterns.md` - Convert between message formats (MT103→CAMT, etc.)
- `reconciliation-patterns.md` - Reconcile message types against masters
- `validation-patterns.md` - Validate message content
- `integration-patterns.md` - Build integration services
- `transformation-patterns.md` - Transform data structures

## Usage

Query Page loads patterns based on:
1. Keywords detected in natural language query
2. User's role (developer, analyst, architect)
3. Best-match pattern selection

## Adding New Patterns

1. Create new `.md` file in this directory
2. Follow the standard structure
3. Include keywords, detection rules, and solution steps
4. Restart backend to pick up new patterns

## Example Query Resolution

**Query**: "Convert MT103 to CAMT.053"
1. Backend loads all patterns
2. Matches "message-conversion-patterns.md" based on keywords
3. Applies role-specific guidance
4. Queries APIs for resources
5. Returns structured solution steps
