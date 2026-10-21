# COBOL85 syntax audit and implementation plan

Date: 2026-10-17. Status: the syntax phase is complete. Every CCVS-inspired
program is accepted by the lexer/parser. Constructs that are recognized but not
yet executable are rejected by the compiler with an explicit diagnostic. The
original audit tables remain the pre-fix baseline.

## Semantic phase: SORT/MERGE

All seven ST execution cases now pass. Generated P-code implements stable
bottom-up SORT, ordered-run MERGE, multiple mixed-direction keys, exact
numeric display-key comparisons, custom ALPHABET collation, USING/GIVING,
INPUT/OUTPUT PROCEDURE ranges, RELEASE FROM, and RETURN INTO with EOF dispatch.
Additional regressions cover empty and repeated sorts, 64-record ordering
within the instruction limit, large fractional keys, collation equivalences,
multiple input/output files, unordered MERGE inputs, and file/phase errors.

The implementation uses in-memory fixed-record buffers and existing text and
file bindings, with no new VM opcodes. It currently requires a single
fixed-length SD record and fixed-length sequential USING/GIVING files; it does
not spill work records to disk. Native ESP32 support remains part of the
deferred PMachine port. See the compiler guide's
[SORT/MERGE section](tandem-cobol85-compiler.md#sort-and-merge).

The current default suite passes 278/287 tests; the nine failures are all in
inter-program communication. The CCVS execution suite passes 105/114 checks,
including the catalog check. Earlier milestone counts below are historical.

## Semantic phase: P-code ISAM foundation

The first semantic batch replaces the JavaScript ISAM engine in the runtime
path with [`isam.pas`](../../libraries/isam/isam.pas), compiled to P-code and
executed by [`pcode-isam.mjs`](../../libraries/isam/pcode-isam.mjs). Primary-key record operations, file modes, statuses, byte-ordered scans and
image updates are decided by P-code. The runtime adapter only transports calls
and opaque state; the existing `host.isam_*` ABI remains in use.

Persistence uses the filesystem server's new, root-confined `isam` grant,
separate from Librarian catalogs and schemas. Hosted ISAM now uses configured
filesystem overrides and their capabilities. CCVS execution runs against an
actual ephemeral server instead of an in-memory Map. Integration tests restart
that server and reopen the same image, check traversal/grant denial, and check
that a hosted caller with no local grants can use the remote filesystem. Process-wide operation serialization and open-file
ownership now prevent separate service hosts in the same runtime process from
overwriting one another's handles; each operation reloads the durable image
before using it. Binding disposal releases ownership. Generic adapters also
validate granted-root aliases, relative file paths and UTF-8 key/record bounds.
Images are capped at 240,000 bytes; individual records at 200,000 bytes. An
oversized or failed image replacement leaves the last committed JSON intact.

COBOL file code generation also fixes group-record WRITE/READ, WRITE FROM key
population, READ INTO, RANDOM/DYNAMIC keyed reads, and record preservation on a
failed READ. The reusable named-record helpers retain existing MOVE behavior.

| Check | Before | After |
|---|---:|---:|
| Default suite: passed / failed / total | 173 / 95 / 268 | 178 / 90 / 268 |
| CCVS programs executing successfully | 18 / 113 | 23 / 113 |
| Indexed CCVS programs executing successfully | 0 / 9 | 5 / 9 |
| Existing runtime ISAM regressions | 2 / 6 | 6 / 6 |

All 39 affected runtime, filesystem, shared-JSON and integration tests pass;
the syntax suite remains 126/126.

New tests cover compiled-P-code execution, every START comparator, byte
collation, cursor positioning/deletion, concurrent-call serialization, modes,
corrupt images, persistence-error rollback and exact 64-handle/1024-record
capacity boundaries. The coordination is process-wide, not cross-process:
deploy one filesystem-service writer for a data root, and do not modify ISAM
files outside the library while they're open. There are no multi-operation
transactions, write-ahead log or crash recovery beyond filesystem-server
atomic image replacement. The current focused SQ/RL/IX sweep passes all 29
cases, and all 20 P-code ISAM binding/server tests pass. Coverage includes
sequential and relative organizations, indexed sequential status `21`,
alternate keys, variable-length records, LINAGE/page advancement, CLOSE WITH
LOCK, and the tested file-specific standard-error declarative. LOW-VALUES/
collation and broader file/declarative conformance still need coverage. The
JSON-backed store does not claim Enscribe compatibility or full M6 conformance.

## Implementation progress: complete syntax coverage

The second batch extends the grammar (`languages/cobolish85/grammar/Cobolish85.g4`)
to the manual's statement and clause formats. It covers:

- **Statements:**
  - The full forms of ADD, SUBTRACT, MULTIPLY, DIVIDE, COMPUTE, SET, PERFORM, UNSTRING, OPEN, CLOSE, CALL, READ, WRITE, REWRITE, START and DELETE.
  - New statements: GO TO, ALTER, EXIT, NEXT SENTENCE, STOP literal, CANCEL, INSPECT, INITIALIZE, SEARCH, SORT, MERGE, RELEASE, RETURN and MOVE CORRESPONDING.
- **Declarations:** configuration, I-O and data-description clauses, and DECLARATIVES.
- **References and literals:** qualification, reference modification, `(ALL)` subscripts, figurative constants and ALL literals.
- **Conditions and expressions:** class, sign and abbreviated combined conditions, intrinsic functions, unary operators and `**`.

Structural changes:

- **Periods.** A period ends a sentence and closes every open statement scope. `sentence` no longer owns the period: paragraphs, sections and the procedure division accept `(sentence | DOT)*`. This matches the manual and removed a source of exponential ambiguity.
- **One rule per verb.** Each verb has one merged rule rather than overlapping "short" and "full" alternatives.
- **Two-stage parse.** `parseCobolishWithAntlr` first tries fast SLL prediction with a bail-out strategy. It reparses with full LL and normal error recovery only when SLL fails.
- **Decimal commas.** `cobol-text-preprocessor.mjs` rewrites decimal-comma numeric literals when `DECIMAL-POINT IS COMMA` is present, after COPY/REPLACE. PICTURE strings are left as written.

The codegen implements the following newly parsed forms:

- **Arithmetic:**
  - Multiple receivers with per-receiver ROUNDED, and the GIVING forms.
  - NOT ON SIZE ERROR.
- **SET:** TO, UP BY and DOWN BY on numeric items.
- **PERFORM:**
  - Out-of-line VARYING, and TIMES taken from an identifier.
  - WITH TEST AFTER.
- **Conditions:** sign conditions.
- **EVALUATE:**
  - `WHEN` THRU ranges, ANY, and conditions under `EVALUATE TRUE/FALSE`.
  - Several WHEN phrases sharing one set of statements.
- **Expressions:** unary plus and minus, and the QUOTE figurative constant.
- **Files and I/O:**
  - INVALID KEY / NOT INVALID KEY on READ, REWRITE, START and DELETE.
  - OPEN with several modes, and the NO REWIND phrases (no-ops for disk files).
  - DISPLAY ... WITH NO ADVANCING.

Everything else that parses but cannot yet run is rejected, never silently dropped:

- **Where it is checked.**
  - `languages/cobolish85/src/unsupported-features.mjs` rejects unsupported constructs after parsing and before code generation.
  - Code generation itself rejects unsupported operands and phrases.
- **What the error says.** `[COBOLISH] <feature> is recognized but not yet implemented (line n)`.
- **Old silent fallbacks.** Unknown statements, operands, operators and conditions used to be dropped or replaced by `0`. They now raise errors too.
- **Accepted layout clauses.** `SIGN`, `BLANK WHEN ZERO` and `OCCURS DEPENDING ON` are accepted. They do not change stored values, because values are held as abstract decimals and tables are allocated at their maximum size.

ISAM support now lives in `virtualMachines/esp32/libraries/isam/isam-library.mjs`. The runtime's `pmachines/javascript/src/isam-bindings.mjs` is a thin adapter that keeps the shared `host.isam_*` ABI.

Validation after this batch:

| Check | After batch 1 | After batch 2 |
|---|---:|---:|
| CCVS-inspired programs rejected by lexer/parser | 91 | 0 |
| `npm run test:syntax` (foundation + 113 parse-only) | 35 / 126 | 126 / 126 |
| CCVS-inspired programs passing execution checks | 4 | 18 |
| Original suites (`tests/*.test.mjs` + nucleus) | all pass | 152 / 152 |
| Default suite: passed / failed / total | 148 / 109 / 257 | 173 / 95 / 268 |

The 95 remaining default-suite failures contain no parse errors:

- **Most are explicit "not yet implemented" rejections.** These are, in order of frequency:
  - Intrinsic functions.
  - Sequential and relative file organizations.
  - Nested programs.
  - SORT/MERGE.
  - Declaratives.
  - GO TO/ALTER.
  - INSPECT.
  - Qualification.
  - Level-88 and level-66 items.
  - Edited PICTUREs.
- **Some are runtime mismatches.** For example:
  - Numeric/group MOVE representation.
  - SET of index data items.
  - Indexed-file records built from numeric group items.

These belong to milestones M3 through M9 below.

## Implementation progress: syntax foundations

The first batch implements:

- Leading-point numeric literals, including signed forms, numeric VALUE
  validation and MOVE metadata.
- Comma/semicolon separators followed by whitespace without changing literals;
  space-separated subscripts and parameter/argument lists. Existing compact
  comma-separated subscripts remain accepted for compatibility.
- SOURCE-COMPUTER/OBJECT-COMPUTER terminating periods, optional WITH DEBUGGING
  MODE, and SEGMENT-LIMIT syntax with its manual 1-through-49 range.
- Explicit section headers, optional segment numbers (integer 0 through 99),
  source-order execution, and section PERFORM/THRU boundaries.
- END PROGRAM with ordinary spaces, tabs or line breaks between its words.
- One parser entry point shared by metadata and P-code compilation, including
  the same segment-number diagnostics.
- The SQRT and ANNUITY expected stored values identified below are corrected.

The ANTLR JavaScript parser was regenerated, not hand-edited.

Validation after this batch:

| Check | Before | After |
|---|---:|---:|
| CCVS-inspired programs rejected by lexer/parser | 95 | 91 |
| CCVS-inspired programs passing parse-only checks | 18 | 22 |
| CCVS-inspired programs passing execution checks | 1 | 4 |
| Original regression tests passing | 130 | 130 |
| New syntax-foundation regressions passing | 0 | 13 |
| Default suite: passed / failed / total | 132 / 112 / 244 | 148 / 109 / 257 |

New execution passes are SG-ORDER-01, DB-LINES-ON-01 and DB-LINES-OFF-01.
NC-PICTURE-01 now parses but still requires storage/representation work.
No unsupported tests were skipped or converted to expected failures.

`npm --prefix languages\cobolish85 run test:syntax` runs the foundation
regressions and independent parse-only assertions for all 113 catalog programs.
The default test/report selection excludes those duplicate parse-only checks.
The machine-readable audit linked below is the original snapshot, not a
regenerated current-state report.

This is partial M0/M1 work, not completion of M1: period-driven implicit scope,
constrained PICTURE parsing, broader configuration clauses, declarations,
preprocessing and the remaining statement families still need implementation.
ISAM execution was not changed. File work should put reusable ISAM support in
an ISAM library called by the runtime library, retaining the existing shared
`host.isam_*` ABI rather than adding a COBOL-specific index engine.

## Authority and scope

The language authority is **HP COBOL Manual for TNS and TNS/R Programs,
522555-006, July 2005**, supplied as [Cobol85.pdf](C:/Users/scobo/Downloads/Cobol85.pdf).
References below are the manual's printed chapter-page numbers, not PDF page
numbers. CCVS supplies coverage ideas, not authority to override this dialect.
The attached compiler guide describes implementation status; it is not a
replacement language specification.

This audit covers all 113 programs in the current CCVS-inspired catalog:
NC, SQ, RL, IX, ST, IC, SM, IF, SG and DB. It does not establish coverage of
every CCVS program or every manual production. RW, CM and OB remain outside
this catalog's previously selected scope.

Evidence:

- Recompiled every case with the current compiler, recording all lexer/parser
  diagnostics and distinguishing parse failure from post-parse rejection.
- Ran the actual CCVS suite, with program/expected/actual tracing enabled.
- Inspected the grammar, metadata parser, code generator, case builders and
  test runner; checked the categories and important dialect differences
  against the supplied manual.
- [Machine-readable audit](../../../../languages/cobolish85/reports/cobol85-syntax-audit.json)
  records each program's source, expected output, diagnostics, compile stage,
  primary category and category references. It is a generated local report.
- No reference HP compiler was run. Expected-output issues identified below
  must be resolved from the manual, not assumed correct because a fixture
  cites a CCVS program.

## Verified baseline

The CCVS command is:

```text
npm --prefix languages\cobolish85 run test:ccvs
```

| Stage reached | Programs | Interpretation |
|---|---:|---|
| Lexer/parser rejection | 95 | 449 reported diagnostics, including recovery cascades |
| Parse succeeds; code generation rejects program | 12 | Not parser errors |
| Compiles; output differs | 2 | DISPLAY and MOVE representation/padding |
| Compiles; execution throws | 3 | Indexed-file record passed to host as a non-string |
| Compiles and passes | 1 | NC-ACCEPT-01 |
| **Total programs** | **113** | **112 fail, 1 passes** |

The suite also has one passing catalog-integrity test: **114 tests, 2 pass,
112 fail, 0 skipped, 0 TODO**. This audit reran that suite, not the separate
130-test baseline; the previously reported combined total was 244 tests.

| Module | Syntax rejection | Post-parse rejection | Compiles | Programs |
|---|---:|---:|---:|---:|
| NC | 36 | 3 | 3 | 42 |
| SQ | 7 | 8 | 0 | 15 |
| RL | 5 | 0 | 0 | 5 |
| IX | 6 | 0 | 3 | 9 |
| ST | 7 | 0 | 0 | 7 |
| IC | 9 | 0 | 0 | 9 |
| SM | 6 | 1 | 0 | 7 |
| IF | 11 | 0 | 0 | 11 |
| SG | 3 | 0 | 0 | 3 |
| DB | 5 | 0 | 0 | 5 |
| **Total** | **95** | **12** | **6** | **113** |

## Complete syntax-error categorization

Each rejected program is assigned exactly one **primary repair family** below,
so counts sum to 95. This is not a claim that a program has only one defect.
Secondary blockers are listed explicitly. For example, fixing configuration
paragraphs exposes missing debugging declaratives; fixing `RELATIVE KEY`
exposes missing relative-file execution.

Do not treat all 449 messages as separate defects. Unknown verbs often become
paragraph names, producing misleading "missing period" messages; unsupported
forms also cause long "no viable alternative" messages spanning earlier valid
statements. Repair the production, then rerun to expose the next blocker.

| Family | Programs | Missing or incorrect syntax | Manual references |
|---|---:|---|---|
| S01 Lexical numbers and separators | 2 | Leading decimal point, signed fractional literals, comma/semicolon separators outside literals and PICTURE | 3-4/3-5; Numeric Literals in chapter 3 |
| S02 Figurative constants | 2 | `ALL literal`, singular/plural QUOTE, HIGH-VALUE and LOW-VALUE forms in all literal contexts | Figurative Constants in chapter 3; 7-89; 9-128 |
| S03 Arithmetic statement formats | 6 | Operand lists, GIVING, INTO, REMAINDER, CORRESPONDING, multiple COMPUTE receivers, exponentiation, per-receiver ROUNDED, both size-error branches and scope terminators | 8-22/8-27, 8-43/8-48; 9-9/9-15, 9-41/9-43, 9-50/9-57, 9-132/9-137, 9-262/9-268 |
| S04 Qualified references | 1 | OF/IN qualification composed with subscripts | 4-18/4-24 |
| S05 Data-description variants | 3 | Condition-name VALUE lists/ranges, single-item RENAMES, COMPUTATIONAL usage synonym | 7-69; 7-91/7-97 |
| S06 Edited PICTURE strings | 2 | Currency, signs, punctuation, insertion and floating editing; lexer currently rejects `$` outright | 7-54/7-68 |
| S07 Conditions | 3 | Class/sign conditions and abbreviated combined relations | 8-53/8-68 |
| S08 Procedure control and selection | 6 | Sections, GO TO, ALTER, EXIT, broader PERFORM, EVALUATE selection objects, NEXT SENTENCE | 8-10/8-20; 9-16/9-17, 9-67/9-90, 9-157/9-176 |
| S09 Text verbs and initialization | 5 | All INSPECT formats, INITIALIZE, UNSTRING alternative/repeated delimiters and result clauses | 9-91/9-114; 9-257/9-261; 9-271/9-282 |
| S10 Table search and index operations | 4 | SEARCH/SEARCH ALL, table key clauses, SET lists and UP/DOWN BY | 7-79/7-86; 9-209/9-226 |
| S11 SPECIAL-NAMES | 2 | ALPHABET, CLASS, SYMBOLIC CHARACTERS, DECIMAL-POINT IS COMMA | 6-10/6-21 |
| S12 ACCEPT sources | 1 | ACCEPT FROM DATE/DAY/TIME/DAY-OF-WEEK | 9-6/9-8 |
| S13 File declarations and statement variants | 16 | SELECT OPTIONAL, RELATIVE/ALTERNATE KEY, RESERVE, variable records, LINAGE, mixed OPEN modes, CLOSE WITH LOCK, WRITE BEFORE/AFTER, READ/START/DELETE exception forms | 6-23/6-56; 7-5/7-29; 9-37/9-40, 9-45/9-46, 9-138/9-156, 9-177/9-199, 9-202/9-208, 9-237/9-251, 9-292/9-307 |
| S14 Declaratives | 4 | DECLARATIVES/END DECLARATIVES, sections, USE AFTER STANDARD ERROR/EXCEPTION and USE FOR DEBUGGING | 8-15/8-20; 9-283/9-291 |
| S15 SORT/MERGE | 7 | SORT, MERGE, RELEASE, RETURN, keys, procedures, duplicate ordering and collating sequence | 7-30/7-32; 9-119/9-127, 9-200/9-201, 9-227/9-236 |
| S16 Program units and interprogram calls | 9 | Contained programs, INITIAL/COMMON, GLOBAL/EXTERNAL, EXIT PROGRAM, CANCEL, USING lists and CALL exception forms | chapter 2; 5-4; 7-38/7-42, 7-52/7-53; 9-18/9-33, 9-76/9-80; 11-5 |
| S17 Source-text manipulation | 6 | COPY in data/environment, qualified libraries, pseudo-text and REPLACE; these must be expanded before normal parsing | 10-2/10-16 |
| S18 Intrinsic function identifiers | 11 | FUNCTION keyword, no-argument forms, nested functions, space/comma-separated arguments, ALL subscripts, function results as MOVE senders | chapter 14 |
| S19 Section segment attributes | 3 | Section headers with numbers and complete OBJECT-COMPUTER/SEGMENT-LIMIT paragraph syntax | 6-5/6-7; 8-13/8-14; ALTER/PERFORM rules |
| S20 Debug-source configuration | 2 | SOURCE-COMPUTER paragraph ending period and optional WITH DEBUGGING MODE | 6-4; chapter 16; 9-284/9-287 |
| **Total** | **95** | | |

### Exhaustive program assignment and secondary blockers

#### S01 - lexical numbers and separators (2)

- `NC-PICTURE-01`: `.00123` is rejected; also needs P scaling, REDEFINES
  storage overlays and separate-sign representation.
- `NC-SEPARATOR-01`: semicolons and leading-point numbers; also arithmetic
  operand lists and GIVING. Separators must respect required following space.

#### S02 - figurative constants (2)

- `NC-FIGCON-01`: ALL, QUOTE/QUOTES and HIGH/LOW variants need
  context-dependent expansion, not variable lookup. Fixed for tested literal,
  MOVE and comparison contexts.
- `IX-SEQ-CREATE-01`: LOW-VALUES initialization; subsequently needs correct
  record storage, key ordering and file-status execution.

#### S03 - arithmetic formats (6)

- `NC-MULTIPLY-01`: GIVING and END-MULTIPLY.
- `NC-DIVIDE-01`: INTO, GIVING, REMAINDER and END-DIVIDE. Tested REMAINDER
  and zero-divisor ON SIZE ERROR are fixed.
- `NC-ADD-01`: source lists, GIVING, NOT ON SIZE ERROR and END-ADD.
- `NC-SUBTRACT-01`: source lists, GIVING and END-SUBTRACT.
- `NC-COMPUTE-01`: `**`, multiple receivers and size-error behavior. Integer
  literal exponents are fixed; computed exponents remain unsupported.
- `NC-CORR-01`: ADD/MOVE/SUBTRACT CORRESPONDING; also qualified-name binding.

All need exact decimal execution, receiver-specific conversion, preservation
of receivers on handled size errors and unambiguous handler scope.

#### S04 - qualified references (1)

- `NC-QUAL-01`: full and abbreviated OF/IN qualification, then subscripts.
  A name-only global map cannot distinguish its two fields named F.

#### S05 - data descriptions (3)

- `NC-CONDNAME-01`: 88 VALUE lists, VALUES ARE and THRU; condition-name
  predicates and SET TO TRUE must reference the parent storage. Fixed.
- `NC-REDEFINES-01`: optional THRU in RENAMES; both RENAMES and REDEFINES
  must alias actual bytes, rather than allocate unrelated fields.
- `NC-USAGE-01`: COMPUTATIONAL synonym; also validate numeric representation
  and SYNCHRONIZED layout.

#### S06 - edited PICTURE (2)

- `NC-EDIT-01`: Z, currency, comma/period, asterisks, B, slash and zero
  insertion; editing/de-editing execution follows parsing.
- `NC-EDIT-02`: fixed/floating signs, CR/DB and BLANK WHEN ZERO.

#### S07 - conditions (3)

- `NC-CLASS-01`: built-in NUMERIC/ALPHABETIC class tests and optional IS/NOT
  are fixed for elementary fields.
- `NC-SIGN-01`: POSITIVE/NEGATIVE/ZERO on arithmetic expressions.
- `NC-ABBREV-01`: inherited subjects/operators in abbreviated conditions are
  fixed for the covered AND/OR, NOT and parenthesized forms.

#### S08 - procedure control (6)

- `NC-GOTO-01`: unconditional/computed GO TO and EXIT.
- `NC-ALTER-01`: ALTER and alterable GO TO; EXIT.
- `NC-PERFORM-01`: actual section nodes, section/range execution and a
  data-name TIMES count.
- `NC-PERFORM-02`: out-of-line VARYING/AFTER, WITH TEST AFTER, signed steps.
  Manual 9-168 permits AFTER phrases in out-of-line, not inline, PERFORM.
- `NC-EVALUATE-01`: THRU ranges, NOT objects and shared WHEN bodies.
- `NC-IF-01`: NEXT SENTENCE, real sentence boundaries and nested ELSE pairing.

#### S09 - text verbs (5)

- `NC-INSPECT-01`: tested TALLYING variants and BEFORE/AFTER INITIAL are fixed.
- `NC-INSPECT-02`: tested REPLACING variants and bounded scanning are fixed.
- `NC-INSPECT-03`: tested combined TALLYING/REPLACING and CONVERTING are fixed.
- `NC-INITIALIZE-01`: default/category-specific initialization and table items
  are fixed for the tested forms.
- `NC-STRING-01`: UNSTRING OR/ALL, DELIMITER IN, COUNT IN and TALLYING IN;
  also retain existing STRING pointer and overflow behavior.

#### S10 - tables (4)

- `NC-SEARCH-01`: serial SEARCH and VARYING.
- `NC-SEARCH-02`: ASCENDING/DESCENDING KEY in OCCURS and SEARCH ALL;
  also REDEFINES-backed table initialization.
- `NC-SET-01`: UP/DOWN BY and receiver lists; distinguish index-names from
  USAGE INDEX items.
- `NC-INDEX-01`: multiple SET receivers; also group/table storage and
  three-dimensional addressing. Existing expression subscripts are not the
  primary parse blocker.

#### S11 - SPECIAL-NAMES (2)

- `NC-SPECIAL-01`: ALPHABET, CLASS and SYMBOLIC CHARACTERS; class predicates
  and symbolic-character ordinal semantics.
- `NC-SPECIAL-02`: decimal-comma configuration, numeric literals and edited
  PICTURE strings. Global comma-to-period string replacement is not valid.

#### S12 - ACCEPT (1)

- `NC-ACCEPT-02`: date/day/time/weekday sources and fixed-width result
  representation. Capture one clock value per test or inject a clock to
  avoid midnight rollover making date/day assertions flaky.

#### S13 - files (16)

- `SQ-OPTIONAL-01`: SELECT OPTIONAL.
- `SQ-LOCK-01`: CLOSE WITH LOCK.
- `SQ-VARIABLE-01`: RECORD IS VARYING IN SIZE and DEPENDING ON.
- `SQ-ADVANCING-01`: BEFORE ADVANCING and singular LINE.
- `SQ-LINAGE-01`: LINAGE, LINAGE-COUNTER and AT END-OF-PAGE.
- `SQ-MULTI-OPEN-01`: RESERVE and multiple mode groups in one OPEN.
- `RL-SEQ-CREATE-01`: RELATIVE KEY.
- `RL-RANDOM-01`: RELATIVE KEY and random READ exception branches.
- `RL-DYNAMIC-START-01`: RELATIVE KEY and START/READ positioning.
- `RL-REWRITE-DELETE-01`: RELATIVE KEY, READ INVALID KEY and DELETE RECORD.
- `RL-STATUS-01`: SELECT OPTIONAL; sequential relative-file status rules.
- `IX-RANDOM-01`: READ INVALID KEY/NOT INVALID KEY.
- `IX-ALTERNATE-01`: ALTERNATE RECORD KEY WITH DUPLICATES.
- `IX-START-01`: both INVALID KEY branches on START.
- `IX-REWRITE-DELETE-01`: READ exception branches and DELETE RECORD.
- `IX-OPTIONAL-01`: SELECT OPTIONAL.

Every SQ/RL case subsequently needs an organization-specific runtime. IX cases
also need the existing group-record serialization defect fixed. Use statement
formats appropriate to organization/access mode; do not admit arbitrary clause
permutations just to suppress diagnostics.

#### S14 - declaratives (4)

- `SQ-DECLARATIVES-01`: error declarative section and USE AFTER STANDARD
  ERROR PROCEDURE; also sequential file execution.
- `DB-USE-ON-01`: debugging configuration and USE FOR DEBUGGING.
- `DB-USE-OFF-01`: same declarative must parse but remain inactive.
- `DB-ALL-PROCEDURES-01`: ALL PROCEDURES and debug special registers.

Declaratives are not ordinary paragraphs called during normal fall-through.

#### S15 - sorting and merging (7)

- `ST-USING-GIVING-01`: SORT USING/GIVING.
- `ST-MULTIKEY-01`: multiple ascending/descending key groups.
- `ST-INPUT-PROC-01`: INPUT/OUTPUT PROCEDURE, sections, RELEASE and RETURN;
  also DISPLAY-numeric reference modification in the input procedure.
- `ST-DUPLICATES-01`: WITH DUPLICATES IN ORDER; unnamed FILLER storage.
- `ST-MERGE-01`: MERGE with GIVING and OUTPUT PROCEDURE.
- `ST-COLLATING-01`: SPECIAL-NAMES ALPHABET and COLLATING SEQUENCE.
- `ST-NUMERIC-KEYS-01`: numeric key comparison and procedure-fed sorting.

These require SD descriptors, sequential-file execution and procedure control.
Parsing SORT without implementing its record flow is not a successful repair.

#### S16 - program structure and calls (9)

- `IC-CALL-REF-01`: contained program, space-separated PROCEDURE USING
  parameters, BY REFERENCE, EXIT PROGRAM.
- `IC-CALL-CONTENT-01`: same structure and BY CONTENT copies.
- `IC-STATE-01`: CANCEL, INITIAL and retained/reinitialized storage.
- `IC-GLOBAL-01`: GLOBAL and COMMON visibility.
- `IC-NESTED-01`: two nesting levels and lexical name hiding.
- `IC-EXCEPTION-01`: both exception branches and ON OVERFLOW form.
- `IC-EXTERNAL-01`: shared EXTERNAL record.
- `IC-LINKAGE-TABLE-01`: contained program, linkage table, condition-name
  and index semantics.
- `IC-NO-USING-01`: contained program, GLOBAL, dynamic target and GO TO.

The compilationUnit currently permits one programUnit, not the necessary
contained-program structure. END PROGRAM is also one whitespace-sensitive
lexer token; it should be parsed from keywords under normal separator rules.

#### S17 - preprocessing (6)

- `SM-COPY-DATA-01`: COPY in data descriptions.
- `SM-COPY-ENV-01`: COPY in configuration, then CLASS syntax.
- `SM-REPLACING-01`: pseudo-text, identifiers, words and literal replacements.
- `SM-COPY-LIBRARY-01`: OF/IN library qualification.
- `SM-REPLACE-01`: replacement scope, REPLACE OFF and data/procedure text.
- `SM-REPLACE-COPY-01`: replacement ordering around copied text.

The seventh SM case, `SM-COPY-PROC-01`, parses but is explicitly rejected by
code generation. All seven belong in one preprocessing workstream.
The compiler receives a copybooks option from the harness but does not consume
it to expand source. Resolve copybooks locally and report missing libraries,
recursive expansion and malformed pseudo-text explicitly.

#### S18 - intrinsic functions (11)

- `IF-TRIG-01`
- `IF-LOG-SQRT-01`
- `IF-INTEGER-01`
- `IF-STATS-01`
- `IF-ALPHA-01`
- `IF-CHAR-ORD-01`
- `IF-NUMVAL-01`
- `IF-DATES-01`
- `IF-FINANCE-01`
- `IF-RANDOM-01`
- `IF-CLOCK-01`

One shared function-identifier production should serve numeric expressions and
alphanumeric senders, supporting nested and parameterless functions. ALL in a
function argument subscript is not a normal scalar subscript. Validate the
chapter-14 signature, argument categories and result category for each
function, including special-register/clock behavior and random-sequence state.

The existing identifier-parenthesis functionCall rule is not the manual's
FUNCTION syntax, and its unsupported codegen path falls through to a zero
value. New forms must not inherit that success-shaped fallback.

#### S19 - segments (3)

- `SG-INDEPENDENT-01`: configuration terminators, section segment numbers,
  ALTER/GO TO/EXIT and independent-segment alter-state rules.
- `SG-SEGMENT-LIMIT-01`: configuration, SEGMENT-LIMIT and section attributes.
- `SG-ORDER-01`: numbered sections and source-order fall-through.

#### S20 - debug source configuration (2)

- `DB-LINES-ON-01`: WITH DEBUGGING MODE and paragraph terminator.
- `DB-LINES-OFF-01`: SOURCE-COMPUTER ending period even without the option.

The test harness already strips fixed-format D lines according to debug mode.
That does not prove the public compiler handles reference format: the public
entry point must use equivalent source processing with correct source maps.

## Not syntax errors: keep these separate

| Programs | Current post-parse blocker | Planned owner |
|---|---|---|
| NC-COMPARE-01 | HIGH/LOW-VALUE comparison expansion and P-code string escape decoding | Fixed in the JS compiler/runtime and the native ESP32 COBOL engine |
| NC-ODO-01 | Nested-group receiving MOVE explicitly unsupported | Storage layout and variable group length |
| NC-LIMITS-01 | END-ADD parsed as a name, then "undeclared" | Arithmetic grammar/scope first; precision tests afterward |
| SQ-WRITE-READ-01, SQ-NOT-AT-END-01, SQ-INTO-FROM-01, SQ-REWRITE-01, SQ-EXTEND-01, SQ-STATUS-4X-01, SQ-REWRITE-43-01, SQ-ODO-RECORD-01 | Sequential organization explicitly rejected | Sequential file execution |
| SM-COPY-PROC-01 | COPY requires expansion | Source-text preprocessing |

Compiling is not equivalent to executing correctly:

- `NC-DISPLAY-01`: numeric DISPLAY now emits picture-width digits and omits
  the implied decimal point (`042`, `150`, `042/150`).
- `NC-MOVE-01`: numeric-to-alphanumeric and literal-to-group assertions fail.
  The other three assertions in this case pass.
- `IX-SEQ-ERRORS-01`, `IX-EXTEND-01`, `IX-SCOPE-01`: runtime throws
  `Invalid host argument 3 for host.isam_write: expected string`.
  Fix record-area serialization and ABI typing; do not move standard record
  keys into WORKING-STORAGE to accommodate the implementation.
- `NC-ACCEPT-01` passes.

The runtime exception occurs before the harness records its execution check.
The reporting work should record thrown exceptions as actual failures too,
without turning them into successful/default results.

## Canonical-spec corrections and fixture checks

1. **SEGMENT-LIMIT is not an overlay-manager requirement in this dialect.**
   Manual 6-7 (PDF page 169) requires its value to be 1 through 49, but says
   the clause is otherwise ignored. Manual 8-14 (PDF page 350) says independent
   segments matter only to ALTER. Keep section attributes and the required
   ALTER state behavior; do not build physical overlays to satisfy the SG
   descriptions. The two SG expected trails are not disproved by this:
   correct the descriptions and separate syntax checks from state checks.
2. **Two intrinsic-function oracles exclude their correct truncated result.**
   `IF-LOG-SQRT-01` stores SQRT(2) in a six-fractional-digit receiver without
   ROUNDED, then requires a result strictly greater than 1.414213 and strictly
   less than 1.414214. There is no representable value satisfying that
   assertion. `IF-FINANCE-01` similarly excludes truncated ANNUITY(0.1, 2)
   = 0.576190. Use exact expected stored values, or tolerances that include
   the specified receiver conversion. References: 4-15, 8-23 and 9-41/9-43.
   Do not change compiler rounding to satisfy these tests.
3. **COPY replacement must be proven at text-word boundaries.**
   For the colon-delimited prefix template in `SM-REPLACING-01`, add an
   assertion for the expanded source and compare it with manual 10-5 and
   10-7/10-10 before accepting the expected WS-/ALT- names. Colons are
   separators during pseudo-text analysis. Do not implement generic substring
   substitution or assume another compiler's prefix extension is canonical.
   This is a fixture-verification item, not a confirmed invalid program.
4. **Descriptions are not coverage evidence.**
   `SQ-MULTI-OPEN-01` mentions SAME AREA but contains no I-O-CONTROL/SAME
   clause. `IX-START-01` mentions a partial key but never uses PART-KEY.
   Add real focused cases, with manual-legal declarations, or correct the
   descriptions. Do not count those features as tested.
5. **Source formats need explicit treatment.**
   Most fixtures use the project's free-form input convention. Distinguish
   that convenience from manual Tandem/ANSI reference formats; retain the
   fixed-format CCVS adapter and test equivalent reference-format programs.
6. **Compatibility requires negative tests too.**
   Generic truthy expressions are not a substitute for condition-names;
   unrestricted data-clause order, arbitrary level numbers and arbitrary
   PICTURE identifiers are not proof of correct manual syntax. Check accepted
   invalid inputs as well as rejected valid inputs.

## Implementation plan

### M0 - establish trustworthy tests and stage accounting

Dependencies: none.

- Correct the two impossible numeric assertions above; verify the other
  expected values when each feature is implemented. Keep unsupported features
  as failing tests, not skipped/TODO or changed-to-pass expectations.
- Annotate cases with manual references and primary/secondary blockers.
- Add parse-only assertions alongside compile/execute assertions, so grammar
  progress is measurable without pretending code generation is implemented.
- Capture thrown runtime errors in trace/report output, preserving failure.
- Save baseline totals for syntax, semantic/codegen and execution separately.

Exit: every case has a known stage and failure reason; report totals reconcile.

### M1 - source pipeline, lexical rules and procedure structure

Dependencies: M0.

- Define one compiler pipeline: source-format handling and source-text
  expansion, lexical/configuration handling, parsing, semantic validation,
  code generation, execution. Preserve original file/line/column provenance.
- Fix numeric literals/separators, configuration paragraph periods and
  context-sensitive decimal punctuation; preserve text literals unchanged.
- Give PICTURE its own constrained parsing/tokenization strategy; do not
  expand general expressions to accept arbitrary editing punctuation.
- Represent sections, paragraphs, sentences and declarative sections
  explicitly. A period ends a sentence and relevant implicit scopes;
  END-IF/END-ADD/etc. close their own statements, not arbitrary later input.
- Introduce missing statement keywords/terminators and normal separator
  handling for END PROGRAM. Preserve intentional Pulse extension syntax;
  audit keyword collisions instead of allowing any identifier as any verb.
- Regenerate the JavaScript parser with the existing ANTLR 4.13.2 generator.
  Never hand-edit generated parser files.

Exit: small positive/negative lexical, paragraph/section, period/scope and
configuration tests pass through both parser consumers. Existing syntax stays
working. SOURCE-COMPUTER and simple numbered-section errors disappear.

### M2 - source-text manipulation

Dependencies: M1 pipeline contract and source provenance.

- Implement COPY and REPLACE before ordinary COBOL grammar parsing, using
  manual text-word comparison, pseudo-text delimiters, replacement order,
  local library resolution and REPLACE OFF scope.
- Consume the harness's copybooks input; define the same resolver contract
  for the CLI instead of providing a test-only implementation.
- Preserve format/debug-line rules and copybook source locations. Explicitly
  diagnose missing books, recursion, unterminated pseudo-text and bad syntax.

Exit: all seven SM cases reach the intended stage, with independently checked
expanded text. Remaining failures in copied CLASS/text are assigned to their
real owners rather than COPY parsing.

### M3 - declarations, symbol binding and storage representation

Dependencies: M1.

- Add dedicated 66/77/88 entries, condition-name ranges, FILLER and usage
  synonyms; validate legal levels and clause combinations against chapter 7.
- Bind qualified names in program/record scopes instead of one flat name map.
- Implement storage offsets/views for groups, REDEFINES, RENAMES, tables,
  variable OCCURS lengths and separate signs. Reuse the storage view for
  group MOVE, DISPLAY representation and file records.
- Add GLOBAL/EXTERNAL attributes and explicit program ownership; nested
  program execution itself is M8.
- Extend the existing PICTURE helper with manual-constrained parsing and
  formatting; retain exact-decimal arithmetic and receiver conversion.

Exit: declaration/reference microtests pass, storage aliases are real, and
DISPLAY/MOVE/ODO/indexed-record regressions have independent focused tests.
No lossy JavaScript Number conversion for 18-digit values.

### M4 - arithmetic, conditions and core procedure control

Dependencies: M1 structure and M3 binding/conversion.

- Implement full arithmetic formats, exponent precedence, CORRESPONDING,
  receiver lists, rounding and both size-error branches.
- Implement class/sign/condition-name tests and expand abbreviated relations
  to explicit subject/operator comparisons before emission.
- Implement GO TO, EXIT, ALTER, PERFORM section/range/TIMES/VARYING/test-site,
  EVALUATE objects and NEXT SENTENCE with actual control-flow targets.
- Validate ranges, ALTER targets and segment constraints per the manual.
  SEGMENT-LIMIT accepts valid syntax but does not create physical overlays.

Exit: S03/S07/S08 and related post-parse cases pass in execution, with nested
handler/scope tests and negative semantic cases, not parse acceptance alone.

### M5 - text, tables, configuration and intrinsic functions

Dependencies: M3; control-flow forms use M4.

- Extend existing STRING/UNSTRING helpers; add INSPECT and INITIALIZE with
  byte-preserving semantics, category selection and table traversal.
- Implement SET variants and serial/binary SEARCH, validating SEARCH ALL
  table keys and legal condition forms.
- Implement SPECIAL-NAMES class/alphabet/symbolic character semantics,
  ACCEPT clock sources and chapter-14 intrinsic identifiers/signatures.
- Reuse existing text/date host bindings where semantics match. Add only
  missing operations; propagate capabilities and types through program maps.
  Function dispatch must reject unknown/unimplemented functions explicitly.
- Test random reseeding, compile-time WHEN-COMPILED and execution-time
  CURRENT-DATE separately; make clock tests deterministic.

Exit: S09/S10/S11/S12/S18 pass after fixture corrections; parsing and execution
agree about function result categories and receiving conversions.

### M6 - file syntax and organization-specific execution

Dependencies: M1 statement scopes, M3 record storage; procedure handlers use M4.

- Extend SELECT/FD and I-O statements to their manual-defined formats.
- Indexed group-record serialization, sequential and relative organizations,
  optional files, and tested open-mode/status transitions now use the shared
  filesystem-backed record store. Sequential files use generated record keys;
  relative files use padded numeric RELATIVE KEY values.
- Focused CCVS coverage now passes for alternate/duplicate keys, indexed
  sequential-access status 21, variable record lengths, LINAGE/page advancement,
  CLOSE WITH LOCK, and file-specific standard-error declaratives. Extend tests
  for remaining manual cases, harden declarative/file-status combinations, and
  keep portable backing-file representation separate from claims of Enscribe
  binary compatibility.

Exit: all 29 current SQ/RL/IX cases and the 20 P-code ISAM binding/server tests
pass. Remaining file work includes LOW-VALUES/collation, broader declarative
forms, and additional partial-key and SAME AREA cases.

### M7 - SORT/MERGE

Dependencies: M3 storage, M4 procedure ranges and M6 sequential I-O.

- Implement SD descriptors, SORT/MERGE keys, stable ordering and collating
  sequences, USING/GIVING, input/output procedures, RELEASE and RETURN.
- Preserve numeric comparison semantics and SORT-RETURN error propagation.
- Define and enforce sort-procedure record ownership/lifetime.

Exit: all seven ST cases execute; failure/empty-input and equal-key tests also
pass, without treating sort statements as no-ops.

### M8 - contained programs and call execution

Dependencies: M1 nested syntax, M3 scopes/storage and M4 control flow.

- Model compilation groups, containment and matching END PROGRAM boundaries.
- Implement linkage binding, BY REFERENCE/CONTENT, dynamic and literal call
  resolution, COMMON/GLOBAL visibility and EXTERNAL record sharing.
- Implement return control, INITIAL, retained working storage, CANCEL and
  both CALL exception branches under the manual's rules.
- Keep existing Pulse/host CALL behavior explicit; local program dispatch
  must not accidentally reinterpret existing service calls.

Exit: all nine IC cases execute with correct storage sharing and lifecycle;
negative visibility, missing-target and mismatched-boundary tests pass.

### M9 - declaratives, debugging and integration closure

Dependencies: M1 declarative structure, M4 procedures, M6 I-O; M8 for
program-scoped debugging state.

- File-specific USE AFTER STANDARD ERROR PROCEDURE dispatch now runs after
  status assignment and is excluded from ordinary procedure fall-through.
- Extend USE coverage to the remaining manual forms and implement WITH
  DEBUGGING MODE, reference-format D lines and DEBUG special registers,
  including inactive declaratives when debugging is off.
- Finish SG alter-state checks using manual behavior, not generic overlay
  assumptions.
- Re-run the complete suite, regenerate the per-program report and update
  the compiler guide's actual supported-feature claims.

Exit: catalog passes without skips, unsupported placeholders, silent defaults
or swallowed errors. The final report shows expected and actual output for
every program, and separate harness/metadata checks.

## Implementation surfaces and validation gates

- The former aggregator grammar copy is deleted; the active
  [grammar](../../../../languages/cobolish85/grammar/Cobolish85.g4)
  and its generated files are under the language package.
- Both [metadata parsing](../../../../languages/cobolish85/src/cobolish-antlr-compiler.mjs)
  and [executable compilation](../../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs)
  consume that parser. Update both when context shapes change.
- [Tandem entry point](../../../../languages/cobolish85/src/compile-tandem-cobol85-to-pcode.mjs),
  CLI and aggregator consumers must see the same preprocessing/configuration
  behavior; do not implement compatibility only in the test runner.
- [PICTURE helper](../../../../languages/cobolish85/src/cobol-picture.mjs),
  [fixed-format adapter](../../../../languages/cobolish85/validation/corpus.mjs),
  [CCVS harness](../../../../languages/cobolish85/tests/ccvs-coverage-suite.mjs)
  and [report generator](../../../../languages/cobolish85/scripts/generate-test-report.mjs)
  are directly affected.
- Shared runtime/text/date/file bindings and program-map capabilities must
  remain compatible with other P-code languages.

For each family, run the smallest focused parse/semantic/execution test set
first, including invalid variants. Regenerate the parser only for grammar
changes. Then run the existing baseline and the CCVS suite separately; full
`npm test` and report regeneration are integration gates.

Required final measurements:

1. Zero syntax failures for independently verified valid fixtures.
2. Zero post-parse implementation rejections for features claimed supported.
3. Exact expected output, no thrown/runtime error and no instruction-limit
   hit for every executable case.
4. All original tests preserved; corrected fixtures retain their intended
   standards coverage rather than weakening assertions.
5. No claim of full manual conformance from this finite inspired catalog.
