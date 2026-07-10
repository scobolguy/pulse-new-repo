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

Generic declarations are also available on Pascalish type and class definitions:

```pascal
type box<T> = record
  value : T;
end;

class repository<T>;
  items : array<integer> of T;
end;
```

## Classes

Pascalish classes are declaration-level types that compile down as type metadata and remain compatible with existing pcode machines because runtime execution still depends on ordinary statements and pcode opcodes.

```pascal
class account<T> extends repository<T>;
  id : string;
  procedure load(item : T);
  begin
    call process(item);
  end;
end;
```

Supported class syntax includes:
- generic parameters on the class name
- optional `extends` base type
- typed fields
- `procedure` and `function` members with typed parameters and optional return types

Current compiler lowering rules:
- class and type declarations are preserved in compiled artifacts as `classDeclarations`, `typeDeclarations`, and `variableDeclarations`
- class methods lower to ordinary pcode procedures using namespaced labels such as `repository.add -> PROC_REPOSITORY_ADD`
- `self.field` and bare field references inside class methods lower to singleton class storage such as `counterBox.count -> counterBox__self__count`
- top-level references like `counterBox.count` target the same singleton class storage, so class state remains accessible without new runtime opcodes
- no new object runtime or pcode opcodes are required, so generated programs remain compatible with the existing JS and ESP32 pcode machines

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
