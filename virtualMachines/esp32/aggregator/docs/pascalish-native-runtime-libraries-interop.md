# Pascalish Native Runtime, Libraries, and Interop

This repository now supports native lifecycle/runtime declarations, generic type references, code librarian role governance, and language interop declarations directly in the Pascalish grammar.

## Native Runtime Units

Use exactly one runtime declaration at top-level:

```pascal
SERVICE "router-service";
PROGRAM "router-program";
DAEMON "router-daemon" REFRESH 2 S;
```

- `SERVICE`: long-lived service identity, no refresh cycle.
- `PROGRAM`: one-shot/finite runtime identity.
- `DAEMON`: continuous runtime identity with `REFRESH` interval.
- `REFRESH` unit defaults to milliseconds when omitted.
- Units: `MS`, `S`, `M`.

## Native Generics

Generic types are now part of the grammar via `typeRef`:

```pascal
VAR inbound : envelope<swift-mt103> FROM LIBRARIAN;
MAPPER "m1" SOURCE envelope<swift-mt103> TARGET envelope<pacs008> BEGIN
  MAP "src.sender" TO "dst.sender";
END;
```

`TYPE` and `TYPES` clauses on `OUTPUT` also accept generic type references.

## Code Librarian Role and Shared Code

Declare the role explicitly:

```pascal
ROLE CODE_LIBRARIAN;
```

Manage reusable shared units:

```pascal
LIBRARY "payments-common" FROM LIBRARIAN;
USE "payments-common" AS payments;
```

If libraries/uses are present and role is omitted, the compiler infers `CODE_LIBRARIAN` with governance capabilities.

## Interoperability Declarations

Declare dependencies on other language domains:

```pascal
INTEROP WFL "pain2-routing" AS routingFlow;
INTEROP COBOLISH "nostro-posting" AS coreBanking;
```

Supported interop kinds:
- `WFL`
- `WORKFLOW`
- `COBOLISH`
- `PASCALISH`

These declarations are preserved in compiled artifacts for orchestration and cross-language build tooling.

## Artifact Fields

Compiled Pascalish artifacts now include:
- `runtimeUnit`
- `roles`
- `codeLibraries`
- `uses`
- `interoperability`
- `variableDeclarations`
- `routerRules`
- `dataMappings`
