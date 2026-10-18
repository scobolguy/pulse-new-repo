import assert from 'node:assert/strict';
import { test, traceCompileError } from './support/trace.mjs';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';

function reportProgram(reportSection, procedure = 'STOP RUN.', declaratives = '') {
  return `IDENTIFICATION DIVISION.
PROGRAM-ID. RW-CHECK.
ENVIRONMENT DIVISION.
INPUT-OUTPUT SECTION.
FILE-CONTROL.
SELECT REPORT-FILE ASSIGN TO "data/rw-check.prn" ORGANIZATION IS SEQUENTIAL.
DATA DIVISION.
FILE SECTION.
FD REPORT-FILE REPORT IS CHECK-REPORT.
WORKING-STORAGE SECTION.
01 KEY-A PIC X.
01 AMOUNT PIC 999.
REPORT SECTION.
RD CHECK-REPORT CONTROLS ARE FINAL KEY-A.
${reportSection}
PROCEDURE DIVISION.
${declaratives}MAIN-LINE.
${procedure}`;
}

function expectCompileError(source, pattern) {
  traceCompileError(import.meta.url, compileTandemCobol85ToPcode, source, pattern);
  assert.throws(() => compileTandemCobol85ToPcode(source), pattern);
}

test('Report Writer compiles control breaks, SUM counters and report declaratives', () => {
  const compiled = compileTandemCobol85ToPcode(reportProgram(`01 ROW TYPE DE LINE PLUS 1.
   03 COLUMN 1 PIC 999 SOURCE AMOUNT.
01 TYPE CF KEY-A LINE PLUS 1.
   03 KEY-TOTAL COLUMN 1 PIC ZZ9 SUM AMOUNT RESET ON FINAL.
01 TYPE CF FINAL LINE PLUS 1.
   03 COLUMN 1 PIC ZZZ9 SUM KEY-TOTAL.`, `INITIATE CHECK-REPORT
GENERATE ROW
TERMINATE CHECK-REPORT
STOP RUN.`, `DECLARATIVES.
ROW-USE SECTION.
    USE BEFORE REPORTING ROW.
ROW-PARA.
    SUPPRESS PRINTING.
END DECLARATIVES.
MAIN SECTION.
`));
  assert.match(compiled.pcodeText, /STORE __COBOL_RW_SUPPRESS/);
  assert.match(compiled.pcodeText, /KEY_TOTAL/);
});

test('Report Writer rejects SUM outside a CONTROL FOOTING', () => {
  expectCompileError(reportProgram(`01 ROW TYPE DE LINE PLUS 1.
   03 COLUMN 1 PIC 999 SUM AMOUNT.`), /SUM clause is only supported in CONTROL FOOTING/);
});

test('Report Writer rejects control groups for undeclared controls', () => {
  expectCompileError(reportProgram(`01 TYPE CH AMOUNT LINE PLUS 1.
   03 COLUMN 1 PIC 999 SOURCE AMOUNT.`), /not a control of CHECK_REPORT/);
});

test('Report Writer rejects USE BEFORE REPORTING for an unknown group', () => {
  expectCompileError(reportProgram(`01 ROW TYPE DE LINE PLUS 1.
   03 COLUMN 1 PIC 999 SOURCE AMOUNT.`, 'STOP RUN.', `DECLARATIVES.
BAD-USE SECTION.
    USE BEFORE REPORTING MISSING-GROUP.
BAD-PARA.
    EXIT.
END DECLARATIVES.
MAIN SECTION.
`), /unknown report group MISSING_GROUP/);
});

test('Report Writer rejects GROUP INDICATE outside a DETAIL group', () => {
  expectCompileError(reportProgram(`01 TYPE CF KEY-A LINE PLUS 1.
   03 COLUMN 1 PIC X SOURCE KEY-A GROUP INDICATE.`), /GROUP INDICATE is only allowed in DETAIL/);
});
