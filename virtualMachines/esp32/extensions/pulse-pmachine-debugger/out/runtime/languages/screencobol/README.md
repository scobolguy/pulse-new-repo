# SCREEN COBOL subset for Pulse Pathway

SCREEN COBOL `.scob` requesters compile through the formal
[ANTLR grammar](grammar/ScreenCobol.g4) into the existing p-machine P-code.
The grammar and generated parser are checked in. This is a deliberately small,
independently implemented subset of the NonStop SCREEN COBOL language, not
ordinary COBOL's SCREEN SECTION and not full HP source compatibility.

See the [working Pathway application](../../virtualMachines/esp32/pathway/README.md)
and [requester](../../virtualMachines/esp32/pathway/examples/echo.scob).

## Supported subset

- Case-insensitive COBOL division headers, one `PROGRAM-ID`.
- Elementary `01`/`77` working-storage items with `PIC X` or `PIC X(n)` and
  optional literal `VALUE`.
- `SCREEN SECTION`, `01 name SIZE rows, columns`, and elementary `05` fields.
- Vendor-style `AT row, column`; literals or matching-width `PIC X(n)` fields
  with `FROM`, `TO`, or `USING` working-storage associations.
- `DISPLAY [BASE] screen`, `ACCEPT screen`, literal `MOVE … TO item`.
- `SEND item TO "server-class" REPLY CODE integer YIELDS item`.
- Final `STOP RUN`.

The compiler rejects unknown syntax, missing symbols, duplicate names, layout
overlaps, field-width mismatches, and statements after STOP. Limits are 32 KiB
source, 64 working-storage items, one screen, 60 rows, 160 columns, and 512-byte
ASCII records. UTF-8/multibyte record layouts are intentionally not supported.

The requester host executes P-code with the versioned typed bindings
`screen.accept`, `screen.display`, and `pathway.send`. Each browser submission
is a fresh requester invocation; `ACCEPT` reads validated submitted fields and
`DISPLAY` updates the output values. Requester input is not executed as code.
Failures are displayed explicitly; inputs remain available for the user.

## Differences from the vendor implementation

This first slice does not implement paragraphs/PERFORM, repeating terminal
sessions, function keys, overlays, arbitrary screen attributes, numeric editing,
multiple SEND records/reply layouts, `ON ERROR`, Guardian binary reply-code
fields, PATHMON naming, transactions, or 6530 terminal protocols.
The transport envelope is JSON `{code, data}` carrying an ASCII record rather
than a Guardian binary message. It preserves the logical SEND/REPLY model, not
wire compatibility. The browser host handles error display outside the source
language. SCREEN COBOL requesters currently run on the JavaScript p-machine;
their servers may run on JavaScript or the bounded ESP32 host.

Syntax references: *Compaq NonStop Pathway/iTS SCREEN COBOL Reference Manual*,
426750-001, chapter 5 and chapter 6 (`DISPLAY`, `SEND`):
<http://www.nonstoptools.com/manuals/Scobol.pdf>.

## Build and test

```powershell
cd languages\screencobol
npm ci
npm run antlr:generate
npm test
```

Parser generation uses the existing repository ANTLR 4.13.2 tool and Java.
The extension recognizes `.scob` and provides **Pulse: Compile SCREEN COBOL
Requester**. Compiled requesters require the Pathway requester host; they are
not standalone console programs or ESP32 hardware handlers.
