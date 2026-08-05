# Routing/Transformer Pascal-ish DSL

This DSL is designed for queue routing and message transformation, then compiled into JSON artifacts that can be executed by the existing routing engine and PL/0 interpreter. Older artifacts may still use mapper terminology for compatibility.

Terminology used in this document:
- Router: reads a message and emits one or more queue deliveries.
- Transformer (Mapper): changes payload shape/content between source and target schemas.
- Flow: a broader pipeline that can include both routing and transformation stages.

## 1) Concrete DSL

Top-level declarations:
- SERVICE "service-id";
- ROUTER ... END; (legacy keyword retained for compatibility)
- MAPPER ... END; (mapper keyword represents transformer declarations)

### Routing syntax (legacy ROUTER keyword)

ROUTER "rule-id" INPUT "queue.name" [DESCRIPTION "text"] [ENABLED TRUE|FALSE] [SERVICE "service-id"] BEGIN
  OUTPUT "queue.name" [TYPE "type-id" | TYPES ("type-a", "type-b", ...)] WHEN "<pl0-when>" TRANSFORM "<pl0-transform>";
  ...
END;

Notes:
- WHEN and TRANSFORM are PL/0 snippets as quoted strings.
- WHEN and TRANSFORM can also be unquoted PL/0 blocks using BEGIN ... END.
- WHEN should produce output truthy/falsy.
- TRANSFORM should assign to output (for example: output := src;).
- map("mapping-id", payload) is supported in transform snippets by the routing runtime.
- TYPE sets a single queue type for auto-created output queues.
- TYPES sets a set of allowed queue types for auto-created output queues.
- Comments follow standard Pascal forms: `{ ... }` or `(* ... *)`.

Block form example:

OUTPUT "payments.mt103"
  TYPE "swift-mt103"
  WHEN BEGIN
    IF startswith(upper(src), "MT103") THEN output := 1 ELSE output := 0;
  END
  TRANSFORM BEGIN
    output := src;
  END;

OUTPUT "correspondent.pacs008.outbound"
  TYPES ("pacs", "pacs-lynx")
  WHEN "output := 1;"
  TRANSFORM "output := src;";

### Transformer syntax (MAPPER keyword)

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
- scripts/compile-pascal.mjs
- scripts/compile-pascal-to-pcode.mjs

Output artifacts:
- data/router-rules.generated.json
- data/data-mappings.generated.json
- data/router-mapper-compiled.json (contains AST + emitted artifacts)
- ../pcode/router-mapper.pcode (portable pcode text)
- ../pcode/router-mapper.program.json (symbol and metadata sidecar)

The compiler flow is:
1. Tokenize DSL
2. Parse DSL to AST
3. Walk AST and emit router + transformer artifacts
4. Validate all embedded PL/0 snippets with the PL/0 parser
5. Write generated artifacts

## 3) Run compiler

node scripts/compile-pascal.mjs \
  --in data/router-mapper.dsl \
  --router-out data/router-rules.generated.json \
  --mapping-out data/data-mappings.generated.json \
  --artifact-out data/router-mapper-compiled.json

Compile to portable pcode for PMachine runtimes:

node scripts/compile-pascal-to-pcode.mjs \
  --in data/router-mapper.dsl \
  --out ../pcode/router-mapper.pcode \
  --map-out ../pcode/router-mapper.program.json \
  --manifest ../pcode/pcode-opcodes.manifest.json

Run generated .pcode on the JavaScript PMachine runtime:

node scripts/run-js-pmachine.mjs \
  --pcode ../pcode/router-mapper.pcode \
  --program-map ../pcode/router-mapper.program.json \
  --input-queue swift.mt103.parsed \
  --message "MT103 SAMPLE"

## 4) Example

See data/router-mapper.dsl for concrete examples including nested map(...) transforms.
