# Pascalish User Guide

## What Pascalish Is

Pascalish is a Pascal-style DSL used in this repository for routing/mapper and interop-oriented orchestration.

Common uses:
- define service/router/mapper logic
- describe queue routing and mapping behavior
- interoperate with WFL and COBOLISH documents

## File Type

- Extension: `.pas`
- Editor language id: `pascalish`

## Quick Start

Create a new Pascalish document using the develop workspace API:

```http
POST /api/develop/files
Content-Type: application/json

{
  "typeId": "pascalish"
}
```

## Minimal Example

```pascal
program "router-mapper-sample";
role code_librarian;
library "core-shared" from librarian;
interop wfl "payment-workflow" as wf;

var mt103Message : swift-mt103 from librarian;
```

## Compile Pascalish

```http
POST /api/develop/compile
Content-Type: application/json

{
  "fileName": "router-mapper-sample.pas",
  "mode": "compile"
}
```

Modes:
- `compile`
- `compile-run`
- `compile-debug`

## Interop Patterns

Typical interop declarations:

```pascal
interop wfl "payment-workflow" as wf;
interop cobolish "legacy-transform" as legacy;
```

## JSON Library

The built-in `JSON` Pascalish library provides a `JSONDocument` class for JSON objects in hosted services.
Load serialized JSON with `load`, access required fields through `text`, `intValue`,
`value`, `pathText`, and `pathInteger`, and update the document with `setText`,
`setInteger`, `setBoolean`, `embed`, `merge`, and `appendText`. These helpers use the
runtime's checked JSON implementation; malformed JSON, missing fields, and type mismatches
are errors rather than silent defaults.

```pascal
use "JSON";
var request: JSONDocument;

request.load(host.event_body());
request.setText('normalizedName', request.pathText('person.name'));
return request.serialize()
```

## Data Librarian Policy

The Data Librarian keeps its HTTP API and catalog storage in Node.js. Subschema field-access
validation runs as a hosted Pascalish policy in
`virtualMachines/esp32/src/librarian/subschema-policy.pas`; it uses the `JSON` library while
Node supplies the parent schema's flattened field paths and persists catalog changes.
The policy integration check is `npm run test:librarian:subschema-policy` from
`virtualMachines/esp32/aggregator`.

## Best Practices

- keep declarations clear and top-level
- keep mapper/routing names stable for downstream references
- prefer small, testable units over one large source file
- compile after each significant change

## Troubleshooting

- If compile fails, verify file extension is `.pas` and mode is supported.
- If a referenced interop target is missing, ensure the target document exists in the develop workspace.
