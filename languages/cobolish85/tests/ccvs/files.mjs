import { ccvsCase } from './builder.mjs';

const sq = (id, ccvs, description, build) => ccvsCase('SQ', id, ccvs, description, build);
const rl = (id, ccvs, description, build) => ccvsCase('RL', id, ccvs, description, build);
const ix = (id, ccvs, description, build) => ccvsCase('IX', id, ccvs, description, build);

const control = selects => `INPUT-OUTPUT SECTION.
FILE-CONTROL.
${selects}`;

// A simple sequential file SQ-FILE with 10-character records and status SQ-FS.
const sqSelect = (name = 'SQ-FILE', path = 'sq01.dat', extra = '') =>
  `SELECT ${name} ASSIGN TO "data/${path}"\n    ORGANIZATION IS SEQUENTIAL${extra}\n    FILE STATUS IS ${name}-FS.`;
const sqFd = (name = 'SQ-FILE', record = 'SQ-REC') => `FD ${name}.\n01 ${record} PIC X(10).`;

const rlSelect = (access, path) => `SELECT RL-FILE ASSIGN TO "data/${path}"
    ORGANIZATION IS RELATIVE
    ACCESS MODE IS ${access}
    RELATIVE KEY IS RL-KEY
    FILE STATUS IS RL-FS.`;
const rlFd = 'FD RL-FILE.\n01 RL-REC PIC X(8).';
const rlWs = '01 RL-KEY PIC 9(4).\n01 RL-FS PIC XX.\n01 N PIC 9(4).';

const ixSelect = (access, path, extra = '') => `SELECT IX-FILE ASSIGN TO "data/${path}"
    ORGANIZATION IS INDEXED
    ACCESS MODE IS ${access}
    RECORD KEY IS IX-KEY${extra}
    FILE STATUS IS IX-FS.`;
const ixFd = `FD IX-FILE.
01 IX-REC.
   05 IX-KEY PIC X(4).
   05 IX-ALT PIC X(4).
   05 IX-DATA PIC X(8).`;

export const fileCases = [
  // ---------------------------------------------------------------- SQ
  sq('SQ-WRITE-READ-01', ['SQ101M', 'SQ102A', 'SQ103A'], 'OPEN OUTPUT/WRITE/CLOSE then OPEN INPUT/READ with AT END and FILE STATUS 00/10', k => ({
    environment: control(sqSelect()),
    fileSection: sqFd(),
    ws: '01 SQ-FILE-FS PIC XX.\n01 N PIC 99 VALUE 0.\n01 EOF-SW PIC X VALUE "N".',
    proc: `OPEN OUTPUT SQ-FILE
${k('open-output', 'SQ-FILE-FS = "00"')}
MOVE "REC-1" TO SQ-REC
WRITE SQ-REC
MOVE "REC-2" TO SQ-REC
WRITE SQ-REC
MOVE "REC-3" TO SQ-REC
WRITE SQ-REC
${k('write', 'SQ-FILE-FS = "00"')}
CLOSE SQ-FILE
OPEN INPUT SQ-FILE
READ SQ-FILE AT END MOVE "Y" TO EOF-SW END-READ
${k('first-record', 'SQ-REC = "REC-1" AND SQ-FILE-FS = "00"')}
PERFORM UNTIL EOF-SW = "Y"
    ADD 1 TO N
    READ SQ-FILE AT END MOVE "Y" TO EOF-SW END-READ
END-PERFORM
${k('record-count', 'N = 3')}
${k('at-end-status', 'SQ-FILE-FS = "10"')}
CLOSE SQ-FILE`
  })),

  sq('SQ-NOT-AT-END-01', ['SQ121A', 'SQ122A'], 'READ ... NOT AT END ... END-READ executes the correct branch', k => ({
    environment: control(sqSelect('SQ-FILE', 'sq02.dat')),
    fileSection: sqFd(),
    ws: '01 SQ-FILE-FS PIC XX.\n01 HITS PIC 99 VALUE 0.\n01 ENDS PIC 99 VALUE 0.',
    proc: `OPEN OUTPUT SQ-FILE
MOVE "ONLY" TO SQ-REC
WRITE SQ-REC
CLOSE SQ-FILE
OPEN INPUT SQ-FILE
READ SQ-FILE
    AT END ADD 1 TO ENDS
    NOT AT END ADD 1 TO HITS
END-READ
READ SQ-FILE
    AT END ADD 1 TO ENDS
    NOT AT END ADD 1 TO HITS
END-READ
CLOSE SQ-FILE
${k('not-at-end', 'HITS = 1')}
${k('at-end', 'ENDS = 1')}`
  })),

  sq('SQ-INTO-FROM-01', ['SQ104A', 'SQ105A'], 'WRITE ... FROM and READ ... INTO move through working-storage', k => ({
    environment: control(sqSelect('SQ-FILE', 'sq03.dat')),
    fileSection: sqFd(),
    ws: '01 SQ-FILE-FS PIC XX.\n01 OUT-AREA PIC X(10) VALUE "FROM-AREA".\n01 IN-AREA PIC X(10) VALUE SPACES.',
    proc: `OPEN OUTPUT SQ-FILE
WRITE SQ-REC FROM OUT-AREA
CLOSE SQ-FILE
OPEN INPUT SQ-FILE
READ SQ-FILE INTO IN-AREA AT END CONTINUE END-READ
CLOSE SQ-FILE
${k('read-into', 'IN-AREA = "FROM-AREA"')}
${k('record-area', 'SQ-REC = "FROM-AREA"')}`
  })),

  sq('SQ-REWRITE-01', ['SQ106A', 'SQ107A'], 'OPEN I-O, READ then REWRITE replaces the record just read', k => ({
    environment: control(sqSelect('SQ-FILE', 'sq04.dat')),
    fileSection: sqFd(),
    ws: '01 SQ-FILE-FS PIC XX.',
    proc: `OPEN OUTPUT SQ-FILE
MOVE "AAA" TO SQ-REC
WRITE SQ-REC
MOVE "BBB" TO SQ-REC
WRITE SQ-REC
CLOSE SQ-FILE
OPEN I-O SQ-FILE
${k('open-io', 'SQ-FILE-FS = "00"')}
READ SQ-FILE AT END CONTINUE END-READ
READ SQ-FILE AT END CONTINUE END-READ
MOVE "BBB-NEW" TO SQ-REC
REWRITE SQ-REC
${k('rewrite', 'SQ-FILE-FS = "00"')}
CLOSE SQ-FILE
OPEN INPUT SQ-FILE
READ SQ-FILE AT END CONTINUE END-READ
${k('first-unchanged', 'SQ-REC = "AAA"')}
READ SQ-FILE AT END CONTINUE END-READ
${k('second-rewritten', 'SQ-REC = "BBB-NEW"')}
CLOSE SQ-FILE`
  })),

  sq('SQ-EXTEND-01', ['SQ108A', 'SQ141A'], 'OPEN EXTEND appends records after the existing ones', k => ({
    environment: control(sqSelect('SQ-FILE', 'sq05.dat')),
    fileSection: sqFd(),
    ws: '01 SQ-FILE-FS PIC XX.\n01 N PIC 99 VALUE 0.\n01 LAST-REC PIC X(10).\n01 EOF-SW PIC X VALUE "N".',
    proc: `OPEN OUTPUT SQ-FILE
MOVE "ONE" TO SQ-REC
WRITE SQ-REC
CLOSE SQ-FILE
OPEN EXTEND SQ-FILE
${k('open-extend', 'SQ-FILE-FS = "00"')}
MOVE "TWO" TO SQ-REC
WRITE SQ-REC
CLOSE SQ-FILE
OPEN INPUT SQ-FILE
PERFORM UNTIL EOF-SW = "Y"
    READ SQ-FILE
        AT END MOVE "Y" TO EOF-SW
        NOT AT END ADD 1 TO N MOVE SQ-REC TO LAST-REC
    END-READ
END-PERFORM
CLOSE SQ-FILE
${k('count', 'N = 2')}
${k('appended-last', 'LAST-REC = "TWO"')}`
  })),

  sq('SQ-OPTIONAL-01', ['SQ201A', 'SQ203A', 'SQ225A'], 'OPEN INPUT of an absent file gives status 35; an absent OPTIONAL file gives 05 then AT END with 10', k => ({
    environment: control(`${sqSelect('MISSING-FILE', 'never-created.dat')}
SELECT OPTIONAL OPT-FILE ASSIGN TO "data/never-created-opt.dat"
    ORGANIZATION IS SEQUENTIAL
    FILE STATUS IS OPT-FILE-FS.`),
    fileSection: `${sqFd('MISSING-FILE', 'MISSING-REC')}\n${sqFd('OPT-FILE', 'OPT-REC')}`,
    ws: '01 MISSING-FILE-FS PIC XX.\n01 OPT-FILE-FS PIC XX.\n01 EOF-SW PIC X VALUE "N".',
    proc: `OPEN INPUT MISSING-FILE
${k('absent-35', 'MISSING-FILE-FS = "35"')}
OPEN INPUT OPT-FILE
${k('optional-05', 'OPT-FILE-FS = "05"')}
READ OPT-FILE AT END MOVE "Y" TO EOF-SW END-READ
${k('optional-at-end', 'EOF-SW = "Y" AND OPT-FILE-FS = "10"')}
CLOSE OPT-FILE`
  })),

  sq('SQ-STATUS-4X-01', ['SQ216A', 'SQ217A', 'SQ218A', 'SQ219A', 'SQ220A'], 'Logic-error statuses 41, 42, 46, 47 and 48', k => ({
    environment: control(sqSelect('SQ-FILE', 'sq06.dat')),
    fileSection: sqFd(),
    ws: '01 SQ-FILE-FS PIC XX.',
    proc: `CLOSE SQ-FILE
${k('close-unopened-42', 'SQ-FILE-FS = "42"')}
OPEN OUTPUT SQ-FILE
OPEN OUTPUT SQ-FILE
${k('open-twice-41', 'SQ-FILE-FS = "41"')}
READ SQ-FILE AT END CONTINUE END-READ
${k('read-output-47', 'SQ-FILE-FS = "47"')}
MOVE "X" TO SQ-REC
WRITE SQ-REC
CLOSE SQ-FILE
OPEN INPUT SQ-FILE
WRITE SQ-REC
${k('write-input-48', 'SQ-FILE-FS = "48"')}
READ SQ-FILE AT END CONTINUE END-READ
READ SQ-FILE AT END CONTINUE END-READ
${k('at-end-10', 'SQ-FILE-FS = "10"')}
READ SQ-FILE AT END CONTINUE END-READ
${k('read-after-eof-46', 'SQ-FILE-FS = "46"')}
CLOSE SQ-FILE`
  })),

  sq('SQ-REWRITE-43-01', ['SQ221A'], 'REWRITE without a preceding successful READ gives status 43', k => ({
    environment: control(sqSelect('SQ-FILE', 'sq07.dat')),
    fileSection: sqFd(),
    ws: '01 SQ-FILE-FS PIC XX.',
    proc: `OPEN OUTPUT SQ-FILE
MOVE "R1" TO SQ-REC
WRITE SQ-REC
CLOSE SQ-FILE
OPEN I-O SQ-FILE
MOVE "R1-NEW" TO SQ-REC
REWRITE SQ-REC
${k('rewrite-43', 'SQ-FILE-FS = "43"')}
CLOSE SQ-FILE`
  })),

  sq('SQ-LOCK-01', ['SQ228A'], 'CLOSE WITH LOCK prevents the file from being opened again (status 38)', k => ({
    environment: control(sqSelect('SQ-FILE', 'sq08.dat')),
    fileSection: sqFd(),
    ws: '01 SQ-FILE-FS PIC XX.',
    proc: `OPEN OUTPUT SQ-FILE
CLOSE SQ-FILE WITH LOCK
${k('close-lock', 'SQ-FILE-FS = "00"')}
OPEN INPUT SQ-FILE
${k('open-locked-38', 'SQ-FILE-FS = "38"')}`
  })),

  sq('SQ-VARIABLE-01', ['SQ111A', 'SQ113A', 'SQ114A'], 'Variable-length records: RECORD VARYING DEPENDING ON and multiple 01 record descriptions', k => ({
    environment: control(sqSelect('SQ-FILE', 'sq09.dat')),
    fileSection: `FD SQ-FILE
    RECORD IS VARYING IN SIZE FROM 2 TO 12 CHARACTERS
    DEPENDING ON REC-LEN.
01 SHORT-REC PIC X(2).
01 LONG-REC PIC X(12).`,
    ws: '01 SQ-FILE-FS PIC XX.\n01 REC-LEN PIC 99.',
    proc: `OPEN OUTPUT SQ-FILE
MOVE "AB" TO SHORT-REC
MOVE 2 TO REC-LEN
WRITE SHORT-REC
MOVE "ABCDEFGHIJKL" TO LONG-REC
MOVE 12 TO REC-LEN
WRITE LONG-REC
CLOSE SQ-FILE
OPEN INPUT SQ-FILE
READ SQ-FILE AT END CONTINUE END-READ
${k('short-length', 'REC-LEN = 2')}
${k('short-data', 'SHORT-REC = "AB"')}
READ SQ-FILE AT END CONTINUE END-READ
${k('long-length', 'REC-LEN = 12')}
${k('long-data', 'LONG-REC = "ABCDEFGHIJKL"')}
CLOSE SQ-FILE`
  })),

  sq('SQ-ODO-RECORD-01', ['SQ115A'], 'A record containing OCCURS DEPENDING ON is written and read back with its variable length', k => ({
    environment: control(sqSelect('SQ-FILE', 'sq10.dat')),
    fileSection: `FD SQ-FILE.
01 TABLE-REC.
   05 ITEM-COUNT PIC 9.
   05 ITEM PIC X(2) OCCURS 1 TO 5 TIMES DEPENDING ON ITEM-COUNT.`,
    ws: '01 SQ-FILE-FS PIC XX.',
    proc: `OPEN OUTPUT SQ-FILE
MOVE 3 TO ITEM-COUNT
MOVE "AA" TO ITEM (1)
MOVE "BB" TO ITEM (2)
MOVE "CC" TO ITEM (3)
WRITE TABLE-REC
CLOSE SQ-FILE
MOVE SPACES TO TABLE-REC
OPEN INPUT SQ-FILE
READ SQ-FILE AT END CONTINUE END-READ
CLOSE SQ-FILE
${k('count', 'ITEM-COUNT = 3')}
${k('items', 'ITEM (1) = "AA" AND ITEM (2) = "BB" AND ITEM (3) = "CC"')}`
  })),

  sq('SQ-ADVANCING-01', ['SQ109M', 'SQ110M'], 'WRITE BEFORE/AFTER ADVANCING lines and PAGE on a print file', k => ({
    environment: control(sqSelect('PRINT-FILE', 'sq11.prn')),
    fileSection: 'FD PRINT-FILE.\n01 PRINT-LINE PIC X(20).',
    ws: '01 PRINT-FILE-FS PIC XX.',
    proc: `OPEN OUTPUT PRINT-FILE
MOVE "TITLE" TO PRINT-LINE
WRITE PRINT-LINE AFTER ADVANCING PAGE
MOVE "LINE-2" TO PRINT-LINE
WRITE PRINT-LINE AFTER ADVANCING 2 LINES
MOVE "LINE-3" TO PRINT-LINE
WRITE PRINT-LINE BEFORE ADVANCING 1 LINE
${k('advancing', 'PRINT-FILE-FS = "00"')}
CLOSE PRINT-FILE`
  })),

  sq('SQ-LINAGE-01', ['SQ137A', 'SQ138A', 'SQ139A'], 'LINAGE with FOOTING and LINAGE-COUNTER; WRITE AT END-OF-PAGE', k => ({
    environment: control(sqSelect('PRINT-FILE', 'sq12.prn')),
    fileSection: `FD PRINT-FILE
    LINAGE IS 5 LINES WITH FOOTING AT 4
    LINES AT TOP 1 LINES AT BOTTOM 1.
01 PRINT-LINE PIC X(20).`,
    ws: '01 PRINT-FILE-FS PIC XX.\n01 EOP-HITS PIC 99 VALUE 0.\n01 I PIC 99.',
    proc: `OPEN OUTPUT PRINT-FILE
${k('counter-after-open', 'LINAGE-COUNTER = 1')}
MOVE "L1" TO PRINT-LINE
WRITE PRINT-LINE
${k('counter-after-write', 'LINAGE-COUNTER = 2')}
PERFORM VARYING I FROM 1 BY 1 UNTIL I > 3
    WRITE PRINT-LINE AT END-OF-PAGE ADD 1 TO EOP-HITS END-WRITE
END-PERFORM
${k('end-of-page', 'EOP-HITS > 0')}
CLOSE PRINT-FILE`
  })),

  sq('SQ-DECLARATIVES-01', ['SQ224A', 'SQ226A'], 'USE AFTER STANDARD ERROR PROCEDURE runs after the file status is set', k => ({
    source: `IDENTIFICATION DIVISION.
PROGRAM-ID. SQ-DECLARATIVES-01.
ENVIRONMENT DIVISION.
${control(sqSelect('SQ-FILE', 'never-created-decl.dat'))}
DATA DIVISION.
FILE SECTION.
${sqFd()}
WORKING-STORAGE SECTION.
01 SQ-FILE-FS PIC XX.
01 ERR-COUNT PIC 99 VALUE 0.
PROCEDURE DIVISION.
DECLARATIVES.
SQ-ERROR SECTION.
    USE AFTER STANDARD ERROR PROCEDURE ON SQ-FILE.
SQ-ERROR-PARA.
    IF SQ-FILE-FS = "35"
        ADD 1 TO ERR-COUNT
    END-IF.
END DECLARATIVES.
MAIN SECTION.
MAIN-LINE.
    OPEN INPUT SQ-FILE
${k('declarative-ran', 'ERR-COUNT = 1')}
${k('status-35', 'SQ-FILE-FS = "35"')}
    STOP RUN.`
  })),

  sq('SQ-MULTI-OPEN-01', ['SQ130A', 'SQ131A'], 'One OPEN statement opening several files in different modes; RESERVE and SAME AREA clauses', k => ({
    environment: `INPUT-OUTPUT SECTION.
FILE-CONTROL.
SELECT IN-FILE ASSIGN TO "data/sq13-in.dat"
    RESERVE 2 AREAS
    ORGANIZATION IS SEQUENTIAL
    FILE STATUS IS IN-FILE-FS.
SELECT OUT-FILE ASSIGN TO "data/sq13-out.dat"
    ORGANIZATION IS SEQUENTIAL
    FILE STATUS IS OUT-FILE-FS.`,
    fileSection: `${sqFd('IN-FILE', 'IN-REC')}\n${sqFd('OUT-FILE', 'OUT-REC')}`,
    ws: '01 IN-FILE-FS PIC XX.\n01 OUT-FILE-FS PIC XX.\n01 EOF-SW PIC X VALUE "N".\n01 N PIC 99 VALUE 0.',
    proc: `OPEN OUTPUT IN-FILE
MOVE "COPY-ME" TO IN-REC
WRITE IN-REC
WRITE IN-REC
CLOSE IN-FILE
OPEN INPUT IN-FILE OUTPUT OUT-FILE
${k('both-open', 'IN-FILE-FS = "00" AND OUT-FILE-FS = "00"')}
PERFORM UNTIL EOF-SW = "Y"
    READ IN-FILE
        AT END MOVE "Y" TO EOF-SW
        NOT AT END WRITE OUT-REC FROM IN-REC ADD 1 TO N
    END-READ
END-PERFORM
CLOSE IN-FILE OUT-FILE
${k('copied', 'N = 2 AND OUT-FILE-FS = "00"')}`
  })),

  // ---------------------------------------------------------------- RL
  rl('RL-SEQ-CREATE-01', ['RL101A', 'RL102A', 'RL103A'], 'Sequential creation of a relative file updates the RELATIVE KEY; sequential READ returns the relative record number', k => ({
    environment: control(rlSelect('SEQUENTIAL', 'rl01.dat')),
    fileSection: rlFd,
    ws: `${rlWs}\n01 EOF-SW PIC X VALUE "N".`,
    proc: `OPEN OUTPUT RL-FILE
PERFORM VARYING N FROM 1 BY 1 UNTIL N > 4
    MOVE N TO RL-REC
    WRITE RL-REC
END-PERFORM
${k('write-sets-key', 'RL-KEY = 4')}
CLOSE RL-FILE
OPEN INPUT RL-FILE
MOVE 0 TO N
PERFORM UNTIL EOF-SW = "Y"
    READ RL-FILE NEXT RECORD
        AT END MOVE "Y" TO EOF-SW
        NOT AT END ADD 1 TO N
    END-READ
END-PERFORM
${k('count', 'N = 4')}
${k('last-key', 'RL-KEY = 4')}
${k('at-end-10', 'RL-FS = "10"')}
CLOSE RL-FILE`
  })),

  rl('RL-RANDOM-01', ['RL104A', 'RL105A', 'RL106A'], 'Random WRITE/READ by RELATIVE KEY with INVALID KEY (22 duplicate, 23 not found)', k => ({
    environment: control(rlSelect('RANDOM', 'rl02.dat')),
    fileSection: rlFd,
    ws: `${rlWs}\n01 BAD PIC 99 VALUE 0.`,
    proc: `OPEN OUTPUT RL-FILE
MOVE 5 TO RL-KEY
MOVE "FIVE" TO RL-REC
WRITE RL-REC INVALID KEY ADD 1 TO BAD END-WRITE
MOVE 2 TO RL-KEY
MOVE "TWO" TO RL-REC
WRITE RL-REC INVALID KEY ADD 1 TO BAD END-WRITE
${k('writes-ok', 'BAD = 0 AND RL-FS = "00"')}
MOVE 5 TO RL-KEY
WRITE RL-REC INVALID KEY ADD 1 TO BAD END-WRITE
${k('duplicate-22', 'BAD = 1 AND RL-FS = "22"')}
CLOSE RL-FILE
OPEN INPUT RL-FILE
MOVE 5 TO RL-KEY
READ RL-FILE INVALID KEY ADD 1 TO BAD END-READ
${k('read-five', 'RL-REC = "FIVE"')}
MOVE 3 TO RL-KEY
READ RL-FILE
    INVALID KEY ADD 1 TO BAD
    NOT INVALID KEY MOVE 99 TO BAD
END-READ
${k('missing-23', 'BAD = 2 AND RL-FS = "23"')}
CLOSE RL-FILE`
  })),

  rl('RL-DYNAMIC-START-01', ['RL107A', 'RL108A', 'RL109A'], 'Dynamic access: START EQUAL, GREATER THAN and NOT LESS THAN followed by READ NEXT', k => ({
    environment: control(rlSelect('DYNAMIC', 'rl03.dat')),
    fileSection: rlFd,
    ws: `${rlWs}\n01 BAD PIC 99 VALUE 0.`,
    proc: `OPEN OUTPUT RL-FILE
MOVE 2 TO RL-KEY
MOVE "R2" TO RL-REC
WRITE RL-REC
MOVE 4 TO RL-KEY
MOVE "R4" TO RL-REC
WRITE RL-REC
MOVE 6 TO RL-KEY
MOVE "R6" TO RL-REC
WRITE RL-REC
CLOSE RL-FILE
OPEN I-O RL-FILE
MOVE 4 TO RL-KEY
START RL-FILE KEY IS EQUAL TO RL-KEY
READ RL-FILE NEXT RECORD AT END ADD 1 TO BAD END-READ
${k('start-equal', 'RL-REC = "R4" AND RL-KEY = 4')}
MOVE 4 TO RL-KEY
START RL-FILE KEY IS GREATER THAN RL-KEY
READ RL-FILE NEXT AT END ADD 1 TO BAD END-READ
${k('start-greater', 'RL-REC = "R6" AND RL-KEY = 6')}
MOVE 3 TO RL-KEY
START RL-FILE KEY IS NOT LESS THAN RL-KEY
READ RL-FILE NEXT AT END ADD 1 TO BAD END-READ
${k('start-not-less', 'RL-REC = "R4"')}
MOVE 7 TO RL-KEY
START RL-FILE KEY IS NOT LESS THAN RL-KEY INVALID KEY ADD 1 TO BAD END-START
${k('start-invalid-23', 'BAD = 1 AND RL-FS = "23"')}
MOVE 2 TO RL-KEY
READ RL-FILE
${k('random-read', 'RL-REC = "R2"')}
READ RL-FILE NEXT
${k('read-next-after-random', 'RL-REC = "R4"')}
CLOSE RL-FILE`
  })),

  rl('RL-REWRITE-DELETE-01', ['RL110A', 'RL111A', 'RL112A'], 'REWRITE and DELETE of relative records with INVALID KEY', k => ({
    environment: control(rlSelect('RANDOM', 'rl04.dat')),
    fileSection: rlFd,
    ws: `${rlWs}\n01 BAD PIC 99 VALUE 0.`,
    proc: `OPEN OUTPUT RL-FILE
MOVE 1 TO RL-KEY
MOVE "ONE" TO RL-REC
WRITE RL-REC
MOVE 2 TO RL-KEY
MOVE "TWO" TO RL-REC
WRITE RL-REC
CLOSE RL-FILE
OPEN I-O RL-FILE
MOVE 1 TO RL-KEY
MOVE "ONE-NEW" TO RL-REC
REWRITE RL-REC INVALID KEY ADD 1 TO BAD END-REWRITE
MOVE 2 TO RL-KEY
DELETE RL-FILE RECORD INVALID KEY ADD 1 TO BAD END-DELETE
${k('ok', 'BAD = 0 AND RL-FS = "00"')}
MOVE 2 TO RL-KEY
READ RL-FILE INVALID KEY ADD 1 TO BAD END-READ
${k('deleted-23', 'BAD = 1 AND RL-FS = "23"')}
MOVE 9 TO RL-KEY
REWRITE RL-REC INVALID KEY ADD 1 TO BAD END-REWRITE
${k('rewrite-missing-23', 'BAD = 2')}
MOVE 1 TO RL-KEY
READ RL-FILE
${k('rewritten', 'RL-REC = "ONE-NEW"')}
CLOSE RL-FILE`
  })),

  rl('RL-STATUS-01', ['RL201A', 'RL202A', 'RL213A'], 'Relative file logic errors: absent file 35, OPTIONAL 05, READ after AT END 46', k => ({
    environment: control(`SELECT RL-FILE ASSIGN TO "data/rl-missing.dat"
    ORGANIZATION IS RELATIVE ACCESS MODE IS SEQUENTIAL
    RELATIVE KEY IS RL-KEY
    FILE STATUS IS RL-FS.
SELECT OPTIONAL OPT-FILE ASSIGN TO "data/rl-missing-opt.dat"
    ORGANIZATION IS RELATIVE ACCESS MODE IS SEQUENTIAL
    RELATIVE KEY IS OPT-KEY
    FILE STATUS IS OPT-FS.`),
    fileSection: `${rlFd}\nFD OPT-FILE.\n01 OPT-REC PIC X(8).`,
    ws: '01 RL-KEY PIC 9(4).\n01 OPT-KEY PIC 9(4).\n01 RL-FS PIC XX.\n01 OPT-FS PIC XX.',
    proc: `OPEN INPUT RL-FILE
${k('absent-35', 'RL-FS = "35"')}
OPEN INPUT OPT-FILE
${k('optional-05', 'OPT-FS = "05"')}
READ OPT-FILE NEXT AT END CONTINUE END-READ
${k('at-end-10', 'OPT-FS = "10"')}
READ OPT-FILE NEXT AT END CONTINUE END-READ
${k('after-eof-46', 'OPT-FS = "46"')}
CLOSE OPT-FILE`
  })),

  // ---------------------------------------------------------------- IX
  ix('IX-SEQ-CREATE-01', ['IX101A', 'IX102A', 'IX103A'], 'Sequential creation of an indexed file and sequential READ in key order', k => ({
    environment: control(ixSelect('SEQUENTIAL', 'ix01.dat')),
    fileSection: ixFd,
    ws: '01 IX-FS PIC XX.\n01 N PIC 99 VALUE 0.\n01 EOF-SW PIC X VALUE "N".\n01 PREV PIC X(4) VALUE LOW-VALUES.\n01 ORDER-OK PIC X VALUE "Y".',
    proc: `OPEN OUTPUT IX-FILE
MOVE "K001ALT1DATA-1" TO IX-REC
WRITE IX-REC
MOVE "K002ALT2DATA-2" TO IX-REC
WRITE IX-REC
MOVE "K003ALT3DATA-3" TO IX-REC
WRITE IX-REC
${k('write', 'IX-FS = "00"')}
CLOSE IX-FILE
OPEN INPUT IX-FILE
PERFORM UNTIL EOF-SW = "Y"
    READ IX-FILE NEXT
        AT END MOVE "Y" TO EOF-SW
        NOT AT END
            ADD 1 TO N
            IF IX-KEY NOT > PREV MOVE "N" TO ORDER-OK END-IF
            MOVE IX-KEY TO PREV
    END-READ
END-PERFORM
${k('count', 'N = 3')}
${k('ascending', 'ORDER-OK = "Y"')}
${k('at-end-10', 'IX-FS = "10"')}
CLOSE IX-FILE`
  })),

  ix('IX-SEQ-ERRORS-01', ['IX104A', 'IX105A'], 'Sequential-access WRITE out of key sequence gives 21; random duplicate key gives 22', k => ({
    environment: control(`${ixSelect('SEQUENTIAL', 'ix02.dat')}
SELECT IX-FILE2 ASSIGN TO "data/ix02b.dat"
    ORGANIZATION IS INDEXED ACCESS MODE IS RANDOM
    RECORD KEY IS IX2-KEY FILE STATUS IS IX2-FS.`),
    fileSection: `${ixFd}
FD IX-FILE2.
01 IX2-REC.
   05 IX2-KEY PIC X(4).
   05 IX2-DATA PIC X(4).`,
    ws: '01 IX-FS PIC XX.\n01 IX2-FS PIC XX.\n01 BAD PIC 99 VALUE 0.',
    proc: `OPEN OUTPUT IX-FILE
MOVE "K005" TO IX-KEY
WRITE IX-REC
MOVE "K001" TO IX-KEY
WRITE IX-REC INVALID KEY ADD 1 TO BAD END-WRITE
${k('sequence-21', 'BAD = 1 AND IX-FS = "21"')}
CLOSE IX-FILE
OPEN OUTPUT IX-FILE2
MOVE "K001" TO IX2-KEY
WRITE IX2-REC
WRITE IX2-REC INVALID KEY ADD 1 TO BAD END-WRITE
${k('duplicate-22', 'BAD = 2 AND IX2-FS = "22"')}
CLOSE IX-FILE2`
  })),

  ix('IX-RANDOM-01', ['IX106A', 'IX107A', 'IX108A'], 'Random READ by prime key with INVALID KEY / NOT INVALID KEY and END-READ', k => ({
    environment: control(ixSelect('RANDOM', 'ix03.dat')),
    fileSection: ixFd,
    ws: '01 IX-FS PIC XX.\n01 HITS PIC 99 VALUE 0.\n01 MISSES PIC 99 VALUE 0.',
    proc: `OPEN OUTPUT IX-FILE
MOVE "B000ALT1RANDOM-B" TO IX-REC
WRITE IX-REC
MOVE "A000ALT2RANDOM-A" TO IX-REC
WRITE IX-REC
CLOSE IX-FILE
OPEN INPUT IX-FILE
MOVE "A000" TO IX-KEY
READ IX-FILE
    INVALID KEY ADD 1 TO MISSES
    NOT INVALID KEY ADD 1 TO HITS
END-READ
${k('found', 'HITS = 1 AND IX-DATA = "RANDOM-A"')}
MOVE "Z999" TO IX-KEY
READ IX-FILE
    INVALID KEY ADD 1 TO MISSES
    NOT INVALID KEY ADD 1 TO HITS
END-READ
${k('not-found-23', 'MISSES = 1 AND IX-FS = "23"')}
CLOSE IX-FILE`
  })),

  ix('IX-ALTERNATE-01', ['IX109A', 'IX110A', 'IX111A'], 'ALTERNATE RECORD KEY WITH DUPLICATES: status 02 and READ KEY IS alternate', k => ({
    environment: control(ixSelect('DYNAMIC', 'ix04.dat', '\n    ALTERNATE RECORD KEY IS IX-ALT WITH DUPLICATES')),
    fileSection: ixFd,
    ws: '01 IX-FS PIC XX.',
    proc: `OPEN OUTPUT IX-FILE
MOVE "K001SAMEFIRST" TO IX-REC
WRITE IX-REC
${k('unique-00', 'IX-FS = "00"')}
MOVE "K002SAMESECOND" TO IX-REC
WRITE IX-REC
${k('duplicate-alt-02', 'IX-FS = "02"')}
CLOSE IX-FILE
OPEN INPUT IX-FILE
MOVE "SAME" TO IX-ALT
READ IX-FILE KEY IS IX-ALT
${k('first-duplicate', 'IX-KEY = "K001" AND IX-FS = "02"')}
READ IX-FILE NEXT
${k('next-duplicate', 'IX-KEY = "K002"')}
CLOSE IX-FILE`
  })),

  ix('IX-START-01', ['IX112A', 'IX113A', 'IX114A'], 'START KEY EQUAL / GREATER / NOT LESS (including a partial key) and INVALID KEY 23', k => ({
    environment: control(ixSelect('DYNAMIC', 'ix05.dat')),
    fileSection: ixFd,
    ws: '01 IX-FS PIC XX.\n01 BAD PIC 99 VALUE 0.\n01 PART-KEY PIC X(2).',
    proc: `OPEN OUTPUT IX-FILE
MOVE "AA10" TO IX-KEY
WRITE IX-REC
MOVE "BB20" TO IX-KEY
WRITE IX-REC
MOVE "CC30" TO IX-KEY
WRITE IX-REC
CLOSE IX-FILE
OPEN I-O IX-FILE
MOVE "BB20" TO IX-KEY
START IX-FILE KEY IS = IX-KEY
READ IX-FILE NEXT
${k('equal', 'IX-KEY = "BB20"')}
MOVE "BB20" TO IX-KEY
START IX-FILE KEY IS > IX-KEY
READ IX-FILE NEXT
${k('greater', 'IX-KEY = "CC30"')}
MOVE "AB00" TO IX-KEY
START IX-FILE KEY IS NOT < IX-KEY
READ IX-FILE NEXT
${k('not-less', 'IX-KEY = "BB20"')}
MOVE "ZZ99" TO IX-KEY
START IX-FILE KEY IS >= IX-KEY
    INVALID KEY ADD 1 TO BAD
    NOT INVALID KEY ADD 50 TO BAD
END-START
${k('invalid-23', 'BAD = 1 AND IX-FS = "23"')}
CLOSE IX-FILE`
  })),

  ix('IX-REWRITE-DELETE-01', ['IX115A', 'IX116A', 'IX117A'], 'REWRITE and DELETE in random and sequential access', k => ({
    environment: control(ixSelect('DYNAMIC', 'ix06.dat')),
    fileSection: ixFd,
    ws: '01 IX-FS PIC XX.\n01 BAD PIC 99 VALUE 0.',
    proc: `OPEN OUTPUT IX-FILE
MOVE "K001ALT1OLD-1" TO IX-REC
WRITE IX-REC
MOVE "K002ALT2OLD-2" TO IX-REC
WRITE IX-REC
CLOSE IX-FILE
OPEN I-O IX-FILE
MOVE "K001ALT1NEW-1" TO IX-REC
REWRITE IX-REC INVALID KEY ADD 1 TO BAD END-REWRITE
MOVE "K002" TO IX-KEY
DELETE IX-FILE INVALID KEY ADD 1 TO BAD END-DELETE
${k('ok', 'BAD = 0')}
MOVE "K002" TO IX-KEY
READ IX-FILE INVALID KEY ADD 1 TO BAD END-READ
${k('deleted-23', 'BAD = 1 AND IX-FS = "23"')}
MOVE "K001" TO IX-KEY
READ IX-FILE
${k('rewritten', 'IX-DATA = "NEW-1"')}
MOVE "K009" TO IX-KEY
DELETE IX-FILE RECORD INVALID KEY ADD 1 TO BAD END-DELETE
${k('delete-missing', 'BAD = 2 AND IX-FS = "23"')}
CLOSE IX-FILE`
  })),

  ix('IX-EXTEND-01', ['IX118A', 'IX119A'], 'OPEN EXTEND on an indexed file appends records with higher keys', k => ({
    environment: control(ixSelect('SEQUENTIAL', 'ix07.dat')),
    fileSection: ixFd,
    ws: '01 IX-FS PIC XX.\n01 N PIC 99 VALUE 0.\n01 EOF-SW PIC X VALUE "N".',
    proc: `OPEN OUTPUT IX-FILE
MOVE "K001" TO IX-KEY
WRITE IX-REC
CLOSE IX-FILE
OPEN EXTEND IX-FILE
${k('open-extend', 'IX-FS = "00"')}
MOVE "K002" TO IX-KEY
WRITE IX-REC
CLOSE IX-FILE
OPEN INPUT IX-FILE
PERFORM UNTIL EOF-SW = "Y"
    READ IX-FILE AT END MOVE "Y" TO EOF-SW NOT AT END ADD 1 TO N END-READ
END-PERFORM
${k('count', 'N = 2')}
CLOSE IX-FILE`
  })),

  ix('IX-OPTIONAL-01', ['IX201A', 'IX202A', 'IX203A'], 'OPTIONAL indexed file opened I-O is created (status 05); CLOSE of unopened file gives 42; absent file 35', k => ({
    environment: control(`SELECT OPTIONAL IX-FILE ASSIGN TO "data/ix-optional.dat"
    ORGANIZATION IS INDEXED ACCESS MODE IS DYNAMIC
    RECORD KEY IS IX-KEY FILE STATUS IS IX-FS.
SELECT IX-MISSING ASSIGN TO "data/ix-missing.dat"
    ORGANIZATION IS INDEXED ACCESS MODE IS DYNAMIC
    RECORD KEY IS MISS-KEY FILE STATUS IS MISS-FS.`),
    fileSection: `${ixFd}
FD IX-MISSING.
01 MISS-REC.
   05 MISS-KEY PIC X(4).`,
    ws: '01 IX-FS PIC XX.\n01 MISS-FS PIC XX.',
    proc: `CLOSE IX-FILE
${k('close-unopened-42', 'IX-FS = "42"')}
OPEN INPUT IX-MISSING
${k('absent-35', 'MISS-FS = "35"')}
OPEN I-O IX-FILE
${k('optional-05', 'IX-FS = "05"')}
MOVE "K001" TO IX-KEY
WRITE IX-REC
${k('write-created', 'IX-FS = "00"')}
CLOSE IX-FILE`
  })),

  ix('IX-SCOPE-01', ['IX120A', 'IX121A'], 'Nested conditional WRITE statements: an inner WRITE ... INVALID KEY ... END-WRITE inside NOT INVALID KEY', k => ({
    environment: control(ixSelect('DYNAMIC', 'ix08.dat')),
    fileSection: ixFd,
    ws: '01 IX-FS PIC XX.\n01 TRAIL PIC X(6) VALUE SPACES.',
    proc: `OPEN OUTPUT IX-FILE
MOVE "K001" TO IX-KEY
WRITE IX-REC
    INVALID KEY STRING TRAIL DELIMITED BY SPACE "X" DELIMITED BY SIZE INTO TRAIL
    NOT INVALID KEY
        WRITE IX-REC
            INVALID KEY MOVE "W2" TO TRAIL
        END-WRITE
END-WRITE
${k('nested-write', 'TRAIL = "W2" AND IX-FS = "22"')}
CLOSE IX-FILE`
  }))
];
