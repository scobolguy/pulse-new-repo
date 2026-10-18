import assert from 'node:assert/strict';
import { test, traceProgram, traceCheck, traceCompileError } from './support/trace.mjs';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { createDesktopTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-text-bindings.mjs';
import { createDesktopIntrinsicBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-intrinsic-bindings.mjs';

function program(storage, procedure) {
  return `IDENTIFICATION DIVISION.
PROGRAM-ID. LAYOUT-CHECK.
DATA DIVISION.
WORKING-STORAGE SECTION.
${storage}
PROCEDURE DIVISION.
${procedure}`;
}

async function runSource(source) {
  traceProgram(import.meta.url, source);
  const compiled = compileTandemCobol85ToPcode(source);
  const bindings = { ...createDesktopTextBindings(), ...createDesktopIntrinsicBindings() };
  const execution = await executeProgram({
    instructions: parsePcode(compiled.pcodeText),
    programMap: compiled.programMap,
    inputQueue: '',
    sourceMessage: '',
    runtimeContext: {
      callHost: (name, args) => {
        assert.equal(typeof bindings[name], 'function', `Missing host binding ${name}`);
        return bindings[name](...args);
      }
    }
  });
  traceCheck(import.meta.url, {
    description: 'Program completes without a runtime error',
    expected: 'No runtime error',
    actual: execution.error ? `Runtime error: ${execution.error}` : 'No runtime error'
  });
  assert.equal(execution.error, null);
  assert.equal(execution.stepLimitHit, false);
  return execution;
}

async function expectOutput(storage, procedure, expected) {
  const execution = await runSource(program(storage, procedure));
  traceCheck(import.meta.url, { description: 'DISPLAY output', expected, actual: execution.stdout });
  assert.deepEqual(execution.stdout, expected);
}

function expectCompileError(storage, procedure, pattern) {
  const source = program(storage, procedure);
  traceCompileError(import.meta.url, compileTandemCobol85ToPcode, source, pattern);
  assert.throws(() => compileTandemCobol85ToPcode(source), pattern);
}

test('group VALUE initializes subordinate items from the literal bytes (7-89)', async () => {
  await expectOutput(`01 HEADER VALUE "AB1234".
   05 CODE-PART PIC X(2).
   05 NUM-PART PIC 9(4).
01 STARS VALUE ALL "*".
   05 S1 PIC X(3).
   05 S2 PIC X(2).
01 ZEROED VALUE ZEROS.
   05 Z1 PIC 9(3).
   05 Z2 PIC X(2).`, `MAIN-LINE.
    DISPLAY HEADER.
    DISPLAY CODE-PART.
    ADD 1 TO NUM-PART.
    DISPLAY HEADER.
    DISPLAY STARS.
    DISPLAY S2.
    ADD 7 TO Z1.
    DISPLAY ZEROED.
    STOP RUN.`, ['AB1234', 'AB', 'AB1235', '*****', '**', '00700']);
});

test('group VALUE is restored by CANCEL in a called program', async () => {
  const execution = await runSource(`IDENTIFICATION DIVISION.
PROGRAM-ID. GROUP-RESET.
PROCEDURE DIVISION.
MAIN-LINE.
    CALL "SUB-GROUP"
    CALL "SUB-GROUP"
    CANCEL "SUB-GROUP"
    CALL "SUB-GROUP"
    STOP RUN.
IDENTIFICATION DIVISION.
PROGRAM-ID. SUB-GROUP.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 STATE-GROUP VALUE "XY00".
   05 STATE-TAG PIC XX.
   05 STATE-COUNT PIC 99.
PROCEDURE DIVISION.
SUB-MAIN.
    ADD 1 TO STATE-COUNT
    DISPLAY STATE-GROUP
    EXIT PROGRAM.
END PROGRAM SUB-GROUP.
END PROGRAM GROUP-RESET.
`);
  traceCheck(import.meta.url, { description: 'DISPLAY output', expected: ['XY01', 'XY02', 'XY01'], actual: execution.stdout });
  assert.deepEqual(execution.stdout, ['XY01', 'XY02', 'XY01']);
});

test('group VALUE rejects numeric literals and oversized literals', () => {
  expectCompileError(`01 G VALUE 12.
   05 A PIC 99.`, 'MAIN-LINE.\n    STOP RUN.', /Group VALUE for .* must be a nonnumeric literal/);
  expectCompileError(`01 G VALUE "ABC".
   05 A PIC XX.`, 'MAIN-LINE.\n    STOP RUN.', /Group VALUE for .* must be a nonnumeric literal/);
});

test('writes through an alphanumeric REDEFINES update the shared bytes (7-110)', async () => {
  await expectOutput(`01 BASE-TEXT PIC X(6) VALUE "ABCDEF".
01 BASE-VIEW REDEFINES BASE-TEXT.
   05 VIEW-HEAD PIC X(2).
   05 VIEW-TAIL PIC X(4).`, `MAIN-LINE.
    MOVE "ZZ" TO VIEW-HEAD.
    DISPLAY BASE-TEXT.
    MOVE "Q" TO VIEW-TAIL.
    DISPLAY BASE-TEXT.
    MOVE "123456" TO BASE-VIEW.
    DISPLAY VIEW-HEAD " " VIEW-TAIL.
    STOP RUN.`, ['ZZCDEF', 'ZZQ   ', '12 3456']);
});

test('numeric writes through REDEFINES update a numeric base and group base', async () => {
  await expectOutput(`01 AMOUNT PIC 9(4) VALUE 1234.
01 AMOUNT-PARTS REDEFINES AMOUNT.
   05 AMOUNT-HIGH PIC 99.
   05 AMOUNT-LOW PIC 99.
01 RECORD-AREA.
   05 REC-NAME PIC X(3) VALUE "ABC".
   05 REC-QTY PIC 9(3) VALUE 123.
01 RECORD-TEXT REDEFINES RECORD-AREA PIC X(6).`, `MAIN-LINE.
    MOVE 56 TO AMOUNT-LOW.
    DISPLAY AMOUNT.
    ADD 1 TO AMOUNT-HIGH.
    DISPLAY AMOUNT.
    ADD 1 TO AMOUNT.
    DISPLAY AMOUNT-LOW.
    MOVE "XYZ999" TO RECORD-TEXT.
    DISPLAY REC-NAME.
    ADD 1 TO REC-QTY.
    DISPLAY REC-QTY.
    STOP RUN.`, ['1256', '1356', '57', 'XYZ', '000']);
});

test('subscripted writes through a REDEFINES table update the base', async () => {
  await expectOutput(`01 PAIRS PIC X(6) VALUE "AABBCC".
01 PAIR-TABLE REDEFINES PAIRS.
   05 PAIR PIC XX OCCURS 3 TIMES.
01 IDX PIC 9 VALUE 3.`, `MAIN-LINE.
    MOVE "ZZ" TO PAIR (2).
    MOVE "YY" TO PAIR (IDX).
    DISPLAY PAIRS.
    STOP RUN.`, ['AAZZYY']);
});

test('reference modification writes numeric, group, and redefined items (6-11)', async () => {
  await expectOutput(`01 NUMBER-ITEM PIC 9(4) VALUE 1234.
01 GROUP-ITEM.
   05 GROUP-A PIC XX VALUE "AB".
   05 GROUP-N PIC 99 VALUE 12.
01 TEXT-BASE PIC X(4) VALUE "WXYZ".
01 TEXT-VIEW REDEFINES TEXT-BASE.
   05 TEXT-PART PIC X(4).`, `MAIN-LINE.
    MOVE "9" TO NUMBER-ITEM (2:1).
    DISPLAY NUMBER-ITEM.
    ADD 1 TO NUMBER-ITEM.
    DISPLAY NUMBER-ITEM.
    MOVE "Q7" TO GROUP-ITEM (2:2).
    DISPLAY GROUP-A GROUP-N.
    DISPLAY TEXT-PART (2:2).
    MOVE "--" TO TEXT-PART (3:2).
    DISPLAY TEXT-BASE.
    STOP RUN.`, ['1934', '1935', 'AQ72', 'XY', 'WX--']);
});

test('reference modification after subscripts reads and writes table elements', async () => {
  await expectOutput(`01 TABLE-AREA.
   05 ENTRY-TEXT PIC X(4) OCCURS 2 TIMES.
   05 ENTRY-NUM PIC 9(3) OCCURS 2 TIMES.`, `MAIN-LINE.
    MOVE "ABCD" TO ENTRY-TEXT (1).
    MOVE "EFGH" TO ENTRY-TEXT (2).
    MOVE 123 TO ENTRY-NUM (2).
    MOVE "XY" TO ENTRY-TEXT (2) (2:2).
    MOVE "8" TO ENTRY-NUM (2) (3:1).
    DISPLAY ENTRY-TEXT (2).
    DISPLAY ENTRY-TEXT (1) (3:2).
    DISPLAY ENTRY-NUM (2).
    STOP RUN.`, ['EXYH', 'CD', '128']);
});

test('byte-layout writes reject embedded-sign numeric items', () => {
  expectCompileError(`01 SIGNED-ITEM PIC S9(4) VALUE 12.`, `MAIN-LINE.
    MOVE "1" TO SIGNED-ITEM (1:1).
    STOP RUN.`, /embedded sign/);
});
