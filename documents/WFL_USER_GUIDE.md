# WFL User Guide

## What WFL Is

WFL (Workflow Language) is the workflow DSL used for declarative process orchestration.

Typical capabilities:
- queue and API symbol declarations
- workflow step sequencing
- conditional routing
- issue/test/project-plan lifecycle operations

## File Type

- Extension: `.wfl`
- Editor language id: `workflow-dsl`

## Quick Start

Create a new WFL document:

```http
POST /api/develop/files
Content-Type: application/json

{
  "typeId": "workflow"
}
```

## Minimal Example

```wfl
WORKFLOW "new-workflow" BEGIN
  STEP "check-backend" CHECK API "aggregator" GET "/status" EXPECT 200 RETRIES 3 EVERY 500;
END;
```

## Example Features

WFL supports patterns such as:
- `ISSUE CREATE`
- `TESTCASE CREATE`
- `TESTPLAN CREATE` and `TESTPLAN ADD`
- `PROJECT`, `RELEASE`, `DEPLOYMENT ARTIFACT`
- nested `IF ... THEN ... ELSE ... ENDIF`

See real examples in:
- `virtualMachines/esp32/aggregator/data/workflow.wfl`

## Compile Status in Develop Workspace

Current behavior of `POST /api/develop/compile`:
- Pascalish: supported
- COBOLISH: supported
- WFL: not currently supported by that compile endpoint

So WFL is currently authored and consumed through workflow/runtime integration paths rather than the Pascalish/COBOLISH compile endpoint.

## Best Practices

- keep workflow names stable for interop consumers
- use explicit state variable names in `INTO STATE` clauses
- keep conditional trees readable (limit deep nesting)
- break large processes into subflows where possible

## Troubleshooting

- If a step references unknown queues/APIs, verify symbol table declarations are present.
- If behavior diverges at runtime, test simplified workflows first and reintroduce complexity incrementally.
