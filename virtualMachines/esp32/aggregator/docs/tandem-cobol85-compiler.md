# Tandem COBOL-85 compiler

The Tandem COBOL-85 front end builds on the existing COBOLish ANTLR grammar and
P-code backend. Compile a source file with:

```text
npm run compile:tandem-cobol85 -- --in source.cob --out program.pcode --map-out program.json
```

The language reference is the **HP COBOL Manual for TNS and TNS/R Programs,
522555-006**, supplied locally as `Downloads\Cobol85.pdf`. The grammar and
compiler must follow that manual; unsupported features are implementation gaps,
not a different definition of COBOL-85. The manual is not distributed with this
repository.

The compiler currently generates executable P-code for COBOL divisions,
fixed-point `PICTURE` arithmetic, elementary `VALUE` initialization, fixed-width
alphanumeric `MOVE`, recursive group moves, qualified data names, `MOVE`/`ADD`/
`SUBTRACT CORRESPONDING`, table subscripts, serial `SEARCH`, ascending or
descending `SEARCH ALL`, reference modification, `STRING` and multi-delimiter
`UNSTRING`, paragraphs and control flow, procedure sections and section
`PERFORM`/`THRU` ranges, plus indexed, sequential, and relative-file `OPEN`,
keyed or sequential `READ`,
`WRITE`, `REWRITE`, `START`, `DELETE`, and `CLOSE`. Read access to data items
that `REDEFINES` an alphanumeric item uses the shared byte layout; writes through
a redefining view remain unsupported. Indexed files use `SELECT ... ASSIGN TO
"root/path"` with a primary `RECORD KEY`, an optional `FILE STATUS`, and an `FD`
record. Sequential files receive generated, zero-padded record keys; relative
files use their numeric `RELATIVE KEY` as the ordered record key. Both
organizations use the filesystem-backed JSON record store, not native COBOL or
Enscribe file formats. `SELECT OPTIONAL`, sequential `EXTEND`, sequential and
dynamic relative access, and their tested file-status transitions are supported.
The tested file-I/O forms also include alternate indexed keys (including
duplicate-key status 02 and keyed reads), indexed sequential-write status 21,
variable-length records, LINAGE counters and end-of-page handling, WRITE
ADVANCING, and CLOSE WITH LOCK. File-specific `USE AFTER STANDARD ERROR
PROCEDURE` handlers run after the file status is updated and are excluded from
ordinary procedure fall-through. These behaviors are covered by the SQ/RL/IX
CCVS cases; declarative dispatch is not yet a complete implementation of every
COBOL-85 USE form. `USE FOR DEBUGGING` remains explicitly unsupported. Printer
advancement is represented by sequential control records; physical printer
rendering is outside this runtime.
`COPY` and `REPLACE` are expanded by
`src/cobol-text-preprocessor.mjs` before parsing (copybook text is passed as
`options.copybooks`); `EXEC` blocks still produce an explicit compilation
error. Group `VALUE` initialization and reference modification of numeric
storage also remain unsupported.

The grammar accepts the manual's full statement and clause formats. Constructs
that parse but have no code generation yet are rejected with
`[COBOLISH] <feature> is recognized but not yet implemented` by
`src/unsupported-features.mjs` or by code generation itself. They are never
silently dropped. A period ends the sentence and closes every open statement
scope.

## Manual-based regression tests

From the repository root:

```text
npm --prefix languages\cobolish85 test
npm --prefix languages\cobolish85 run test:nucleus
```

The default test command includes the 100-program nucleus catalog and the
manual-semantics regressions. Each nucleus program must compile, execute
without an error or instruction-limit hit, and emit exactly its own PASS line.
Compilation alone, skipped cases, and unsupported-feature diagnostics are not
counted as passes.

The syntax-foundation regressions cover leading-point numeric literals (including
signed `VALUE` and `MOVE`), comma/semicolon separators followed by whitespace,
space-separated subscripts, configuration-paragraph periods, `WITH DEBUGGING
MODE`, section headers and section ranges, and normal whitespace between
`END PROGRAM`. `SEGMENT-LIMIT` is checked for integer values 1 through 49 and
otherwise ignored, as specified by manual 6-7. Section segment numbers must be
integers 0 through 99. Segment-specific `ALTER` state remains unimplemented.
Existing compact comma-separated subscripts remain accepted for compatibility.

To measure parser progress separately from code generation and execution:

```text
npm --prefix languages\cobolish85 run test:syntax
```

This runs the 13 syntax-foundation regressions and a parse-only assertion for
each of the 113 CCVS-inspired programs. All 126 currently pass; a syntax pass is
not an execution pass. Each parse-only case is preprocessed with its copybooks.
The parser-only cases are opt-in and are not duplicated in the default test
run or default report; pass `tests/ccvs-syntax.mjs` explicitly to the report
command to report them.

The fixtures use standard COBOL source forms: arithmetic statements may span
lines without a continuation indicator in free-form input; elementary table
`VALUE` initializes every occurrence with the same value; paragraph routines
follow the main program's `STOP RUN` rather than enclosing its assertions.
The fixed-format CCVS adapter remains responsible for card-column continuation.

## CCVS-guided coverage suite

`tests/ccvs-coverage-suite.mjs` runs self-checking programs modelled on the
NIST CCVS85 modules NC (nucleus), SQ (sequential I-O), RL (relative I-O),
IX (indexed I-O), ST (SORT/MERGE), IC (inter-program communication), SM (COPY
and REPLACE), IF (intrinsic functions), SG (segmentation) and DB (debugging).
The cases live in `tests/ccvs/`; each one lists the CCVS programs it was
modelled on and displays a `PASS` line for every check, so its expected output
is exactly those lines in order. Expected values are derived from the COBOL 85
rules, not from another compiler.

The suite is part of `npm test` on purpose: cases that need features the
compiler does not implement yet fail rather than being skipped. Run it alone
with `npm --prefix languages\cobolish85 run test:ccvs`. File cases use an
in-memory file system and assign files to `"data/<name>"`. SM cases pass
library text to the compiler as `options.copybooks` (`{ NAME: text }`, or
`{ "LIBRARY/NAME": text }` for `COPY ... OF library`). DB cases are written in
reference format and converted with the fixed-format adapter, with debugging
lines enabled when `WITH DEBUGGING MODE` is present.

## Test report

```text
npm --prefix languages\cobolish85 run report
```

This runs the test files and writes `reports/cobol85-test-report.html` and a
PDF printed by headless Edge or Chrome. Each test has its own page showing the
COBOL program, the expected result, the actual result and any failure. A final
summary page gives totals, results by group or CCVS module, and the failed
tests. Pass specific test files to limit the run, `--out <dir>` to choose the
output directory, or `--no-pdf` to skip the PDF.

Important checked rules include:

- Sections 7-87 and 7-89/7-90: `JUSTIFIED` affects receiving moves, but not
  `VALUE` initialization; initial values must fit their `PICTURE`.
- Sections 4-21 and 7-80: subscripts are one-based, nested subscripts select
  the corresponding table occurrence, and `INDEXED BY` declares index-names.
- Section 9-128: a `MOVE` sender is evaluated once before assigning receivers.
- Sections 9-257/9-258 and 9-275/9-276: string operations preserve untouched
  positions, advance pointers by consumed characters, and dispatch overflow
  handlers.

Text operations use the existing desktop string host bindings, not new P-code
opcodes. Programs requiring those bindings declare the JavaScript target and
host ABI in their program maps; their runtime must supply the bindings.
Literal initialization and literal-to-elementary moves are resolved at compile
time and do not themselves require a text host.

The shared Pascalish library is `libraries/ISAM`. Its `ISAMFile` class wraps
the common `host.isam_*` ABI so Pascalish and other P-code compilers can use the
same indexed-file runtime operations. The JavaScript PMachine persists its
versioned index image through the granted filesystem root; this is a portable
runtime representation, not a byte-compatible Tandem Enscribe file. A writable
filesystem root must be configured by the host for `OUTPUT`, `I-O`, `EXTEND`,
and mutating operations.

The record-store implementation is now
[`libraries/isam/isam.pas`](../../libraries/isam/isam.pas), compiled to P-code
once on first use. [`pcode-isam.mjs`](../../libraries/isam/pcode-isam.mjs)
executes it on the JavaScript PMachine. The adapter keeps opaque serialized
library state, serializes calls, and forwards generic JSON, byte-comparison and
filesystem primitives. It contains no keyed-record algorithm. The old
`isam-library.mjs` remains a reference implementation; runtime bindings no
longer call it. The existing Pascalish `ISAMFile` facade and `host.isam_*`
signatures are unchanged.

The simple library implements primary-key WRITE, keyed READ, ordered READ NEXT,
START, REWRITE, DELETE, OPEN and CLOSE. Images retain the version-1
`{version,keyName,records}` format, with records sorted by UTF-8 byte order.
Writes persist before committing the handle's in-memory image. Storage errors
are rethrown, leave status `30`, and do not commit unpersisted records. Reopening
reloads disk instead of using a stale cache. Scans use a key cursor rather than
an array index, so deleting an earlier record cannot skip the next record.
Reads on OUTPUT/EXTEND return `47`; disallowed mutations return `49`.

For remote storage, supply `createFilesystemServiceClient(url).bindings` as
the service host's `filesystemBindingOverrides`, or pass them directly to
`createIsamBindings`. ISAM now honors those overrides, including their advertised
read/write capabilities, instead of bypassing them through local storage.
The filesystem server grants a separate writable logical root `isam`, confined
to `<dataRoot>/services/isam`. `/read`, `/exists`, and `/write` accept this root;
Librarian catalog-path restrictions and read-only schema grants are unchanged.
No client chooses an absolute server path.

CCVS execution now uses this real server, with a temporary data root and a
separate filename namespace per case. Its COBOL `data` grant maps explicitly to
the server's `isam` grant; ordinary deployments must configure their own grants.
All data-bearing ISAM bindings are asynchronous; direct JavaScript callers must
await them. `host.isam_status` returns the last completed operation's status
synchronously, as before.

The library is deliberately a simple permanent store: at most 64 open handles
per P-code binding, 1024 records and 240,000 UTF-8 bytes per image. Calls are
serialized process-wide; each file has one active open owner in that process,
and each operation reloads the durable image before reading or mutating it.
The filesystem server atomically replaces each JSON image, so a failed write
does not partially overwrite the prior image. This protects multiple hosted
services sharing one filesystem-service process. It does not coordinate
independent filesystem-service processes that share the same data directory,
or external programs that modify ISAM files directly. It rewrites whole images
and provides neither multi-operation transactions nor Enscribe compatibility.
Lock ownership is process-local, and declarative dispatch currently covers
file-specific standard-error procedures only; other USE forms and full manual
conformance remain incomplete.

COBOL file generation now uses the same group serialization/deserialization as
MOVE: WRITE FROM first populates the file record (including its key), successful
READ populates the file record and then its INTO target, and unsuccessful READ
preserves record data. RANDOM/DYNAMIC READ without NEXT uses the declared key.

Level-88 condition-names compile to comparisons against their conditional
variable (VALUE lists and THRU ranges, subscripted parents included), and
`SET condition-name TO TRUE` moves the first listed value. Figurative
constants expand in tested MOVE and comparison contexts. Built-in class tests,
abbreviated combined relations, `DIVIDE ... REMAINDER`, zero-divisor
`ON SIZE ERROR`, and integer-literal exponentiation compile without new
opcodes. `INSPECT` supports the tested TALLYING, REPLACING, CONVERTING, and
BEFORE/AFTER INITIAL forms; `INITIALIZE` handles tested group/table defaults
and category replacements. These implementations use generated P-code loops
and existing `host.string_index`/`host.string_slice` bindings.

Procedures are laid out in source order so control falls through between
paragraphs and sections. PERFORM arms an exit flag on the last procedure of its
range, CALLs the first procedure and RETs when control reaches that armed end;
this gives GO TO (a plain jump), GO TO DEPENDING ON (out of range falls
through), ALTER (a per-paragraph target index, reset when an independent
segment 50-99 is entered from another segment), NEXT SENTENCE (a jump to the
next period) and PERFORM VARYING ... AFTER. No new opcodes.

## P-code runtime libraries

`compileCobolishToPcode` accepts compiled library modules through
`options.pcodeLibraries`. A module supplies an `id`, `pcodeText`, `programMap`,
an `exports` object mapping public P-code labels to procedure names or labels,
and optionally an `initialize` procedure name. The linker copies only exported
procedures and their transitive `CALL` dependencies, namespaces implementation
labels and globals, inserts initializer calls at `MAIN`, and merges procedure,
host-capability, target, and source-map metadata. A library's `MAIN` is never
copied. Libraries that declare globals must provide an initializer; callers
must execute the linked program with its merged program map.

The COBOL compiler statically links `CobolRuntimeCore`, `CobolRuntimeText`, and
`CobolRuntimeMath` as needed. The libraries provide `ABS`, numeric and
alphanumeric `MAX`/`MIN`, `LENGTH`, `UPPER-CASE`, `LOWER-CASE`, `REVERSE`,
`CHAR`, `ORD`, `CURRENT-DATE`, the trigonometric and logarithmic functions,
`SQRT`, `FACTORIAL`, `INTEGER`, `INTEGER-PART`, `MOD`, `REM`, statistical
functions (`MEAN`, `MEDIAN`, `MIDRANGE`, `RANGE`, `SUM`, `VARIANCE`,
`STANDARD-DEVIATION`, `ORD-MAX`, and `ORD-MIN`), `NUMVAL`, `NUMVAL-C`,
date/integer conversions, `ANNUITY`, `PRESENT-VALUE`, and `RANDOM`.
`WHEN-COMPILED` is emitted as a compile-time value. The P-code wrappers are
reusable library procedures; their text, math, date, and random host primitives
currently target JavaScript and need corresponding ESP32 PMachine support before
these functions can run there. `PRESENT-VALUE` accepts period-end amounts
followed by the discount rate, and expands a table passed with `ALL`; `NUMVAL-C`
accepts its optional currency-sign argument.

The existing indexed-file backend remains behind `host.isam_*` bindings and
executes `libraries/isam/isam.pas` through its hardened adapter. It is not yet
statically linked into each COBOL program: doing so safely requires moving the
adapter's path/size validation, process-wide operation serialization, and
open-file ownership guarantees to shared filesystem-server primitives first.
The generic linker supports library globals and initialization, but that alone
is not a substitute for those storage guarantees.

Current validation: 225 of 274 default tests pass; 64 of the 113 executable
CCVS-guided programs pass (the suite also includes its catalog check). The
remaining 49 default test failures are still real conformance gaps, not
expected-pass substitutions.

Passing these tests does not establish full manual compatibility. Sequential
and relative I/O, additional statement execution,
and Tandem NonStop system intrinsics still need implementation and independent
conformance tests. Pulse-specific service and metadata clauses are extensions,
not syntax defined by the HP manual.

## ESP32 PMachine port backlog

COBOL semantics are implemented and tested on the JavaScript PMachine first.
The ESP32 PMachine (`pmachines/arduino/src/pmachine.cpp`) is updated later in
one batch. Until then, compiled COBOL programs that use the items below run
only on the JavaScript PMachine. New runtime semantics should prefer shared
opcodes or P-code libraries; anything that cannot must be added here.

| Item | Kind | Used for | ESP32 notes |
|---|---|---|---|
| `PUSH_DEC`, `DEC_CONV`, `DEC_QUANT`, `DEC_STR`, `DEC_FITS` | Opcodes (manifest `targets: ["js"]`) | Fixed-point `PICTURE` arithmetic, ROUNDED, ON SIZE ERROR | JS uses BigInt. COBOL-85 needs 18 digits (fits `int64_t`); the JS division intermediate uses scale 20, so ESP32 needs 128-bit or a bounded intermediate scale. |
| `DEC_DISPLAY precision scale` | Opcode `0x75` (`targets: ["js"]`) | Numeric DISPLAY and group serialization: zero-padded to PICTURE width, implied point omitted | Straightforward once a decimal value representation exists. |
| `CONCAT` | Opcode `0x6B` (`targets: ["js"]`) | DISPLAY lists, group MOVE | Header defines it but the manifest/compat check disagree (`check-pcode-compat.mjs` reports it). |
| P-code quoted-string escape decoding | Runtime parser | LOW-VALUE NUL bytes and escaped COBOL text constants | The JS parser now decodes JSON escapes; verify C++ parity in the later PMachine batch. |
| `host.string_*` text bindings, including `host.string_length` | Host ABI | Reference modification, STRING, UNSTRING, intrinsic text functions, group MOVE, class tests, INSPECT | Need native implementations or a P-code text library. |
| `host.math_*` numeric bindings | Host ABI | Transcendental and numeric intrinsic functions | Needs native math bindings and a decimal-result ABI. |
| `host.isam_*` and `host.fs_*` | Host ABI | Indexed files via `libraries/isam/isam.pas` | ISAM logic is already P-code; ESP32 needs the filesystem bindings (local flash or remote filesystem server). |

Programs requiring host bindings are tagged `targets: ["js"]` in their program
map. Run `node scripts/check-pcode-compat.mjs` from `aggregator` after porting;
it currently fails on pre-existing manifest gaps (`OP_FSM`, `OP_GPIO_WRITE`,
`OP_DELAY_MS`, `OP_CONCAT`).
