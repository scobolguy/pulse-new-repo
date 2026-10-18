import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';

const source = `
use "ISAM";
service 'isam-library-test';
var indexFile: ISAMFile;
var recordValue: string;
post '/write';
begin
  indexFile.openFile('data', 'accounts.isam', 'account-id', 'OUTPUT');
  indexFile.writeRecord('001', host.event_body());
  recordValue := indexFile.lastStatus();
  indexFile.closeFile();
  return recordValue
end
post '/read';
begin
  indexFile.openFile('data', 'accounts.isam', 'account-id', 'INPUT');
  recordValue := indexFile.readRecord('001');
  if indexFile.lastStatus() = '00' then return recordValue;
  return indexFile.lastStatus()
end
end.`;

const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
assert.deepEqual(compiled.programMap.libraries, ['ISAM']);
assert.match(compiled.pcodeText, /CALL_EXT host\.isam_open 4/);
assert.match(compiled.pcodeText, /CALL_EXT host\.isam_read 2/);
assert.deepEqual(compiled.programMap.requiredHostCapabilities, ['filesystem.read', 'filesystem.write']);
assert.deepEqual(compiled.programMap.targets, ['js']);

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-isam-'));
const host = await createPascalishServiceHost({
  compiled,
  collectorId: 'isam-library-test',
  httpPort: null,
  udpPort: null,
  storageRoots: { data: { path: root, readOnly: false } },
  logger: { warn() {}, error() {} }
});

try {
  await host.start();
  const write = await host.dispatch({ method: 'POST', path: '/write', body: 'customer-one' });
  assert.equal(write.status, 200);
  assert.equal(write.body, '00');
  const read = await host.dispatch({ method: 'POST', path: '/read', body: '' });
  assert.equal(read.status, 200);
  assert.equal(read.body, 'customer-one');
  assert.equal(await fs.readFile(path.join(root, 'accounts.isam'), 'utf8'),
    '{"version":1,"keyName":"account-id","records":[["001","customer-one"]]}');
} finally {
  await host.stop();
  await fs.rm(root, { recursive: true, force: true });
}

console.log('[pascalish-isam-library] PASS');
