# Shared scalar compiler and library contract

This directory is the common library boundary for Pulse's VBish and C#
frontends. The name describes their source-language family, not a CLR,
Microsoft .NET implementation, or Windows DLL format.
Kotlin also lowers its bounded scalar subset through this backend.

## Current implementation

- [System manifest](libraries/System/library.json): one library ID/version,
  scalar types, Console signatures and JS integer intrinsic bindings.
- [System helper](system-library.mjs): signature lookup and checked
  Int32 arithmetic implementations, shared by both languages.
- [Scalar semantic analyzer](scalar-semantics.mjs) and
  [p-code emitter](compile-scalar-to-pcode.mjs): shared by C# and the explicit
  VBish `vb11` profile. Language-specific parsing remains in each frontend.
- [Scalar library adapter](scalar-library.mjs): versioned, typed static exports
  and imports using the existing language-neutral p-code linker.
- [Scalar conversions](scalar-conversions.mjs): C# scalar identity casts and
  explicit integer casts and VB integer/Boolean/String conversions.
  [Integer types](integer-types.mjs) defines signed/unsigned 8- and 16-bit
  bounds, signed Int32, widening and checked/wrapping conversions.
  VB Boolean-to-signed-integer yields -1 or 0; unsigned targets use their
  maximum or 0, not the p-machine's internal Boolean encoding.
  String parsing, UInt32/64-bit integers, floating point and decimal
  conversions remain unsupported.
- [Validation machinery](validation/runner.mjs): shared isolated workers,
  result evaluation, bounded execution, atomic reports and fingerprints.
- Both compilers emit the same `System` ID/version in `programMap.libraries`.
- C# retains unchecked nonconstant Int32 arithmetic; `vb11` emits checked
  add/subtract/multiply through System intrinsics. These are language semantics,
  not interchangeable defaults. Console formatting and procedure frames are shared.
- System 0.3.2 adds stateless UTF-16 string length for well-formed Unicode
  (`system.string.length`) and explicit wrapping divide/remainder bindings
  (`system.int32.divide.unchecked`, `system.int32.remainder.unchecked`).
  Kotlin uses these library APIs; C#/VB keep their existing checked division
  behavior. Native string length validates UTF-8 without allocating a copy.
  No language-specific PMachine opcodes or concurrency state are required.
- Legacy VBish's default `pulse` profile retains its original compiler path.
- C# and VB11 syntax now comes from generated ANTLR parsers, with parse-tree
  lowering in each frontend and a [shared generation helper](generate-parser.mjs).
  Syntax changes belong in `Csharp.g4` or `Vbish.g4`, never generated code.
- Both frontends reuse symbolic generic-method validation, exact inference,
  forwarding/recursion and cached specialization in the shared backend.
  The limit is 128 emitted procedures including Main; generic classes,
  constraints and generic ABI exports are not implemented.
  VB generic functions currently require explicit returns on all paths and
  explicit initialization of type-parameter locals; implicit generic defaults
  are rejected.
- Both frontends now share scalar overload resolution: argument counts,
  identity/widening-compatible integer parameter types, fitting Int32 constants,
  explicit/inferred generic arguments,
  accessibility filtering, and nongeneric/more-specific-parameter tie breakers.
  Return types do not select an overload. Duplicate signatures (including
  alpha-equivalent generic signatures), ambiguity and inapplicable calls are
  diagnosed. Overloaded Main methods do not become extra entry points unless
  they have a supported entry signature.
  Better-conversion selection retains C# signed-target and VB numeric-order
  tie breakers; crossed parameter specificity remains ambiguous.
- C# `checked`/`unchecked` expressions and blocks control Int32 arithmetic
  lexically, including unary negation, compound assignments and increments.
  Nested contexts do not change another method's policy. The emitter reuses
  the existing shared checked Int32 intrinsics; VB retains checked arithmetic.
  VB strict compound assignments reject implicitly narrowing result types;
  C# compound assignments use their specified checked/wrapping narrowing.

### ESP32 named-device library

[The device adapter](device-library.mjs) exports `Open() -> int`,
`SetPower(int, bool) -> bool`, `ReadPower(int) -> string`,
`SetColor(int, string) -> bool`, `ReadColor(int) -> string`,
`SetIntensity(int, int) -> bool`, `ReadIntensity(int) -> string`,
`Close(int) -> bool` and `Delay(int) -> void` through scalar ABI v1.
It uses the existing language-neutral `FSM` instructions and `DELAY_MS`,
not C#-specific opcodes or a separate GPIO implementation.
Both C# and VB11 accept `{ target: 'esp32', libraries: [...] }`; the default
remains `js`. An ESP32-only library is rejected on the JS target.
Other frontends can use the underlying FSM/device contract; this adapter
does not yet add typed library imports to every language.

```javascript
import { createDeviceLibrary } from './device-library.mjs';
const boardLed = createDeviceLibrary({
  id: 'BoardLed', name: 'BoardLed', type: 'ws2812', pin: 48
});
// Pass { target: 'esp32', libraries: [boardLed] } to either scalar compiler.
```

`ws2812`/`rgb-led` selects the shared ESP32 addressable-LED driver; `led`
still means an ordinary digital output. The RGB driver uses a separately
allocated Arduino RMT transmitter, checks initialization/transmission errors,
and supports `color` (`#RRGGBB`, case-insensitive input, uppercase readback)
and `intensity` (decimal 0..255). Output channels are scaled linearly with
nearest-integer rounding; 0 is dark and 255 is the full selected color.
Power-off sends black without losing color/intensity. Defaults are green
and intensity 32. Invalid values or failed transmissions leave state unchanged.
Unregistered LEDs initialize off on opening; closing releases their transmitter.
The Waveshare firmware profile registers `BoardLed` persistently: opening and
closing acquire/release exclusive handles without resetting its RGB settings.
Another name cannot claim a registered or already-open GPIO. Concurrent opens
of the same named device fail explicitly; network clients should retry HTTP 409.
Explicitly turn the LED off before closing if it should remain dark.
Wiring remains the operator's responsibility.
`Delay` accepts 0..10000ms per invocation on the native runtime.

The [C# example](../csharp/examples/board-led.cs) performs three
three-second on/off cycles in red, green and blue at intensity 32, and checks
operation results before closing.
From `virtualMachines\esp32`, after building and installing the firmware:

```powershell
node --test testing\pmachines\board-led.test.mjs
$env:PULSE_LED_TEST_NODE = 'http://192.168.2.90'
$env:PULSE_LED_TEST_AGGREGATOR = 'http://127.0.0.1:4000' # Optional live discovery check
node --test testing\pmachines\board-led.test.mjs
Remove-Item Env:\PULSE_LED_TEST_NODE
Remove-Item Env:\PULSE_LED_TEST_AGGREGATOR
```

The `esp32_s3_waveshare_pmachine_n16r8` firmware profile configures GPIO48
and publishes `BoardLed` as a public device in `GET /services/describe`.
Other profiles do not assume an onboard RGB LED pin. It removes the old
hard-coded GPIO2 LED/relay routes and recognizes only legacy demo metadata
for cleanup, preserving custom device definitions.

Any language or network client can use the same device:

```text
GET /api/device/BoardLed?state=color
POST /api/device/BoardLed  {"state":"color","value":"#FF8000"}
POST /api/device/BoardLed  {"state":"intensity","value":128}
POST /api/device/BoardLed  {"state":"power","value":"on"}
```

Send POST bodies as `application/json`. GET only observes state. State values
survive separate requests and handle closes, but not a board reboot.

The opt-in test drives GPIO48 on an idle board, verifies returned state,
completion, elapsed time and idle post-test status. It cannot verify emitted
light; visual confirmation remains necessary.

### Earlier complete-inventory validation milestone

| JavaScript suite | Supported checks passed | Expected unsupported rejections |
| --- | ---: | ---: |
| [C# report](../csharp/reports/ecma334-js-validation.json) | 269 | 37 |
| [VB11 report](../vbish/reports/vb11-js-validation.json) | 174 | 25 |

Both complete runs have zero failures, timeouts or infrastructure errors.
These reports precede the 8-/16-bit increment; their fingerprints identify the
earlier Int32 compiler, not the current compiler. Focused integer-width
validation and regression tests cover the new increment without claiming a
refreshed full-inventory run.
Reports retain compiler/harness/corpus fingerprints and source artifacts;
accepted programs also retain runnable p-code and complete source maps.
Regression tests cover bidirectional scalar calls, generic helpers behind
concrete ABI wrappers, and the exact shared specialization boundary.
Unsupported rejections are not conformance passes.

The earlier [independent overload comparison](reports/overload-differential.json)
recorded 43 passing cases against the locally installed Microsoft compilers
in C# 7.0 and VB 11 language modes. Positive cases require matching exact
output; negative cases require source-located compiler rejection. Toolchain
setup/process failures are errors, not successful negative tests. The runner
disables VB's implicit desktop `My` template for the .NET reference pack and
does not download packages. Run it from the repository root with:

```powershell
node languages\dotnet\validation\differential.mjs
node languages\dotnet\validation\differential.mjs --suite numeric
node languages\dotnet\validation\differential.mjs --suite integers
```

The earlier [numeric comparison](reports/numeric-differential.json) recorded
60 supported cases in the same language modes. It additionally requires
matching runtime exception identities for expected arithmetic faults, rather
than treating any unsuccessful process as an expected fault. Unsupported String
parsing probes are excluded from differential comparisons. Each report's
fingerprints identify its own compiler milestone; the earlier overload-only
report predates the numeric changes.

The integer-width suite includes positive, required-negative and runtime-fault
cases. Run `npm run validate -- --suite integers --jobs 4 --out
validation\output\integer-widths` in each language package to retain a focused
report and source/p-code/map artifacts without replacing the historical full
report. The independent comparison is
[integers-differential.json](reports/integers-differential.json).

### Verified 8-/16-bit integer milestone

| Validation | Passed |
| --- | ---: |
| [C# focused integer report](../csharp/validation/output/integer-widths/results.json) | 34 |
| [VB11 focused integer report](../vbish/validation/output/integer-widths/results.json) | 36 |
| [Independent Microsoft compiler comparison](reports/integers-differential.json) | 70 |
| Related compiler, corpus and bidirectional ABI regression tests | 343 |

All runs have zero failures. Focused reports also have zero unsupported cases,
timeouts and infrastructure errors. At that milestone, compiler/harness/corpus hashes,
exact case selection and original sources were audited; the 51 runnable
artifact pairs have complete instruction source maps and System 0.3.0 metadata.
Independent checks verify exact output, source-located required rejections and
arithmetic fault identities in C# 7.0 and VB 11 modes.
In particular, VB `Option Strict On` rejects small-integer `n += 1` because
the Integer result narrows; a same-width operand tests checked compound overflow.

These are complete runs of the current subset inventories, not complete
language standards or all-target/all-language certification.

## Scalar interoperability

The `pulse.scalar` ABI v1 transports `sbyte`, `byte`, `short`, `ushort`,
`int` (signed Int32), `bool` and `string`
by value, plus `void` results. Arguments are evaluated left-to-right and passed
in declaration order through p-machine procedure frames. It does not serialize
values to text or introduce a second interpreter.
The enabled integers use exact Int32 numeric storage, with distinct signature
types and explicit narrowing at language-defined boundaries. System 0.3.1
adds explicit integer-to-string formatting and native ESP32 System bindings.
The compiler's default certified target remains JavaScript; this does not
enable every language/target surface automatically. Cross-language
tests round-trip each small-width type's minimum and maximum in both directions,
including widening results and rejected implicit narrowing.

```javascript
import { createScalarLibrary } from './scalar-library.mjs';
const library = createScalarLibrary(compiledVb11Program, {
  id: 'VisualBasic',
  version: '1.0.0',
  exports: { Twice: 'program.twice' }
});
const application = compileCsharpToPcode(
  'class P { static void Main() { System.Console.WriteLine(VisualBasic.Twice(21)); } }',
  { libraries: [library] }
);
```

The provider is a compiled program with an inert `Main`; linking excludes its
entry point. Exports must resolve to accessible, nongeneric concrete methods.
Exact library versions, signatures and explicit `targets` are validated before
linking. VB identifiers are case-insensitive; C# identifiers remain case-sensitive.
VB reserved names in imported library IDs must be bracket-escaped.
The same API supports C# providers and VBish consumers.
An overloaded provider method must be selected by its procedure label or its
`programMap.procedures[label].signature`, for example `Program.Copy` followed
by `` `0(int) `` for a nongeneric Int32 overload. Signatures encode generic
arity and parameter types, not return types. Type parameters use ordinal names
(`!0`, `!1`) so spelling changes do not change signature identity. Expose concrete
overloads under distinct language-neutral export names such as `CopyInteger`
and `CopyString`; ABI v1 does not yet expose overloaded import groups.
Concrete exported wrappers may call generic helpers internally; linking retains
their specialized call closure. This is tested in both language directions and
does not make the generic methods themselves part of ABI v1.

ABI v1 deliberately rejects global-state libraries, already-linked re-exports,
unsupported signatures, ambiguous exports and incompatible targets. It does not
provide objects, reference parameters, shared mutable references, managed
exceptions, dynamic loading or automatic version selection. Runtime faults are
host errors, not catchable language exception objects.

JavaScript remains the default certified target; physical ESP32 subset
validation is described below, not blanket certification of every artifact.
The adapter uses the existing common linker, rather than a C#/VB-specific linker.
Other frontends must explicitly implement its wire types and procedure metadata
and pass the same interop tests before claiming ABI compatibility. Existing
COBOL/Pascal runtime-library linking remains separate and unchanged; this does
not yet prove all language pairs interoperable.

### ESP32 runtime validation

The native System RTL implements checked Int32 arithmetic, divide/remainder
faults, checked/wrapping 8-/16-bit conversions and locale-independent
`system.int32.tostring`. Generated string conversions no longer depend on
JavaScript's coercing `CONCAT`; native `CONCAT` still requires two strings.
Execution responses set `ok: false` for runtime/thunk/orchestration errors or
instruction-limit exhaustion, retaining the diagnostic and partial output.
Older firmware must be rebuilt before these bindings are available.
The host regression run after this change passes 323 tests; its physical-board
test is skipped unless explicitly enabled. Native System and existing FORTRAN
RTL boundary tests also pass.
On 2026-11-03 the updated ESP32-S3 on COM4 (`192.168.2.90`, 16 MB flash,
8 MB PSRAM) passed 115 physical execution checks: 64 C# and 47 VB corpus
programs, two bidirectional library calls, unknown-binding rejection and
instruction-limit exhaustion. The 36 expected arithmetic faults returned
`ok: false` with the required exception identities; ordinary programs matched
exact expected output. Post-test status was responsive and idle. Firmware was
built successfully and only the application partition was flashed, preserving
the matching partition table, filesystem and configuration.

Run native boundary tests with `npm run test:pmachine:fortran` from
`virtualMachines/esp32` (the existing native RTL runner includes System tests).
For an idle physical board with updated firmware:

```powershell
$env:PULSE_DOTNET_TEST_NODE = 'http://192.168.2.90'
node --test testing\pmachines\dotnet-device.test.mjs
```

The opt-in test checks compiled numeric/generic/overload programs, exact output,
runtime fault identities and failed-response flags, plus linked calls in both
language directions. It does not flash firmware, change GPIOs or install services.
Earlier saved validation reports identify earlier compiler fingerprints.

## Integration direction

Keep library identity, exported names, parameter/return types, target support
and versioning language-neutral. Source spelling belongs in each frontend.
Resolve common APIs against that contract, then emit the same p-code/runtime
bindings; do not create separate VBish and C# implementations of each library.

## Conformance and integration work remaining

The pinned targets are **ECMA-334 C# 7** and Microsoft's published
**Visual Basic 11 language specification**. Latest compiler/runtime product
versions are not substitutes for these language specifications.

### Execution plan

Correct C# and VB grammar/semantics take precedence over compatibility with old
source. Change syntax only in `.g4` files and regenerate. Keep required Pulse
extensions explicit rather than weakening a standards profile to preserve old
syntax. The legacy VBish compiler still exists; retaining it is not a constraint
on specification work.

Work in these dependency-ordered milestones:

| Phase | Deliverable | Completion gate |
| --- | --- | --- |
| 1. Scalar overloads | Shared signature identity, candidate selection, generic tie breaking, diagnostics and concrete export selection | Both language corpora, source maps, distinct procedure instances, bidirectional library tests and independent C#/VB differential checks pass |
| 2. Numeric model and conversions | Shared integer widths, signedness, floating point/decimal, literals, checked/unchecked operations and language-specific widening/narrowing | Boundary/overflow tests, independent compiler comparisons and typed cross-language round trips for each enabled type; unsupported runtime targets rejected |
| 3. References and structured values | Arrays, records/objects, null/Nothing, reference parameters, ownership/lifetime and a common value representation | Aliasing, lifetime, layout, bounds and error tests across enabled language/target combinations |
| 4. Object and generic semantics | Classes, inheritance, interfaces, overload/conversion extensions, generic types/constraints and full inference/default rules | Specification-indexed positive/negative tests and cross-language public-type tests |
| 5. Runtime and libraries | Managed exceptions/unwinding, delegates/events, iterators/async, reflection and required System APIs | Observable language-specific behavior and resource-limit tests; no host-error substitutes for language exceptions |
| 6. Host and deployment | Pinned Mono/.NET adapter, capability declarations, librarians, schema/version resolution and deployment integrity | Repeatable host/target tests and compatibility checks before deployment |

**All-language interoperability is a parallel requirement throughout, not a
final C#/VB-only feature.** Fortranish (the existing MNF/FORTRAN frontend),
Pascalish and Cobolish (COBOLish85) must each interoperate with both VBish and
C# in both directions. Inventory those frontends alongside VBish, C#,
Assemblerish and the WFL/MAPL/VFL orchestration/mapping surfaces. For each,
document whether it imports/exports executable procedures or composes artifacts,
then implement the appropriate adapter against the existing language-neutral
p-code linker. Do not invent scalar call semantics for a graph/configuration
language. Track every supported provider/consumer direction in an interoperability
matrix with executable tests, including precise conversions, strings, records,
references, library versions, errors and target capabilities. The existing
C#/VB scalar and COBOL/Pascal paths are seeds, not proof of all-language support.

| Required language pair | Provider/consumer directions | Current common scalar ABI status |
| --- | --- | --- |
| VBish / C# | Both | Tested for 8-/16-bit integers, Int32, Boolean and String |
| Fortranish / VBish | Both | Adapter and executable pair tests pending |
| Fortranish / C# | Both | Adapter and executable pair tests pending |
| Pascalish / VBish | Both | Adapter and executable pair tests pending |
| Pascalish / C# | Both | Adapter and executable pair tests pending |
| Cobolish / VBish | Both | Adapter and executable pair tests pending |
| Cobolish / C# | Both | Adapter and executable pair tests pending |

Each phase must update its grammar/semantics, runtime, metadata/ABI, tests and
documentation together. Advance only after the relevant behavior is verified.
Phase 1 is implemented and verified for the current scalar/identity-conversion
subset. Phase 2 now includes 8-/16-bit integer widths/signedness, integer
widening/narrowing, lexical Int32 overflow contexts and scalar conversions.
UInt32/64-bit integers, floating point,
decimal, literal typing, complete numeric overload rules and generic inference remain open,
as do phases 3-6 and the broader interoperability matrix.

1. **Grammar and semantics:** extend `Csharp.g4` and `Vbish.g4` toward their
   respective specifications. The C# ANTLR migration is implemented; complete
   language syntax and semantics remain outstanding. Never hand-edit generated parsers.
   The current scalar profiles are not full language implementations.
2. **Shared type system:** numeric widths, floating point/decimal, conversions,
   overload resolution, objects, arrays, nullable/reference semantics,
   inheritance, interfaces, generic types/constraints, complete generic-method
   inference/default semantics and reference parameters.
3. **Shared runtime:** ownership/GC, exceptions and unwinding, delegates/events,
   iterators, async state machines, reflection metadata and required standard
   library support. Preserve each source language's distinct semantics.
4. **Standards validation:** expand both clause-indexed corpora, differential
   tests against an independent compiler, and target-specific execution tests.
   Unsupported probes never establish conformance. Unsafe support and any
   permitted implementation restrictions require an explicit conformance policy.
5. **All-language ABI adoption:** typed adapters and bidirectional tests for
   Fortranish/MNF, Pascalish, Cobolish/COBOLish85, MAPL and other frontends;
   each executable language must import from and export to VBish and C#.
   Include explicit handling of
   strings, record schemas, decimals, arrays, references and errors. Do not
   infer compatibility from a shared instruction format.
6. **Mono/.NET host integration:** select and pin a maintained runtime/toolchain,
   then add a host adapter with declared capabilities. Mono is a runtime, not a
   new source language. Keep CLR execution distinct from p-code execution;
   CLR assembly compatibility and ECMA-335 are separate from ECMA-334.
   Do not assume a desktop Mono runtime or every CLR facility fits ESP32.

After those contract foundations:

1. Connect **Code Librarian** to versioned source and compiled library artifacts,
   retaining source maps, hashes/signatures, exports and target capabilities.
2. Connect **Data Librarian** to named schema identities and versions. Keep data
   schemas separate from executable-library ownership and deployment metadata.
3. Let **Data Mapper/MAPL** reference those schema identities and explicit
   conversion-library exports. Validate field types and conversion signatures
   before binding or deployment, rather than copying compiler-specific logic.
4. Add deployment/library resolution and every supported language-pair contract
   test before designing dynamic loading.

### Portable Pulse distribution and IDE packages

The distribution must include the Aggregator, file server, language compilers,
runtime libraries and JavaScript p-machine, not just editor support. Use the
repository-root `extensions` directory as the installation entry point for the
VS Code VSIX and accompanying backend setup/launcher. Installation must not
require a Pulse repository checkout or project-local dependency installation.

Reuse that backend/runtime distribution for an Eclipse plug-in delivered through
a p2 update site and offline installation archive. Visual Studio requires its
own extension package; its VSIX is not interchangeable with a VS Code VSIX.
Keep IDE-specific editors, commands and views thin over shared compiler/runtime,
discovery and library contracts. Shared language-server and debug-adapter
services are planned integration work, not existing support for every language.

The Aggregator supplies network discovery and inventory: available ESP32
p-machines must appear in each IDE's Swarm view, and the file server must appear
in its Servers view. Validate installation outside the checkout, bundled
compiler/RTL execution, backend readiness, discovery refresh/expiry, visible
errors and server registration. Backend start/stop ownership, authentication,
network exposure and persistent storage must be explicit setup decisions; merely
bundling the Aggregator must not silently start a LAN-accessible service.

Finish the portable distribution and VS Code installation path first; Eclipse
and Visual Studio adapters remain subsequent work. None of these packaging
requirements imply full compiler conformance or hardware certification.

Later dynamic libraries are **p-machine libraries**, not Windows DLLs. They
will need relocation/import tables, compatibility checks, ownership/lifetime
rules, bounded storage, deployment integrity and equivalent JS/C++/Arduino
behavior. Loading and unloading must not invalidate live call frames or
managed references. This remains a later project, not a feature of this release.
