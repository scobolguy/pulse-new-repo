# Router/Mapper Pascal-ish DSL

This DSL is designed for queue routing and message mapping, then compiled into JSON artifacts that can be executed by the existing router engine and PL/0 interpreter.

## 1) Concrete DSL

Top-level declarations:
- SERVICE "service-id";
- ROUTER ... END;
- MAPPER ... END;

### Router syntax

ROUTER "rule-id" INPUT "queue.name" [DESCRIPTION "text"] [ENABLED TRUE|FALSE] [SERVICE "service-id"] BEGIN
  OUTPUT "queue.name" WHEN "<pl0-when>" TRANSFORM "<pl0-transform>";
  ...
END;

Notes:
- WHEN and TRANSFORM are PL/0 snippets as quoted strings.
- WHEN and TRANSFORM can also be unquoted PL/0 blocks using BEGIN ... END.
- WHEN should produce output truthy/falsy.
- TRANSFORM should assign to output (for example: output := src;).
- map("mapping-id", payload) is supported in transform snippets by the router runtime.

Block form example:

OUTPUT "payments.mt103"
  WHEN BEGIN
    IF startswith(upper(src), "MT103") THEN output := 1 ELSE output := 0;
  END
  TRANSFORM BEGIN
    output := src;
  END;

### Mapper syntax

MAPPER "mapping-id" SOURCE "source-type" TARGET "target-type" [DESCRIPTION "text"] [ENABLED TRUE|FALSE] BEGIN
  MAP "source.path" TO "target.path" [USING "<pl0-conversion>"];
  ...
END;

Notes:
- USING defaults to output := src; when omitted.
- Each USING expression is PL/0 and is validated at compile time.
- USING accepts either a quoted PL/0 string or an unquoted BEGIN ... END PL/0 block.

Block form example:

MAP "finEnvelope.block4.fields.20" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId"
  USING BEGIN
    output := trim(src);
  END;

## 2) Compiler pipeline

Input:
- data/router-mapper.dsl

Compiler:
- scripts/compile-router-mapper-dsl.mjs

Output artifacts:
- data/router-rules.generated.json
- data/data-mappings.generated.json
- data/router-mapper-compiled.json (contains AST + emitted artifacts)

The compiler flow is:
1. Tokenize DSL
2. Parse DSL to AST
3. Walk AST and emit router + mapper artifacts
4. Validate all embedded PL/0 snippets with the PL/0 parser
5. Write generated artifacts

## 3) Run compiler

node scripts/compile-router-mapper-dsl.mjs \
  --in data/router-mapper.dsl \
  --router-out data/router-rules.generated.json \
  --mapping-out data/data-mappings.generated.json \
  --artifact-out data/router-mapper-compiled.json

## 4) Example

See data/router-mapper.dsl for concrete examples including nested map(...) transforms.
