import { ccvsCase } from './builder.mjs';

const st = (id, ccvs, description, build) => ccvsCase('ST', id, ccvs, description, build);

const select = (name, path) => `SELECT ${name} ASSIGN TO "data/${path}"
    ORGANIZATION IS SEQUENTIAL.`;
const sortSelect = (name, path) => `SELECT ${name} ASSIGN TO "data/${path}".`;

// Writes the given 8-character records (key in columns 1-2, second key 3-4, payload 5-8).
const load = (file, record, rows) => [`OPEN OUTPUT ${file}`,
  ...rows.flatMap(row => [`MOVE "${row}" TO ${record}`, `WRITE ${record}`]), `CLOSE ${file}`].join('\n');

// Reads a file into SEEN (a concatenation of the payloads) to check order.
const readBack = (file, record, field = `${record}(5:4)`) => `OPEN INPUT ${file}
MOVE "N" TO EOF-SW
MOVE SPACES TO SEEN
MOVE 1 TO PTR
PERFORM UNTIL EOF-SW = "Y"
    READ ${file}
        AT END MOVE "Y" TO EOF-SW
        NOT AT END STRING ${field} DELIMITED BY SIZE INTO SEEN WITH POINTER PTR
    END-READ
END-PERFORM
CLOSE ${file}`;

const common = '01 EOF-SW PIC X.\n01 SEEN PIC X(40).\n01 PTR PIC 99.';

export const sortCases = [
  st('ST-USING-GIVING-01', ['ST101A', 'ST102A', 'ST103A'], 'SORT ... ON ASCENDING KEY USING file GIVING file', k => ({
    environment: `INPUT-OUTPUT SECTION.
FILE-CONTROL.
${select('IN-FILE', 'st01-in.dat')}
${select('OUT-FILE', 'st01-out.dat')}
${sortSelect('SORT-FILE', 'st01.srt')}`,
    fileSection: `FD IN-FILE.
01 IN-REC PIC X(8).
FD OUT-FILE.
01 OUT-REC PIC X(8).
SD SORT-FILE.
01 SORT-REC.
   05 S-KEY1 PIC XX.
   05 S-KEY2 PIC XX.
   05 S-DATA PIC X(4).`,
    ws: common,
    proc: `${load('IN-FILE', 'IN-REC', ['30AAccc1', '10ZZaaa1', '20MMbbb1'])}
SORT SORT-FILE ON ASCENDING KEY S-KEY1
    USING IN-FILE GIVING OUT-FILE
${k('sort-return', 'SORT-RETURN = 0')}
${readBack('OUT-FILE', 'OUT-REC')}
${k('ascending', 'SEEN = "aaa1bbb1ccc1"')}`
  })),

  st('ST-MULTIKEY-01', ['ST104A', 'ST105A', 'ST106A'], 'Multiple keys mixing DESCENDING major and ASCENDING minor keys', k => ({
    environment: `INPUT-OUTPUT SECTION.
FILE-CONTROL.
${select('IN-FILE', 'st02-in.dat')}
${select('OUT-FILE', 'st02-out.dat')}
${sortSelect('SORT-FILE', 'st02.srt')}`,
    fileSection: `FD IN-FILE.
01 IN-REC PIC X(8).
FD OUT-FILE.
01 OUT-REC PIC X(8).
SD SORT-FILE.
01 SORT-REC.
   05 S-KEY1 PIC 99.
   05 S-KEY2 PIC XX.
   05 S-DATA PIC X(4).`,
    ws: common,
    proc: `${load('IN-FILE', 'IN-REC', ['10BBr3--', '20AAr1--', '10AAr2--', '05ZZr4--'])}
SORT SORT-FILE
    ON DESCENDING KEY S-KEY1
    ON ASCENDING KEY S-KEY2
    USING IN-FILE GIVING OUT-FILE
${readBack('OUT-FILE', 'OUT-REC', 'OUT-REC(5:2)')}
${k('major-desc-minor-asc', 'SEEN = "r1r2r3r4"')}`
  })),

  st('ST-INPUT-PROC-01', ['ST107A', 'ST108A', 'ST109A'], 'INPUT PROCEDURE with RELEASE ... FROM; OUTPUT PROCEDURE with RETURN ... INTO and AT END', k => ({
    source: `IDENTIFICATION DIVISION.
PROGRAM-ID. ST-INPUT-PROC-01.
ENVIRONMENT DIVISION.
INPUT-OUTPUT SECTION.
FILE-CONTROL.
${sortSelect('SORT-FILE', 'st03.srt')}
DATA DIVISION.
FILE SECTION.
SD SORT-FILE.
01 SORT-REC.
   05 S-KEY PIC 99.
   05 S-DATA PIC XX.
WORKING-STORAGE SECTION.
01 WORK-REC.
   05 W-KEY PIC 99.
   05 W-DATA PIC XX.
01 OUT-AREA PIC X(4).
01 EOF-SW PIC X VALUE "N".
01 SEEN PIC X(20) VALUE SPACES.
01 PTR PIC 99 VALUE 1.
01 N PIC 99.
PROCEDURE DIVISION.
MAIN-LINE.
    SORT SORT-FILE ON ASCENDING KEY S-KEY
        INPUT PROCEDURE IS BUILD-SECTION
        OUTPUT PROCEDURE IS EMIT-SECTION
${k('output-order', 'SEEN = "d1d2d3d4"')}
    STOP RUN.
BUILD-SECTION SECTION.
BUILD-PARA.
    PERFORM VARYING N FROM 4 BY -1 UNTIL N < 1
        MOVE N TO W-KEY
        STRING "d" N(2:1) DELIMITED BY SIZE INTO W-DATA
        RELEASE SORT-REC FROM WORK-REC
    END-PERFORM.
EMIT-SECTION SECTION.
EMIT-PARA.
    PERFORM UNTIL EOF-SW = "Y"
        RETURN SORT-FILE INTO OUT-AREA
            AT END MOVE "Y" TO EOF-SW
            NOT AT END STRING OUT-AREA(3:2) DELIMITED BY SIZE INTO SEEN WITH POINTER PTR
        END-RETURN
    END-PERFORM.`
  })),

  st('ST-DUPLICATES-01', ['ST110A', 'ST111A'], 'WITH DUPLICATES IN ORDER keeps input order for equal keys', k => ({
    environment: `INPUT-OUTPUT SECTION.
FILE-CONTROL.
${select('IN-FILE', 'st04-in.dat')}
${select('OUT-FILE', 'st04-out.dat')}
${sortSelect('SORT-FILE', 'st04.srt')}`,
    fileSection: `FD IN-FILE.
01 IN-REC PIC X(8).
FD OUT-FILE.
01 OUT-REC PIC X(8).
SD SORT-FILE.
01 SORT-REC.
   05 S-KEY PIC XX.
   05 FILLER PIC X(6).`,
    ws: common,
    proc: `${load('IN-FILE', 'IN-REC', ['BB--dup1', 'AA--uniq', 'BB--dup2', 'BB--dup3'])}
SORT SORT-FILE ON ASCENDING KEY S-KEY
    WITH DUPLICATES IN ORDER
    USING IN-FILE GIVING OUT-FILE
${readBack('OUT-FILE', 'OUT-REC')}
${k('stable', 'SEEN = "uniqdup1dup2dup3"')}`
  })),

  st('ST-MERGE-01', ['ST112A', 'ST113A', 'ST114A'], 'MERGE two ordered files USING ... GIVING and MERGE with OUTPUT PROCEDURE', k => ({
    source: `IDENTIFICATION DIVISION.
PROGRAM-ID. ST-MERGE-01.
ENVIRONMENT DIVISION.
INPUT-OUTPUT SECTION.
FILE-CONTROL.
${select('FILE-A', 'st05-a.dat')}
${select('FILE-B', 'st05-b.dat')}
${select('OUT-FILE', 'st05-out.dat')}
${sortSelect('MERGE-FILE', 'st05.srt')}
DATA DIVISION.
FILE SECTION.
FD FILE-A.
01 A-REC PIC X(8).
FD FILE-B.
01 B-REC PIC X(8).
FD OUT-FILE.
01 OUT-REC PIC X(8).
SD MERGE-FILE.
01 M-REC.
   05 M-KEY PIC XX.
   05 M-DATA PIC X(6).
WORKING-STORAGE SECTION.
${common}
01 COUNTED PIC 99 VALUE 0.
PROCEDURE DIVISION.
MAIN-LINE.
${load('FILE-A', 'A-REC', ['10--m1--', '30--m3--'])}
${load('FILE-B', 'B-REC', ['20--m2--', '40--m4--'])}
    MERGE MERGE-FILE ON ASCENDING KEY M-KEY
        USING FILE-A FILE-B GIVING OUT-FILE
${readBack('OUT-FILE', 'OUT-REC', 'OUT-REC(5:2)')}
${k('merged', 'SEEN = "m1m2m3m4"')}
    MERGE MERGE-FILE ON ASCENDING KEY M-KEY
        USING FILE-A FILE-B
        OUTPUT PROCEDURE IS COUNT-SECTION
${k('output-procedure', 'COUNTED = 4')}
    STOP RUN.
COUNT-SECTION SECTION.
COUNT-PARA.
    MOVE "N" TO EOF-SW
    PERFORM UNTIL EOF-SW = "Y"
        RETURN MERGE-FILE AT END MOVE "Y" TO EOF-SW
            NOT AT END ADD 1 TO COUNTED
        END-RETURN
    END-PERFORM.`
  })),

  st('ST-COLLATING-01', ['ST115A', 'ST116A'], 'SORT with COLLATING SEQUENCE from an ALPHABET clause in SPECIAL-NAMES', k => ({
    environment: `CONFIGURATION SECTION.
SPECIAL-NAMES.
    ALPHABET REVERSED-ABC IS "C" "B" "A".
INPUT-OUTPUT SECTION.
FILE-CONTROL.
${select('IN-FILE', 'st06-in.dat')}
${select('OUT-FILE', 'st06-out.dat')}
${sortSelect('SORT-FILE', 'st06.srt')}`,
    fileSection: `FD IN-FILE.
01 IN-REC PIC X(8).
FD OUT-FILE.
01 OUT-REC PIC X(8).
SD SORT-FILE.
01 SORT-REC.
   05 S-KEY PIC X.
   05 FILLER PIC X(7).`,
    ws: common,
    proc: `${load('IN-FILE', 'IN-REC', ['A---rec1', 'C---rec3', 'B---rec2'])}
SORT SORT-FILE ON ASCENDING KEY S-KEY
    COLLATING SEQUENCE IS REVERSED-ABC
    USING IN-FILE GIVING OUT-FILE
${readBack('OUT-FILE', 'OUT-REC')}
${k('custom-sequence', 'SEEN = "rec3rec2rec1"')}`
  })),

  st('ST-NUMERIC-KEYS-01', ['ST117A', 'ST118A'], 'Signed numeric sort keys order by algebraic value', k => ({
    source: `IDENTIFICATION DIVISION.
PROGRAM-ID. ST-NUMERIC-KEYS-01.
ENVIRONMENT DIVISION.
INPUT-OUTPUT SECTION.
FILE-CONTROL.
${sortSelect('SORT-FILE', 'st07.srt')}
DATA DIVISION.
FILE SECTION.
SD SORT-FILE.
01 SORT-REC.
   05 S-KEY PIC S99 SIGN IS LEADING SEPARATE.
   05 S-TAG PIC X.
WORKING-STORAGE SECTION.
01 EOF-SW PIC X VALUE "N".
01 SEEN PIC X(10) VALUE SPACES.
01 PTR PIC 99 VALUE 1.
PROCEDURE DIVISION.
MAIN-LINE.
    SORT SORT-FILE ON ASCENDING KEY S-KEY
        INPUT PROCEDURE IS LOAD-SECTION
        OUTPUT PROCEDURE IS EMIT-SECTION
${k('algebraic', 'SEEN = "abcd"')}
    STOP RUN.
LOAD-SECTION SECTION.
LOAD-PARA.
    MOVE 5 TO S-KEY  MOVE "c" TO S-TAG  RELEASE SORT-REC
    MOVE -12 TO S-KEY  MOVE "a" TO S-TAG  RELEASE SORT-REC
    MOVE 40 TO S-KEY  MOVE "d" TO S-TAG  RELEASE SORT-REC
    MOVE -1 TO S-KEY  MOVE "b" TO S-TAG  RELEASE SORT-REC.
EMIT-SECTION SECTION.
EMIT-PARA.
    PERFORM UNTIL EOF-SW = "Y"
        RETURN SORT-FILE AT END MOVE "Y" TO EOF-SW
            NOT AT END STRING S-TAG DELIMITED BY SIZE INTO SEEN WITH POINTER PTR
        END-RETURN
    END-PERFORM.`
  }))
];
