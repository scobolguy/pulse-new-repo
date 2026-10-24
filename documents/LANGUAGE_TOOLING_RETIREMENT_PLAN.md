# Legacy language tooling retirement plan

## Decision

Begin deprecation now; remove old entrypoints only after their callers have
migrated and removal gates pass. This is a repository/API cleanup, not a removal
of supported source dialects or a change to p-code semantics.

The main compiler implementations have canonical homes under `languages`.
Many apparent old compilers are already forwarding wrappers, not independently
maintained versions. However, the historical `dsl` tree and remaining shared
aggregator dependencies mean that deleting the old directories wholesale is
not safe.

This document is a plan only. It does not authorize implementation deletion,
service process changes, publication, commits or pushes.

## Verified starting point

| Language | Canonical home | Current old-path status |
| --- | --- | --- |
| Pascal / Pascalish | [pascalish](../languages/pascalish) | Aggregator program/router-mapper compiler entrypoints forward here. |
| COBOLish / Tandem COBOL-85 | [cobolish85](../languages/cobolish85) | Aggregator compiler, metadata and PICTURE entrypoints forward here. Distinct frontends remain intentional. |
| VBish | [vbish](../languages/vbish) | Compiler and ANTLR wrappers forward here; application compilation still uses the aggregator interoperability adapter. |
| C# subset | [csharp](../languages/csharp) | Canonical compiler plus a legacy aggregator CLI wrapper; JS target only. |
| Minnesota FORTRAN | [mnf](../languages/mnf) | Canonical compiler plus an aggregator re-export. |
| MAPL | [mapl](../languages/mapl) | Canonical compiler/grammar/parser plus legacy forwarding paths. |
| WFL | [wfl](../languages/wfl) | Canonical frontend, compilers and interpreter plus legacy forwarding paths. |

[dotnet](../languages/dotnet) contains the shared VBish/C# System contract; it is
not another compiler or a CLR.

Further work remains:

- The historical [dsl tree](../dsl) contains another Pascalish grammar, a
  TypeScript generator, Python API, test programs, and `Pulse0CompilerJS`.
  These must be classified individually, not presumed equivalent or unused.
- Old generated-parser directories remain under the aggregator. Some files
  are thin re-exports; every remaining generated/cache artifact needs an owner.
- Language packages still use aggregator helpers for mapping-rule emission,
  diagnostics/signing/source maps, and some cross-language compilation.
- The VS Code extension and application integrations still resolve several
  compilers through aggregator paths.
- Parser generation is language-owned, but the ANTLR jar is still located in
  the aggregator's tools directory.

## Phase 1: Inventory and baseline

1. Inventory old compiler APIs/CLIs, grammar sources, generated parsers, caches,
   package scripts, examples, service consumers, editor/LSP tooling, tests,
   CI/build/deployment configuration and documentation.
2. Classify each file as canonical implementation, compatibility wrapper,
   generated artifact, application/runtime integration, historical prototype,
   or an active implementation with unique behavior.
3. Record old-to-new API and command mappings, including the accepted dialect,
   options, exports, exit codes and artifact shape.
4. Capture focused test results before changes. Keep existing failures visible
   and distinguish them from new regressions.

**Gate:** Every candidate has an owner and replacement, or an explicit reason
for retention. A lack of direct imports alone does not prove a CLI or
configuration-driven entrypoint is unused.

## Phase 2: Finish canonical ownership

1. Move any remaining active language implementation into its language package
   before retiring its original location.
2. Keep grammar, parser-generation scripts, generated runtime parsers,
   compiler tests and examples in the owning language directory.
3. Define/document the supported package exports and CLI commands. Add missing
   language setup documentation, including Pascalish and COBOLish.
4. Separate mixed adapters: pure language compilation belongs under
   `languages`; schema/catalog lookup and deployment orchestration belong to
   the appropriate service; runtime artifact contracts belong to the shared
   p-machine boundary. Reuse shared helpers rather than copying them.
5. Classify the historical `dsl` implementations. Port any required unique
   behavior and regression cases first; obtain an explicit retirement decision
   for dialects or prototypes with no supported replacement.

**Gate:** There is one authoritative implementation for each supported frontend.
Preserve intentionally different Pascalish entrypoints and COBOL dialects.
An old generator's feature list is not evidence that the new compiler implements
those features.

## Phase 3: Migrate callers

1. Switch backend/service imports and dynamic compiler lookup to canonical
   language APIs.
2. Update VS Code Run/Debug, web compilation, language servers, scripts,
   parser generation, examples and documentation.
3. Make newly extracted services depend on canonical compiler paths rather
   than introducing new dependencies on compatibility wrappers.
4. Preserve source filenames, debug maps, procedure metadata, library identity,
   signed artifact contracts, CLI diagnostics and runtime-target restrictions.
5. Add a check that rejects new uses of deprecated paths. Maintain a small,
   explicit transitional allowlist for compatibility tests and approved callers.

**Gate:** No production caller uses an entrypoint scheduled for removal,
including paths embedded in JSON, generated code, tasks and deployment commands.
Language packages must not import a wrapper that is about to be removed.

## Phase 4: Deprecation window

1. Publish an old-command/API-to-new-command/API migration table.
2. Retain forwarding wrappers for at least one tested release as the recommended
   default, then review external scripts and deployed users before removal.
3. Keep wrappers logic-free; test that both paths reach the same implementation.
4. If adding CLI warnings, emit them on stderr and test machine-readable
   stdout/exit-code compatibility. Do not add import-time logging.
5. Announce the intended removal release; do not choose a removal date merely
   because the repository search is clean.

**Gate:** Canonical paths have shipped and been exercised, known consumers have
transitioned, and the removal release is approved.

## Phase 5: Remove retired surfaces in small batches

1. Remove unused duplicate/prototype implementations only after Phase 2.
2. Remove obsolete generated/cache artifacts and old build outputs; retain
   generated parsers needed by the canonical runtime and a reproducible
   generation command.
3. Remove compiler/parser wrappers language by language after the deprecation
   window. Convert compatibility tests to canonical regression tests without
   losing their behavioral assertions.
4. Remove obsolete package scripts, configuration entries and documentation.
   Drop dependencies only after checking runtime and parser-generation needs.
5. Remove the historical `dsl` tree only when every file has been accounted for;
   retain necessary history in version control rather than another live copy.

Suggested order: unused historical outputs, C#/MNF forwarding surfaces,
MAPL/WFL/VBish, then the more widely used Pascalish/COBOL paths. Actual order
depends on the consumer inventory, not language age.

**Gate for each batch:** Relevant tests pass with no new failures against the
recorded baseline, and no unresolved references point at removed files.

## Verification and public-release gates

- Import and CLI compatibility while wrappers exist; canonical-only operation
  after removal.
- Equivalent p-code and semantic metadata for unchanged supported input.
  Normalize only incidental timestamps/paths when comparing artifacts.
- Exact output and required diagnostics, deliberate rejection of unsupported
  input, and explicit runtime faults.
- Source breakpoints, stepping, call frames, locals and source-map accuracy.
- Existing Pascal validation, COBOL CCVS-style validation, VBish regressions,
  MNF tests, MAPL/WFL tests and the original C# validation corpus.
- Preserve C# accounting: unsupported probes are not passes, and a JS-only
  result is not C++/Arduino certification.
- Frontend build and VS Code extension build/package-content checks.
- A clean checkout can restore dependencies, generate parsers, compile examples
  and run focused tests without recovering deleted files from an old build.
- Unrelated known failures remain documented; retirement-critical checks
  cannot be waived by calling them pre-existing.

## Coordination with service relocation

Keep the `/services` extraction and wrapper deletion in separate change batches.
Move service consumers onto canonical APIs during extraction, but retain old
entrypoints until startup, compiler lookup, mapper/librarian integration and
editor tests work in the new layout. Do not combine this cleanup with runtime
directory consolidation or dynamic p-code linking.

## End state

- `languages/<language>` owns each supported compiler, grammar and tests.
- `languages/dotnet` owns the common VBish/C# library contract.
- `services/<service>` owns service integration, not duplicate compilers.
- The aggregator contains no alternate language implementation or retired
  compiler/parser forwarding paths.
- One documented build path exists per frontend; compatibility history remains
  in version control.

Recommended next action: complete Phase 1 and canonicalize compiler imports in
the services being relocated. Do not begin with mass deletion.
