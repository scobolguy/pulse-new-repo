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

Desktop hosted services can additionally `use "JSONArrays"` for `JSONArray`: `load`,
`serialize`, `count`, zero-based `item`, `append`, `replace`, `remove` and `formatted(indent)`.
Items are serialized JSON values, not text implicitly coerced into strings. Array types,
JSON syntax and indices are checked; indentation must be an integer from 0 through 10.
These wrappers use `host.json_array_*` and `host.json_format`. They retain Unicode/escaped
strings and JSON value types. Their serialized-text implementation reparses on each call
and remains subject to the host's result, instruction and execution budgets.

The array extension is a separate [library](../virtualMachines/esp32/aggregator/libraries/JSONArrays/JSONArrays.pas)
because its bindings are desktop-only. Merely using the existing `JSON` object library
does not introduce new desktop-only calls or change its declared targets. ESP32 image
generation rejects the new array calls explicitly; ESP32 transport/chunking is unchanged.

## Data Librarian Policy

The Data Librarian keeps its HTTP API and non-XSD schema parsing in Node.js. XSD structure
extraction now runs in Pascalish, as described below. Subschema field-access
validation runs as a hosted Pascalish policy in
`virtualMachines/esp32/src/librarian/subschema-policy.pas`; it uses the `JSON` library while
Node supplies the parent schema's flattened field paths. Catalog persistence now runs in a
separate hosted Pascalish service, described below.
The policy integration check is `npm run test:librarian:subschema-policy` from
`virtualMachines/esp32/aggregator`.
Run `npm run test:librarian:policy-parity` to compare the current service against the
original Node-only Librarian from `a49a70ca^`. The test uses temporary catalogs and checks
HTTP responses, persisted contracts, Unicode, long paths, chunk boundaries, concurrent
validation, and errors. It also reports local HTTP timings as an indication of policy
overhead, not a production benchmark.
Policy tokens preserve UTF-16 code units so distinct JavaScript field paths remain distinct,
even when they contain unpaired surrogates.

## XML Library and XSD Structure Extraction

Desktop services can `use "XML"` for the
[`XMLDocument` class](../virtualMachines/esp32/aggregator/libraries/XML/XML.pas).
`load(text)` parses XML into a document handle. `count`, `localName`, `namespaceURI`,
`attribute`, `attributeInteger(node, name, fallback)`, `qualifiedLocal`,
`qualifiedNamespace`, `firstChild`, `nextSibling`, `subtreeEnd` and `textValue`
provide checked navigation and namespace-aware access. Node indices are zero-based;
missing children/siblings return -1, and `subtreeEnd` is an exclusive preorder index.
Optional missing attributes return an empty string; integer attributes use the explicit
fallback only when absent. Direct text includes decoded entities and CDATA, not descendant
text. Handles are valid only for the current service invocation, not subsequent requests.

XML tokenization and well-formedness checks use the existing `fast-xml-parser` host
dependency; the Pascalish library wraps generic desktop bindings, not an XSD-specific
JavaScript parser. DTDs, external/custom entities, unbound prefixes, invalid characters,
duplicate expanded attributes and multiple roots are rejected. The host also retains
the dependency's rejection of dangerous JavaScript property names. Documents are bounded
by the service body-byte budget, 20000 aggregate element nodes, depth 64 and eight handles.
These bindings are desktop-only; ESP32 compilation/image checks reject their use.

[`xsd-parser.pas`](../virtualMachines/esp32/src/librarian/xsd-parser.pas) owns XSD
namespace recognition, named simple-type enum collection and recursive construction of
the existing Librarian tree shape. It handles `element`, `complexType`, `sequence`,
`choice`, `all` and content/extension/restriction wrappers, including `minOccurs`
optionality. QName matching uses namespace identity, independent of prefix spelling.
Annotations/comments no longer corrupt the parent stack, single-quoted attributes and
escaped text work, and foreign-namespace elements do not masquerade as XSD declarations.
The [thin adapter](../virtualMachines/esp32/aggregator/src/librarian/xsd-parser.mjs)
compiles and dispatches; Node retains schema-file discovery, encoding conversion and HTTP.
The adapter caches serialized trees by source-content hash, bounded at 256 entries and
8000000 bytes, and coalesces simultaneous identical requests. Callers receive independent
trees, changed content is reparsed, and failures are never cached. This avoids rerunning
the VM on every unchanged catalog read; first-time parsing of the full corpus is
substantially slower than the old regex implementation (about 30 seconds locally).

This is structure extraction, **not full XSD validation**. Named complex-type references,
element references, simple-type inheritance, imports/includes and complete facets/cardinality
semantics are not expanded or validated. It makes no network requests. Well-formed non-XSD
XML and schemas without displayable nodes return null. Malformed XML/XSD attribute values
fail explicitly rather than silently appearing as an unavailable structure.

The internal XSD host opts into `desktopBudget: true`, allowing up to 10000000 instructions,
with a 10000 ms execution deadline, 1000000-byte input/output limits and 256 admitted
events. The JavaScript runtime's default ceiling remains 200000 instructions, the hosted
service default remains 100000, and ESP32 budgets and chunked transport are unchanged.
The larger desktop ceiling is bounded and granted by trusted host configuration, not P-code.

Run `node --test testing\pmachines\xml-xsd.test.mjs testing\pmachines\librarian-http-catalog.test.mjs`
from the ESP32 workspace. Tests cover XML contracts, corrected XSD behavior, original-parser
parity on its correctly parsed subset, all 123 checked-in XSDs, concurrent admission,
UTF-16 HTTP listings, subschema validation/projection, malformed input and recovery.

## Data Librarian Catalog Persistence

[`catalog-store.pas`](../virtualMachines/esp32/src/librarian/catalog-store.pas) owns the
allowlisted filenames and filesystem reads/atomic writes for `subschemas`, `data-types`,
`mapper-rulesets` and `schema-lifecycle`. Its `JSONDocument` envelopes validate JSON before
writing. The [Node adapter](../virtualMachines/esp32/aggregator/src/librarian/catalog-store.mjs)
only dispatches in-process events and serializes values; it does not implement a fallback
catalog writer. Catalog uploads use the same Pascalish writer and preserve supplied formatting.

The desktop service receives a writable `catalog` root and read-only `legacy` root from
trusted startup configuration. Only legacy `data-types.json` is exposed by that service.
Directory creation and legacy-path migration remain Node startup responsibilities; schema
files, schema parsing, normalization and HTTP routing remain Node responsibilities.
Subschema mutations now run in Pascalish as described below; the other catalogs still
have Node read/modify/write orchestration. This is not yet a fully Pascalish Librarian.

Missing catalogs retain the existing empty defaults. Corrupt JSON, invalid UTF-8, incorrect
catalog shapes, linked files and storage failures now surface as errors instead of being
silently treated as empty catalogs. Storage-layout initialization fails startup explicitly.
This intentional error-handling change prevents a later update from overwriting a corrupt
catalog under the assumption that it was empty.

The file budget defaults to 262144 bytes; configure `LIBRARIAN_CATALOG_MAX_BYTES` for larger
local catalogs (1..1000000). Internal event/response envelopes are bounded at 1000000 bytes,
so escaped write requests may reach that bound before the file budget. The local catalog
host has a bounded 64-event queue, independent of ESP32 network chunking. Atomic writes
protect individual file replacement. Subschema mutations additionally check their
snapshots; the other catalogs and multi-file updates are not transactions.

Run `node --test testing\pmachines\librarian-catalog-store.test.mjs` from the ESP32 workspace.
The old/new parity script also checks all four persisted catalogs and their formatting.

Data Librarian `import ... from data librarian` declarations are parsed metadata in
`programMap.librarianImports`; they do not attach runtime catalog data or fetch remote types.

### Subschema CRUD

The catalog service owns subschema duplicate detection, array insertion/replacement,
ID rename, deletion and parent-schema path updates. Each mutation reads the current
file, checks a snapshot and atomically writes within one serialized host event.
HTTP responses are projected from the definition returned by that event, rather than
rereading a catalog that another request may already have changed.

Node still normalizes the snapshot and validates requested fields against the physical
parent schema before submitting a mutation. Pascalish compares the raw expected snapshot
to the freshly read catalog before using its normalized entries. Formatting differences
do not cause conflicts. A stale snapshot returns an internal retryable 409; Node refreshes
the snapshot and, for updates, remerges and revalidates the request. There are at most 32
attempts, after which the conflict is returned explicitly. Real duplicates return 409
without retry; missing IDs return 404.

This prevents successful concurrent subschema operations from silently replacing one
another, including operations interleaved with catalog imports within the same service.
It is not a cross-process lock: external writers must not concurrently mutate the
operator-owned storage, and physical schema rename/lifecycle changes are still separate
operations rather than a multi-file transaction.

The HTTP integration test covers 24 simultaneous creates, competing duplicate IDs,
partial updates of the same record, concurrent deletes and parent-schema rename.
Run `node --test testing\pmachines\json-collection-bindings.test.mjs testing\pmachines\librarian-http-catalog.test.mjs`
from the ESP32 workspace.

## Best Practices

- keep declarations clear and top-level
- keep mapper/routing names stable for downstream references
- prefer small, testable units over one large source file
- compile after each significant change

## Troubleshooting

- If compile fails, verify file extension is `.pas` and mode is supported.
- If a referenced interop target is missing, ensure the target document exists in the develop workspace.
