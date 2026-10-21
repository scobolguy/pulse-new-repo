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
that `REDEFINES` another item uses the shared byte layout, and writes through a
redefining view (including subscripted redefinitions and numeric overlays)
splice its DISPLAY bytes back into the redefined item. Byte-layout writes
reject signed numeric items whose sign is embedded rather than `SIGN
SEPARATE`. Indexed files use `SELECT ... ASSIGN TO
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
COBOL-85 USE form. The DB catalog also checks `USE FOR DEBUGGING` on procedures
with debugging mode enabled and disabled. Printer
advancement is represented by sequential control records; physical printer
rendering is outside this runtime. The tested Report Writer subset supports
`FD REPORT`, `RD` with `PAGE LIMIT`/`HEADING`/`FIRST DETAIL`/`LAST DETAIL`/
`FOOTING` and `CONTROL[S]` (including `FINAL`), report groups of every `TYPE`
(RH, PH, CH, DE, CF, PF, RF, long or abbreviated), multi-line groups with
absolute or `PLUS` lines and `LINE NEXT PAGE`, `NEXT GROUP`, `SOURCE`/`VALUE`,
edited pictures, `GROUP INDICATE`, `JUSTIFIED`, `BLANK WHEN ZERO`, `INITIATE`,
`GENERATE` of a detail group or of the report name (summary reporting),
`TERMINATE`, control-break processing (footings see the previous control
values), `SUM` counters with `UPON`, `RESET ON` and rolling forward, and
`USE BEFORE REPORTING` declaratives with `SUPPRESS PRINTING`. `SUM` is accepted
only in control footings, and crossfooting within one group is rejected.
`LINE-COUNTER` and `PAGE-COUNTER` are shared by all reports in a run unit, and
blank lines between printed lines are represented by the counters rather than
by empty records.
`COPY` and `REPLACE` are expanded by
`src/cobol-text-preprocessor.mjs` before parsing (copybook text is passed as
`options.copybooks`); `EXEC` blocks still produce an explicit compilation
error. Group `VALUE` initialization (nonnumeric literals and figurative
constants on non-table groups) is restored at program start and by `INITIAL`/
`CANCEL`. Reference modification can read and write numeric, group and
redefined items, including the subscript-then-modifier form `X(i)(s:l)`;
numeric items are modified through their DISPLAY representation.

The grammar covers the forms exercised by the regression suites, not every
manual or optional ANSI COBOL-85 module format. The tested Report Writer and
obsolete-feature forms have executable coverage or syntax-only classification;
Communications runtime behavior and additional optional-module forms remain
outside the configured environment. Constructs that parse but have no code
generation yet should be rejected with
`[COBOLISH] <feature> is recognized but not yet implemented` by
`src/unsupported-features.mjs` or by code generation itself. They are never
silently dropped. A period ends the sentence and closes every open statement
scope. The coverage suites also detect constructs that are accepted but produce
incorrect behavior; parser acceptance alone does not establish implementation.

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
integers 0 through 99. The SG catalog checks independent-segment `ALTER` reset
and fixed-segment state retention.
Existing compact comma-separated subscripts remain accepted for compatibility.

To measure parser progress separately from code generation and execution:

```text
npm --prefix languages\cobolish85 run test:syntax
```

This runs the 13 syntax-foundation regressions and a parse-only assertion for
each of the 139 CCVS-inspired scenarios: **152 checks, 152 pass, 0 fail**.
A syntax pass is not an execution pass. Each case is
preprocessed with its copybooks. The default run includes only the nine
external-environment syntax cases; parser checks for the 130 executable
scenarios are opt-in, not duplicated in the default run or report. Pass
`tests/ccvs-syntax.mjs` explicitly to the report command to report all syntax
checks.

The fixtures use standard COBOL source forms: arithmetic statements may span
lines without a continuation indicator in free-form input; elementary table
`VALUE` initializes every occurrence with the same value; paragraph routines
follow the main program's `STOP RUN` rather than enclosing its assertions.
The fixed-format CCVS adapter remains responsible for card-column continuation.

## CCVS-guided coverage suite

`tests/ccvs-coverage-suite.mjs` runs self-checking programs modelled on the
NIST CCVS85 modules NC (nucleus), SQ (sequential I-O), RL (relative I-O),
IX (indexed I-O), ST (SORT/MERGE), IC (inter-program communication), SM (COPY
and REPLACE), IF (intrinsic functions), SG (segmentation), DB (debugging),
RW (Report Writer), and OB (obsolete features). Communications (CM), tape
metadata/positioning, and operator STOP have separately labelled syntax-only
checks in `tests/ccvs-external-syntax.test.mjs`.
`tests/ccvs/catalog.mjs` is the shared catalog used by both execution and syntax
suites. Its integrity check requires all 13 corpus language modules, unique
case IDs, source references, and an explicit execution/syntax classification.
Executable cases display a `PASS` line for every check; their expected output
is exactly those lines in order. Expected values are independently authored
from COBOL rules, not copied from another compiler's actual output.

The suite is part of `npm test` on purpose: cases that need features the
compiler does not implement yet fail rather than being skipped. Run it alone
with `npm --prefix languages\cobolish85 run test:ccvs`; this also includes the
external-environment syntax checks. File cases use the real local filesystem
service with an isolated temporary data root and assign files to
`"data/<name>"`. SM cases pass
library text to the compiler as `options.copybooks` (`{ NAME: text }`, or
`{ "LIBRARY/NAME": text }` for `COPY ... OF library`). DB cases are written in
reference format and converted with the fixed-format adapter, with debugging
lines enabled when `WITH DEBUGGING MODE` is present.

### Expanded module inventory and baseline

The pinned original corpus has the following main-program inventory. Support
units, copybooks, data, and the EXEC harness are not additional language
modules. The RW/CM/OB scenarios cite all 20 main-program IDs in those formerly
omitted modules; this is a source cross-reference, **not** a claim that those
20 original programs have been executed or certified. CM and RW are optional
ANSI modules; their inclusion here does not imply that every facility appears
in the HP dialect manual.

| Module | Original main programs | Guided execution pass / fail | Guided syntax-only pass / fail |
| --- | ---: | ---: | ---: |
| NC | 95 | 42 / 0 | - |
| SQ | 84 | 15 / 0 | - |
| RL | 26 | 5 / 0 | - |
| IX | 29 | 9 / 0 | - |
| ST | 25 | 8 / 0 | - |
| IC | 25 | 13 / 0 | - |
| SM | 13 | 7 / 0 | - |
| IF | 45 | 11 / 0 | - |
| SG | 13 | 3 / 0 | - |
| DB | 15 | 5 / 0 | - |
| RW | 6 | 9 / 0 | - |
| CM | 9 | - | 6 / 0 |
| OB | 5 | 5 / 0 | 3 / 0 |
| **Total** | **390** | **132 / 0** | **9 / 0** |

There are **141 guided scenarios: 132 execution and nine syntax-only**.
The full default run is **331 tests: 331 pass, 0 fail, none skipped**. This
adds two Report Writer scenarios, nine data-layout tests
(`tests/data-layout.test.mjs`) and five Report Writer compile tests
(`tests/report-writer.test.mjs`) to the earlier 315. The expanded
suite includes executable Report Writer page/counter/output checks and the
previously failing IC, OB, and ST cases. It does not certify every original
CCVS85 program or every optional-module feature.

Current coverage limits:

| Area | Current validation | Remaining limitation |
| --- | --- | --- |
| RW | Nine executable cases cover FD REPORT/RD descriptions, INITIATE/GENERATE/TERMINATE, SOURCE/VALUE and columns, line/page counters, page limits, headings/footings, clause ordering, control breaks with CH/CF and FINAL, SUM subtotals with rolling forward, GROUP INDICATE, RH/RF, multi-line groups, NEXT GROUP NEXT PAGE, USE BEFORE REPORTING with SUPPRESS PRINTING and GENERATE report-name. Generated records are read back and checked line by line. | LINE-COUNTER/PAGE-COUNTER are shared across reports; SUM crossfooting and the original RW corpus programs are not executed. |
| CM | Six syntax-only cases parse COMMUNICATION SECTION/CD descriptions, queue metadata, ENABLE/DISABLE, ACCEPT count, RECEIVE message/segment, SEND indicators/destination tables and PURGE. | Runtime status/delivery behavior requires a configured message-control system; syntax acceptance is not an execution pass. |
| OB | Five executable cases pass, including numeric paragraph names, DATE-COMPILED and SORT in a called program. Three syntax-only cases parse STOP literal and tape label/positioning forms. | Operator suspension and tape volume/position semantics require their respective runtime devices. |
| IC | All 13 executable cases pass, including BY CONTENT mode inheritance, byte-layout aliases, identifier CANCEL and dynamic signature selection. | Broader calling conventions and external program-loading scenarios need separate coverage. |
| ST | All eight executable cases pass, including RETURN with NOT AT END and no AT END phrase. | No currently failing case in this catalog. |

STOP literal syntax currently passes, but operator suspension/continuation is
not implemented or counted as an execution pass. CM needs configured queues,
terminals and access keys; the harness does not invent successful MCS
delivery. Tape syntax acceptance will not establish volume/position behavior.
Original inspection/flagging tests remain distinct from automated execution;
the RW clause-order scenarios exercise legal source forms, not compiler
standards-flagging diagnostics.

These additions cover the omitted corpus sections, not every combination in
the standard. The native ESP32 engine below is checked against this catalog's
JavaScript output.

## SORT and MERGE

`SORT` supports multiple `USING` and `GIVING` files, or `INPUT PROCEDURE` and
`OUTPUT PROCEDURE` paragraph/section ranges, including `THRU`. `RELEASE` accepts
`FROM`; `RETURN` supports `INTO`, `AT END`, and `NOT AT END`. An exhausted
`RETURN` preserves both the SD record and the `INTO` receiver.

SORT uses stable bottom-up merging, preserving release/file order for equal
keys, including `WITH DUPLICATES IN ORDER`. Keys may mix ascending and
descending order. Numeric display keys are compared as exact fixed-point
values, including leading/trailing separate signs. Alphanumeric keys use
native character order unless `COLLATING SEQUENCE` names an `ALPHABET`;
custom alphabets support character/ordinal entries, ascending or descending
`THRU` ranges, and `ALSO` equivalences.

`MERGE` combines the ordered input-file runs with the same key comparison.
It checks each input run's order and reports `SORT-RETURN = 16` for an
unordered run. Successful operations leave `SORT-RETURN = 0`; automatic
file-operation errors, invalid RELEASE/RETURN phases, and recursive use of
the same SD file report `16`. File failures prevent subsequent output
processing. Filesystem transport exceptions still propagate rather than
being converted to a successful empty result. An unsuccessful automatic OPEN
does not close a file already owned by the calling program.

This implementation requires one fixed-length SD record and fixed-length,
sequential FD files for USING/GIVING. Signed numeric SD items require
`SIGN LEADING/TRAILING SEPARATE`; embedded sign storage is not implemented.
Other unsupported layouts are rejected explicitly.
Work records live in P-code string buffers, not an external disk-spill sorter;
available runtime memory and the PMachine instruction limit bound the dataset.
The existing filesystem image/record limits still apply to USING/GIVING.
The sort algorithm, buffering, and procedure dispatch are generated P-code:
there are no new JavaScript-only SORT/MERGE opcodes or host bindings. Running
them on native ESP32 hardware uses the COBOL engine below; USING/GIVING files
are delegated to the desktop file manager.

All seven ST CCVS cases and the additional edge/failure tests in
[`sort-merge.test.mjs`](../../../../languages/cobolish85/tests/sort-merge.test.mjs)
exercise compilation and execution, not just parser acceptance.

## Inter-program communication

Programs in one compilation unit, including nested and additional programs,
have separate data and procedure namespaces. A COBOL `CALL` can invoke an
included program by literal name or by an identifier holding its name.
`PROCEDURE DIVISION USING` parameters bind in declaration order; BY REFERENCE
uses live aliases to the caller's storage, including repeated arguments that
refer to the same item; alphanumeric storage can also be viewed through
different caller/LINKAGE field boundaries; BY CONTENT and BY VALUE receive
independent values. Linkage items may be groups and tables when their
elementary storage layouts match. A called program's WORKING-STORAGE persists
between calls, `INITIAL` resets it on entry, and `CANCEL` resets it. LOCAL-STORAGE
is reset on every call. `GLOBAL` items are visible to contained programs, and
`EXTERNAL` items with matching names share storage. Calls to unavailable programs take the
`ON EXCEPTION` or `ON OVERFLOW` branch when provided; otherwise the JavaScript
PMachine reports a runtime error.

The current implementation resolves calls only to programs included in the
same compilation unit. Recursive entry is not yet supported because
WORKING-STORAGE has one persistent instance per program. These behaviors are
covered by the IC CCVS cases and `inter-program.test.mjs`.

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

Before the module expansion, all 289 default tests passed, including 113
executable CCVS-guided programs and the catalog check. The expanded baseline
and its genuine outstanding failures are listed above.

Passing these tests does not establish full manual compatibility. Broader
statement/clause combinations and Tandem NonStop system intrinsics still need
implementation and independent conformance tests. Pulse-specific service and
metadata clauses are extensions, not syntax defined by the HP manual.

## ESP32 PMachine COBOL engine

COBOL semantics are implemented and tested on the JavaScript PMachine first.
The ESP32 PMachine runs the same P-code on a native engine, `cobolvm`
(`pmachines/arduino/src/cobol_vm*.cpp`), that reproduces `runtime.mjs`:

- `PUSH_DEC`/`DEC_*` arbitrary-precision decimal arithmetic (the scale-20
  division intermediate, ROUNDED, ON SIZE ERROR) and `DEC_DISPLAY`.
- `PUSH_REF` BY REFERENCE aliases (including `name@offset:length` byte
  slices), dynamically scoped `CALL` frames, and program-map params/locals.
- The `host.string_*`, `host.math_*` and date bindings, implemented natively.
- Quoted-string escape decoding (LOW-VALUE NUL bytes).

`parseTextPCode` recognises COBOL P-code (compiler header or COBOL-only
opcodes) and returns one `OP_COBOL_PROGRAM` (`0xFD`) instruction, which
`runInstructions` hands to the engine. That marker is native-only and is
deliberately not in the shared opcode manifest. Program maps pass COBOL
`globals` and procedure `locals` to the machine as `@globals` and
`@locals:LABEL` signature entries. Output, `__runtime_error`, the step count
and limit (200000), and globals are reported through the normal run results.

ISAM is not implemented on the device: the ISAM file manager runs on the
desktop. `host.isam_*` and `host.fs_*` calls are checked against the
binding contract and then delegated to the machine's host-call hook; without
one they fail with `Host binding unavailable`.

Parity is checked by exporting every executable CCVS case that needs no file
host (89 of 132) with its JavaScript output, then running the P-code through
`cobolvm` built with desktop g++; all outputs match line for line.

`node scripts/check-pcode-compat.mjs` (from `aggregator`) still reports the
pre-existing manifest gaps `OP_FSM`, `OP_GPIO_WRITE`, `OP_DELAY_MS` and
`OP_CONCAT`.
