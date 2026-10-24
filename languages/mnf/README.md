# Minnesota FORTRAN (MNF)

A small, executable MNF-inspired compiler targeting Pulse's shared p-machine.
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
```

The compiler writes p-code and a companion `.program.json` map. Tests execute
the emitted instructions on the shared JavaScript p-machine, not a separate
FORTRAN evaluator. ESP32 and native C++ MNF execution have not been certified.

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

### Limits

Integers use the p-machine's signed 32-bit arithmetic and wrapping; reals use
single precision, not CDC 60-bit representation. Integer division truncates.
The current p-machine arithmetic returns zero for division by zero; this is not
an MNF compatibility guarantee. Assign variables before reading them.
REAL-to-INTEGER assignment is rejected rather than silently converted.

Tabs, blanks embedded inside identifiers/numbers/keywords, arrays, functions,
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
