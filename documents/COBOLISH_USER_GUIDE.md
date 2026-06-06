# COBOLISH User Guide

## What COBOLISH Is

COBOLISH is a COBOL85-style language profile in this repository for legacy-friendly logic and structured interop.

It is designed to interoperate with:
- WFL flows
- Pascalish programs

## File Type

- Extension: `.cob`
- Editor language id: `cobolish`

## Quick Start

Create a new COBOLISH document:

```http
POST /api/develop/files
Content-Type: application/json

{
  "typeId": "cobolish"
}
```

## Minimal Example

```cobol
IDENTIFICATION DIVISION.
PROGRAM-ID. CUSTOMER-ROUTER.
DATA DIVISION.
WORKING-STORAGE SECTION.
01  CUSTOMER-ID        PIC X(20).
01  CUSTOMER-BALANCE   PIC 9(9)V99.
PROCEDURE DIVISION.
    INTEROP WFL "payment-workflow" AS ROUTING-FLOW.
    INTEROP PASCALISH "router-mapper" AS ROUTER-MAPPER.
    DISPLAY "COBOLISH READY".
    GOBACK.
END PROGRAM CUSTOMER-ROUTER.
```

## Compile COBOLISH

```http
POST /api/develop/compile
Content-Type: application/json

{
  "fileName": "customer-router.cob",
  "mode": "compile"
}
```

Compiler output summary includes:
- program id
- section count
- paragraph count
- data item count
- interop count
- syntax error count

## CALL / EVALUATE Tips

- Use explicit CALL USING modes where needed (`BY REFERENCE`, `BY CONTENT`, `BY VALUE`).
- Keep `EVALUATE` branches explicit and test with intentionally invalid cases during hardening.

## Best Practices

- keep divisions in canonical order
- keep data names consistent with interop contracts
- isolate interop declarations in predictable locations
- compile frequently during grammar-heavy edits

## Troubleshooting

- If compile rejects the source, check for syntax errors in division/statement terminators.
- If interop bindings fail, confirm referenced Pascalish/WFL artifacts exist.
