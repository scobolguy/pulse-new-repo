import { ccvsCase } from './builder.mjs';

const sm = (id, ccvs, description, build) => ccvsCase('SM', id, ccvs, description, build);

// Library text is supplied to the compiler as options.copybooks: { NAME: text } or, for
// COPY ... OF library, { "LIBRARY/NAME": text }.
export const smCases = [
  sm('SM-COPY-DATA-01', ['SM101A', 'SM102A'], 'COPY of a record description into WORKING-STORAGE', k => ({
    copybooks: {
      CUSTREC: `01 CUSTOMER-REC.
   05 CUST-ID PIC 9(4) VALUE 1234.
   05 CUST-NAME PIC X(10) VALUE "SMITH".`
    },
    ws: 'COPY CUSTREC.',
    proc: `${k('copied-numeric', 'CUST-ID = 1234')}
${k('copied-alpha', 'CUST-NAME = "SMITH"')}`
  })),

  sm('SM-COPY-PROC-01', ['SM103A', 'SM104A'], 'COPY of procedure text: statements and whole paragraphs', k => ({
    copybooks: {
      ADDSTMT: 'ADD 5 TO TOTAL',
      PARAS: `DOUBLE-IT.
    MULTIPLY 2 BY TOTAL.`
    },
    ws: '01 TOTAL PIC 9(3) VALUE 1.',
    proc: `COPY ADDSTMT.
${k('statement-copy', 'TOTAL = 6')}
PERFORM DOUBLE-IT
${k('paragraph-copy', 'TOTAL = 12')}`,
    paragraphs: 'COPY PARAS.'
  })),

  sm('SM-COPY-ENV-01', ['SM105A'], 'COPY in the ENVIRONMENT DIVISION (SPECIAL-NAMES entries)', k => ({
    copybooks: { SPECNAMES: 'CLASS HEX-DIGIT IS "0" THRU "9" "A" THRU "F"' },
    environment: `CONFIGURATION SECTION.
SPECIAL-NAMES.
    COPY SPECNAMES.
    .`,
    ws: '01 H PIC X(4) VALUE "1F9A".\n01 G PIC X(4) VALUE "1G9A".',
    proc: `${k('class-from-copy', 'H IS HEX-DIGIT AND G IS NOT HEX-DIGIT')}`
  })),

  sm('SM-REPLACING-01', ['SM201A', 'SM202A', 'SM203A'], 'COPY ... REPLACING pseudo-text, identifiers, literals and words', k => ({
    copybooks: {
      TEMPLATE: `01 :PFX:-ITEM PIC 9(3) VALUE 100.
01 :PFX:-NAME PIC X(6) VALUE "OLD".`,
      ADDER: 'ADD 1 TO TARGET-ITEM'
    },
    ws: `COPY TEMPLATE REPLACING ==:PFX:== BY ==WS==.
COPY TEMPLATE REPLACING ==:PFX:== BY ==ALT== "OLD" BY "NEW" ==100== BY ==200==.`,
    proc: `${k('pseudo-text', 'WS-ITEM = 100 AND WS-NAME = "OLD"')}
${k('literal-and-text', 'ALT-ITEM = 200 AND ALT-NAME = "NEW"')}
COPY ADDER REPLACING TARGET-ITEM BY WS-ITEM.
${k('identifier', 'WS-ITEM = 101')}
COPY ADDER REPLACING TARGET-ITEM BY ALT-ITEM ADD BY SUBTRACT TO BY FROM.
${k('words', 'ALT-ITEM = 199')}`
  })),

  sm('SM-COPY-LIBRARY-01', ['SM206A', 'SM207A'], 'COPY text-name OF/IN library-name selects between libraries', k => ({
    copybooks: {
      'LIBA/SHARED': '01 FROM-LIB PIC X(4) VALUE "LIBA".',
      'LIBB/SHARED2': '01 FROM-LIB2 PIC X(4) VALUE "LIBB".'
    },
    ws: 'COPY SHARED OF LIBA.\nCOPY SHARED2 IN LIBB.',
    proc: k('library-qualified', 'FROM-LIB = "LIBA" AND FROM-LIB2 = "LIBB"')
  })),

  sm('SM-REPLACE-01', ['SM208A', 'SM301M'], 'REPLACE ... BY ... applies to following text until REPLACE OFF', k => ({
    source: `IDENTIFICATION DIVISION.
PROGRAM-ID. SM-REPLACE-01.
DATA DIVISION.
WORKING-STORAGE SECTION.
REPLACE ==ALPHA-SIZE== BY ==8== ==FIELD-A== BY ==REPLACED-NAME==.
01 FIELD-A PIC X(ALPHA-SIZE) VALUE "REPLACED".
01 N PIC 9 VALUE 0.
PROCEDURE DIVISION.
MAIN-LINE.
${k('replaced-in-data', 'REPLACED-NAME = "REPLACED"')}
REPLACE OFF.
REPLACE ==BUMP== BY ==ADD 1 TO N==.
    BUMP
    BUMP
${k('replaced-in-procedure', 'N = 2')}
REPLACE OFF.
    STOP RUN.`
  })),

  sm('SM-REPLACE-COPY-01', ['SM209A'], 'REPLACE also acts on text produced by COPY; a later REPLACE supersedes an earlier one', k => ({
    copybooks: { INCR: 'ADD STEP-VALUE TO TOTAL' },
    source: `IDENTIFICATION DIVISION.
PROGRAM-ID. SM-REPLACE-COPY-01.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 TOTAL PIC 99 VALUE 0.
PROCEDURE DIVISION.
MAIN-LINE.
REPLACE ==STEP-VALUE== BY ==3==.
    COPY INCR.
REPLACE ==STEP-VALUE== BY ==10==.
    COPY INCR.
REPLACE OFF.
${k('replace-after-copy', 'TOTAL = 13')}
    STOP RUN.`
  }))
];
