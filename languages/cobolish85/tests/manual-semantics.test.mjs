import assert from 'node:assert/strict';
import { test, traceProgram, traceCheck, traceCompileError } from './support/trace.mjs';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { createDesktopTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-text-bindings.mjs';

function program(storage, procedure) {
  return `IDENTIFICATION DIVISION.
PROGRAM-ID. MANUAL-CHECK.
DATA DIVISION.
WORKING-STORAGE SECTION.
${storage}
PROCEDURE DIVISION.
${procedure}`;
}

async function run(storage, procedure) {
  const source = program(storage, procedure);
  traceProgram(import.meta.url, source);
  const compiled = compileTandemCobol85ToPcode(source);
  const bindings = createDesktopTextBindings();
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

function expectOutput(execution, expected) {
  traceCheck(import.meta.url, { description: 'DISPLAY output', expected, actual: execution.stdout });
  assert.deepEqual(execution.stdout, expected);
}

function expectCompileError(storage, procedure, pattern) {
  const source = program(storage, procedure);
  traceCompileError(import.meta.url, compileTandemCobol85ToPcode, source, pattern);
  assert.throws(() => compileTandemCobol85ToPcode(source), pattern);
}

test('VALUE uses standard alignment; JUSTIFIED applies to subsequent MOVE (7-87, 7-90)', async () => {
  const execution = await run('01 ITEM PIC X(4) JUSTIFIED RIGHT VALUE "AB".', `
DISPLAY ITEM.
MOVE "C" TO ITEM.
DISPLAY ITEM.
MOVE "123456" TO ITEM.
DISPLAY ITEM.
STOP RUN.`);
  expectOutput(execution, ['AB  ', '   C', '3456']);
});

test('VALUE rejects nonzero numeric truncation and oversized strings (7-89, 7-90)', () => {
  for (const storage of ['01 ITEM PIC 99 VALUE 123.', '01 ITEM PIC 9V9 VALUE 1.25.',
    '01 ITEM PIC 99 VALUE -1.', '01 ITEM PIC X VALUE "AB".']) {
    expectCompileError(storage, 'STOP RUN.', /VALUE.*PICTURE/);
  }
});

test('MOVE snapshots its sender and truncates receiving numeric digits (9-128)', async () => {
  const execution = await run('01 A PIC 999 VALUE 123.\n01 B PIC 99.\n01 C PIC S9V9.', `
MOVE A TO B A.
MOVE -12.35 TO C.
DISPLAY A.
DISPLAY B.
DISPLAY C.
STOP RUN.`);
  expectOutput(execution, ['123', '23', '-23']);
});

test('group MOVE includes leading zero positions of DISPLAY numeric fields', async () => {
  const execution = await run(`01 SENDER.
05 A PIC 999 VALUE 12.
05 B PIC X VALUE "Z".
01 RECEIVER.
05 C PIC X(2).
05 D PIC X(2).`, `
MOVE SENDER TO RECEIVER.
DISPLAY C.
DISPLAY D.
STOP RUN.`);
  expectOutput(execution, ['01', '2Z']);
});

test('OCCURS one and nested subscripts use consistent storage (4-21, 7-80)', async () => {
  const execution = await run(`01 TABLE-ONE.
05 SINGLE-ITEM PIC 9 OCCURS 1 TIMES VALUE 4.
01 TABLE-TWO.
05 ROW-ITEM OCCURS 2 TIMES.
10 CELL PIC 9 OCCURS 2 TIMES VALUE 1.`, `
MOVE 8 TO CELL(2, 1).
DISPLAY SINGLE-ITEM(1).
DISPLAY CELL(1, 2).
DISPLAY CELL(2, 1).
DISPLAY CELL(2, 2).
STOP RUN.`);
  expectOutput(execution, ['4', '1', '8', '1']);
});

test('INDEXED BY declares a usable index-name (7-80)', async () => {
  const execution = await run('01 TABLE-ITEM.\n05 CELL PIC 9 OCCURS 3 TIMES INDEXED BY IDX.', `
SET IDX TO 2.
MOVE 7 TO CELL(IDX).
DISPLAY CELL(2).
STOP RUN.`);
  expectOutput(execution, ['7']);
});

test('STRING honors non-SIZE delimiters and preserves unused receiver positions (9-258)', async () => {
  const execution = await run('01 ITEM PIC X(6) VALUE "123456".', `
STRING "AB-CD" DELIMITED BY "-" "EF" DELIMITED BY "!" INTO ITEM END-STRING.
DISPLAY ITEM.
STOP RUN.`);
  expectOutput(execution, ['ABEF56']);
});

test('STRING partial overflow advances its pointer by characters actually moved (9-258)', async () => {
  const execution = await run('01 ITEM PIC X(4) VALUE "1234".\n01 PTR PIC 9 VALUE 3.', `
STRING "ABCDE" DELIMITED BY SIZE INTO ITEM WITH POINTER PTR
ON OVERFLOW DISPLAY "OVERFLOW"
NOT ON OVERFLOW DISPLAY "UNEXPECTED"
END-STRING.
DISPLAY ITEM.
DISPLAY PTR.
STOP RUN.`);
  expectOutput(execution, ['OVERFLOW', '12AB', '5']);
});

test('STRING invalid initial pointer leaves sender, receiver and pointer intact (9-258)', async () => {
  const execution = await run('01 ITEM PIC X(4) VALUE "1234".\n01 PTR PIC 9 VALUE 0.', `
STRING "AB" DELIMITED BY SIZE INTO ITEM WITH POINTER PTR
ON OVERFLOW DISPLAY "OVERFLOW"
END-STRING.
DISPLAY ITEM.
DISPLAY PTR.
STOP RUN.`);
  expectOutput(execution, ['OVERFLOW', '1234', '0']);
});

test('STRING permits NOT ON OVERFLOW without an ON OVERFLOW phrase (9-258)', async () => {
  const execution = await run('01 ITEM PIC X(4) VALUE SPACES.', `
STRING "AB" DELIMITED BY SIZE INTO ITEM
NOT ON OVERFLOW DISPLAY "COMPLETE"
END-STRING.
DISPLAY ITEM.
STOP RUN.`);
  expectOutput(execution, ['COMPLETE', 'AB  ']);
});

test('UNSTRING leaves unvisited receivers intact and advances over delimiters (9-275, 9-276)', async () => {
  const execution = await run(`01 ITEM PIC X(4) VALUE "A--B".
01 PTR PIC 9 VALUE 1.
01 A PIC X VALUE "X".
01 B PIC X VALUE "X".
01 C PIC X VALUE "X".
01 D PIC X VALUE "X".`, `
UNSTRING ITEM DELIMITED BY "-" INTO A B C D WITH POINTER PTR
ON OVERFLOW DISPLAY "UNEXPECTED"
NOT ON OVERFLOW DISPLAY "COMPLETE"
END-UNSTRING.
DISPLAY A.
DISPLAY B.
DISPLAY C.
DISPLAY D.
DISPLAY PTR.
STOP RUN.`);
  expectOutput(execution, ['COMPLETE', 'A', ' ', 'B', 'X', '5']);
});

test('UNSTRING reports unexamined input when receivers are exhausted (9-275)', async () => {
  const execution = await run('01 ITEM PIC X(3) VALUE "A-B".\n01 PART PIC X.', `
UNSTRING ITEM DELIMITED BY "-" INTO PART
ON OVERFLOW DISPLAY "OVERFLOW"
END-UNSTRING.
DISPLAY PART.
STOP RUN.`);
  expectOutput(execution, ['OVERFLOW', 'A']);
});

test('reference modification allows omitted length and pads only the receiving slice', async () => {
  const execution = await run('01 ITEM PIC X(5) VALUE "ABCDE".', `
MOVE "X" TO ITEM(2:2).
DISPLAY ITEM.
DISPLAY ITEM(4:).
STOP RUN.`);
  expectOutput(execution, ['AX DE', 'DE']);
});

test('alphanumeric comparisons pad the shorter operand on the right', async () => {
  const execution = await run('01 ITEM PIC X(4) VALUE "AB".', `
IF ITEM = "AB" DISPLAY "EQUAL" END-IF.
IF "AB" = ITEM DISPLAY "EQUAL" END-IF.
STOP RUN.`);
  expectOutput(execution, ['EQUAL', 'EQUAL']);
});

test('nonnumeric literals use doubled delimiters, not C escapes', async () => {
  const execution = await run('01 ITEM PIC X.', `
DISPLAY "A""B".
DISPLAY 'C''D'.
DISPLAY "C:\\TEMP".
STOP RUN.`);
  expectOutput(execution, ['A"B', "C'D", 'C:\\TEMP']);
});

test('PERFORM UNTIL tests before executing and undefined paragraphs are diagnosed', async () => {
  const execution = await run('01 N PIC 9 VALUE 3.', `
PERFORM UNTIL N >= 3
ADD 1 TO N
END-PERFORM.
DISPLAY N.
STOP RUN.`);
  expectOutput(execution, ['3']);
  expectCompileError('', 'PERFORM MISSING-PARA.\nSTOP RUN.', /Invalid PERFORM/);
});

test('execution starts in the first paragraph and falls through subsequent paragraphs (8-11)', async () => {
  const execution = await run('', `FIRST-PARA.
DISPLAY "FIRST".
SECOND-PARA.
DISPLAY "SECOND".
STOP RUN.`);
  expectOutput(execution, ['FIRST', 'SECOND']);
});

test('text host requirements are declared in the program map', () => {
  const source = program('01 ITEM PIC X(4).', 'MOVE "AB" TO ITEM(1:2).\nSTOP RUN.');
  traceProgram(import.meta.url, source);
  const compiled = compileTandemCobol85ToPcode(source);
  traceCheck(import.meta.url, {
    description: 'Program map host requirements',
    expected: { hostBindingsVersion: 1, targets: ['js'] },
    actual: { hostBindingsVersion: compiled.programMap.hostBindingsVersion, targets: compiled.programMap.targets }
  });
  assert.equal(compiled.programMap.hostBindingsVersion, 1);
  assert.deepEqual(compiled.programMap.targets, ['js']);
});

test('IF accepts optional THEN and word-form relational operators', async () => {
  const execution = await run('01 N PIC 9 VALUE 3.', `
IF N IS GREATER THAN OR EQUAL TO 3 DISPLAY "GE" END-IF.
IF N IS NOT LESS THAN 2 DISPLAY "NOT LT" END-IF.
IF N IS EQUAL TO 3 THEN DISPLAY "EQ" END-IF.
IF N NOT = 4 DISPLAY "NE" END-IF.
STOP RUN.`);
  expectOutput(execution, ['GE', 'NOT LT', 'EQ', 'NE']);
});
