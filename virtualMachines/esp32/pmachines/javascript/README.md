# JavaScript PMachine

`@pulse/pmachine-javascript` is the public JavaScript PMachine package boundary.

- `index.mjs` exports the interpreter API and opcode loaders.
- `src/opcodes.mjs` owns the opcode manifest loader.
- `run.mjs` is the CLI entry point and explicitly invokes the exported `runCli` implementation.

`src/runtime.mjs` owns the interpreter. The legacy [Aggregator entrypoint](../../aggregator/scripts/run-js-pmachine.mjs) delegates both API calls and CLI execution to this runtime; it must not contain a separate interpreter copy. Queue-manager and debug helper integrations remain in the Aggregator. New backend integrations should import this public API rather than reach into `aggregator/scripts/`.

Run the shared conformance suite from `aggregator` with `node scripts/test-pmachine-conformance.mjs --target js`. To compare against installed ESP32 firmware, set `ESP32_HOST` and run the same script with `--diff`.

Pascalish supports fixed-point `decimal(precision, scale)` declarations, the `decimal(value)` conversion, and `ROUNDED` assignments. Bare `decimal` defaults to precision 18 and scale 0; `decimal(p)` defaults to scale 0. Precision must be a positive integer, and scale must be an integer from 0 through precision. Assignment fixes the receiving field's scale, truncating by default or rounding half-up away from zero with `ROUNDED`. Decimal literals retain their original digits rather than passing through floating point.

Run the compiler-to-runtime decimal regression from `aggregator` with `node scripts/test-decimal-arithmetic.mjs`. After editing `aggregator/grammar/Pascalish.g4`, regenerate its JavaScript parser with the repository's ANTLR 4.13.2 tool before testing.

## Desktop host capabilities and storage

The hosted compiler and runtime share a versioned [capability contract](../shared/contracts/host-capabilities.mjs). The current desktop adapter provides `filesystem.read` and `filesystem.write`; ESP32 does not provide these desktop filesystem calls. Programs using them (or `host.capabilities`) target `js` only, and the ESP32 image encoder explicitly refuses them. Existing portable programs retain their targets, ABI and network limits. ESP32 transport chunking is unchanged.

Hosted maps carry `hostCapabilitiesVersion: 1` and `requiredHostCapabilities` when filesystem calls occur. Installation checks both the map and actual P-code for the service and every daemon, so removing requirements from a map does not bypass the check. Missing grants and unknown capabilities reject installation before an existing service is stopped.

Storage is default-deny. Supply trusted operator configuration, not paths from an HTTP request:

```js
const host = await createPascalishServiceHost({
  compiled, collectorId: 'catalog',
  storageRoots: {
    catalog: { path: 'C:\\Pulse\\catalog', readOnly: false },
    reference: { path: 'C:\\Pulse\\reference' } // read-only by default
  }
});
```

Roots must already exist and be real directories. The [deployment server](./server.mjs) accepts `storageGrants`, keyed by collector ID, or the equivalent JSON in `JS_PMACHINE_STORAGE_GRANTS`:

```json
{"catalog":{"catalog":{"path":"C:\\Pulse\\catalog","readOnly":false}}}
```

An installation request only selects the collector ID; it cannot supply or expand grants. Services and their daemons share that collector's roots. The existing stop-before-reinstall rule remains: attempting to replace a running primary service returns 409. Denied additional installations leave the primary service running. Status and `host.capabilities()` expose the desktop profile, granted capability IDs, root aliases/read-only flags and effective limits, never physical root paths.

### Pascalish bindings

All paths below are relative to a named root. Both slash separators are accepted. Successful mutations return integer `0`; failures throw and produce an explicit HTTP error when called from an HTTP handler.

| Binding | Result |
| --- | --- |
| `host.capabilities()` | JSON capability/profile descriptor |
| `host.fs_stat(root, path)` | JSON `{name, kind, size, modifiedAt}` |
| `host.fs_exists(root, path)` | Integer `1` if present or `0` for ENOENT only; denied/invalid paths and missing roots remain errors |
| `host.fs_list(root, path, cursor, limit)` | JSON `{entries: [{name, kind, size, modifiedAt}], nextCursor}` |
| `host.fs_read_text(root, path)` | Strict UTF-8 text |
| `host.fs_read_text_auto(root, path)` | Strict UTF-8 or BOM-marked UTF-16 LE/BE text; strips BOM, retains BOM-less UTF-16 LE zero-byte heuristic |
| `host.fs_resolve_relative(root, baseFile, reference)` | Confined root-relative path, resolving forward-slash `.`/`..` references relative to the base file's directory |
| `host.fs_write_text(root, path, text)` | Atomic file replacement; parent must exist |
| `host.fs_mkdir(root, path)` | Create a single directory, not recursively |
| `host.fs_rename(root, source, destination)` | Rename within a root; destination must not exist |
| `host.fs_delete(root, path)` | Delete a regular file only, never recursively |

List/stat accept `''` or `'.'` for the root. Start listing with cursor `''`; pass `nextCursor` to continue until it is empty. Entries are sorted by JavaScript string order, with `kind` either `file` or `directory`, byte `size`, and ISO UTC `modifiedAt`. Pages are not a snapshot: directory changes between calls can change their contents. Limit is 1..1000; scans retain only the next bounded page in memory. Reduce the requested limit if the serialized page exceeds its byte budget.

Default file and directory-page limits are 262144 bytes. `createPascalishServiceHost` accepts `maxFileBytes` and caps it at `maxResponseBytes`; directory pages use `maxResponseBytes`. Limits are reported by the descriptor. These are local desktop budgets, not an expansion of the existing 4096-byte network binding/HTTP intake defaults. Missing files return 404, denied access 403, existing rename destinations 409 and capacity overflow 413. Invalid paths/arguments and invalid UTF-8 never return success-shaped empty results.

Paths reject traversal, absolute paths, Windows alternate streams/device names, links/junctions and regular-file hard links. Writes use exclusive sibling temporary files, sync and rename, with cleanup on failure. Operations observe host cancellation before starting OS mutations and writes check again before replacement; an already-submitted OS mutation cannot be rolled back by cancellation.
The explicit relative-reference resolver is the exception for `.`/`..`: it normalizes
them without permitting escape above the granted root, then checks the resulting path
with the same confinement/link rules. It rejects URLs, UNC/absolute paths, backslashes,
query/fragment/percent encodings and alternate streams. Returned paths use forward slashes
and are lowercased on Windows to deduplicate case aliases.

**Ownership assumption:** roots must be operator-owned and must not be concurrently replaced by an untrusted external process. Portable Node path checks cannot close every check-to-I/O race; this is confined application storage, not a general-purpose OS sandbox. Atomic replacement is not a multi-file transaction or a guarantee of directory-metadata durability after power loss.

This establishes the application/VM/platform boundary for a future native C/C++ adapter using the same binding semantics. It does not yet migrate all Librarian persistence to Pascalish or implement a native runtime.

Desktop hosted services also provide checked `host.json_array_count(json)`,
`host.json_array_get(json, index)`, `host.json_array_append(json, serializedItem)`,
`host.json_array_set(json, index, serializedItem)`, `host.json_array_remove(json, index)`
and `host.json_format(json, indent)`. Indices are zero-based; format indentation is 0..10.
Array operations return serialized JSON except `count`, which returns an integer.
The Pascalish `JSONArrays` library wraps these as `JSONArray`. These generic primitives
do not implement catalog policy, require no storage grant, and do not exist on ESP32:
compiler targets and image generation enforce that boundary. They reparse serialized
values on each call, with output bounded by `maxResponseBytes`.

Run the storage contract and hosted-runtime tests from the ESP32 workspace:

```powershell
node --test testing\pmachines\filesystem-bindings.test.mjs testing\pmachines\pascalish-service-host.test.mjs
```

### Desktop XML bindings

The invocation-scoped [XML adapter](src/xml-bindings.mjs) exposes
`host.xml_parse(text)`, `host.xml_count(handle)`, `host.xml_local_name(handle, node)`,
`host.xml_namespace(handle, node)`, `host.xml_attribute(handle, node, name)`,
`host.xml_attribute_integer(handle, node, name, fallback)`,
`host.xml_qname_local(handle, node, value)`, `host.xml_qname_namespace(handle, node, value)`,
`host.xml_has_attribute(handle, node, name)`,
`host.xml_first_child(handle, node)`, `host.xml_next_sibling(handle, node)`,
`host.xml_parent(handle, node)`, `host.xml_end(handle, node)` and `host.xml_text(handle, node)`.
`host.xml_append_document(handle, donorHandle)` moves a donor's parsed forest into
the receiver, returns the new root index and invalidates the donor. Appended roots
remain separate (parent -1, linked by next-sibling); namespace scopes and existing
subtree end indices are preserved. Aggregate source/node budgets still apply.
The Pascalish [XML library](../../aggregator/libraries/XML/XML.pas) wraps these
as `XMLDocument`; XSD application policy stays in
[Pascalish](../../src/librarian/xsd-parser.pas).
`host.json_has(object, key)` additionally provides checked own-property existence.
`host.text_hash(text)` returns a SHA-256 hex digest of UTF-16LE code units, retaining
lone-surrogate distinctions; it is a desktop-only generic content identity primitive.
`host.text_split_whitespace(text)` returns a serialized array of tokens split on XML
whitespace (space, tab, CR, LF). It does not treat other Unicode spacing characters as
XML separators. `XMLDocument.hasAttribute` returns Boolean presence independently of
the empty-string default of `attribute`. Numeric XML character references are decoded
alongside the five predefined entities, without enabling HTML named entities or recursive
decoding; CDATA remains literal.

Parsing uses the aggregator's existing `fast-xml-parser` dependency, resolved through
its package location; a standalone installation must retain that dependency/layout.
Only predefined/numeric entities are permitted. DTDs and external/custom entities are
disabled without resource access. Namespace scopes, expanded attribute uniqueness,
single-root documents and XML character validity are checked. The parser's dangerous-name
protection remains enabled. Malformed XML is an explicit 400 error; capacity failures are
explicit errors, not empty documents.

Indices are zero-based, no-child/no-sibling is -1, subtree end is exclusive,
optional absent attributes are empty strings, and direct text includes CDATA.
Handles expire at invocation end. Each invocation holds at most eight documents,
20000 total element nodes, depth 64 and `maxBodyBytes` of source text.
XML and `json_has` calls are desktop-only and refused by ESP32 image encoding.
The XSD service uses these generic bindings plus a read-only filesystem grant to load
explicit local includes/imports in Pascalish, capped at 16 document instances.
The constructor requires `schemaRoot`. Its dependency-aware `parseFile` cache checks
all source hashes through the confined reader before reuse; `parse(content)` does
not follow local links. See the [user guide](../../../../documents/PASCALISH_USER_GUIDE.md#xml-library-and-xsd-structure-extraction)
for namespace adoption, graph limits and unsupported `xml:base`/redefine/override.
The Pascalish simple-type resolver handles inherited restriction enums, inline simple
types, list item metadata and finite unions. List items are not whole-list enums, and
open/incomplete union members do not imply a finite enum set. See the guide's
[simple-type semantics](../../../../documents/PASCALISH_USER_GUIDE.md#simple-type-inheritance-lists-and-unions)
for lexical-only interpretation and recursion/work limits.

Trusted hosts can opt into `desktopBudget: true` to raise the accepted `maxSteps`
ceiling from 200000 to 10000000. Neither the runtime's 200000-step default nor the
service host's 100000-step default changes; time, stack, call-depth and byte limits
remain enforced. This option does not expand ESP32 resources or network/chunking limits.

```powershell
node --test testing\pmachines\xml-xsd.test.mjs testing\pmachines\xsd-references.test.mjs testing\pmachines\xsd-links.test.mjs testing\pmachines\xsd-simple-types.test.mjs testing\pmachines\librarian-http-catalog.test.mjs
```