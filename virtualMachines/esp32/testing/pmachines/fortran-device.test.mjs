import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileMnfToPcode } from '../../../../languages/mnf/src/compile-mnf-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode, parseProgramMapMappings } from '../../pmachines/javascript/index.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

const target = process.env.PULSE_FORTRAN_TEST_NODE;

test('physical ESP32 FORMAT and external-file RTL match JS across independent executions', {
  skip: !target, timeout: 180000,
}, async () => {
  const base = new URL(target);
  assert.ok(['http:', 'https:'].includes(base.protocol));
  const execute = async (artifact, expectedError, stdin) => {
    const response = await fetch(new URL('/pmachine/execute_json', base), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        pcode: artifact.pcodeText,
        programMapText: JSON.stringify(attachPcodeSignature(artifact.programMap, artifact.pcodeText)),
        max: Math.max(65536, Buffer.byteLength(artifact.pcodeText)),
        inputQueue: 'fortran.device.test', message: 'not console input', stdin,
      }),
    });
    const text = await response.text();
    assert.equal(response.status, 200, text);
    const result = JSON.parse(text);
    if (expectedError) assert.match(result.runtimeError || '', expectedError);
    else assert.ok(!result.runtimeError, JSON.stringify(result));
    assert.equal(result.stepLimitHit, false);
    return result;
  };
  for (const length of [65535, 65536, 70000]) {
    const pcodeText = ' '.repeat(length - 4) + 'HALT';
    const result = await execute({ pcodeText, programMap: {} });
    assert.deepEqual(result.stdout, []);
  }
  const payload = 'Record "q" \\ value / '.repeat(2).trimEnd();
  const records = compileMnfToPcode([
    '      INTEGER I',
    '      DO 20 I=1,400',
    `      WRITE(*,10) I,'${payload}'`,
    '   10 FORMAT(I4,1X,A)',
    '   20 CONTINUE',
    '      END',
  ].join('\n'), { fileName: 'record-output.ftn', standard: 'fortran77' });
  const recordResult = await execute(records);
  assert.deepEqual(recordResult.stdout, Array.from({ length: 400 },
    (_, index) => `${String(index + 1).padStart(4)} ${payload}`));
  assert.equal(recordResult.ok, true);
  assert.equal(recordResult.source, 'json');
  assert.equal(recordResult.message, 'not console input');
  assert.ok(recordResult.stepCount > 0);
  const sources = [
    [
      'INTEGER I', 'REAL X', 'COMPLEX Z', 'CHARACTER*80 FMT', 'CHARACTER*24 BUF(2)',
      `FMT='(I3,2F6.2)'`, 'I=42', 'X=1.25', 'Z=(1.,2.)',
      'WRITE(*,FMT) I,X,-X', 'WRITE(*,10) Z',
      '10 FORMAT(2F5.1)', 'WRITE(BUF,20) I,73', '20 FORMAT(I3)',
      'READ(BUF,20) I', 'WRITE(*,30) I,BUF(1),BUF(2)',
      "30 FORMAT(I3,':',A3,':',A3)", 'END',
    ],
    [
      'INTEGER I,S', 'CHARACTER*12 FMT', `FMT='(I5)'`, 'S=0',
      'DO 10 I=1,200', 'S=S+I', '10 CONTINUE', 'WRITE(*,FMT) S',
      `WRITE(*,20) 0,7,-7`, '20 FORMAT(SP,I3.0,I4.3,SS,I4)',
      `WRITE(*,30) 1,2,3,4,5`, "30 FORMAT('HEAD',2(I2),'!')", 'END',
    ],
    [
      'INTEGER I,S', 'CHARACTER*4 BUF', `BUF='KEEP'`,
      'WRITE(BUF,10,IOSTAT=S) 123456', '10 FORMAT(I6)', 'WRITE(*,20) S,BUF',
      "20 FORMAT(I2,':',A4)", `BUF='BAD!'`, 'READ(BUF,30,IOSTAT=S) I',
      '30 FORMAT(I4)', 'WRITE(*,*) S', 'END',
    ],
  ];
  for (const [index, lines] of sources.entries()) {
    const source = lines.map(line => {
      const label = /^(\d+) (.*)$/.exec(line);
      return label ? `${label[1].padStart(5)} ${label[2]}` : '      ' + line;
    }).join('\n');
    const artifact = compileMnfToPcode(source, { fileName: 'device.ftn', standard: 'fortran77' });
    const expected = await executeProgram({
      instructions: parsePcode(artifact.pcodeText), opcodeMap: await loadOpcodeMap(),
      mappingsById: parseProgramMapMappings(artifact.programMap), inputQueue: 'fortran.device.test', sourceMessage: '',
    });
    assert.ok(!expected.error, expected.error);
    const actual = await execute(artifact);
    assert.deepEqual(actual.stdout, expected.stdout, `compiled source ${index + 1}`);
    console.log(`Device source ${index + 1}: ${JSON.stringify(actual.stdout)}`);
  }
  const prefix = `ftest-${Date.now().toString(36)}`;
  const names = ['seq', 'direct', 'formatted', 'list', 'scratch', 'unformatted'].map(suffix => `${prefix}-${suffix}`);
  const [seq, direct, formatted, list, scratch, unformatted] = names;
  const files = new Map();
  const compile = lines => compileMnfToPcode(lines.map(line => {
    if (line.startsWith('+')) return '     ' + line;
    const label = /^(\d+) (.*)$/.exec(line);
    return label ? `${label[1].padStart(5)} ${label[2]}` : '      ' + line;
  }).join('\n'), { fileName: 'files.ftn', standard: 'fortran77' });
  const compareFiles = async (label, lines) => {
    const artifact = compile(lines);
    const expected = await executeProgram({
      instructions: parsePcode(artifact.pcodeText), opcodeMap: await loadOpcodeMap(),
      mappingsById: parseProgramMapMappings(artifact.programMap),
      inputQueue: 'fortran.device.test', sourceMessage: '', runtimeContext: { files },
    });
    assert.ok(!expected.error, expected.error);
    const actual = await execute(artifact);
    assert.deepEqual(actual.stdout, expected.stdout, label);
    console.log(`Device ${label}: ${JSON.stringify(actual.stdout)}`);
  };
  const compareInput = async (label, lines, stdin, output) => {
    const artifact = compile(lines);
    const expected = await executeProgram({
      instructions: parsePcode(artifact.pcodeText), opcodeMap: await loadOpcodeMap(),
      mappingsById: parseProgramMapMappings(artifact.programMap),
      inputQueue: 'fortran.device.test', sourceMessage: 'not console input', runtimeContext: { stdin },
    });
    assert.ok(!expected.error, expected.error);
    assert.deepEqual(expected.stdout, output, label);
    const actual = await execute(artifact, undefined, stdin);
    assert.deepEqual(actual.stdout, output, label);
    console.log(`Device ${label}: ${JSON.stringify(actual.stdout)}`);
  };
  await compareInput('console formatted READ and record cursor', [
    'INTEGER I,J,K', 'REAL X', 'CHARACTER*4 C',
    'READ(*,10) I,X,C', '10 FORMAT(I3,F5.2,A4)',
    'READ(5,20) J,K', '20 FORMAT(I3)',
    'WRITE(*,30) I,X,C,J,K', "30 FORMAT(I3,F6.2,1X,A4,2I3)", 'END',
  ], ' 42 1.25TEXT\r\n 73\r\n 99\r\n', [' 42  1.25 TEXT 73 99']);
  await compareInput('console list input types and nulls', [
    'INTEGER I,J,K,N', 'REAL X', 'DOUBLE PRECISION D', 'COMPLEX Z',
    'LOGICAL L', 'CHARACTER*11 C', 'K=7', 'N=8',
    'READ(*,*) I,J,K,X,D,Z,L,C,N',
    'WRITE(*,10) I,J,K,X,D,Z,L,C,N',
    '10 FORMAT(3I3,4F5.1,L2,1X,A11,I3)', 'END',
  ], "2*3,,1.5,2.5D0,(1.,\n2.),T,'hello world',/99\n",
  ['  3  3  7  1.5  2.5  1.0  2.0 T hello world  8']);
  await compareInput('console malformed input recovery and EOF', [
    'INTEGER I,K', 'I=9', 'READ(*,*,IOSTAT=K,ERR=10) I',
    "PRINT, 'WRONG'", '10 CONTINUE', "IF(K.GT.0) PRINT, 'ERR OK'",
    'WRITE(*,*) I', 'READ(*,*) I', 'WRITE(*,*) I',
    'READ(*,*,END=20,IOSTAT=K) I', "PRINT, 'WRONG'",
    '20 CONTINUE', "IF(K.LT.0) PRINT, 'EOF OK'", 'END',
  ], 'BAD\n73\n', ['ERR OK', ' 9', ' 73', 'EOF OK']);
  await compareInput('empty console input never reuses prior invocation', [
    'INTEGER I,K', 'READ(*,*,IOSTAT=K,END=10) I', "PRINT, 'WRONG'",
    '10 CONTINUE', "IF(K.LT.0) PRINT, 'EMPTY OK'", 'END',
  ], '', ['EMPTY OK']);
  await compareInput('console input may leave unread records', [
    'INTEGER I', 'READ(*,*) I', 'WRITE(*,*) I', 'END',
  ], '42\n99\n', [' 42']);
  const omittedInput = await execute(compile([
    'INTEGER I,K', 'READ(*,*,IOSTAT=K,END=10) I',
    "PRINT, 'WRONG'", '10 CONTINUE',
    "IF(K.LT.0) PRINT, 'NO INPUT'", 'END',
  ]));
  assert.deepEqual(omittedInput.stdout, ['NO INPUT']);
  await compareInput('console slash discards remainder of current record', [
    'INTEGER I,J', 'I=9', 'READ(*,*) I', 'READ(*,*) J',
    'WRITE(*,*) I,J', 'END',
  ], '/99\n42\n', [' 9 42']);
  await execute(compile(['INTEGER I', 'READ(*,*) I', 'END']), /End of file/);
  const boundedInput = compile([
    'INTEGER I,K', 'READ(*,*,IOSTAT=K,ERR=10) I',
    "PRINT, 'WRONG'", '10 CONTINUE',
    "IF(K.GT.0) PRINT, 'LIMIT OK'", 'END',
  ]);
  assert.deepEqual((await execute(boundedInput, undefined, ' '.repeat(8193))).stdout, ['LIMIT OK']);
  const invalidInput = await fetch(new URL('/pmachine/execute_json', base), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ pcode: 'HALT', stdin: 42 }),
  });
  assert.equal(invalidInput.status, 400);
  assert.match(await invalidInput.text(), /stdin must be a string/);
  let fileTestError;
  try {
    await compareFiles('sequential positioning and handled EOF', [
      'INTEGER I,J,K', `OPEN(12,FILE='${seq}',STATUS='NEW')`,
      'WRITE(12,10) 12,34', '10 FORMAT(I4)', 'REWIND 12',
      'READ(12,10) I', 'BACKSPACE 12', 'READ(12,10) J',
      'WRITE(*,*) I,J', 'READ(12,10) I', 'ENDFILE 12', 'REWIND 12',
      'READ(12,10) I,J', 'READ(12,10,END=20,IOSTAT=K) I',
      "PRINT, 'WRONG'", '20 CONTINUE', "IF(K.LT.0) PRINT, 'EOF OK'",
      'CLOSE(12)', 'END',
    ]);
    await compareFiles('persist direct typed unformatted records', [
      'LOGICAL L', 'CHARACTER*4 C', 'L=.TRUE.', `C='a b!'`,
      `OPEN(12,FILE='${direct}',STATUS='NEW',ACCESS='DIRECT',`,
      '+RECL=32)',
      'WRITE(12,REC=2) 42,2.5D0,(1.,2.),L,C', 'CLOSE(12)', 'END',
    ]);
    await compareFiles('reopen unformatted in independent invocation', [
      'DOUBLE PRECISION D', 'COMPLEX Z', 'LOGICAL L', 'CHARACTER*4 C',
      `OPEN(12,FILE='${direct}',STATUS='OLD',ACCESS='DIRECT',`,
      '+RECL=32)',
      'READ(12,REC=2) I,D,Z,L,C', 'WRITE(*,10) I,D,Z,L,C',
      "10 FORMAT(I3,3F5.1,L2,1X,A4)", "CLOSE(12,STATUS='DELETE')", 'END',
    ]);
    await compareFiles('direct formatted and INQUIRE', [
      'INTEGER I,J', 'LOGICAL L', `OPEN(12,FILE='${formatted}',`,
      "+STATUS='NEW',ACCESS='DIRECT',FORM='FORMATTED',RECL=4)",
      'WRITE(12,10,REC=2) 73', 'WRITE(12,10,REC=1) 42',
      '10 FORMAT(I4)', 'READ(12,10,REC=2) I', 'READ(12,10,REC=1) J',
      'WRITE(*,*) I,J', 'INQUIRE(12,OPENED=L,NUMBER=I)',
      "IF(L.AND.I.EQ.12) PRINT, 'OPEN OK'",
      "CLOSE(12,STATUS='DELETE')", `INQUIRE(FILE='${formatted}',`,
      '+EXIST=L)', "IF(.NOT.L) PRINT, 'DELETE OK'", 'END',
    ]);
    await compareFiles('list input repeats null slash quotes and complex', [
      'INTEGER I,J,K,N', 'COMPLEX Z', 'CHARACTER*11 C',
      `OPEN(12,FILE='${list}',STATUS='NEW')`,
      `WRITE(12,10) '2*3,,(1.,2.),''hello world'',/99'`,
      '10 FORMAT(A)', 'REWIND 12', 'K=7', 'N=8',
      'READ(12,*) I,J,K,Z,C,N', 'WRITE(*,20) I,J,K,Z,C,N',
      '20 FORMAT(3I3,2F5.1,1X,A11,I3)', "CLOSE(12,STATUS='DELETE')", 'END',
    ]);
    await compareFiles('scratch file lifecycle', [
      'INTEGER I', `OPEN(12,FILE='${scratch}',STATUS='SCRATCH')`,
      'WRITE(12,*) 42', 'REWIND 12', 'READ(12,*) I', 'WRITE(*,*) I',
      'CLOSE(12)', 'END',
    ]);
    await compareFiles('sequential unformatted positioning and reopen', [
      'INTEGER I,J,K', `OPEN(12,FILE='${unformatted}',`,
      "+FORM='UNFORMATTED',STATUS='NEW')",
      'WRITE(12) 42', 'WRITE(12) 73', 'REWIND 12',
      'READ(12) I', 'READ(12) J', 'BACKSPACE 12', 'READ(12) K',
      'WRITE(*,*) I,J,K', 'CLOSE(12)',
      `OPEN(12,FILE='${unformatted}',STATUS='OLD',`,
      "+FORM='UNFORMATTED')", 'READ(12) I', 'WRITE(*,*) I',
      "CLOSE(12,STATUS='DELETE')", 'END',
    ]);
    const confined = await execute(compile([
      'INTEGER K', "OPEN(13,FILE='../invalid',IOSTAT=K)",
      "IF(K.GT.0) PRINT, 'PATH OK'", 'END',
    ]));
    assert.deepEqual(confined.stdout, ['PATH OK']);
  } catch (error) {
    fileTestError = error;
    throw error;
  } finally {
    // Each name belongs exclusively to this test; do not touch other node files.
    try {
      await execute(compile([
        'INTEGER K',
        ...names.flatMap(name => [
          `OPEN(12,FILE='${name}',STATUS='OLD',IOSTAT=K)`,
          "IF(K.EQ.0) CLOSE(12,STATUS='DELETE')",
        ]),
        'END',
      ]));
    } catch (error) {
      if (fileTestError) throw new AggregateError([fileTestError, error], 'File test and cleanup failed');
      throw error;
    }
  }
  const pcodeText = [
    'CALL_EXT fortran.iobegin 0', 'PUSH_STR "UNIT"', 'PUSH_INT 6', 'CALL_EXT fortran.iocontrol 2',
    'PUSH_STR "FMT"', `PUSH_STR "('MANAGED=',I3)"`, 'CALL_EXT fortran.iocontrol 2',
    'PUSH_INT 0', 'STORE_NAME N', 'PRESSURE:', 'PUSH_STR "discard"', 'STORE_NAME JUNK',
    'LOAD_NAME N', 'PUSH_INT 1', 'ADD', 'STORE_NAME N', 'LOAD_NAME N', 'PUSH_INT 400', 'LT',
    'JZ DONE', 'JMP PRESSURE', 'DONE:',
    'CALL_EXT fortran.begin 0', 'PUSH_INT 42', 'PUSH_STR "I"', 'CALL_EXT fortran.item 2',
    'CALL_EXT fortran.write 0', 'HALT',
  ].join('\n');
  const pressure = await execute({ pcodeText, programMap: { globals: ['N', 'JUNK'] } });
  assert.deepEqual(pressure.stdout, ['MANAGED= 42']);
  console.log('Device managed FORMAT survived 400 temporary string allocations.');
  const invalid = {
    pcodeText: [
      'CALL_EXT fortran.begin 0', 'PUSH_INT 1', 'PUSH_STR "I"', 'CALL_EXT fortran.item 2',
      'PUSH_STR "(A)"', 'CALL_EXT fortran.print 1', 'HALT',
    ].join('\n'), programMap: {},
  };
  const failure = await execute(invalid, /FORMAT descriptor A is incompatible/);
  assert.deepEqual(failure.stdout, []);
  const recovered = await execute({ pcodeText, programMap: { globals: ['N', 'JUNK'] } });
  assert.deepEqual(recovered.stdout, ['MANAGED= 42']);
  console.log('Device reports unhandled FORMAT errors and executes the next invocation successfully.');
});
