import { ccvsCase } from './builder.mjs';

const ob = (id, ccvs, description, build) => ccvsCase('OB', id, ccvs, description, build);
const syntax = (id, ccvs, description, requires, parts) => ob(id, ccvs, description, () => ({
  ...parts, validation: 'syntax', requires
}));

export const obsoleteCases = [
  ob('OB-NUMERIC-PARAGRAPH-01', ['OBNC1M'], 'Numeric paragraph names can be used by ALTER and GO TO', k => ({
    ws: '01 RESULT-ITEM PIC 9 VALUE 0.',
    proc: `ALTER 02 TO PROCEED TO 77
GO TO 02.`,
    paragraphs: `02.
    GO TO 50.
50.
    MOVE 9 TO RESULT-ITEM
    GO TO FINISH.
77.
    MOVE 1 TO RESULT-ITEM.
FINISH.
${k('numeric-alter-target', 'RESULT-ITEM = 1')}
    STOP RUN.`
  })),
  ob('OB-ALTER-UNASSIGNED-01', ['OBNC2M'], 'ALTER assigns the destination of a paragraph containing an initially destinationless GO TO', k => ({
    ws: '01 RESULT-ITEM PIC 9 VALUE 0.',
    proc: `ALTER ALTERABLE TO PROCEED TO TARGET-PARA
GO TO ALTERABLE.`,
    paragraphs: `ALTERABLE.
    GO TO.
TARGET-PARA.
    MOVE 1 TO RESULT-ITEM
${k('assigned-goto', 'RESULT-ITEM = 1')}
    STOP RUN.`
  })),
  ob('OB-ALTER-MULTIPLE-01', ['OBNC2M'], 'One ALTER statement updates more than one paragraph destination', k => ({
    ws: '01 RESULT-ITEM PIC 99 VALUE 0.',
    proc: `ALTER FIRST-JUMP TO PROCEED TO FIRST-TARGET
      SECOND-JUMP TO PROCEED TO SECOND-TARGET
GO TO FIRST-JUMP.`,
    paragraphs: `FIRST-JUMP.
    GO TO BAD-TARGET.
SECOND-JUMP.
    GO TO BAD-TARGET.
FIRST-TARGET.
    ADD 1 TO RESULT-ITEM
    GO TO SECOND-JUMP.
SECOND-TARGET.
    ADD 10 TO RESULT-ITEM
${k('both-destinations', 'RESULT-ITEM = 11')}
    STOP RUN.
BAD-TARGET.
    DISPLAY "OB-ALTER-MULTIPLE-01 both-destinations: FAIL"
    STOP RUN.`
  })),
  ob('OB-DATE-COMPILED-01', ['OBNC2M'], 'Empty DATE-COMPILED documentary paragraph does not prevent program execution', k => ({
    identification: 'DATE-COMPILED.',
    ws: '01 RESULT-ITEM PIC 9 VALUE 1.',
    proc: k('documentary-paragraph', 'RESULT-ITEM = 1')
  })),
  ob('OB-CALLED-SORT-01', ['OBIC1A'], 'A called program can SORT using procedures and return its sorted result through LINKAGE', k => ({
    source: `IDENTIFICATION DIVISION.
PROGRAM-ID. OB-CALLED-SORT-01.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 RESULT-ITEM PIC 9(4) VALUE 0.
PROCEDURE DIVISION.
MAIN-LINE.
    CALL "SORT-CHILD" USING RESULT-ITEM
${k('called-sort-result', 'RESULT-ITEM = 1020')}
    STOP RUN.
IDENTIFICATION DIVISION.
PROGRAM-ID. SORT-CHILD.
ENVIRONMENT DIVISION.
INPUT-OUTPUT SECTION.
FILE-CONTROL.
SELECT SORT-WORK ASSIGN TO "data/ob-called-sort.srt".
DATA DIVISION.
FILE SECTION.
SD SORT-WORK.
01 SORT-RECORD PIC 99.
LINKAGE SECTION.
01 L-RESULT PIC 9(4).
PROCEDURE DIVISION USING L-RESULT.
SORT-MAIN.
    MOVE 0 TO L-RESULT
    SORT SORT-WORK ASCENDING KEY SORT-RECORD
        INPUT PROCEDURE LOAD-ITEMS
        OUTPUT PROCEDURE TAKE-ITEMS
    EXIT PROGRAM.
LOAD-ITEMS.
    MOVE 20 TO SORT-RECORD
    RELEASE SORT-RECORD
    MOVE 10 TO SORT-RECORD
    RELEASE SORT-RECORD.
TAKE-ITEMS.
    RETURN SORT-WORK
        AT END CONTINUE
        NOT AT END COMPUTE L-RESULT = SORT-RECORD * 100
    END-RETURN
    RETURN SORT-WORK
        AT END CONTINUE
        NOT AT END ADD SORT-RECORD TO L-RESULT
    END-RETURN.
END PROGRAM SORT-CHILD.
END PROGRAM OB-CALLED-SORT-01.`
  })),
  syntax('OB-STOP-LITERAL-01', ['OBNC1M'], 'STOP literal suspends for operator continuation; it is not STOP RUN',
    ['operator message display and run-continuation mechanism'], {
      proc: 'STOP "CONTINUE THIS RUN"\nCONTINUE'
    }),
  syntax('OB-VALUE-OF-01', ['OBSQ1A'], 'FD LABEL RECORDS and VALUE OF IDENTIFICATION describe external tape labels',
    ['tape device and volume-label verification'], {
      environment: `INPUT-OUTPUT SECTION.
FILE-CONTROL.
SELECT TAPE-FILE ASSIGN TO "TAPE-A" ORGANIZATION IS SEQUENTIAL.`,
      fileSection: `FD TAPE-FILE
    LABEL RECORDS ARE STANDARD
    VALUE OF IDENTIFICATION IS "VOL001".
01 TAPE-RECORD PIC X(80).`,
      proc: 'OPEN INPUT TAPE-FILE\nREAD TAPE-FILE AT END CONTINUE END-READ\nCLOSE TAPE-FILE'
    }),
  syntax('OB-MULTIPLE-FILE-01', ['OBSQ3A'], 'I-O-CONTROL MULTIPLE FILE TAPE with explicit file positions',
    ['multi-file tape device and positioning/volume verification'], {
      environment: `INPUT-OUTPUT SECTION.
FILE-CONTROL.
SELECT TAPE-A ASSIGN TO "TAPE-A" ORGANIZATION IS SEQUENTIAL.
SELECT TAPE-B ASSIGN TO "TAPE-B" ORGANIZATION IS SEQUENTIAL.
I-O-CONTROL.
MULTIPLE FILE TAPE CONTAINS TAPE-A POSITION 1 TAPE-B POSITION 2.`,
      fileSection: 'FD TAPE-A.\n01 RECORD-A PIC X(80).\nFD TAPE-B.\n01 RECORD-B PIC X(80).',
      proc: 'OPEN INPUT TAPE-A TAPE-B\nCLOSE TAPE-A TAPE-B'
    })
];
