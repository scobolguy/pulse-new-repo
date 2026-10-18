import assert from 'node:assert/strict';
import test from 'node:test';
import { createIsamBindings } from '../../pmachines/javascript/src/isam-bindings.mjs';
import { loadIsamPcode } from '../../libraries/isam/pcode-isam.mjs';

function memoryFilesystem() {
  const files = new Map();
  return {
    files,
    handlers: {
      'host.fs_exists': async (_root, path) => Number(files.has(path)),
      'host.fs_read_text': async (_root, path) => {
        if (!files.has(path)) throw new Error(`Missing file: ${path}`);
        return files.get(path);
      },
      'host.fs_write_text': async (_root, path, content) => {
        files.set(path, content);
        return 0;
      }
    }
  };
}

test('ISAM writes persist, scan in key order, and support update/delete', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  const output = await host['host.isam_open']('data', 'ledger.json', 'record-key', 'OUTPUT');
  assert.equal(await host['host.isam_write'](output, 'B', 'record B'), 0);
  assert.equal(await host['host.isam_write'](output, 'A', 'record A'), 0);
  assert.equal(await host['host.isam_write'](output, 'A', 'duplicate'), 22);
  assert.equal(await host['host.isam_status'](output), '22');
  assert.equal(await host['host.isam_close'](output), 0);

  const reopened = createIsamBindings(storage.handlers);
  const handle = await reopened['host.isam_open']('data', 'ledger.json', 'record-key', 'I-O');
  assert.equal(await reopened['host.isam_read'](handle, 'B'), 'record B');
  assert.equal(await reopened['host.isam_start'](handle, 'A', '>='), 0);
  assert.equal(await reopened['host.isam_read_next'](handle), 'record A');
  assert.equal(await reopened['host.isam_read_next'](handle), 'record B');
  assert.equal(await reopened['host.isam_read_next'](handle), '');
  assert.equal(await reopened['host.isam_status'](handle), '10');
  assert.equal(await reopened['host.isam_rewrite'](handle, 'B', 'updated B'), 0);
  assert.equal(await reopened['host.isam_delete'](handle, 'A'), 0);
  await reopened['host.isam_close'](handle);

  const finalHost = createIsamBindings(storage.handlers);
  const finalHandle = await finalHost['host.isam_open']('data', 'ledger.json', 'record-key', 'INPUT');
  assert.equal(await finalHost['host.isam_read'](finalHandle, 'A'), '');
  assert.equal(await finalHost['host.isam_status'](finalHandle), '23');
  assert.equal(await finalHost['host.isam_read'](finalHandle, 'B'), 'updated B');
});

test('ISAM reports missing files, invalid keys, and disallowed writes', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  const missing = await host['host.isam_open']('data', 'missing.json', 'key', 'INPUT');
  assert.equal(await host['host.isam_status'](missing), '35');
  assert.equal(await host['host.isam_read_next'](missing), '');
  assert.equal(await host['host.isam_status'](missing), '35');
  await host['host.isam_close'](missing);
  await assert.rejects(() => host['host.isam_open']('data', 'missing.json', 'key', 'APPEND'), /Unsupported ISAM open mode/);
});

test('ISAM rejects reads and REWRITE on OUTPUT handles', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  const handle = await host['host.isam_open']('data', 'mode.json', 'key', 'OUTPUT');
  await host['host.isam_write'](handle, 'A', 'original');
  assert.equal(await host['host.isam_read'](handle, 'A'), '');
  assert.equal(host['host.isam_status'](handle), '47');
  assert.equal(await host['host.isam_read_next'](handle), '');
  assert.equal(host['host.isam_status'](handle), '47');
  assert.equal(await host['host.isam_rewrite'](handle, 'A', 'changed'), 49);
  assert.deepEqual(JSON.parse(storage.files.get('mode.json')).records, [['A', 'original']]);
});

test('ISAM reopen observes committed external updates rather than stale cache', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  const handle = await host['host.isam_open']('data', 'fresh.json', 'key', 'OUTPUT');
  await host['host.isam_write'](handle, 'A', 'old');
  await host['host.isam_close'](handle);
  storage.files.set('fresh.json', JSON.stringify({ version: 1, keyName: 'key', records: [['A', 'new']] }));
  const reopened = await host['host.isam_open']('data', 'fresh.json', 'key', 'INPUT');
  assert.equal(await host['host.isam_read'](reopened, 'A'), 'new');
});

test('ISAM ordered scans do not skip the next record after deleting a prior key', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  let handle = await host['host.isam_open']('data', 'scan.json', 'key', 'OUTPUT');
  for (const key of ['A', 'B', 'C']) await host['host.isam_write'](handle, key, key);
  await host['host.isam_close'](handle);
  handle = await host['host.isam_open']('data', 'scan.json', 'key', 'I-O');
  assert.equal(await host['host.isam_read_next'](handle), 'A');
  await host['host.isam_delete'](handle, 'A');
  assert.equal(await host['host.isam_read_next'](handle), 'B');
});

test('ISAM persistence failures remain errors and cannot commit in-memory data', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  let handle = await host['host.isam_open']('data', 'failure.json', 'key', 'OUTPUT');
  await host['host.isam_write'](handle, 'A', 'original');
  await host['host.isam_close'](handle);
  handle = await host['host.isam_open']('data', 'failure.json', 'key', 'I-O');
  storage.handlers['host.fs_write_text'] = async () => { throw new Error('disk full'); };
  await assert.rejects(() => host['host.isam_rewrite'](handle, 'A', 'uncommitted'), /disk full/);
  assert.equal(host['host.isam_status'](handle), '30');
  assert.equal(await host['host.isam_read'](handle, 'A'), 'original');
});

test('failed OPEN writes do not leak handles or poison the operation queue', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  const write = storage.handlers['host.fs_write_text'];
  storage.handlers['host.fs_write_text'] = async () => { throw new Error('disk full'); };
  for (let index = 0; index < 65; index++) {
    await assert.rejects(host['host.isam_open']('data', 'failed.json', 'key', 'OUTPUT'), /disk full/);
  }
  storage.handlers['host.fs_write_text'] = write;
  const handle = await host['host.isam_open']('data', 'recovered.json', 'key', 'OUTPUT');
  assert.equal(host['host.isam_status'](handle), '00');
});

test('independent bindings serialize access to one file and release ownership on close/dispose', async () => {
  const storage = memoryFilesystem();
  const firstHost = createIsamBindings(storage.handlers);
  const secondHost = createIsamBindings(storage.handlers);
  const thirdHost = createIsamBindings(storage.handlers);
  const first = await firstHost['host.isam_open']('data', 'exclusive.json', 'key', 'OUTPUT');
  await firstHost['host.isam_write'](first, 'A', 'retained');
  const duplicate = await secondHost['host.isam_open']('data', 'exclusive.json', 'key', 'OUTPUT');
  assert.equal(secondHost['host.isam_status'](duplicate), '41');
  await secondHost['host.isam_close'](duplicate);
  const stillBlocked = await thirdHost['host.isam_open']('data', 'exclusive.json', 'key', 'I-O');
  assert.equal(thirdHost['host.isam_status'](stillBlocked), '41');
  await thirdHost['host.isam_close'](stillBlocked);
  await firstHost['host.isam_close'](first);
  const recovered = await thirdHost['host.isam_open']('data', 'exclusive.json', 'key', 'I-O');
  assert.equal(thirdHost['host.isam_status'](recovered), '00');
  await thirdHost['host.isam_close'](recovered);
  const leased = await firstHost['host.isam_open']('data', 'leased.json', 'key', 'OUTPUT');
  secondHost.dispose();
  await assert.rejects(secondHost['host.isam_open']('data', 'exclusive.json', 'key', 'INPUT'), /disposed/);
  firstHost.dispose();
  const released = await thirdHost['host.isam_open']('data', 'leased.json', 'key', 'INPUT');
  assert.equal(thirdHost['host.isam_status'](released), '00');
  await thirdHost['host.isam_close'](released);
});

test('active handles refresh the durable image before reads and mutations', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  let handle = await host['host.isam_open']('data', 'refresh.json', 'key', 'OUTPUT');
  await host['host.isam_write'](handle, 'A', 'initial');
  await host['host.isam_close'](handle);
  handle = await host['host.isam_open']('data', 'refresh.json', 'key', 'INPUT');
  storage.files.set('refresh.json', JSON.stringify({
    version: 1, keyName: 'key', records: [['A', 'external'], ['B', 'other']]
  }));
  assert.equal(await host['host.isam_read'](handle, 'A'), 'external');
  await host['host.isam_close'](handle);
  handle = await host['host.isam_open']('data', 'refresh.json', 'key', 'I-O');
  storage.files.set('refresh.json', JSON.stringify({
    version: 1, keyName: 'key', records: [['A', 'latest'], ['B', 'other'], ['C', 'third']]
  }));
  assert.equal(await host['host.isam_write'](handle, 'D', 'new'), 0);
  assert.deepEqual(JSON.parse(storage.files.get('refresh.json')).records, [
    ['A', 'latest'], ['B', 'other'], ['C', 'third'], ['D', 'new']
  ]);
  await host['host.isam_close'](handle);
});

test('ISAM validates storage aliases, relative paths and UTF-8 key/record bounds before I/O', async () => {
  let calls = 0;
  const storage = memoryFilesystem();
  for (const name of Object.keys(storage.handlers)) {
    const original = storage.handlers[name];
    storage.handlers[name] = async (...args) => { calls += 1; return original(...args); };
  }
  const host = createIsamBindings(storage.handlers);
  for (const [root, filePath] of [
    ['../data', 'ledger.json'], ['data', '../outside.json'], ['data', 'C:\\outside'],
    ['data', 'nested\\..\\outside'], ['data', 'CON.txt'], ['data', 'trailing. ']
  ]) {
    await assert.rejects(host['host.isam_open'](root, filePath, 'key', 'OUTPUT'));
  }
  const handle = await host['host.isam_open']('data', 'bounded.json', 'key', 'OUTPUT');
  await assert.rejects(host['host.isam_write'](handle, '\ud800', 'bad key'), /UTF-8/);
  await assert.rejects(host['host.isam_write'](handle, 'A', 'x'.repeat(240001)), /size limit/);
  assert.equal(calls, 1, 'only the valid OPEN may touch storage');
});

test('ISAM operations execute compiled P-code, not a JavaScript index engine', async () => {
  const library = await loadIsamPcode();
  assert.match(library.pcodeText, /CALL_EXT host\.fs_read_text 2/);
  assert.match(library.pcodeText, /CALL_EXT host\.fs_write_text 3/);
  assert.doesNotMatch(library.pcodeText, /CALL_EXT host\.isam_/);
});

test('ISAM START comparisons and keyed reads position byte-ordered scans', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  let handle = await host['host.isam_open']('data', 'order.json', 'key', 'OUTPUT');
  for (const key of ['a', 'Z', 'A', '0']) await host['host.isam_write'](handle, key, key);
  await host['host.isam_close'](handle);
  handle = await host['host.isam_open']('data', 'order.json', 'key', 'I-O');
  for (const [comparison, key, expected] of [
    ['=', 'A', 'A'], ['>', 'A', 'Z'], ['>=', 'A', 'A'], ['<', 'A', '0'], ['<=', 'A', '0']
  ]) {
    assert.equal(await host['host.isam_start'](handle, key, comparison), 0);
    assert.equal(await host['host.isam_read_next'](handle), expected);
  }
  assert.equal(await host['host.isam_read'](handle, 'A'), 'A');
  assert.equal(await host['host.isam_read_next'](handle), 'Z');
  assert.equal(await host['host.isam_start'](handle, 'z', '>'), 23);
  await assert.rejects(host['host.isam_start'](handle, 'A', '!='), /comparison/);
});

test('ISAM sequential and relative metadata exposes counts, cursors, and optional EOF statuses', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  let handle = await host['host.isam_open']('data', 'sequential.json', '__SEQUENTIAL__', 'OUTPUT');
  assert.equal(await host['host.isam_write'](handle, '0000000001', 'first'), 0);
  assert.equal(await host['host.isam_write'](handle, '0000000002', 'second'), 0);
  await host['host.isam_close'](handle);

  handle = await host['host.isam_open']('data', 'sequential.json', '__SEQUENTIAL__', 'I-O');
  assert.equal(await host['host.isam_count'](handle), 2);
  assert.equal(await host['host.isam_read_next'](handle), 'first');
  assert.equal(await host['host.isam_current_key'](handle), '0000000001');
  assert.equal(await host['host.isam_read_next'](handle), 'second');
  assert.equal(await host['host.isam_current_key'](handle), '0000000002');
  assert.equal(await host['host.isam_read_next'](handle), '');
  assert.equal(await host['host.isam_status'](handle), '10');
  assert.equal(await host['host.isam_read_next'](handle), '');
  assert.equal(await host['host.isam_status'](handle), '46');
  await host['host.isam_close'](handle);

  handle = await host['host.isam_open']('data', 'relative.json', '__RELATIVE__:REL-KEY', 'OUTPUT');
  assert.equal(await host['host.isam_write'](handle, '0001', 'one'), 0);
  assert.equal(await host['host.isam_write'](handle, '0003', 'three'), 0);
  await host['host.isam_close'](handle);
  handle = await host['host.isam_open']('data', 'relative.json', '__RELATIVE__:REL-KEY', 'INPUT');
  assert.equal(await host['host.isam_count'](handle), 2);
  assert.equal(await host['host.isam_start'](handle, '0002', '>='), 0);
  assert.equal(await host['host.isam_read_next'](handle), 'three');
  assert.equal(await host['host.isam_current_key'](handle), '0003');
  await host['host.isam_close'](handle);

  handle = await host['host.isam_open']('data', 'optional.json', '__SEQUENTIAL__', 'INPUT-OPTIONAL');
  assert.equal(await host['host.isam_status'](handle), '05');
  assert.equal(await host['host.isam_read_next'](handle), '');
  assert.equal(await host['host.isam_status'](handle), '10');
  assert.equal(await host['host.isam_read_next'](handle), '');
  assert.equal(await host['host.isam_status'](handle), '46');
  await host['host.isam_close'](handle);
});

test('ISAM serializes concurrent calls, preserves escaped records and checks modes and handles', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  let handle = await host['host.isam_open']('data', 'checks.json', 'key', 'OUTPUT');
  const duplicate = await host['host.isam_open']('data', 'checks.json', 'key', 'OUTPUT');
  assert.equal(host['host.isam_status'](duplicate), '41');
  await host['host.isam_close'](duplicate);
  const contender = createIsamBindings(storage.handlers);
  const blocked = await contender['host.isam_open']('data', 'checks.json', 'key', 'INPUT');
  assert.equal(contender['host.isam_status'](blocked), '41');
  await contender['host.isam_close'](blocked);
  contender.dispose();
  const record = 'quote" slash\\ newline\n unicode \u00e9';
  await assert.rejects(host['host.isam_write'](handle, 'invalid', 12), /record must be a string/);
  await assert.rejects(host['host.isam_write'](handle, 12, 'invalid'), /key must be a string/);
  assert.deepEqual(await Promise.all([
    host['host.isam_write'](handle, 'A', record),
    host['host.isam_write'](handle, 'A', 'duplicate'),
    host['host.isam_write'](handle, 'B', '')
  ]), [0, 22, 0]);
  await host['host.isam_close'](handle);
  await assert.rejects(host['host.isam_read'](handle, 'A'), /Invalid ISAM file handle/);
  handle = await host['host.isam_open']('data', 'checks.json', 'key', 'INPUT');
  assert.equal(await host['host.isam_read'](handle, 'A'), record);
  assert.equal(await host['host.isam_read'](handle, 'B'), '');
  assert.equal(host['host.isam_status'](handle), '00');
  assert.equal(await host['host.isam_write'](handle, 'C', 'blocked'), 48);
  assert.equal(await host['host.isam_delete'](handle, 'A'), 49);
  await host['host.isam_close'](handle);
  handle = await host['host.isam_open']('data', 'checks.json', 'key', 'EXTEND');
  assert.equal(await host['host.isam_read_next'](handle), '');
  assert.equal(host['host.isam_status'](handle), '47');
  assert.equal(await host['host.isam_write'](handle, 'C', 'extended'), 0);
  await host['host.isam_close'](handle);
});

test('ISAM rejects corrupt, duplicate and mismatched persisted images', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  for (const content of [
    'broken', '{"version":2,"keyName":"key","records":[]}',
    '{"version":1,"keyName":"other","records":[]}',
    '{"version":1,"keyName":"key","records":[["A","a"],["A","b"]]}',
    '{"version":1,"keyName":"key","records":[["B","b"],["A","a"]]}',
    '{"version":1,"keyName":"key","records":[["A",1]]}'
  ]) {
    storage.files.set('invalid.json', content);
    await assert.rejects(host['host.isam_open']('data', 'invalid.json', 'key', 'INPUT'));
  }
});

test('ISAM enforces its 1024-record and 64-open-handle bounds without changing committed data', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  const records = Array.from({ length: 1023 }, (_, index) => [String(index).padStart(4, '0'), 'record']);
  storage.files.set('capacity.json', JSON.stringify({ version: 1, keyName: 'key', records }));
  const handle = await host['host.isam_open']('data', 'capacity.json', 'key', 'I-O');
  assert.equal(await host['host.isam_write'](handle, '1023', 'last'), 0);
  const committed = storage.files.get('capacity.json');
  assert.equal(JSON.parse(committed).records.length, 1024);
  await assert.rejects(host['host.isam_write'](handle, '1024', 'overflow'), /record capacity/);
  assert.equal(storage.files.get('capacity.json'), committed);
  assert.equal(await host['host.isam_read'](handle, '1023'), 'last');
  await host['host.isam_close'](handle);
  const handles = [];
  for (let index = 0; index < 64; index++) {
    handles.push(await host['host.isam_open']('data', `handle-${index}.json`, 'key', 'OUTPUT'));
  }
  await assert.rejects(host['host.isam_open']('data', 'overflow.json', 'key', 'OUTPUT'), /handle capacity/);
  assert.equal(storage.files.has('overflow.json'), false);
  await host['host.isam_close'](handles[0]);
  const reopened = await host['host.isam_open']('data', 'replacement.json', 'key', 'OUTPUT');
  assert.equal(host['host.isam_status'](reopened), '00');
});

test('ISAM enforces a serialized image bound without committing oversized images', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  const handle = await host['host.isam_open']('data', 'image-limit.json', 'key', 'OUTPUT');
  assert.equal(await host['host.isam_write'](handle, 'A', 'x'.repeat(130000)), 0);
  await assert.rejects(host['host.isam_write'](handle, 'B', 'y'.repeat(130000)), /image exceeds 240000 bytes/);
  assert.equal(host['host.isam_status'](handle), '30');
  assert.deepEqual(JSON.parse(storage.files.get('image-limit.json')).records, [['A', 'x'.repeat(130000)]]);
});
