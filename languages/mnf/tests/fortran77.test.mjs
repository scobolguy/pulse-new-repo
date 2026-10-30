import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileMnfToPcode } from '../src/compile-mnf-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode, parseProgramMapMappings } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';
import { createFortranState, executeFortranIntrinsic } from '../runtime/fortran-library.mjs';
import { createFortranRuntimeContext } from '../../../virtualMachines/esp32/pmachines/javascript/src/fortran-context.mjs';

const fixed = lines => lines.map(line => {
  const label = /^(\d+)(?: (.*))?$/.exec(line);
  return label ? `${label[1].padStart(5)} ${label[2] || 'CONTINUE'}` : '      ' + line;
}).join('\n');

test('desktop FORTRAN context supplies input files and persists confined external files across runs', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-fortran-desktop-'));
  try {
    const dataDirectory = path.join(directory, 'data'), inputFile = path.join(directory, 'input');
    await fs.writeFile(inputFile, '73\n');
    const context = await createFortranRuntimeContext({ dataDirectory, inputFile });
    assert.deepEqual(await run([
      'INTEGER I', 'READ(*,*) I', "OPEN(12,FILE='result',STATUS='NEW')",
      'WRITE(12,10) I', '10 FORMAT(I3)', 'CLOSE(12)', 'END',
    ], context), []);
    assert.deepEqual(await run([
      'INTEGER I', "OPEN(12,FILE='result',STATUS='OLD')", 'READ(12,10) I',
      '10 FORMAT(I3)', 'WRITE(*,*) I', "CLOSE(12,STATUS='DELETE')", 'END',
    ], await createFortranRuntimeContext({ dataDirectory })), [' 73']);
    assert.equal(await context.fileSystem.readText('result'), null);
    await assert.rejects(context.fileSystem.readText('../input'), /Invalid storage path/);
    await assert.rejects(context.fileSystem.writeText('../outside', 'forbidden'), /Invalid storage path/);
    await assert.rejects(createFortranRuntimeContext({ dataDirectory, inputFile, stdin: '1' }), /either/);
    await assert.rejects(createFortranRuntimeContext({ dataDirectory, inputFile: path.join(directory, 'missing') }), /ENOENT/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

async function run(lines, runtimeContext = {}) {
  const source = Array.isArray(lines) ? fixed(lines) : lines;
  const artifact = compileMnfToPcode(source, { fileName: 'regression.ftn', standard: 'fortran77' });
  const instructions = parsePcode(artifact.pcodeText);
  assert.equal(Object.keys(artifact.programMap.sourceMap).length, instructions.length);
  assert.deepEqual(artifact.programMap.targets, ['js']);
  const result = await executeProgram({
    instructions, opcodeMap: await loadOpcodeMap(), mappingsById: parseProgramMapMappings(artifact.programMap),
    inputQueue: 'fortran.test', sourceMessage: '', runtimeContext,
  });
  assert.ok(!result.error, result.error);
  assert.ok(!result.stepLimitHit, 'instruction limit hit');
  return result.stdout;
}

test('formatted WRITE handles variable output units and both literal quote styles', async () => {
  assert.deepEqual(await run([
    'INTEGER U', 'U=6', 'WRITE(U,10) 42',
    `   10 FORMAT("VALUE=",I3)`, 'END',
  ].map(line => /^\s+10/.test(line) ? line : '      ' + line).join('\n')), ['VALUE= 42']);
});

test('DATA initializes explicit multidimensional elements and implied DO objects', async () => {
  assert.deepEqual(await run([
    'INTEGER A(2,2),B(3)', 'DATA A(2,2)/9/,(B(I),I=1,3)/1,2,3/',
    'WRITE(*,*) A(2,2),B(1)+B(2)+B(3)', 'END',
  ]), [' 9 6']);
});

test('COMMON, EQUIVALENCE, and subroutine arguments share storage', async () => {
  assert.deepEqual(await run([
    'INTEGER A,B,C', 'COMMON /BOX/C', 'EQUIVALENCE (A,B)', 'A=4',
    'CALL INC(B)', 'WRITE(*,*) A,C', 'END', 'SUBROUTINE INC(X)',
    'INTEGER X,C', 'COMMON /BOX/C', 'X=X+1', 'C=X+2', 'END',
  ]), [' 5 7']);
});

test('user functions return values through the generated call convention', async () => {
  assert.deepEqual(await run([
    'INTEGER F', 'I=3', 'WRITE(*,*) F(I),I', 'END', 'INTEGER FUNCTION F(N)',
    'N=N+1', 'F=N*2', 'END',
  ]), [' 8 4']);
});

test('adjustable and assumed-size dummy bounds are evaluated on each call', async () => {
  assert.deepEqual(await run([
    'INTEGER A(2:3,2),S', 'DATA A/1,2,3,4/', 'CALL GET(A,2,2,S)',
    'WRITE(*,*) S', 'END', 'SUBROUTINE GET(A,L,N,S)', 'INTEGER L,N,S,A(L:L+N-1,*)',
    'S=A(L+1,2)', 'END',
  ]), [' 4']);
});

test('FORTRAN77 DO is zero-trip and supports shared terminal nested loops', async () => {
  assert.deepEqual(await run([
    'S=0', 'DO 10 I=5,1', 'S=99', '10', 'DO 20 I=1,2',
    'DO 20 J=1,2', 'S=S+1', '20', 'WRITE(*,100) S', '100 FORMAT(F4.1)', 'END',
  ]), [' 4.0']);
});

test('logical and arithmetic IF, computed GO TO, and real intrinsics execute', async () => {
  assert.deepEqual(await run([
    'X=SQRT(9.)', 'IF (X.EQ.3.) THEN', "PRINT, 'SQRT OK'", 'ELSE',
    "PRINT, 'WRONG'", 'END IF', 'IF (X-3.) 10,20,10',
    '10', "PRINT, 'WRONG'", '20', 'GO TO (30,40),2', '30',
    "PRINT, 'WRONG'", '40', "PRINT, 'FLOW OK'", 'END',
  ]), ['SQRT OK', 'FLOW OK']);
});

test('default compiler falls back to FORTRAN77 without changing starter behavior', async () => {
  const artifact = compileMnfToPcode(fixed(['WRITE(*,*) 42', 'END']));
  assert.equal(artifact.programMap.standard, 'fortran77');
  assert.throws(() => compileMnfToPcode(fixed(['END']), { standard: 'invalid' }), /Unknown FORTRAN standard/);
});

test('double precision preserves constants, mixed arithmetic, math and conversions', async () => {
  assert.deepEqual(await run([
    'DOUBLE PRECISION D', 'D=1.000000000001D0', 'IF (D-1.D0.GT.0.D0) THEN',
    "PRINT, 'DOUBLE OK'", 'END IF', 'D=DSQRT(4.D0)+1', 'WRITE(*,10) D',
    '10 FORMAT(F5.2)', 'END',
  ]), ['DOUBLE OK', ' 3.00']);
});

test('complex math, powers, formatted output and function results execute', async () => {
  assert.deepEqual(await run([
    'COMPLEX Z,F', 'Z=CSQRT((-3.,4.))', 'WRITE(*,10) Z,Z**2,F()',
    '10 FORMAT(6F5.1)', 'END', 'COMPLEX FUNCTION F()', 'F=CEXP((0.,0.))', 'END',
  ]), ['  1.0  2.0 -3.0  4.0  1.0  0.0']);
});

test('fixed-form blanks are ignored outside literals, with mapped source positions', async () => {
  assert.deepEqual(await run([
    'I N T E G E R I V A L', 'I V A L = 1 2 3', 'IF (IVAL.EQ.123) PRINT, \') OK\'',
    'WRITE(*,10) IVAL', '10 FORMAT(I4)', 'END',
  ]), [') OK', ' 123']);
});

test('ENTRY and procedure-valued dummy arguments dispatch with by-reference parameters', async () => {
  assert.deepEqual(await run([
    'INTRINSIC IABS', 'INTEGER APPLY', 'WRITE(*,*) APPLY(IABS,-7)',
    'I=2', 'CALL OTHER(I)', 'WRITE(*,*) I', 'END',
    'INTEGER FUNCTION APPLY(F,N)', 'INTEGER F', 'EXTERNAL F', 'APPLY=F(N)', 'END',
    'SUBROUTINE ORIGINAL(N)', 'N=99', 'RETURN', 'ENTRY OTHER(N)', 'N=N+3', 'END',
  ]), [' 7', ' 5']);
});

test('DATA substrings and CHARACTER dummy writes preserve the actual variable length', async () => {
  assert.deepEqual(await run([
    'CHARACTER A*8', "DATA A(3:5)/'XYZ'/", 'CALL SET(A)', "IF (A.EQ.'ABXYZ   ') PRINT, 'ALIAS OK'",
    'END', 'SUBROUTINE SET(C)', 'CHARACTER C*2', "C='AB'", 'END',
  ]), ['ALIAS OK']);
});

test('formatted and list-directed console input includes complex, nulls and slash termination', async () => {
  assert.deepEqual(await run([
    'DOUBLE PRECISION D', 'COMPLEX Z', 'I=9', 'J=8', 'READ(*,*) I,Z,D,J',
    'WRITE(*,10) I,Z,D,J', '10 FORMAT(I2,2F4.1,F5.1,I2)', 'END',
  ], { stdin: ', (1.0,\n2.0), 3.5D0 /' }), [' 9 1.0 2.0  3.5 8']);
  assert.deepEqual(await run([
    'READ(*,10) I,X', '10 FORMAT(I3,F5.2)', 'WRITE(*,20) I,X',
    '20 FORMAT(I3,F5.2)', 'END',
  ], { stdin: ' 12 1.25' }), [' 12 1.25']);
});

test('internal character arrays read/write multiple records and retain input null values', async () => {
  assert.deepEqual(await run([
    'CHARACTER A(2)*4', 'WRITE(A,10) 12,34', '10 FORMAT(I4)',
    'READ(A,10) I,J', 'WRITE(*,*) I,J', 'END',
  ]), [' 12 34']);
});

test('sequential files, REWIND, BACKSPACE, ENDFILE, EOF/ERR and IOSTAT execute', async () => {
  const files = new Map();
  assert.deepEqual(await run([
    "OPEN(12,FILE='test',STATUS='NEW')", 'WRITE(12,10) 12,34', '10 FORMAT(I4)',
    'REWIND 12', 'READ(12,10) I', 'BACKSPACE 12', 'READ(12,10) J',
    'WRITE(*,*) I,J', 'READ(12,10) I', 'ENDFILE 12', 'REWIND 12',
    'READ(12,10) I,J', 'READ(12,10,END=20,IOSTAT=K) I', "PRINT, 'WRONG'",
    '20 CONTINUE', "IF(K.LT.0) PRINT, 'EOF OK'", 'CLOSE(12)',
    "OPEN(13,FILE='absent',STATUS='OLD',IOSTAT=K,ERR=30)", "PRINT, 'WRONG'",
    '30 CONTINUE', "IF(K.GT.0) PRINT, 'ERR OK'", 'END',
  ], { files }), [' 12 12', 'EOF OK', 'ERR OK']);
  assert.ok(files.has('test'));
});

test('direct unformatted files survive CLOSE/reopen and independent executions', async () => {
  const files = new Map();
  await run([
    "OPEN(12,FILE='direct',STATUS='NEW',ACCESS='DIRECT',RECL=32)",
    'WRITE(12,REC=2) 42,2.5D0,(1.,2.)', 'CLOSE(12)', 'END',
  ], { files });
  assert.deepEqual(await run([
    'DOUBLE PRECISION D', 'COMPLEX Z',
    "OPEN(12,FILE='direct',STATUS='OLD',ACCESS='DIRECT',RECL=32)",
    'READ(12,REC=2) I,D,Z', 'WRITE(*,10) I,D,Z', '10 FORMAT(I3,3F5.1)', 'END',
  ], { files }), [' 42  2.5  1.0  2.0']);
});

test('INQUIRE reports file state and CLOSE DELETE removes persisted records', async () => {
  const files = new Map();
  assert.deepEqual(await run([
    'LOGICAL L', "OPEN(12,FILE='test',STATUS='NEW')",
    'INQUIRE(12,OPENED=L,NUMBER=I)', "IF(L.AND.I.EQ.12) PRINT, 'OPEN OK'",
    "CLOSE(12,STATUS='DELETE')", "INQUIRE(FILE='test',EXIST=L)",
    "IF(.NOT.L) PRINT, 'DELETE OK'", 'END',
  ], { files }), ['OPEN OK', 'DELETE OK']);
  assert.equal(files.has('test'), false);
});

test('invalid input and files fail explicitly; intrinsic calls validate their ABI', async () => {
  await assert.rejects(() => run(['READ(*,*) I', 'END']), /End of file/);
  await assert.rejects(() => run(['WRITE(-1,*) 1', 'END']), /Invalid file unit/);
  await assert.rejects(() => run(['CHARACTER A*2', "WRITE(A,'(A3)') 'ABC'", 'END']), /exceeds RECL/);
  assert.deepEqual(await run([
    'CHARACTER A*2', "A='OK'", "WRITE(A,'(A3)',IOSTAT=I) 'ABC'",
    "IF(I.GT.0.AND.A.EQ.'OK') PRINT, 'OVERFLOW OK'", 'END',
  ]), ['OVERFLOW OK']);
  const state = createFortranState();
  assert.throws(() => executeFortranIntrinsic('fortran.math', [], state, {}), /Invalid argument count/);
  assert.throws(() => executeFortranIntrinsic('fortran.unknown', [], state, {}), /Unknown FORTRAN/);
});
