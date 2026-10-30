import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { test } from 'node:test';
import { compileMnfToPcode } from '../../../../languages/mnf/src/compile-mnf-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

const target = process.env.PULSE_FORTRAN_TEST_NODE;
const port = process.env.PULSE_FORTRAN_TEST_UART;

test('physical UART prompts, editing, multiline READ, EOF and 30-second timeout', {
  skip: !target || !port, timeout: 100000,
}, async () => {
  // Open without asserting DTR/RTS: opening the port must not reset the board.
  const script = `
import json, serial, sys, time
s = serial.Serial()
s.port = sys.argv[1]
s.baudrate = 115200
s.timeout = 0.1
s.dtr = False
s.rts = False
s.open()
replies = [b'41\\x082\\r\\n', b'(1.,\\r\\n', b'2.)\\n', b"'hello world'\\n", b'\\x04']
pending = ''
seen = ''
count = 0
print(json.dumps({'ready': True}), flush=True)
deadline = time.monotonic() + 85
while time.monotonic() < deadline:
    data = s.read(4096).decode('utf8', errors='replace')
    if not data:
        continue
    print(json.dumps({'text': data}), flush=True)
    seen = (seen + data)[-1024:]
    pending += data
    while '? ' in pending:
        pending = pending.split('? ', 1)[1]
        if count < len(replies):
            s.write(replies[count])
            s.flush()
        count += 1
    pending = pending[-1:]
    if 'UART TEST DONE' in seen:
        s.close()
        print(json.dumps({'prompts': count}), flush=True)
        sys.exit(0)
s.close()
raise RuntimeError('UART test timed out')
`;
  const serial = spawn('python', ['-u', '-c', script, port], { windowsHide: true });
  let transcript = '', diagnostics = '', prompts;
  const exited = once(serial, 'exit');
  serial.stderr.setEncoding('utf8').on('data', text => { diagnostics += text; });
  const lines = createInterface({ input: serial.stdout });
  const ready = new Promise((resolve, reject) => {
    serial.once('error', reject);
    serial.once('exit', code => reject(new Error(`Serial helper exited (${code}): ${diagnostics}`)));
    lines.on('line', line => {
      const event = JSON.parse(line);
      if (event.ready) resolve();
      if (event.text) transcript += event.text;
      if (event.prompts !== undefined) prompts = event.prompts;
    });
  });
  const execute = async (source, uartInput, stdin) => {
    const artifact = compileMnfToPcode(source.map(line => {
      const label = /^(\d+) (.*)$/.exec(line);
      return label ? `${label[1].padStart(5)} ${label[2]}` : '      ' + line;
    }).join('\n'), { fileName: 'uart.ftn', standard: 'fortran77' });
    const response = await fetch(new URL('/pmachine/execute_json', target), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        pcode: artifact.pcodeText,
        programMapText: JSON.stringify(attachPcodeSignature(artifact.programMap, artifact.pcodeText)),
        max: 65536, uartInput, stdin,
      }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.ok(!result.runtimeError, `${JSON.stringify(result)}\nSerial: ${JSON.stringify(transcript)}\n${diagnostics}`);
    assert.equal(result.stepLimitHit, false);
    return result;
  };
  try {
    await ready;
    const live = await execute([
      'INTEGER I,K', 'COMPLEX Z', 'CHARACTER*11 C',
      "WRITE(*,*) 'UART READY'", 'READ(*,11) I', '11 FORMAT(I2)',
      'READ(*,*) Z', 'READ(5,*) C',
      'WRITE(*,10) I,Z,C', '10 FORMAT(I3,2F5.1,1X,A11)',
      'READ(*,*,IOSTAT=K,END=20) I', "PRINT, 'WRONG'",
      '20 CONTINUE', "IF(K.LT.0) PRINT, 'UART EOF OK'", 'END',
    ], true);
    assert.deepEqual(live.stdout, [' UART READY', ' 42  1.0  2.0 hello world', 'UART EOF OK']);
    const before = Date.now();
    const timeout = await execute([
      'INTEGER I,K', 'I=9', 'READ(*,*,IOSTAT=K,ERR=10) I',
      "PRINT, 'WRONG'", '10 CONTINUE',
      "IF(K.GT.0.AND.I.EQ.9) PRINT, 'UART TIMEOUT OK'",
      "PRINT, 'UART TEST DONE'", 'END',
    ], true);
    assert.ok(Date.now() - before >= 29000, 'UART must wait for the configured timeout');
    assert.deepEqual(timeout.stdout, ['UART TIMEOUT OK', 'UART TEST DONE']);
    const [code] = await exited;
    assert.equal(code, 0, diagnostics);
    assert.equal(prompts, 6);
    assert.match(transcript, /UART READY/);
    assert.match(transcript, /42  1\.0  2\.0 hello world/);
    assert.match(transcript, /UART EOF OK/);
    assert.match(transcript, /UART TIMEOUT OK/);
    assert.match(transcript, /\b \b/);
    const normal = await execute([
      'INTEGER I', 'READ(*,*) I', 'WRITE(*,*) I', 'END',
    ], false, '73\n');
    assert.deepEqual(normal.stdout, [' 73']);
  } finally {
    if (serial.exitCode === null) {
      serial.kill();
      await exited;
    }
    lines.close();
  }
});
