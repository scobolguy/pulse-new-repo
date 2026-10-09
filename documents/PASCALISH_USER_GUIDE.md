# Pascalish User Guide

An `.mjs` adapter prefixed with `~` is retained for Node integration where the
same-named Pascalish module owns the implementation policy. The tilde is part of
the filename and all imports must use it.

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
Pascalish collects the parent schema's flattened field paths. Catalog persistence now runs in a
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

### Schema field paths and subschema projection

[`schema-tree.pas`](../virtualMachines/esp32/src/librarian/schema-tree.pas) owns
preorder field-path collection and ancestor/descendant subschema filtering. The
[Node adapter](../virtualMachines/esp32/aggregator/src/librarian/schema-tree-service.mjs)
only dispatches events and caches serialized results; Node retains catalog response
wrappers, normalization and HTTP routing. JSON/XML/copybook trees use the same rules:
unnamed nodes, `root` and XSD container types do not add path segments; named branches
and leaves do. Paths are unique in first-occurrence order. Projection retains the entire
node metadata and replaces only `children`; an inaccessible branch is omitted.
Creation/update validates the projected result before catalog mutation and reuses that
result with the committed definition, so a projection budget failure cannot first persist
a definition that cannot be returned.

Traversal uses invocation-local generic JSON value handles and an explicit JSON-array
frame stack, not recursive VM calls or repeated full-subtree parsing. Tree depth does not
consume the VM's call-depth budget. Desktop events/results remain bounded at
1000000 bytes, with 10000000 instructions, 10 seconds and a 256-event queue. Capacity or
execution failures are explicit; there is no truncated-success fallback. The adapter
coalesces identical pending work and caches at most 256 entries/32 MB, keyed by UTF-16LE
content identity; results are independent copies and tree edits cannot reuse stale paths.

Physical-schema editors request `GET /api/librarian/schema-fields?path=...`, returning
`{path, availableFields}`. Existing schema/catalog responses are unchanged. The UI shows
loading/errors and disables saving until fields load; it no longer traverses a physical
schema to construct its field options. Existing virtual schemas use their `availableFields`.
The bounded/chunked ESP32 membership policy is unchanged; the tree service and generic
Unicode text/JSON collection helpers are desktop-only.

Run `node --test testing\pmachines\librarian-schema-tree.test.mjs testing\pmachines\librarian-http-catalog.test.mjs`
from the ESP32 workspace for traversal parity, metadata, depth, concurrency and API tests.

## XML Library and XSD Structure Extraction

Desktop services can `use "XML"` for the
[`XMLDocument` class](../virtualMachines/esp32/aggregator/libraries/XML/XML.pas).
`load(text)` parses XML into a document handle. `count`, `localName`, `namespaceURI`,
`attribute`, `hasAttribute`, `attributeInteger(node, name, fallback)`, `qualifiedLocal`,
`qualifiedNamespace`, `parentNode`, `firstChild`, `nextSibling`, `subtreeEnd` and `textValue`
provide checked navigation and namespace-aware access. Node indices are zero-based;
missing children/siblings return -1, and `subtreeEnd` is an exclusive preorder index.
Optional missing attributes return an empty string; integer attributes use the explicit
fallback only when absent. `hasAttribute` distinguishes an explicitly empty value from
a missing attribute (important for enumeration facets). Direct text includes decoded
predefined/numeric entities and CDATA, not descendant
text. Handles are valid only for the current service invocation, not subsequent requests.
`appendDocument(donorHandle)` moves a parsed donor into the receiving document's forest,
returns its new root index and invalidates the donor handle. Existing indices and each
root's exclusive subtree end remain stable; roots are linked through `nextSibling`,
and each root has parent -1. QName scopes are preserved, not rewritten by the receiver.

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
The [thin adapter](../virtualMachines/esp32/aggregator/src/librarian/~xsd-parser.mjs)
compiles and dispatches; Node retains schema-file discovery and HTTP. The constructor
requires an explicit `schemaRoot`, granted read-only to the internal service.
The adapter caches serialized trees by source-content hash, bounded at 256 entries and
32000000 bytes, and coalesces simultaneous identical requests. Callers receive independent
trees, changed content is reparsed, and failures are never cached. File-backed parsing
keys entries by confined entry path and rechecks every dependency's content hash before
reuse (not just size/mtime); includes changing, disappearing or becoming links cannot
hide behind cached trees. Hashes preserve UTF-16 code units. This avoids rerunning
the VM on every unchanged catalog read. The byte limit was raised from 8000000 for
expanded trees, and the corpus test verifies that all checked-in schemas fit together.
Larger catalogs can still evict entries before the entry-count limit. First-time parsing
of the expanded corpus is substantially slower than the old regex implementation:
the dependency-aware file path measured about 184 seconds cold and 296 ms for the
complete cached reread locally. Cache eviction requires reparsing.

Named global complex types and global element `ref` occurrences are expanded within
the loaded schema graph. Resolution uses the QName's in-scope namespace and the schema's
`targetNamespace`; an unprefixed QName does not implicitly acquire the target namespace.
Forward declarations and namespace aliases work, occurrence `minOccurs` is preserved,
and referenced declarations retain their own QName scope. Complex-content `extension`
adds known base-type fields before its own fields. Standalone named declarations remain
in the top-level catalog tree for compatibility. Included same-namespace declarations
join that tree; imported declarations supply reference expansion but are not separate
top-level display nodes.

`parseFile(relativePath)` loads local `include` and `import` dependencies in Pascalish
through the explicit `schemas` filesystem grant. `schemaLocation` is resolved relative
to the referring file; `.` and `..` are allowed only while remaining inside the root.
Absolute paths, URLs, UNC paths, backslashes, URI query/fragment/percent encodings,
alternate streams, links/junctions and hardlinks are rejected. There is no network fetch
or filesystem search by namespace. Missing explicit locations are errors; an `import`
without a location does not trigger loading and leaves references unresolved unless
that namespace was already loaded by another explicit import in the graph.
Includes require the same target namespace or adopt it for a no-target-namespace
chameleon schema. Imports require their declared namespace to match the target file,
including explicit no-namespace imports. Import declarations must be present for
foreign references to resolve; merely loading another namespace elsewhere is not enough.
Graph diamonds/cycles are deduplicated by confined path plus effective namespace;
a chameleon file can be instantiated in different namespaces. The graph is bounded at
16 document instances, 1000000 aggregate decoded UTF-8 source bytes and 20000 element
nodes, in addition to existing output/VM limits. Each physical read is also limited to
1000000 bytes. UTF-8 and BOM-marked UTF-16 LE/BE are decoded strictly; the prior UTF-16 LE
zero-byte heuristic remains for BOM-less files.

`parse(content)` remains a single-document API: it does not load file dependencies.
`parseFile` is the Librarian path. `xml:base`, `redefine` and `override` are explicitly
unsupported in the linked graph, not silently treated as ordinary includes.
Dependency reads are confined but are not a cross-file atomic snapshot; schema roots
retain the operator-owned/no-untrusted-path-replacement assumption of the filesystem
adapter. A modification during a parse can require the next request to refresh the graph.

Expanded elements keep their declared `valueType` and gain `typeReference` metadata;
element refs gain `reference`. Metadata identifies `{kind, name, namespace}`. Cycles are
cut on the current ancestry path, not globally: sibling occurrences still expand
independently. A cycle remains a branch with `recursive: true` and empty children.
After traversal depth 8 or 1000 emitted nodes, further descendant expansion stops;
siblings remain visible, so 1000 is an expansion-admission threshold, not a total output
node cap. Such branches carry `truncated: true` and `truncationReason: "depth"` or
`"nodes"`. Output bytes, VM instructions and execution time remain hard limits.
Unloaded foreign-namespace references are retained with `unresolved: true`, not guessed by local
name; missing same-namespace references and duplicate referenced global declarations
fail explicitly. The UI and spoken summaries distinguish these branches from scalar
leaves. Subschema field paths include expanded descendants but cannot claim descendants
beyond a recursion, unresolved-reference or truncation boundary.

This is structure extraction, **not full XSD validation**. Attribute/group references
and complete facets/cardinality
semantics are not expanded or validated. Restrictions do not inherit all base particles.
It makes no network requests. Well-formed non-XSD
XML and schemas without displayable nodes return null. Malformed XML/XSD attribute values
fail explicitly rather than silently appearing as an unavailable structure.

The internal XSD host opts into `desktopBudget: true`, allowing up to 10000000 instructions,
with a 10000 ms execution deadline, 1000000-byte input/output limits and 256 admitted
events. The JavaScript runtime's default ceiling remains 200000 instructions, the hosted
service default remains 100000, and ESP32 budgets and chunked transport are unchanged.
The larger desktop ceiling is bounded and granted by trusted host configuration, not P-code.

Run `node --test testing\pmachines\xml-xsd.test.mjs testing\pmachines\xsd-references.test.mjs testing\pmachines\xsd-links.test.mjs testing\pmachines\librarian-http-catalog.test.mjs`
from the ESP32 workspace. Tests cover XML contracts, corrected XSD behavior, original-parser
parity on its correctly parsed subset, all 123 checked-in XSDs, concurrent admission,
UTF-16 HTTP listings, named/reference expansion, inheritance, self/mutual recursion,
exact admission limits, UI branch notices, subschema validation/projection, malformed input
and recovery. Link tests also verify namespace mismatches, diamonds/cycles, chameleon
schemas, exact graph limits, confined path denial, link denial and dependency-cache
invalidation after same-size/same-mtime edits.

### Simple-type inheritance, lists and unions

Global simple types are indexed by namespace identity and resolved on use. Atomic
restrictions without local `enumeration` facets inherit the base's enum strings;
local enumeration facets replace the inherited set rather than concatenating it.
Inline element `simpleType` declarations and inline restriction bases work through
the same resolver, including chameleon includes, explicit imports and global element
refs. Anonymous element types use `valueType: "simple"` and do not contribute extra
field-path segments. Named types keep their declared `valueType`.

`isEnum` and `enumValues` keep their existing output shape. Values are decoded XML
lexical strings, including empty values and Unicode, deduplicated in declaration order.
Only direct enumeration children of the restriction are considered: nested member/item
facets are never mistakenly gathered as the enclosing type's enums.

List and union elements additionally expose `simpleType` metadata:
`{variety, finite, enumValues, itemType?, members?, containsList?}`.
Lists preserve resolved item-type metadata but do not inherit item enums as whole-list
enums: a list of `A` and `B` permits arbitrarily long sequences. A restriction can
explicitly enumerate list values such as `"A B"` and `"B A"`. Built-in `NMTOKENS`,
`IDREFS` and `ENTITIES` are recognized as lists. Lists of lists (including unions
containing list members as a list's item type) fail explicitly.

Unions combine whitespace-separated `memberTypes` and inline member declarations.
A union exposes top-level enum values only when every member has a finite, complete
enum set. An unrestricted builtin, list member or unresolved/cyclic/truncated member
does not masquerade as a finite union. Such members retain their own metadata for
inspection. Local restriction enums can still explicitly narrow an otherwise open
union. The UI and accessibility labels describe list item enums and union membership
separately from whole-value enum badges.

Simple-type resolution follows at most eight definitions per path. Cycles and depth
limits propagate the existing `recursive`/`truncated` markers, empty tree children and
reference metadata; unavailable imports propagate `unresolved`. Missing loaded/local
base types, conflicting derivation forms, missing facet values and invalid inline/type
combinations are explicit errors. Successful complete resolutions are memoized within
the invocation by definition and resolution depth. The hard resolution-work ceiling is
10000 uncached definition visits, in addition to XML, instruction, time and byte budgets.

These are **lexical metadata**, not value-space validation: numeric equivalents,
whitespace facets, regex patterns, ranges, lengths and compatibility of explicit enum
values with the base are not evaluated. Additional facets may narrow inherited enum
candidates. Unused global definitions are not fully validated, and simple-content
complex types do not yet inherit scalar enum metadata. This is not an XSD validator.

Run `node --test testing\pmachines\xsd-simple-types.test.mjs testing\pmachines\librarian-http-catalog.test.mjs`
for inherited/inline/list/union enums, linked definitions, cycles, exact depth limits,
numeric entity decoding, invalid-shape recovery and HTTP projection checks.

## Data Librarian Catalog Persistence

[`catalog-store.pas`](../virtualMachines/esp32/src/librarian/catalog-store.pas) owns the
allowlisted filenames and filesystem reads/atomic writes for `subschemas`, `data-types`,
`mapper-rulesets` and `schema-lifecycle`. Its `JSONDocument` envelopes validate JSON before
writing. The [Node adapter](../virtualMachines/esp32/aggregator/src/librarian/~catalog-store.mjs)
dispatches in-process events, serializes values and coordinates bounded snapshot retries;
it does not implement a fallback
catalog writer. Catalog uploads use the same Pascalish writer and preserve supplied formatting.

The desktop service receives a writable `catalog` root and read-only `legacy` root from
trusted startup configuration. Only legacy `data-types.json` is exposed by that service.
Directory creation and legacy-path migration remain Node startup responsibilities; schema
files, schema parsing, normalization and HTTP routing remain Node responsibilities.
All four catalogs now have Pascalish mutation policy as described below. Record
normalization, mapper list ordering, date validation, lifecycle status calculation and
HTTP routing remain in Node. This is not yet a fully Pascalish Librarian.

Missing catalogs retain the existing empty defaults. Corrupt JSON, invalid UTF-8, incorrect
catalog shapes, linked files and storage failures now surface as errors instead of being
silently treated as empty catalogs. Storage-layout initialization fails startup explicitly.
This intentional error-handling change prevents a later update from overwriting a corrupt
catalog under the assumption that it was empty.

The file budget defaults to 262144 bytes; configure `LIBRARIAN_CATALOG_MAX_BYTES` for larger
local catalogs (1..1000000). Internal event/response envelopes are bounded at 1000000 bytes,
so escaped write requests may reach that bound before the file budget. The local catalog
host has a bounded 64-event queue, independent of ESP32 network chunking. Atomic writes
protect individual file replacement. Mutations of all four catalogs check their
snapshots. Multi-file updates are not transactions.

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

### Data type, mapper ruleset and lifecycle CRUD

The same Pascalish catalog service owns duplicate/not-found decisions, insertion,
replacement, ID rename, deletion and partial-update merges for data types and mapper
rulesets. Lifecycle updates, key deletion and schema-rename key moves also run there.
Node no longer implements the catalog array/object mutations in the HTTP handlers.
Legacy mapper records retain the existing raw-ID mutation rules and last-valid-record
display semantics; malformed individual records are still excluded from the display,
but their normalization failures are now logged instead of silently ignored.

The internal `/catalogs/mutate` endpoint has plan and commit phases. A plan verifies the
raw snapshot and computes the mutation in Pascalish without writing. The Node adapter
invokes the Pascalish normalization service (including canonical-ID collisions and aliases), then
submits the plan and normalized content. Commit rereads the catalog, verifies the
snapshot, recomputes and checks the plan, checks the normalized shape/count and atomically
writes in one serialized event. Lifecycle content must exactly match its plan. A concurrent
mutation/import forces a fresh plan and remerge rather than overwriting the newer data.
The adapter retries at most 32 times; real duplicates/not-found and exhausted conflicts
remain explicit. Normalization failures happen before writing.

Data type normalization repairs and legacy backfill use this same snapshot-checked
operation. Backfill additionally rechecks the legacy source in both phases. Already
normalized reads and empty fallback reads do not rewrite a file. Response records come
from the committed plan/its normalization, not a racing catalog reread; rename responses
retain the existing distinction between the response record and normalized stored aliases.

Internal request/response/file budgets and the 64-event queue remain bounded. The trusted
desktop catalog host allows at most 10000000 instructions/10 seconds; default VM and
ESP32 budgets are unchanged. Array identity lookup uses invocation-local JSON handles,
avoiding repeated parsing of the entire catalog for each record. Plan and
commit envelopes contain multiple copies of catalog data, so the 1000000-byte event limit
can be reached before the configured file limit. There is no fallback write or
truncated-success result. This protects in-process mutations/imports, not external writers
or schema-file/catalog multi-file transactions. ESP32 transport and chunking are unchanged.

Run `node --test testing\pmachines\librarian-catalog-store.test.mjs testing\pmachines\librarian-http-catalog.test.mjs`
for CRUD, 24-way HTTP concurrency, snapshot retries, legacy-source races, no-write
normalization failures and corruption/size-limit recovery. The historical parity script
now checks 127 old/new HTTP comparisons, including canonical collisions, aliases, legacy
mapper duplicates/raw identities, patch semantics, error precedence and persisted formatting.

### Data type and mapper ruleset normalization

[normalization.pas](../virtualMachines/esp32/src/librarian/normalization.pas) owns data type
record/catalog normalization, custom type creation, mapper ruleset IDs and payload
validation, stored-record deduplication and priority/locale ordering. The
[Node adapter](../virtualMachines/esp32/aggregator/src/librarian/~normalization.mjs) compiles
and invokes the service; it no longer implements this normalization policy.
Canonical collisions retain the historical UTF-8 SHA-256 suffix, whereas alias and
record identities use UTF-16 code units to preserve distinct unpaired surrogates.
Extra type metadata, alias order, JavaScript coercion, persisted property order and
validation-error precedence remain compatible with the original Node implementation.
Invalid stored mapper rows produce explicit warnings and are excluded as before;
host/budget failures propagate instead of being treated as invalid individual rows.

Sorting uses iterative merge sort over invocation-local JSON handles, not recursive
calls or quadratic insertion sort. Service requests and responses are bounded at
1000000 bytes, with at most 256 pending events and 10000000 instructions/10 seconds
per invocation. Oversized input/output or exhausted budgets fail explicitly, before
catalog writes. These are desktop-only helpers; ESP32 transport and chunking are unchanged.

Run `node --test testing\pmachines\librarian-normalization.test.mjs` for direct comparison
with the original normalization functions, including coercion edge cases, Unicode,
canonical collisions, malformed rows, priorities beyond 32-bit integers and reverse-ordered
1000-record catalogs. Historical HTTP/persisted-catalog parity remains a separate check.
Non-XSD schema parsers and schema-file/catalog orchestration still remain in Node;
this milestone does not claim a fully Pascalish Librarian.

### Subschema normalization and lifecycle policy

The normalization service also owns subschema ID/label/parent normalization, field-path
coercion/deduplication/locale sorting, required-field validation and catalog normalization.
Every stored row is validated; an invalid row fails the catalog read rather than being
silently dropped. Catalog order and optional `parentTypeId` omission remain unchanged.
Normalization runs again after snapshot conflicts, before mutation commits.

The reusable desktop [SchemaPaths library](../virtualMachines/esp32/aggregator/libraries/SchemaPaths/SchemaPaths.pas)
provides `SchemaPath_Normalize`. Subschema normalization and schema-tree projection both
use it, preserving the existing case-insensitive `root` prefix removal and trimmed,
nonempty dot-segment semantics without separate walkers in Node.

Lifecycle normalization and status selection run in Pascalish using generic desktop
date primitives. Input coercion, UTC ISO formatting, invalid-date error precedence,
strict reject-after ordering, `keepForDisplay !== false`, and scheduled-before-rejected
status precedence retain historical behavior. Epoch-zero timestamps keep their original
truthiness behavior. Date/budget failures propagate; validation errors remain HTTP 400
and happen before writes. Physical and virtual schema listings share the same normalized
lifecycle display. Listing requests invoke normalization sequentially, avoiding enqueueing
an entire physical catalog beyond the bounded service queue.

The desktop date adapter supplies OS/runtime date conversion and clock semantics only;
it contains no Librarian validation or status policy. ESP32 image encoding rejects these
desktop calls, with no change to transport chunking.
Run `node --test --test-concurrency=1 testing\pmachines\librarian-normalization.test.mjs testing\pmachines\librarian-schema-tree.test.mjs testing\pmachines\librarian-http-catalog.test.mjs`
for direct legacy comparisons, shared path behavior, date/status boundaries and no-write
validation failures. Run the historical parity script separately to avoid competing
CPU-heavy compilations against the VM's bounded wall-time execution budget.

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
