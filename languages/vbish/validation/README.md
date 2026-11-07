# VBish specification validation

Original tests referenced to Microsoft's published
[Visual Basic 11 language specification](https://learn.microsoft.com/en-us/dotnet/visual-basic/reference/language-specification/).
The [committee source](https://github.com/dotnet/vblang/tree/main/spec) labels
that specification Version 11. This is not a claim to implement every feature
of current Visual Basic, nor an official Microsoft certification suite.

```powershell
npm test
npm run validate -- --jobs 4
npm run validate -- --case VB-CALL-001
npm run validate -- --suite unsupported
npm run validate -- --suite overloads
npm run validate -- --suite numeric
npm run validate -- --suite integers
```

The [inventory](cases.mjs) tests the explicit `vb11` scalar profile, not legacy
Pulse syntax. It covers case-insensitive and escaped names, doubled-quote
strings, literal backslashes, separators/continuations, declarations and defaults,
Int32 arithmetic, precedence, Boolean short-circuit versus eager operators,
conditions, loops, bound capture, value parameters, recursion and Console output.
The 235-case inventory includes nine positive generic-method cases and fifteen
required-negative generic cases: explicit/inferred types, multiple parameters,
forwarding, recursion, case-insensitive names, caching, invalid symbolic bodies,
conflicting inference and unsupported generic defaults. The old generic-method
probe `VB-UNSUPPORTED-024` now specifically probes unsupported constraints.
An additional 21 overload cases cover scalar parameter types/arity, generic
candidate elimination/specificity, Main overloads, recursion, evaluation order,
duplicate signatures and ambiguous/inapplicable invocations. Coverage now
includes the specification's overload-resolution chapter.
Required-negative cases test invalid source; runtime cases test real overflow
and divide-by-zero faults. Unsupported probes document missing language features.

Both C# and VBish use the same
[validation runner](../../dotnet/validation/runner.mjs),
[worker observer](../../dotnet/validation/observe.mjs) and
[result evaluator](../../dotnet/validation/evaluate.mjs).
Each persisted validation case runs in a separate Node process with a two-minute
deadline, 100,000 instructions, 64 call frames and bounded output.
`--jobs` accepts 1 through 8, defaulting to 1. Unknown or empty selections fail.

The [saved report](../reports/vb11-js-validation.json) records exact observations,
compiler/grammar/harness/corpus fingerprints, limits, target, original source
hashes and chapter-level inventory versus selected coverage. It is persisted
atomically after each case and is marked complete only after the run finishes.
Source, p-code and maps are retained under ignored `output/latest`; `--out`
stores all artifacts and `results.json` in an explicit output directory.

`pass`, `fail`, `unsupported`, `timeout` and `infrastructure-error` have the same
meaning as in the C# suite. Expected unsupported rejection is not a pass.
Exit status is 0 for all expected outcomes, 1 for failed cases, and 2 for invalid
invocation/setup. `fullStandardConformance` remains false.

Unit tests also execute the corpus directly, check complete instruction source
maps, exercise the legacy Pulse regressions, and verify typed C# -> VBish and
VBish -> C# library calls. Those interop tests are not evidence that every
language pair or hardware target has been validated.
Shared regression tests also verify the exact 128-procedure specialization
boundary and concrete cross-language wrappers that retain generic helpers;
exporting generic specializations themselves remains explicitly rejected.
Overloaded providers are also exported by exact signature under distinct ABI
names and called from the other language. Independent Microsoft compiler
checks for the overload corpus can be run with
`node ..\dotnet\validation\differential.mjs` from this package; an installed
.NET SDK/reference pack is required, with no network restore.

The [numeric cases](numeric-cases.mjs) cover explicit `CInt`, `CBool` and
`CStr` conversions of the existing scalar types, Boolean-to-Int32's -1/0
semantics, Int32 limits, checked compound/unary operations, strict implicit
typing and unsupported String parsing. Runtime faults remain in the `runtime`
suite. Compare supported numeric cases against Microsoft VB 11 with
`node ..\dotnet\validation\differential.mjs --suite numeric`; unsupported
String parsing probes are excluded, not counted as successful comparisons.
Shared integration tests pass converted values through real C#/VB calls in
both directions and verify checked overflow across a language boundary.

The [integer-width cases](integer-cases.mjs) add signed/unsigned 8-/16-bit
limits, checked conversions, VB Boolean conversions, arithmetic result types,
strict rejection of narrowing compound results, same-width compound overflow,
widening calls/returns and overload specificity/ambiguity.
`--suite integers` includes these runtime faults. Use
`npm run validate -- --suite integers --jobs 4 --out validation\output\integer-widths`
to retain a focused report without replacing the earlier full-inventory report,
which predates System 0.3.0. Compare independently with
`node ..\dotnet\validation\differential.mjs --suite integers`.
The refreshed [focused report](output/integer-widths/results.json) passes all
36 integer cases with current fingerprints; the shared
[independent comparison](../../dotnet/reports/integers-differential.json)
passes all 70 C#/VB integer cases. Neither is a full-language conformance claim.

## Grammar and remaining gaps

All grammar edits belong in [Vbish.g4](../grammar/Vbish.g4); regenerate with
`npm run antlr:generate`. The profile's lexer preserves line/colon boundaries
and VB string/identifier rules; its parse tree lowers to the shared scalar AST,
not the old line-oriented code generator.

Unsupported work includes full Unicode identifiers, preprocessing, complete
options/inference/conversions, UInt32/64-bit integers and floating point/decimal, Nothing, default
String/reference values, objects, arrays, properties, generic types, ByRef,
complete conversion-based overload resolution, exception handling, delegates,
iterators, async, LINQ and XML.
For-loop control variables must have `As Integer` or already be declared.
Exit/Continue targeting a non-innermost loop is explicitly rejected.
Option Strict Off/Explicit Off and nonliteral inferred locals are not supported;
use explicit `As` types. The scalar profile enforces exact typing even when no
Option Strict statement is supplied. Optional runtime facilities do not turn
these restrictions into full Microsoft VB conformance.
