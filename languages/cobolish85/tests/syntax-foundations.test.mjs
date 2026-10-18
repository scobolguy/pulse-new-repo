import assert from 'node:assert/strict';
import { test, traceProgram, traceCheck, traceCompileError } from './support/trace.mjs';
import { parseCobolishWithAntlr } from '../src/cobolish-antlr-compiler.mjs';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { createDesktopTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-text-bindings.mjs';
import { segmentationDebugCases } from './ccvs/segmentation-debug.mjs';
import { fixedToFree } from '../validation/corpus.mjs';

function program(storage, procedure, configuration = '') {
  return `IDENTIFICATION DIVISION.
PROGRAM-ID. SYNTAX-CHECK.
${configuration ? `ENVIRONMENT DIVISION.\nCONFIGURATION SECTION.\n${configuration}` : ''}
DATA DIVISION.
WORKING-STORAGE SECTION.
${storage}
PROCEDURE DIVISION.
${procedure}`;
}

async function expectOutput(source, expected) {
  traceProgram(import.meta.url, source);
  const parsed = parseCobolishWithAntlr(source);
  traceCheck(import.meta.url, { description: 'Parser diagnostics', expected: [], actual: parsed.errors });
  assert.deepEqual(parsed.errors, []);
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
    description: 'Execution and DISPLAY output',
    expected: { error: null, stepLimitHit: false, stdout: expected },
    actual: { error: execution.error, stepLimitHit: execution.stepLimitHit, stdout: execution.stdout }
  });
  assert.equal(execution.error, null);
  assert.equal(execution.stepLimitHit, false);
  assert.deepEqual(execution.stdout, expected);
}

test('leading-point literals preserve sign and scale in VALUE, MOVE and expressions (chapter 3)', async () => {
  await expectOutput(program('01 N PIC S9V9(5) VALUE -.00123.', `
DISPLAY N.
MOVE +.5 TO N.
DISPLAY N.
COMPUTE N = N + .125.
DISPLAY N.
MOVE -.0 TO N.
DISPLAY N.
STOP RUN.`), ['-000123', '050000', '062500', '000000']);
  const source = program('01 N PIC S9V9(5).', 'MOVE -.5 TO N. STOP RUN.');
  traceProgram(import.meta.url, source);
  const assignments = parseCobolishWithAntlr(source).metadata.assignments;
  const expected = [{ value: '-.5', target: 'N' }];
  traceCheck(import.meta.url, { description: 'Metadata preserves a leading-point MOVE sender', expected, actual: assignments });
  assert.deepEqual(assignments, expected);
});

test('comma and semicolon separators act as spaces without changing literals (3-4/3-5)', async () => {
  await expectOutput(program('01 N PIC 9; VALUE 3.', `
MOVE, 4; TO, N;
DISPLAY, "A, B; C"; N.
STOP RUN.`), ['A, B; C4']);
});

test('separator punctuation without following whitespace is not a general separator (3-5)', () => {
  for (const procedure of ['MOVE 1;TO N.', 'MOVE,1 TO N.']) {
    const source = program('01 N PIC 9.', procedure);
    traceCompileError(import.meta.url, compileTandemCobol85ToPcode, source, /Parse failed/);
    assert.ok(parseCobolishWithAntlr(source).errors.length > 0);
    assert.throws(() => compileTandemCobol85ToPcode(source), /Parse failed/);
  }
});

test('subscripts accept space-separated and comma-separated expressions (4-19/4-21)', async () => {
  await expectOutput(program(`01 T.
05 R OCCURS 2 TIMES.
10 CELL PIC 9 OCCURS 2 TIMES.`, `
MOVE 7 TO CELL(2, 1).
DISPLAY CELL(2 1).
DISPLAY CELL(2,1).
STOP RUN.`), ['7', '7']);
});

test('SOURCE-COMPUTER and OBJECT-COMPUTER consume their final periods (6-4/6-7)', async () => {
  await expectOutput(program('', 'DISPLAY "CONFIG". STOP RUN.',
    'SOURCE-COMPUTER. CCVS-COMPUTER WITH DEBUGGING MODE.\nOBJECT-COMPUTER. CCVS-COMPUTER SEGMENT-LIMIT IS 10.'),
  ['CONFIG']);
});

test('SEGMENT-LIMIT accepts its boundary values but rejects out-of-range and fractional values (6-7)', () => {
  for (const value of ['1', '01', '49']) {
    const source = program('', 'STOP RUN.', `OBJECT-COMPUTER. CCVS-COMPUTER SEGMENT-LIMIT ${value}.`);
    traceProgram(import.meta.url, source);
    const errors = parseCobolishWithAntlr(source).errors;
    traceCheck(import.meta.url, { description: 'Parser diagnostics', expected: [], actual: errors });
    assert.deepEqual(errors, []);
    assert.doesNotThrow(() => compileTandemCobol85ToPcode(source));
  }
  for (const value of ['0', '50', '1.5', '-1']) {
    const source = program('', 'STOP RUN.', `OBJECT-COMPUTER. CCVS-COMPUTER SEGMENT-LIMIT IS ${value}.`);
    traceCompileError(import.meta.url, compileTandemCobol85ToPcode, source, /Parse failed/);
    assert.ok(parseCobolishWithAntlr(source).errors.length > 0);
    assert.throws(() => compileTandemCobol85ToPcode(source), /Parse failed/);
  }
});

test('configuration paragraphs reject a missing final period and incomplete DEBUGGING MODE (6-4)', () => {
  for (const configuration of [
    'SOURCE-COMPUTER. CCVS-COMPUTER',
    'SOURCE-COMPUTER. CCVS-COMPUTER WITH DEBUGGING.',
    'OBJECT-COMPUTER. CCVS-COMPUTER'
  ]) {
    const source = program('', 'STOP RUN.', configuration);
    traceCompileError(import.meta.url, compileTandemCobol85ToPcode, source, /Parse failed/);
    assert.ok(parseCobolishWithAntlr(source).errors.length > 0);
    assert.throws(() => compileTandemCobol85ToPcode(source), /Parse failed/);
  }
});

test('PERFORM a section includes every paragraph but not the following section (8-13)', async () => {
  await expectOutput(program('', `
MAIN-SECTION SECTION 0.
MAIN-PARA.
PERFORM WORK-SECTION.
DISPLAY "DONE".
STOP RUN.
WORK-SECTION SECTION 49.
DISPLAY "HEADER".
FIRST-PARA.
DISPLAY "FIRST".
SECOND-PARA.
DISPLAY "SECOND".
NEXT-SECTION SECTION 99.
NEXT-PARA.
DISPLAY "WRONG".`), ['HEADER', 'FIRST', 'SECOND', 'DONE']);
});

test('PERFORM THRU a section ends after that section and paragraph targets stay individual (8-13)', async () => {
  await expectOutput(program('', `
MAIN-SECTION SECTION.
MAIN-PARA.
PERFORM FIRST-PARA.
PERFORM WORK-SECTION THRU END-SECTION.
STOP RUN.
WORK-SECTION SECTION.
FIRST-PARA.
DISPLAY "FIRST".
SECOND-PARA.
DISPLAY "SECOND".
END-SECTION SECTION.
LAST-PARA.
DISPLAY "LAST".
AFTER-SECTION SECTION.
AFTER-PARA.
DISPLAY "WRONG".`), ['FIRST', 'FIRST', 'SECOND', 'LAST']);
});

test('sections fall through once in source order, including empty sections (8-13)', async () => {
  await expectOutput(program('', `
FIRST-SECTION SECTION 55.
DISPLAY "ONE".
P1.
DISPLAY "TWO".
EMPTY-SECTION SECTION.
LAST-SECTION SECTION 55.
P2.
DISPLAY "THREE".
STOP RUN.`), ['ONE', 'TWO', 'THREE']);
});

test('section segment attributes reject out-of-range and fractional numbers (8-13)', () => {
  for (const value of ['100', '1.5', '-1']) {
    const source = program('', `MAIN-SECTION SECTION ${value}.\nSTOP RUN.`);
    traceCompileError(import.meta.url, compileTandemCobol85ToPcode, source, /Parse failed/);
    assert.ok(parseCobolishWithAntlr(source).errors.length > 0);
    assert.throws(() => compileTandemCobol85ToPcode(source), /Parse failed/);
  }
});

test('END PROGRAM allows ordinary spaces, tabs and newlines between its words (chapter 2)', async () => {
  for (const separator of [' ', '   ', '\t', '\n']) {
    await expectOutput(program('', `DISPLAY "END". STOP RUN.\nEND${separator}PROGRAM SYNTAX-CHECK.`), ['END']);
  }
});

test('CCVS debugging-line cases now parse and execute with their intended source configuration', async () => {
  for (const id of ['DB-LINES-ON-01', 'DB-LINES-OFF-01']) {
    const entry = segmentationDebugCases.find(entry => entry.id === id);
    const source = fixedToFree(entry.source, { debug: /WITH\s+DEBUGGING\s+MODE/i.test(entry.source) });
    await expectOutput(source, entry.expected);
  }
});
