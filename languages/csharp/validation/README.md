# Pulse C# Validation Suite

Original, clause-indexed tests for the implemented C#-to-p-code subset.
This follows the useful validation-suite model of small independent programs,
stable IDs, positive and required-negative tests, and repeatable reports.
It does **not** reproduce CCVS/PVS programs, import ECMA examples, or certify
full ECMA-334 conformance.

Clause numbers refer to the committee's
[standard-v7 reference text](https://github.com/dotnet/csharpstandard/tree/standard-v7/standard).
They identify the tested subject, not complete coverage of that clause.
Console output is the Pulse shared System contract, not a complete .NET library.

## Run

From the C# package directory:

```powershell
npm run validate
npm run validate -- --jobs 4
npm run validate -- --suite generics
npm run validate -- --suite overloads
npm run validate -- --suite numeric
npm run validate -- --case CS-GEN-001
npm run validate -- --suite runtime --out C:\temp\pulse-csharp-runtime
```

Selections: `all`, `core`, `generics`, `overloads`, `numeric`, `integers`, `negative`, `runtime`, `unsupported`.
Unknown, duplicate, missing or empty selectors fail explicitly.
`--jobs` accepts 1 through 8 (default 1), with each case still isolated in its
own process. Parallel runs serialize atomic report writes and retain inventory
order in the report. Use bounded parallelism to amortize slow process startup.

The default [report](../reports/ecma334-js-validation.json) is persisted after
each case and marked complete only after the selected run finishes. Generated
source, p-code and maps live in ignored `output/latest/<case-id>` directories.
With `--out`, artifacts and `results.json` are stored in the chosen directory.
Reports include Node/platform/target, timestamps, compiler and corpus hashes,
per-source hashes, expectations, observations and durations.

The inventory has 340 cases: 303 supported positive, required-negative
and runtime-error checks, plus 37 explicitly unsupported-feature probes.
The original `CS-UNSUPPORTED-005` ID is retained but reclassified as a supported
overload case. Overload cases cover scalar types/arity, generic inference and
specificity, cached distinct procedures, recursion, entry overloads, argument
evaluation, signature duplicates and ambiguity.
Generic coverage includes explicit and inferred instantiation, multiple types,
forwarding, recursion, reuse, invalid bodies, conflicting inference and void
arguments. Tests execute the real JavaScript p-machine.

The expanded inventory in [extended-cases.mjs](extended-cases.mjs) adds an
independent BigInt oracle for 40 arithmetic boundary/sign combinations,
18 comparison combinations, Boolean truth tables, lexical escapes, overflow,
evaluation order, conditional side effects, nested loops, definite assignment,
scope, entry points, accessibility and invalid generic bodies. Literal expected
outputs are used outside the arithmetic/comparison tables; expectations do not
call compiler or p-machine helpers.

The report includes separate inventory and selected-run coverage maps for
every language chapter (6 through 23). Each chapter is marked `partial`,
`unsupported-probes-only` or `not-tested`, with exact case IDs, scope limitations
and specification links. A chapter reference is not complete clause coverage.
Chapters 1 through 5 establish scope, terminology and conformance requirements;
the annexes are not separately certified by these tests. This suite is broad
validation of the current compiler, not a comprehensive implementation or
certification of the entire C# standard.

## Result accounting

| Status | Meaning |
| --- | --- |
| `pass` | A supported case satisfied every required check. |
| `fail` | Wrong output, diagnostic, exception, metadata, or unexpected acceptance/rejection. |
| `unsupported` | A declared unsupported probe was rejected with the expected diagnostic. Never counted as a pass. |
| `timeout` | A worker exceeded its two-minute deadline. |
| `infrastructure-error` | Worker/process/file/JSON failure prevented a valid observation. |

Each case runs in a separate Node process with a two-minute wall-clock
deadline (including process startup), bounded output, 100,000
instructions and 64 call frames. Positive cases require exact output and check
runtime flags, exit values and requested generic specialization identities.
Required-negative cases must fail compilation with `SyntaxError` and the
expected diagnostic; a compiler crash or later runtime fault cannot pass.
Runtime-error cases must first compile, then raise the specified exception.

The report records these limits and a harness fingerprint in addition to the
compiler and corpus fingerprints. Unit tests also compile the entire inventory,
verify located diagnostics and require complete instruction source maps for
every supported artifact. Invalid corpus metadata fails before worker execution.

The command exits 0 only when every selected case is `pass` or expected
`unsupported`; any failure, timeout or infrastructure error exits 1, and
invalid invocation/harness setup exits 2. `fullStandardConformance` is always
false. A passing filtered run does not imply the full inventory passed.
Hardware execution is reported as not run.

## Expanding the suite

Add independently written source and exact expectations to
[cases.mjs](cases.mjs); preserve existing IDs. When implementing a formerly
unsupported feature, move its probes to supported cases and add positive,
required-negative, boundary and runtime tests. Any grammar changes must be
made in `.g4` source and regenerated, never patched into generated parsers.
The compiler now parses with generated ANTLR code from
[Csharp.g4](../grammar/Csharp.g4). Syntax-negative cases assert the offending
token or expected construct, rather than the old handwritten parser's wording.
Future milestones should add
generic classes/constraints, numeric conversions, arrays and object lifetimes,
then certify each additional p-machine target separately. Differential testing
against installed Microsoft C# and VB compilers is available for this overload
milestone using `node ..\dotnet\validation\differential.mjs` from this package.
It requires an installed .NET SDK/reference pack, uses C# 7.0 and VB 11 language
modes, runs locally without restoring packages, and reports exact output or
required compile-time rejection. It does not certify the full languages.

The [numeric cases](numeric-cases.mjs) cover scalar identity casts, nested
checked/unchecked contexts, lexical method boundaries, checked unary/binary
arithmetic, compound assignments, prefix/postfix increments, short-circuiting,
constant overflow and invalid explicit conversions. Runtime-fault cases remain
in the `runtime` suite; `numeric` selects the compile-time/positive cases.
The stable `CS-UNSUPPORTED-010` ID is now a supported checked-expression case;
`CS-UNSUPPORTED-020` is now a required-negative invalid Boolean-to-Int32 cast.
Compare all supported numeric cases, including runtime faults, independently
with `node ..\dotnet\validation\differential.mjs --suite numeric`.
Unhandled reference faults must report the expected .NET exception, not merely
exit unsuccessfully; process/toolchain failures do not count as passing tests.

The [integer-width cases](integer-cases.mjs) add signed/unsigned 8-/16-bit
boundaries, wrapping/checked casts, promoted arithmetic, compound/increment
narrowing, widening calls/returns, fitting constant arguments, generic
specializations and conversion-based overload selection/ambiguity.
`--suite integers` includes its runtime faults as well as compile-time/positive
cases. Use `--out validation\output\integer-widths` to retain a focused report
without overwriting the previous full-inventory report. The latter predates
System 0.3.0 and must not be interpreted as validation of the new compiler.
Run `node ..\dotnet\validation\differential.mjs --suite integers` for an
independent C# 7.0/VB 11 comparison.
