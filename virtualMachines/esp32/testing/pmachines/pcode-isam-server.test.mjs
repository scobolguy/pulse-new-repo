import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFilesystemService } from '../../aggregator/filesystem-service.mjs';
import { createFilesystemServiceClient } from '../../aggregator/src/librarian/filesystem-service-client.mjs';
import { createIsamBindings } from '../../pmachines/javascript/src/isam-bindings.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compileCobolishToPcode } from '../../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../pmachines/javascript/src/runtime.mjs';
import { createDesktopTextBindings } from '../../pmachines/javascript/src/desktop-text-bindings.mjs';

const logger = { log() {}, warn() {}, error() {} };

async function serverFixture(t) {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pcode-isam-server-'));
  let service;
  let client;
  t.after(async () => {
    await client?.stop();
    await service?.stop();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });
  async function restart() {
    await client?.stop();
    await service?.stop();
    service = await createFilesystemService({
      dataRoot, host: '127.0.0.1', httpPort: 0, lifecycleEnv: {}, logger
    });
    client = createFilesystemServiceClient(
      `http://127.0.0.1:${service.getStatus().httpPort}`, { env: {} }
    );
    return client;
  }
  return { dataRoot, restart, client: await restart() };
}

test('P-code ISAM persists through filesystem-server restart and cannot escape its grant', async t => {
  const fixture = await serverFixture(t);
  let bindings = createIsamBindings(fixture.client.bindings);
  let handle = await bindings['host.isam_open']('isam', 'ledger.json', 'key', 'OUTPUT');
  assert.equal(await bindings['host.isam_write'](handle, 'B', 'second'), 0);
  assert.equal(await bindings['host.isam_write'](handle, 'A', 'first'), 0);
  await bindings['host.isam_close'](handle);
  const persisted = JSON.parse(await fs.readFile(
    path.join(fixture.dataRoot, 'services', 'isam', 'ledger.json'), 'utf8'
  ));
  assert.deepEqual(persisted.records, [['A', 'first'], ['B', 'second']]);
  const client = await fixture.restart();
  bindings = createIsamBindings(client.bindings);
  handle = await bindings['host.isam_open']('isam', 'ledger.json', 'key', 'I-O');
  assert.equal(await bindings['host.isam_read_next'](handle), 'first');
  assert.equal(await bindings['host.isam_rewrite'](handle, 'B', 'updated'), 0);
  assert.equal(await bindings['host.isam_delete'](handle, 'A'), 0);
  await bindings['host.isam_close'](handle);
  handle = await bindings['host.isam_open']('isam', 'ledger.json', 'key', 'INPUT');
  assert.equal(await bindings['host.isam_read_next'](handle), 'updated');
  await assert.rejects(bindings['host.isam_open']('isam', '../outside.json', 'key', 'OUTPUT'), /path/i);
  await assert.rejects(bindings['host.isam_open']('schemas', 'blocked.json', 'key', 'OUTPUT'), /restricted/);
  await assert.rejects(client.writeText('catalog', 'not-managed.json', '{}'), /managed/);
});

test('hosted ISAM uses filesystem overrides rather than a local storage engine', async t => {
  const { client } = await serverFixture(t);
  const compiled = compilePascalishProgramWithAntlr(`service 'isam-client';
use "JSON";
var handle: integer; response: JSONDocument; value: string;
post '/'; begin
  handle := host.isam_open('isam', 'hosted.json', 'key', 'OUTPUT');
  host.isam_write(handle, 'A', 'remote');
  host.isam_close(handle);
  handle := host.isam_open('isam', 'hosted.json', 'key', 'INPUT');
  value := host.isam_read(handle, 'A');
  host.isam_close(handle);
  response.load('{}');
  response.setText('record', value);
  return response.serialize()
end end.`, { hostServices: true });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'isam-client', httpPort: null, udpPort: null,
    filesystemBindingOverrides: client.bindings, logger
  });
  t.after(() => host.stop());
  await host.start();
  assert.deepEqual((await host.dispatch({ method: 'POST', path: '/', body: '{}' })).body, { record: 'remote' });
  assert.equal(await client.exists('isam', 'hosted.json'), 1);
});

test('COBOL indexed group records support WRITE FROM, random READ INTO and failed-read preservation', async t => {
  const { client } = await serverFixture(t);
  const compiled = compileCobolishToPcode(`IDENTIFICATION DIVISION.
PROGRAM-ID. ISAM-RECORDS.
ENVIRONMENT DIVISION.
INPUT-OUTPUT SECTION.
FILE-CONTROL.
SELECT F ASSIGN TO "isam/cobol.json"
 ORGANIZATION IS INDEXED ACCESS MODE IS RANDOM
 RECORD KEY IS K FILE STATUS IS FS.
DATA DIVISION.
FILE SECTION.
FD F.
01 R.
 05 K PIC XX.
 05 V PIC X(4).
WORKING-STORAGE SECTION.
01 FS PIC XX.
01 SOURCE-AREA PIC X(6) VALUE "01DATA".
01 DEST-AREA PIC X(6).
PROCEDURE DIVISION.
OPEN OUTPUT F
WRITE R FROM SOURCE-AREA
CLOSE F
OPEN INPUT F
MOVE "01" TO K
READ F INTO DEST-AREA
IF K = "01" AND V = "DATA" AND DEST-AREA = "01DATA" AND FS = "00"
 DISPLAY "record: PASS"
END-IF
MOVE "99" TO K
READ F
IF V = "DATA" AND DEST-AREA = "01DATA" AND FS = "23"
 DISPLAY "missing: PASS"
END-IF
CLOSE F
STOP RUN.`);
  const bindings = { ...createDesktopTextBindings(), ...createIsamBindings(client.bindings) };
  const result = await executeProgram({
    instructions: parsePcode(compiled.pcodeText), sourceMessage: '', inputQueue: '',
    runtimeContext: {
      callHost: (name, args) => {
        if (!bindings[name]) throw new Error(`Missing test host binding ${name}`);
        return bindings[name](...args);
      }
    }
  });
  assert.equal(result.error, null);
  assert.equal(result.stepLimitHit, false);
  assert.deepEqual(result.stdout, ['record: PASS', 'missing: PASS']);
});
