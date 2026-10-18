import assert from 'node:assert/strict';
import { test, traceProgram, traceCheck } from './support/trace.mjs';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { createDesktopTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-text-bindings.mjs';
import { createIsamBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/isam-bindings.mjs';

function program({ record = '05 S-KEY PIC X.\n05 S-TAG PIC X.', select = '', fd = '', ws = '',
  special = '', main, procedures = '' }) {
  return `IDENTIFICATION DIVISION.
PROGRAM-ID. SORT-REGRESSION.
ENVIRONMENT DIVISION.
${special ? `CONFIGURATION SECTION.\nSPECIAL-NAMES.\n${special}` : ''}
INPUT-OUTPUT SECTION.
FILE-CONTROL.
SELECT SORT-FILE ASSIGN TO "data/sort-work".
${select}
DATA DIVISION.
FILE SECTION.
SD SORT-FILE.
01 SORT-REC.
${record}
${fd}
WORKING-STORAGE SECTION.
${ws}
PROCEDURE DIVISION.
MAIN-LINE.
${main}
STOP RUN.
${procedures}`;
}

async function run(source, expected, storageOverrides = {}) {
  traceProgram(import.meta.url, source);
  const compiled = compileTandemCobol85ToPcode(source, { fileName: 'sort-regression.cob' });
  const files = new Map();
  const storage = {
    'host.fs_exists': async (_root, path) => Number(files.has(path)),
    'host.fs_read_text': async (_root, path) => files.get(path),
    'host.fs_write_text': async (_root, path, contents) => { files.set(path, contents); return 0; },
    ...storageOverrides
  };
  const isam = createIsamBindings(storage);
  const bindings = { ...createDesktopTextBindings(), ...isam };
  const signal = new AbortController().signal;
  try {
    const execution = await executeProgram({
      instructions: parsePcode(compiled.pcodeText),
      programMap: compiled.programMap,
      runtimeContext: {
        callHost: (name, args) => {
          assert.equal(typeof bindings[name], 'function', `Missing host binding ${name}`);
          return bindings[name](...args, { signal });
        }
      }
    });
    traceCheck(import.meta.url, { description: 'Sorted records and status', expected, actual: execution.stdout });
    assert.equal(execution.error, null);
    assert.equal(execution.stepLimitHit, false);
    assert.deepEqual(execution.stdout, expected);
    assert.equal(files.has('sort-work'), false, 'SD work records stay in P-code memory');
    return { files, compiled };
  } finally {
    isam.dispose();
  }
}

test('SORT handles empty/singleton input, procedure ranges, repeated use and EOF preservation', async () => {
  await run(program({
    ws: '01 TARGET PIC X(4) VALUE "KEEP".',
    main: `SORT SORT-FILE ON ASCENDING KEY S-KEY
    INPUT PROCEDURE EMPTY-START THRU EMPTY-END OUTPUT PROCEDURE CHECK-EMPTY
DISPLAY SORT-RETURN
SORT SORT-FILE ON ASCENDING KEY S-KEY INPUT PROCEDURE LOAD-ONE OUTPUT PROCEDURE DRAIN
DISPLAY SORT-RETURN
SORT SORT-FILE ON DESCENDING KEY S-KEY INPUT PROCEDURE LOAD-ONE OUTPUT PROCEDURE DRAIN
DISPLAY SORT-RETURN`,
    procedures: `EMPTY-START.
    CONTINUE.
EMPTY-END.
    CONTINUE.
CHECK-EMPTY.
    RETURN SORT-FILE INTO TARGET
        AT END DISPLAY TARGET
        NOT AT END DISPLAY "UNEXPECTED"
    END-RETURN.
LOAD-ONE.
    MOVE "Az" TO SORT-REC
    RELEASE SORT-REC.
DRAIN.
    RETURN SORT-FILE AT END DISPLAY "UNEXPECTED" NOT AT END DISPLAY SORT-REC END-RETURN
    RETURN SORT-FILE AT END DISPLAY SORT-REC NOT AT END DISPLAY "UNEXPECTED" END-RETURN.`
  }), ['KEEP', '00', 'Az', 'Az', '00', 'Az', 'Az', '00']);
});

test('stable merge sort orders 64 reversed records within the PMachine instruction limit', async () => {
  await run(program({
    record: '05 S-KEY PIC 999.',
    ws: '01 N PIC 999.\n01 EXPECTED-KEY PIC 999 VALUE 1.\n01 EOF-SW PIC 9 VALUE 0.',
    main: `SORT SORT-FILE ON ASCENDING KEY S-KEY INPUT PROCEDURE LOAD-MANY OUTPUT PROCEDURE DRAIN
DISPLAY EXPECTED-KEY
DISPLAY SORT-RETURN`,
    procedures: `LOAD-MANY.
    PERFORM VARYING N FROM 64 BY -1 UNTIL N < 1
        MOVE N TO S-KEY
        RELEASE SORT-REC
    END-PERFORM.
DRAIN.
    PERFORM UNTIL EOF-SW = 1
        RETURN SORT-FILE
            AT END MOVE 1 TO EOF-SW
            NOT AT END
                IF S-KEY NOT = EXPECTED-KEY DISPLAY "OUT OF ORDER" END-IF
                ADD 1 TO EXPECTED-KEY
        END-RETURN
    END-PERFORM.`
  }), ['065', '00']);
});

test('SORT compares exact large fractional keys and restores trailing separate signs', async () => {
  const rows = [
    ['9007199254740993.01', 'C'],
    ['-9007199254740993.01', 'B'],
    ['-9007199254740993.02', 'A'],
    ['9007199254740993.01', 'D']
  ];
  const ordered = [rows[2], rows[1], rows[0], rows[3]];
  await run(program({
    record: '05 S-KEY PIC S9(18)V99 SIGN TRAILING SEPARATE.\n05 S-TAG PIC X.',
    main: `SORT SORT-FILE ON ASCENDING KEY S-KEY WITH DUPLICATES IN ORDER
    INPUT PROCEDURE LOAD-ROWS OUTPUT PROCEDURE DRAIN
DISPLAY SORT-RETURN`,
    procedures: `LOAD-ROWS.
${rows.map(([value, tag]) => `MOVE ${value} TO S-KEY MOVE "${tag}" TO S-TAG RELEASE SORT-REC`).join('\n')}.
DRAIN.
${ordered.map(([value]) => `RETURN SORT-FILE AT END DISPLAY "UNEXPECTED" END-RETURN
IF S-KEY = ${value} DISPLAY S-TAG ELSE DISPLAY "WRONG KEY" END-IF`).join('\n')}.`
  }), ['A', 'B', 'C', 'D', '00']);
});

test('custom collation supports descending ranges, ALSO equivalences and multi-character stable keys', async () => {
  await run(program({
    record: '05 S-KEY PIC XX.\n05 S-TAG PIC X.',
    special: 'ALPHABET CUSTOM IS "C" "B" ALSO "b" "A" "Z" THRU "X".',
    ws: '01 EOF-SW PIC 9 VALUE 0.',
    main: `SORT SORT-FILE ON ASCENDING KEY S-KEY WITH DUPLICATES IN ORDER
    COLLATING SEQUENCE IS CUSTOM INPUT PROCEDURE LOAD-ROWS OUTPUT PROCEDURE DRAIN`,
    procedures: `LOAD-ROWS.
${['BZa', 'bZb', 'CZc', 'AZd', 'BAe'].map(row => `MOVE "${row}" TO SORT-REC RELEASE SORT-REC`).join('\n')}.
DRAIN.
    PERFORM UNTIL EOF-SW = 1
        RETURN SORT-FILE AT END MOVE 1 TO EOF-SW NOT AT END DISPLAY S-TAG END-RETURN
    END-PERFORM.`
  }), ['c', 'e', 'a', 'b', 'd']);
});

test('SORT accepts multiple USING/GIVING files and MERGE retains equal-key run order', async () => {
  const names = ['FILE-A', 'FILE-B', 'OUT-A', 'OUT-B'];
  const { files } = await run(program({
    select: names.map(name => `SELECT ${name} ASSIGN TO "data/${name}".`).join('\n'),
    fd: names.map(name => `FD ${name}.\n01 ${name}-REC PIC XX.`).join('\n'),
    ws: '01 EOF-SW PIC 9 VALUE 0.',
    main: `OPEN OUTPUT FILE-A FILE-B
MOVE "B1" TO FILE-A-REC WRITE FILE-A-REC
MOVE "A0" TO FILE-A-REC WRITE FILE-A-REC
MOVE "B2" TO FILE-B-REC WRITE FILE-B-REC
MOVE "C3" TO FILE-B-REC WRITE FILE-B-REC
CLOSE FILE-A FILE-B
SORT SORT-FILE ON ASCENDING KEY S-KEY USING FILE-A FILE-B GIVING OUT-A OUT-B
DISPLAY SORT-RETURN
MERGE SORT-FILE ON ASCENDING KEY S-KEY USING OUT-A OUT-B OUTPUT PROCEDURE DRAIN
DISPLAY SORT-RETURN`,
    procedures: `DRAIN.
    PERFORM UNTIL EOF-SW = 1
        RETURN SORT-FILE AT END MOVE 1 TO EOF-SW NOT AT END DISPLAY SORT-REC END-RETURN
    END-PERFORM.`
  }), ['00', 'A0', 'A0', 'B1', 'B2', 'B1', 'B2', 'C3', 'C3', '00']);
  for (const name of ['OUT-A', 'OUT-B']) {
    assert.deepEqual(JSON.parse(files.get(name)).records.map(row => row[1]), ['A0', 'B1', 'B2', 'C3']);
  }
});

test('MERGE handles descending major and ascending minor keys with an empty input run', async () => {
  const names = ['FILE-A', 'FILE-B', 'EMPTY-FILE'];
  await run(program({
    record: '05 S-MAJOR PIC 99.\n05 S-MINOR PIC X.\n05 S-TAG PIC X.',
    select: names.map(name => `SELECT ${name} ASSIGN TO "data/${name}".`).join('\n'),
    fd: names.map(name => `FD ${name}.\n01 ${name}-REC PIC X(4).`).join('\n'),
    ws: '01 EOF-SW PIC 9 VALUE 0.',
    main: `OPEN OUTPUT FILE-A FILE-B EMPTY-FILE
MOVE "20Aa" TO FILE-A-REC WRITE FILE-A-REC
MOVE "10Cb" TO FILE-A-REC WRITE FILE-A-REC
MOVE "20Bc" TO FILE-B-REC WRITE FILE-B-REC
MOVE "10Ad" TO FILE-B-REC WRITE FILE-B-REC
CLOSE FILE-A FILE-B EMPTY-FILE
MERGE SORT-FILE ON DESCENDING KEY S-MAJOR ON ASCENDING KEY S-MINOR
    USING FILE-A EMPTY-FILE FILE-B OUTPUT PROCEDURE DRAIN
DISPLAY SORT-RETURN`,
    procedures: `DRAIN.
    PERFORM UNTIL EOF-SW = 1
        RETURN SORT-FILE AT END MOVE 1 TO EOF-SW NOT AT END DISPLAY S-TAG END-RETURN
    END-PERFORM.`
  }), ['a', 'c', 'd', 'b', '00']);
});

test('SORT reports missing input with status 16, skips output and can be used again', async () => {
  await run(program({
    select: 'SELECT MISSING-FILE ASSIGN TO "data/missing".',
    fd: 'FD MISSING-FILE.\n01 MISSING-REC PIC XX.',
    main: `SORT SORT-FILE ON ASCENDING KEY S-KEY USING MISSING-FILE OUTPUT PROCEDURE UNEXPECTED
DISPLAY SORT-RETURN
SORT SORT-FILE ON ASCENDING KEY S-KEY INPUT PROCEDURE LOAD-ONE OUTPUT PROCEDURE DRAIN
DISPLAY SORT-RETURN`,
    procedures: `UNEXPECTED.
    DISPLAY "UNEXPECTED".
LOAD-ONE.
    MOVE "Ax" TO SORT-REC RELEASE SORT-REC.
DRAIN.
    RETURN SORT-FILE AT END DISPLAY "UNEXPECTED" NOT AT END DISPLAY SORT-REC END-RETURN.`
  }), ['16', 'Ax', '00']);
});

test('failed automatic OPEN does not close or overwrite a caller-owned input or output file', async () => {
  const { files } = await run(program({
    select: `SELECT IN-FILE ASSIGN TO "data/in".
SELECT OUT-FILE ASSIGN TO "data/out" FILE STATUS FS-CODE.`,
    fd: 'FD IN-FILE.\n01 IN-REC PIC XX.\nFD OUT-FILE.\n01 OUT-REC PIC XX.',
    ws: '01 FS-CODE PIC XX.',
    main: `OPEN OUTPUT IN-FILE
SORT SORT-FILE ON ASCENDING KEY S-KEY USING IN-FILE GIVING OUT-FILE
DISPLAY SORT-RETURN
MOVE "A1" TO IN-REC WRITE IN-REC CLOSE IN-FILE
OPEN OUTPUT OUT-FILE
SORT SORT-FILE ON ASCENDING KEY S-KEY USING IN-FILE GIVING OUT-FILE
DISPLAY SORT-RETURN
MOVE "Z9" TO OUT-REC WRITE OUT-REC
DISPLAY FS-CODE
CLOSE OUT-FILE`
  }), ['16', '16', '00']);
  assert.deepEqual(JSON.parse(files.get('in')).records.map(row => row[1]), ['A1']);
  assert.deepEqual(JSON.parse(files.get('out')).records.map(row => row[1]), ['Z9']);
});

test('RELEASE and RETURN outside their procedure phases report status 16 without changing INTO', async () => {
  await run(program({
    ws: '01 TARGET PIC XX VALUE "OK".',
    main: `RELEASE SORT-REC
DISPLAY SORT-RETURN
RETURN SORT-FILE INTO TARGET AT END DISPLAY TARGET END-RETURN
DISPLAY SORT-RETURN`
  }), ['16', 'OK', '16']);
});

test('MERGE reports unordered input instead of returning a successful unordered result', async () => {
  await run(program({
    select: 'SELECT FILE-A ASSIGN TO "data/a".\nSELECT FILE-B ASSIGN TO "data/b".',
    fd: 'FD FILE-A.\n01 A-REC PIC XX.\nFD FILE-B.\n01 B-REC PIC XX.',
    main: `OPEN OUTPUT FILE-A FILE-B
MOVE "B1" TO A-REC WRITE A-REC
MOVE "A0" TO A-REC WRITE A-REC
CLOSE FILE-A FILE-B
MERGE SORT-FILE ON ASCENDING KEY S-KEY USING FILE-A FILE-B OUTPUT PROCEDURE DRAIN
DISPLAY SORT-RETURN`,
    procedures: 'DRAIN.\nDISPLAY "UNEXPECTED".'
  }), ['16']);
});

test('a recursive SORT of the same SD file reports status 16 and leaves it reusable', async () => {
  await run(program({
    main: `SORT SORT-FILE ON ASCENDING KEY S-KEY INPUT PROCEDURE RECURSIVE-LOAD OUTPUT PROCEDURE DRAIN
DISPLAY SORT-RETURN
SORT SORT-FILE ON ASCENDING KEY S-KEY INPUT PROCEDURE LOAD-ONE OUTPUT PROCEDURE DRAIN
DISPLAY SORT-RETURN`,
    procedures: `RECURSIVE-LOAD.
    MOVE "B1" TO SORT-REC RELEASE SORT-REC
    SORT SORT-FILE ON ASCENDING KEY S-KEY INPUT PROCEDURE LOAD-ONE OUTPUT PROCEDURE DRAIN.
LOAD-ONE.
    MOVE "A0" TO SORT-REC RELEASE SORT-REC.
DRAIN.
    RETURN SORT-FILE AT END DISPLAY "UNEXPECTED" NOT AT END DISPLAY SORT-REC END-RETURN.`
  }), ['16', 'A0', '00']);
});

test('SORT propagates filesystem transport failures instead of reporting a successful empty sort', async () => {
  const source = program({
    select: 'SELECT IN-FILE ASSIGN TO "data/in".',
    fd: 'FD IN-FILE.\n01 IN-REC PIC XX.',
    main: 'SORT SORT-FILE ON ASCENDING KEY S-KEY USING IN-FILE OUTPUT PROCEDURE DRAIN',
    procedures: 'DRAIN.\nDISPLAY "UNEXPECTED".'
  });
  await assert.rejects(run(source, [], {
    'host.fs_exists': async () => { throw new Error('filesystem transport failed'); }
  }), /filesystem transport failed/);
});

test('SORT/MERGE rejects FD work files, invalid keys and unknown collating sequences', () => {
  for (const [source, pattern] of [
    [program({ main: 'SORT SORT-FILE ON ASCENDING KEY S-KEY INPUT PROCEDURE P OUTPUT PROCEDURE P', procedures: 'P. CONTINUE.' })
      .replace('SD SORT-FILE.', 'FD SORT-FILE.'), /fixed-length SD/],
    [program({ ws: '01 OUTSIDE-KEY PIC X.', main: 'SORT SORT-FILE ON ASCENDING KEY OUTSIDE-KEY INPUT PROCEDURE P OUTPUT PROCEDURE P', procedures: 'P. CONTINUE.' }), /not contained in record/],
    [program({ main: 'SORT SORT-FILE ON ASCENDING KEY SORT-REC INPUT PROCEDURE P OUTPUT PROCEDURE P', procedures: 'P. CONTINUE.' }), /elementary, unsubscripted SD/],
    [program({ main: 'SORT SORT-FILE ON ASCENDING KEY S-KEY COLLATING SEQUENCE IS MISSING INPUT PROCEDURE P OUTPUT PROCEDURE P', procedures: 'P. CONTINUE.' }), /Unknown ALPHABET/],
    [program({ record: '05 S-KEY PIC S99.', main: 'SORT SORT-FILE ON ASCENDING KEY S-KEY INPUT PROCEDURE P OUTPUT PROCEDURE P', procedures: 'P. CONTINUE.' }), /embedded sign storage is not yet implemented/],
    [program({ main: 'OPEN INPUT SORT-FILE' }), /OPEN is not valid for SD/],
    [program({ main: 'CLOSE SORT-FILE' }), /CLOSE is not valid for SD/],
    [program({ main: 'READ SORT-FILE AT END CONTINUE END-READ' }), /READ is not valid for SD/],
    [program({ main: 'WRITE SORT-REC' }), /WRITE is not valid for SD/]
  ]) {
    assert.throws(() => compileTandemCobol85ToPcode(source), pattern);
  }
});
