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
npm run validate -- --suite generics
npm run validate -- --case CS-GEN-001
npm run validate -- --suite runtime --out C:\temp\pulse-csharp-runtime
```

Selections: `all`, `core`, `generics`, `negative`, `runtime`, `unsupported`.
Unknown, duplicate, missing or empty selectors fail explicitly.

The default [report](../reports/ecma334-js-validation.json) is persisted after
each case and marked complete only after the selected run finishes. Generated
source, p-code and maps live in ignored `output/latest/<case-id>` directories.
With `--out`, artifacts and `results.json` are stored in the chosen directory.
Reports include Node/platform/target, timestamps, compiler and corpus hashes,
per-source hashes, expectations, observations and durations.

The initial inventory has 74 cases: 62 supported positive, required-negative
and runtime-error checks, plus 12 explicitly unsupported-feature probes.
Generic coverage includes explicit and inferred instantiation, multiple types,
forwarding, recursion, reuse, invalid bodies, conflicting inference and void
arguments. Tests execute the real JavaScript p-machine.

## Result accounting

| Status | Meaning |
| --- | --- |
| `pass` | A supported case satisfied every required check. |
| `fail` | Wrong output, diagnostic, exception, metadata, or unexpected acceptance/rejection. |
| `unsupported` | A declared unsupported probe was rejected with the expected diagnostic. Never counted as a pass. |
| `timeout` | A worker exceeded its ten-second deadline. |
| `infrastructure-error` | Worker/process/file/JSON failure prevented a valid observation. |

Each case runs in a separate Node process with bounded output, 100,000
instructions and 64 call frames. Positive cases require exact output and check
runtime flags, exit values and requested generic specialization identities.
Required-negative cases must fail compilation with `SyntaxError` and the
expected diagnostic; a compiler crash or later runtime fault cannot pass.
Runtime-error cases must first compile, then raise the specified exception.

The command exits 0 only when every selected case is `pass` or expected
`unsupported`; any failure, timeout or infrastructure error exits 1, and
invalid invocation/harness setup exits 2. `fullStandardConformance` is always
false. A passing filtered run does not imply the full inventory passed.
Hardware execution is reported as not run.

## Expanding the suite

Add independently written source and exact expectations to
[cases.mjs](cases.mjs); preserve existing IDs. When implementing a formerly
unsupported feature, move its probes to supported cases and add positive,
required-negative, boundary and runtime tests. Future milestones should add
generic classes/constraints, numeric conversions, arrays and object lifetimes,
then certify each additional p-machine target separately. Differential testing
against a real C# compiler is still future work.
