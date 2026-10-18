import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';

test('an unresolved COBOL CALL reports a runtime error', async () => {
  const compiled = compileTandemCobol85ToPcode(`IDENTIFICATION DIVISION.
PROGRAM-ID. MISSING-CALL-TEST.
PROCEDURE DIVISION.
MAIN-LINE.
    CALL "NOT-PRESENT"
    STOP RUN.
`);
  await assert.rejects(executeProgram({
    instructions: parsePcode(compiled.pcodeText),
    programMap: compiled.programMap,
    inputQueue: '',
    sourceMessage: ''
  }), /P-code procedure not found: PARA_NOT_PRESENT/);
});

test('BY REFERENCE aliases the same actual item across multiple LINKAGE parameters', async () => {
  const compiled = compileTandemCobol85ToPcode(`IDENTIFICATION DIVISION.
PROGRAM-ID. REF-ALIAS-TEST.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 VALUE-ITEM PIC 9 VALUE 0.
PROCEDURE DIVISION.
MAIN-LINE.
    CALL "SUB-ALIAS" USING VALUE-ITEM VALUE-ITEM
    IF VALUE-ITEM = 2
        DISPLAY "BY-REF-ALIAS: PASS"
    ELSE
        DISPLAY "BY-REF-ALIAS: FAIL"
    END-IF
    STOP RUN.
IDENTIFICATION DIVISION.
PROGRAM-ID. SUB-ALIAS.
DATA DIVISION.
LINKAGE SECTION.
01 FIRST-ITEM PIC 9.
01 SECOND-ITEM PIC 9.
PROCEDURE DIVISION USING FIRST-ITEM SECOND-ITEM.
SUB-MAIN.
    ADD 1 TO FIRST-ITEM
    ADD 1 TO SECOND-ITEM
    EXIT PROGRAM.
END PROGRAM SUB-ALIAS.
END PROGRAM REF-ALIAS-TEST.
`);
  const execution = await executeProgram({
    instructions: parsePcode(compiled.pcodeText),
    programMap: compiled.programMap,
    inputQueue: '',
    sourceMessage: ''
  });

  assert.deepEqual(execution.stdout, ['BY-REF-ALIAS: PASS']);
  assert.equal(execution.error, null);
});
