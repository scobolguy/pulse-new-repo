# Workflow DSL (Separate Compiler)

This DSL is intentionally compiled by a separate compiler from the router-mapper DSL so it can evolve independently.

Source file extension:
- .wfl

Compiler:
- scripts/compile-workflow-dsl.mjs

Default input:
- data/workflow.wfl

Generated outputs:
- data/symbols.generated.json
- data/workflows.generated.json
- data/workflow-compiled.json

## Syntax

Queue symbol:

QUEUE "symbol" -> "physical.queue.name" TYPE "type-id";
QUEUE "symbol" -> "physical.queue.name" TYPES ("type-a", "type-b");

File symbol:

FILE "symbol" -> "/absolute/or/virtual/path";

API symbol:

API "symbol" BASE "http://host:port";

Workflow block:

WORKFLOW "workflow-id" BEGIN
  STEP "step-id" CALL API "api-symbol" POST "/relative/route";
END;

Comments:

- `#` for full-line comments
- `--` for inline comments (preferred)
- `//` for inline comments (legacy)

Example:

API "aggregator" BASE "http://localhost:4000"; -- local backend

## Run

npm run compile:workflow
npm run interpret:workflow

Or with custom paths:

node scripts/compile-workflow-dsl.mjs \
  --in data/workflow.wfl \
  --symbols-out data/symbols.generated.json \
  --workflow-out data/workflows.generated.json \
  --artifact-out data/workflow-compiled.json

Interpret and execute one workflow:

node scripts/interpret-workflow.mjs \
  --in data/workflow.wfl \
  --workflow enqueue-pacs

Dry run (no API calls):

node scripts/interpret-workflow.mjs \
  --in data/workflow.wfl \
  --workflow enqueue-pacs \
  --dry-run
