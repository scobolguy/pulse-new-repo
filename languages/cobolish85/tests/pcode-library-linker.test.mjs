import assert from 'node:assert/strict';
import test from 'node:test';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { linkPcodeLibraries } from '../../../virtualMachines/esp32/pmachines/shared/pcode-library-linker.mjs';
import { createDesktopTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-text-bindings.mjs';
import { createDesktopIntrinsicBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-intrinsic-bindings.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';

async function execute(compiled) {
  const bindings = { ...createDesktopTextBindings(), ...createDesktopIntrinsicBindings() };
  return executeProgram({
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
}

function cobol(procedure, storage = '') {
  return `IDENTIFICATION DIVISION.
PROGRAM-ID. PCODE-LIBRARY-TEST.
DATA DIVISION.
WORKING-STORAGE SECTION.
${storage}
PROCEDURE DIVISION.
${procedure}`;
}

test('static P-code library linking preserves strings, decimals, and scalar returns', async () => {
  const compiled = compileTandemCobol85ToPcode(cobol(`
MOVE FUNCTION UPPER-CASE(TEXT-VALUE) TO RESULT-TEXT.
DISPLAY RESULT-TEXT.
MOVE FUNCTION REVERSE("ABC") TO RESULT-TEXT.
DISPLAY RESULT-TEXT.
COMPUTE RESULT-NUMBER = FUNCTION ABS(-12.5).
DISPLAY RESULT-NUMBER.
STOP RUN.`, `
01 TEXT-VALUE PIC X(6) VALUE "AbCdEf".
01 RESULT-TEXT PIC X(6).
01 RESULT-NUMBER PIC S9V99.`));

  const execution = await execute(compiled);
  assert.equal(execution.error, null);
  assert.deepEqual(execution.stdout, ['ABCDEF', 'CBA   ', '250']);
  assert.deepEqual(compiled.programMap.targets, ['js']);
  assert.deepEqual(compiled.programMap.linkedLibraries.map(item => item.id), ['CobolRuntimeText', 'CobolRuntimeCore']);
  assert.ok(compiled.programMap.procedures.PROC_COBOL_RT_UPPER);
});

test('intrinsic runtime libraries implement length and numeric/alphanumeric extrema', async () => {
  const compiled = compileTandemCobol85ToPcode(cobol(`
COMPUTE NUMBER-RESULT = FUNCTION LENGTH("ABC").
DISPLAY NUMBER-RESULT.
COMPUTE NUMBER-RESULT = FUNCTION MAX(3 9 2).
DISPLAY NUMBER-RESULT.
COMPUTE NUMBER-RESULT = FUNCTION MIN(3 9 2).
DISPLAY NUMBER-RESULT.
MOVE FUNCTION MAX("PEAR" "APPLE" "PLUM") TO TEXT-RESULT.
DISPLAY TEXT-RESULT.
MOVE FUNCTION MIN("PEAR" "APPLE" "PLUM") TO TEXT-RESULT.
DISPLAY TEXT-RESULT.
STOP RUN.`, `
01 NUMBER-RESULT PIC 99.
01 TEXT-RESULT PIC X(5).`));

  const execution = await execute(compiled);
  assert.equal(execution.error, null);
  assert.deepEqual(execution.stdout, ['03', '09', '02', 'PLUM ', 'APPLE']);
});

test('math intrinsics call numeric host primitives through the linked runtime module', async () => {
  const compiled = compileTandemCobol85ToPcode(cobol(`
COMPUTE RESULT-NUMBER = FUNCTION COS(0).
IF RESULT-NUMBER = 1 DISPLAY "COS PASS" ELSE DISPLAY "COS FAIL".
COMPUTE RESULT-NUMBER = FUNCTION LOG10(1000).
IF RESULT-NUMBER = 3 DISPLAY "LOG10 PASS" ELSE DISPLAY "LOG10 FAIL".
COMPUTE RESULT-NUMBER = FUNCTION FACTORIAL(5).
IF RESULT-NUMBER = 120 DISPLAY "FACTORIAL PASS" ELSE DISPLAY "FACTORIAL FAIL".
COMPUTE RESULT-NUMBER = FUNCTION INTEGER(-1.5).
IF RESULT-NUMBER = -2 DISPLAY "INTEGER PASS" ELSE DISPLAY "INTEGER FAIL".
COMPUTE RESULT-NUMBER = FUNCTION INTEGER-PART(-1.5).
IF RESULT-NUMBER = -1 DISPLAY "INTEGER-PART PASS" ELSE DISPLAY "INTEGER-PART FAIL".
COMPUTE RESULT-NUMBER = FUNCTION MOD(-11 5).
IF RESULT-NUMBER = 4 DISPLAY "MOD PASS" ELSE DISPLAY "MOD FAIL".
COMPUTE RESULT-NUMBER = FUNCTION REM(7.5 2).
IF RESULT-NUMBER = 1.5 DISPLAY "REM PASS" ELSE DISPLAY "REM FAIL".
STOP RUN.`, '01 RESULT-NUMBER PIC S9(4)V9(6).'));

  const execution = await execute(compiled);
  assert.equal(execution.error, null);
  assert.deepEqual(execution.stdout, [
    'COS PASS', 'LOG10 PASS', 'FACTORIAL PASS', 'INTEGER PASS',
    'INTEGER-PART PASS', 'MOD PASS', 'REM PASS'
  ]);
  assert.deepEqual(compiled.programMap.targets, ['js']);
  assert.ok(compiled.programMap.procedures.PROC_COBOL_RT_REM);
});

test('remaining intrinsic host bindings validate inputs and preserve deterministic ordering', () => {
  const bindings = createDesktopIntrinsicBindings();
  assert.throws(() => bindings['host.math_numval']('1,000'), /does not accept grouping commas/);
  assert.throws(() => bindings['host.math_integer_of_date'](19000229), /not a valid calendar date/);
  assert.throws(() => bindings['host.math_date_of_integer'](0), /at least 1/);
  assert.equal(bindings['host.math_variance']('[1,2,3,4]'), 1.25);
  assert.equal(bindings['host.math_ord_max']('[9,3,9]'), 1);
  const first = bindings['host.math_random_seeded'](7);
  assert.equal(bindings['host.math_random_seeded'](7), first);
  assert.ok(first >= 0 && first < 1);
});

test('P-code linker includes transitive procedures and runs declared initializers', async () => {
  const root = {
    pcodeText: `JMP MAIN
MAIN:
CALL PROC_LIBRARY_GET 0
PRINT
PRINT_NL
HALT
`,
    programMap: {
      globals: [], procedures: {},
      sourceMap: { '0': { sourceFile: 'root.cob' }, '1': { sourceFile: 'root-main.cob' } }
    }
  };
  const library = {
    id: 'TestLibrary',
    exports: { PROC_LIBRARY_GET: 'get' },
    initialize: 'initialize',
    pcodeText: `JMP MAIN
PROC_GET:
LOAD shared
CALL PROC_HELPER 1
RET
PROC_HELPER:
LOAD value
RET
PROC_INITIALIZE:
PUSH_STR "linked"
STORE shared
RET
MAIN:
HALT
`,
    programMap: {
      globals: ['shared'],
      procedures: {
        PROC_GET: { name: 'get', params: [], locals: [] },
        PROC_HELPER: { name: 'helper', params: ['value'], locals: [] },
        PROC_INITIALIZE: { name: 'initialize', params: [], locals: [] }
      },
      sourceMap: { '1': { sourceFile: 'library.pas' } }
    }
  };

  const linked = linkPcodeLibraries(root, [library]);
  const execution = await execute(linked);
  assert.equal(execution.error, null);
  assert.deepEqual(execution.stdout, ['linked']);
  assert.ok(linked.programMap.globals.includes('LIB_TESTLIBRARY_GLOBAL_SHARED'));
  assert.ok(linked.programMap.procedures.LIB_TESTLIBRARY_PROC_HELPER);
  assert.equal(linked.programMap.sourceMap['0'].sourceFile, 'root.cob');
  assert.equal(linked.programMap.sourceMap['2'].sourceFile, 'root-main.cob');
  assert.equal(linked.programMap.sourceMap['6'].sourceFile, 'library.pas');
});

test('P-code linker rejects exported labels that collide with the root program', () => {
  const root = {
    pcodeText: 'JMP MAIN\nPROC_LIBRARY_GET:\nRET\nMAIN:\nHALT\n',
    programMap: { globals: [], procedures: {}, sourceMap: {} }
  };
  const library = {
    id: 'TestLibrary',
    exports: { PROC_LIBRARY_GET: 'get' },
    pcodeText: 'JMP MAIN\nPROC_GET:\nPUSH_INT 1\nRET\nMAIN:\nHALT\n',
    programMap: {
      globals: [],
      procedures: { PROC_GET: { name: 'get', params: [], locals: [] } },
      sourceMap: {}
    }
  };
  assert.throws(() => linkPcodeLibraries(root, [library]), /collides with another label/);
});
