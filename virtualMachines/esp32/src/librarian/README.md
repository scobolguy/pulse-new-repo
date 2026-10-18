# Pascalish Librarian native migration

The target is one logical `pulse-data-librarian` service implemented on
ESP32-S3 using `esp32_s3_n16r8`. Pulse Filesystem remains external storage.
The desktop Librarian remains in place until full native parity is verified;
it must not become a hidden production fallback after cutover.

## Reproducible feasibility inventory

From the ESP32 project directory:

```powershell
node aggregator\scripts\audit-librarian-native.mjs
node aggregator\scripts\audit-librarian-native.mjs --derived-structures
node --test testing\pmachines\librarian-native-audit.test.mjs
```

The audit compiles every Librarian Pascalish module without installing it,
reports service identity, image size, instruction count, target eligibility,
desktop-only bindings and bindings missing from the actual native host table.
It inventories explicit desktop HTTP routes, middleware route contracts,
UI/extension/backend/Mapper references, deployment scripts and repository
schema sizes. Static
references are not proof of runtime reachability; consumer behavior still
requires parity tests. The repository corpus is not authoritative live storage.
The reported limits describe the current host, not approved increases.

The optional derived inventory parses the three largest XSD files in the
repository's top-ten size sample through the desktop Pascalish reference,
without using predigested artifacts. It reports serialized tree/result sizes
and whether the tree alone exceeds the native 20,480-byte HTTP response bound.
It is not a production fallback or an ESP32 timing/memory benchmark.

Measured repository examples:

| Schema | Source bytes | Serialized tree bytes |
| --- | ---: | ---: |
| `camt.052.001.14.xsd` | 110,037 | 170,474 |
| `camt.053.001.14.xsd` | 110,035 | 170,479 |
| `camt.054.001.14.xsd` | 107,246 | 167,168 |

All three trees exceed the current native HTTP response bound by more than
eight times. Paged artifacts or streaming responses are required; source-size
checks or a larger image budget alone would not solve response capacity.

## Selected paging and extended-table approach

Paging is the selected large-result transport. Pages must be bounded by
serialized byte size, not only item count, including the envelope and cursor.
A single oversized node requires a bounded artifact/chunk representation;
it must not be truncated or silently omitted. Revision-bound cursors must
prevent mixing pages from different versions of a schema or its dependencies.
Existing consumers must be adapted explicitly, with no desktop parsing fallback.

Pascalish `array[...] of integer extendable` is supported by the compiler and
native VM. Use it for volatile node IDs, parent links and page/record offsets
to avoid repeatedly traversing or reparsing a complete tree. Scalar arrays,
not arrays of records, are the existing supported declaration form.

The VM allocator tries PSRAM first but can fall back to heap. The hosted-service
path currently does not call `setExtendableDeclarations`; standalone execution
support is not evidence that hosted Librarian instances can use extended tables.
The audit compiles a small service declaration probe and reports this wiring
gap separately from hardware verification. No hardware test is run by the audit.

Before enabling this optimization, wire declarations into hosted execution with
per-instance isolation, explicit admission/allocation errors and measured S3
memory budgets. Extended indexes are disposable accelerators: durable page
artifacts and revisions remain in Pulse Filesystem, and restart/eviction must
not invalidate committed data or silently regenerate uncertain mutations.

## Compatibility decisions already preserved

- Schema catalog structure modes are normalized and validated in Pascalish:
  empty/non-string, `cached` and `lazy` select cached; `full`, `all` and `true`
  select full; `none` and `false` omit physical structures. Invalid strings
  return HTTP 400 with the existing error. Trimming and casing are unchanged.
- Existing file-download middleware is method-agnostic, including HEAD;
  it uses the nested URL path, not a `path` query parameter. Narrowing it to
  GET would be an intentional API change, not transparent migration parity.
- HTTP reference tests wait for dependency readiness, not merely `/health`.

## Required capability groups

| Capability | Existing Pascalish sources | Remaining native work |
| --- | --- | --- |
| Catalog/schema pages | `s3-readonly.pas` | Canonical identity and complete API contracts; current profile only forwards results |
| Data types/rulesets/subschemas | `catalog-store.pas`, `normalization.pas`, `subschema-policy.pas`, `routes/` | Bounded native modules, resumable reads and revision-checked mutations |
| XSD interpretation | `xsd-parser.pas` | Generic native XML/text primitives, streaming input and bounded include/import state |
| Trees/structures/fields | `schema-tree.pas`, `schema-structure.pas`, `routes/schema-fields.pas` | Native execution, paged derived artifacts and revision-based cache invalidation |
| Search and schema lookup | `routes/search.pas`, `routes/schema-lookup.pas` | Port desktop sequencing and enumeration, not just dispatch policies |
| Upload/download/rename/delete | `routes/upload.pas`, `routes/file-download.pas`, `routes/schema-operations.pas` | Granted chunked transfers, safe Filesystem primitives and Pascalish validation/commit |
| Metadata/lifecycle | `routes/metadata.pas`, `routes/schema-catalog.pas` | Preserve metadata routes, errors and lifecycle semantics |

## Desktop decisions still requiring Pascalish workflows

Existing Pascalish policies are not the whole Librarian. The desktop reference
still orchestrates these operations; it is not a deployable native implementation:

| Current responsibility | Pascalish migration destination |
| --- | --- |
| Storage layout creation, seeding and legacy migration | Explicit initialization workflow using confined Filesystem operations; no implicit production seeding |
| File enumeration, BOM/UTF-16 decoding and format dispatch | Resumable catalog traversal and generic byte/text primitives; preserve JSON values, JSON Schema and copybooks as well as XSD |
| Physical catalog assembly, lifecycle attachment and cached/full/none selection | Catalog workflow with paged result assembly and Pascalish decisions |
| Parent lookup, unknown-field validation and virtual schema projection | Resumable subschema workflow retaining normalization and schema-tree policies |
| Source/import dependency validation, parser sequencing and cache eviction | Revision-aware parse/artifact workflow; no desktop parser or predigestion dependency |
| Serialized catalog read-modify-write and conflict retries | Pascalish mutation workflow using conditional, atomic Filesystem commits |
| Upload staging, rename/delete and cache invalidation | Pascalish operation workflow over granted chunks and confined storage primitives |
| HTTP path/query validation and binary/error response assembly | Native route policies and generic transport adapters preserving active contracts |

Current `service_submit` completes by forwarding a child result. It cannot
resume Pascalish on the board to transform that result or choose the next
operation. Full parity requires versioned, authenticated durable resumptions
before mutations and parsing workflows can be migrated safely.

Generic C++ primitives may handle bytes, tokenization, hashing, clocks,
storage/network transport and VM execution. Librarian rules, XSD interpretation,
workflow decisions and cache semantics remain Pascalish on the ESP32.
Filesystem must not become a relocated Librarian parser.

Hardware deployment and live cutover require explicit authorization.
