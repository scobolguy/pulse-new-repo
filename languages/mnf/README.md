# Minnesota FORTRAN (MNF)

A small, executable MNF-inspired compiler and an experimental FORTRAN 77 backend
targeting Pulse's shared p-machine.
Source files use **`.ftn`**. This is not the original Minnesota compiler and
does not claim full MNF, FORTRAN 66, or CDC binary compatibility.

## Historical reference

Clive F. Schofield, *The 'MNF' FORTRAN Compiler*, Lawrence Berkeley Laboratory,
LBL-1570, January 1973:
[catalog record](https://search.worldcat.org/title/3463380),
[institutional copy](https://escholarship.org/uc/item/02p1q620).
The supplied PDF contains 165 pages. Its introduction describes the Minnesota
compiler and its CDC targets; Appendix 4 describes format-free I/O. This starter
uses MNF's `PRINT, ...` form. The manual is a reference, not redistributed here.
Examples and implementation in this directory are new.

## Compile and test

From the repository root:

```powershell
node languages\mnf\src\compile-mnf-to-pcode.mjs languages\mnf\examples\nostalgia.ftn nostalgia.pcode
node --test languages\mnf\tests\*.test.mjs
node languages\mnf\validation\run.mjs
```

The compiler writes p-code and a companion `.program.json` map. Tests execute
the emitted instructions on the shared JavaScript p-machine, not a separate
FORTRAN evaluator. ESP32 and native C++ MNF execution have not been certified.

The compiler accepts `standard: 'starter' | 'fortran77' | 'auto'` (default
`auto`). Auto keeps the existing starter semantics when a whole program fits
that subset, otherwise it uses the FORTRAN 77 parser/backend. Select
`fortran77` explicitly for standard zero-trip DO behavior, even for simple
programs. The optional third CLI argument selects the same standard:

```powershell
node languages\mnf\src\compile-mnf-to-pcode.mjs program.ftn program.pcode fortran77
```

### Experimental FORTRAN 77 backend

The extended backend supports arrays (column-major storage), DATA and
implied-DO initialization, COMMON/EQUIVALENCE, by-reference subroutines and
functions, adjustable/assumed-size dummy arrays, logical and arithmetic IF,
computed/assigned GO TO, ENTRY, intrinsic/external procedure arguments,
DATA substrings, COMPLEX operations, and formatted/list-directed input/output. Its instructions
execute on the real JS p-machine using the bundled `fortran.*` runtime library.
REAL uses binary32 and DOUBLE PRECISION uses binary64, including mixed
arithmetic, conversions, intrinsic calls, and subprogram arguments/results.
Character scalars and arrays can be internal files. External sequential/direct,
formatted/unformatted files support OPEN, CLOSE, INQUIRE, REWIND, BACKSPACE,
ENDFILE, REC, IOSTAT and ERR/END branches. Console units 5/6 are preconnected.
Fixed-form blanks outside character/Hollerith literals are insignificant.

Extended artifacts declare `targets: ['js']`; Run/Debug and the direct ESP32
uploader reject them for unsupported hardware targets before deployment.
The starter still emits ordinary shared opcodes and retains its ESP32 path.
The ESP32 RTL port includes numeric/CHARACTER intrinsics, FORMAT editing,
internal files and confined node-local external sequential/direct,
formatted/unformatted files, including list-directed file input and preconnected
console READ from invocation `stdin` or explicitly enabled `uartInput` prompting
on the serial console (30-second record timeout). Full device-corpus certification remains
pending. Hardware
unformatted persistence is a distinct versioned format, not interchangeable with
the JS file envelope. See the [firmware RTL status](../../virtualMachines/esp32/pmachines/arduino/README.md#fortran-runtime-port-status).
ESP32 double-precision accuracy certification is not required for this port.

Passing the supplied corpus is **not a claim of full FORTRAN 77 conformance**.
Integers remain signed 32-bit, storage and execution have p-machine limits,
and file formats are Pulse runtime formats, not native compiler binary files.
Interactive PAUSE is not supported. Invalid and unsupported operations produce
compiler/runtime diagnostics rather than simulated success.

The JS execution API accepts `runtimeContext.stdin` (a string or record array)
and `runtimeContext.files` (a Map for persistent in-memory files), or
`runtimeContext.fileSystem` implementing asynchronous `readText`, `writeText`,
and `deleteFile`. A missing file returns `null`; other host errors propagate.
Unformatted records use a typed JSON envelope so they survive close/reopen and
separate executions using the same store.

Local extension Run/Debug uses confined persistent storage under
`.pulse-debug/fortran-data` beside the source. Configure
`pulse-pmachine.fortranInput` or `pulse-pmachine.fortranInputFile` for console
input. Debug launches can override these with `stdin`, `fortranInputFile`, and
`fortranDataDirectory`. File names cannot escape the configured data directory.
The web compile/run API accepts `stdin` separately from the message payload.

### Corpus validation

`npm run validate` in this directory attempts all 180 supplied FCVS programs.
Each compilation/execution runs in an isolated child process with a timeout.
The runner compares every output record with its `.reference_output`, ignoring
only trailing whitespace/blank records and the reference harness's `exit 0`
marker. A numerical test-summary match alone never counts as a pass.
It exits nonzero for compilation/runtime failures, timeouts, worker errors, or
output mismatches, and writes the per-program details and output to
[`reports/corpus-validation.json`](reports/corpus-validation.json).

```powershell
npm run validate -- --filter FM002
npm run validate -- --jobs 4 --timeout 30000 --report reports\corpus-validation.json
```

The report is a measurement of current support, not a certification. Existing
corpus attribution and reference input/output files are preserved. Each program's
`.reference_input`, when supplied, is loaded as console input.

The current full run records **180 reference-output matches out of 180 attempted**,
with no compilation/runtime failures, output mismatches, or timeouts. This result
is for the **JS p-machine only**, not ESP32. Re-run validation after compiler/runtime changes.

Run the complete corpus against an explicitly authorized ESP32 with:

```powershell
node languages\mnf\validation\run.mjs --node http://192.168.2.90
```

Use `--from FM411` to start at that program (inclusive) and run the remaining
corpus in filename order. Use a separate `--report` path to retain earlier results.

Hardware execution is sequential and uses the signed inline execution endpoint,
with `uartInput` disabled and supplied reference input as `stdin`. Debugger-only
source maps are omitted; runtime metadata and compiler target declarations are
retained, and normal deployment guards are not changed. The default report is
`reports/hardware-corpus-validation.json`, checkpointed after every program.
HTTP rejection, device communication failures, runtime errors and output
mismatches are recorded separately. Readiness is checked between programs; a
failed program is not automatically re-executed.
Hardware requests default to a 180-second execution deadline, configurable with
`--timeout`; the child process receives an additional 10 seconds for compilation
and reporting. FM107 takes approximately 90 seconds on the selected ESP32-S3
with node-local persistent file writes, so the former 45-second HTTP deadline
reported a timeout even when execution could finish correctly.

The runner refuses to start if a corpus fixture filename already exists and
cleans its known fixtures after the run. It changes the VM's current program.
Do not run other workloads or tests on that board concurrently.

The ESP32-S3 N16R8 run on 2026-10-29 attempted all 180 programs:
**137 exact reference-output matches**, **39 deployment rejections**, and
**4 runtime errors**, with no output mismatches among completed executions.
All 39 rejections were HTTP 400 `Invalid JSON body` for P-code larger than
65535 bytes (smallest rejected: 65611; largest passing: 65108). This identifies
an inline-deployment size boundary, not a measured failure of those programs'
runtime semantics. FM919-FM922 reached execution but rejected their
leading-blank FILE names under the firmware basename policy. Known corpus file
fixtures were cleaned, and the board was responsive after the run. These
results do not enable general extended-FORTRAN hardware deployment.

After widening inline JSON strings, preserving leading-blank filenames, selecting
the corrected AsyncTCP dependency and spooling inline console records to LittleFS,
the remaining FM500-FM922 segment was executed on the ESP32-S3:
**64 of 67 exact reference-output matches**, **2 runtime errors**, and **1 device
communication failure**. Results are in
[`reports/hardware-corpus-final-segment.json`](reports/hardware-corpus-final-segment.json)
through FM910 and
[`reports/hardware-corpus-tail.json`](reports/hardware-corpus-tail.json)
from FM912 onward; readiness failures after FM910 in the first report are
superseded by actual executions in the tail report after a board reset.
FM908 (internal formatted READ) and FM912 (direct formatted file READ) both
report unexpected EOF and reproduce independently. FM910 returned an incomplete
HTTP response and left the node unresponsive. FM919-FM922 now match exactly.
Earlier FM411 still has an output mismatch (test 34: computed 2, expected 6),
and FM413 lost its HTTP connection. FM403 passed three consecutive exact-output
reruns after record spooling. These segmented results are not a clean 180/180
run of the current firmware; hardware deployment guards remain enabled.

To run the same executable regression cases on an ESP32 instead of JavaScript:

```powershell
$env:MNF_ESP32_HOST = '192.168.2.90'
node --test languages\mnf\tests\compiler.test.mjs
Remove-Item Env:\MNF_ESP32_HOST
```

This uploads compiled programs to the selected board and checks its output.
Compiler-rejection tests still run on the host. The board needs working FFS or
the inline execution API. This is the starter-subset regression suite, not a
full FORTRAN 77 conformance/FCVS certification.

## Starter subset

- Fixed form: labels in columns 1-5, continuation in column 6, statements in
  columns 7-72; the sequence field after column 72 is ignored.
- Comment cards beginning with `C`, `c`, `*`, or `!` in column 1.
- Optional `PROGRAM`, scalar `INTEGER` and `REAL` declarations, and required `END`.
- Case-insensitive names of 1-6 letters/digits, starting with a letter.
- Implicit integer names I-N; other names are real unless explicitly declared.
- Assignments, parentheses, unary signs, `+`, `-`, `*`, `/`, and `**` with
  constant integer exponents 0-31.
- Labeled integer `DO`, including nested loops sharing a `CONTINUE` terminal.
  Start and limit expressions are evaluated once. Steps are nonzero integer
  constants. Loops use post-test behavior (the body runs at least once).
- `PRINT,` with numeric expressions and quoted strings, `GO TO`, `CONTINUE`,
  `STOP` with an optional numeric code, and `END`.
- Source maps for the PULSE p-machine debugger.

Output items are concatenated; add explicit string spaces/separators as needed.
Output uses the p-machine's numeric rendering, including scientific notation
for reals, not historical CDC field widths or carriage control. `STOP` codes
currently terminate execution without setting an operating-system exit code.

### Starter-only limits

Integers use the p-machine's signed 32-bit arithmetic and wrapping; reals use
single precision, not CDC 60-bit representation. Integer division truncates.
The current p-machine arithmetic returns zero for division by zero; this is not
an MNF compatibility guarantee. Assign variables before reading them.
REAL-to-INTEGER assignment is rejected rather than silently converted.

When explicitly selecting `starter`, tabs, blanks embedded inside identifiers/numbers/keywords, arrays, functions,
subroutines, COMMON, DATA, logical/complex/double-precision types, IF, formatted
I/O, input, slash I/O controls, and asterisk-delimited strings are not yet
supported. DO terminals must be `CONTINUE`; modifying an active control variable
is rejected. General exponent expressions are rejected.

## PULSE editor

- In Pulse Studio's VS Code extension, open a `.ftn` file to get MNF highlighting,
  column rulers, space indentation, **Run on PMachine**, and p-machine debugging.
  Rebuild/reload the extension to pick up the new language registration.
- The web frontend has an `/mnf` editor with Compile and Compile & Run using
  the existing `/api/develop/compile` endpoint. The frontend and backend must
  both be running. New-document metadata also registers `.ftn` as MNF.
- Fixed-form rulers mark columns 5, 6, 72 and 80. Automatic indentation and
  wrapping are disabled. No source-narrator stepping is presented as execution;
  real stepping is through the VS Code p-machine debugger.
