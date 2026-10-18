import test from 'node:test';
import assert from 'node:assert/strict';
import { createIsamLibrary, ISAM_STATUS, parseIsamStore } from './isam-library.mjs';
import { createIsamBindings } from '../../pmachines/javascript/src/isam-bindings.mjs';

function memoryStorage() {
  const files = new Map();
  return {
    files,
    exists: (_root, path) => files.has(path),
    read: (_root, path) => files.get(path),
    write: (_root, path, contents) => { files.set(path, contents); }
  };
}

test('library keeps records ordered by key and reports COBOL statuses', async () => {
  const storage = memoryStorage();
  const isam = createIsamLibrary(storage);
  const out = await isam.open('root', 'k.dat', 'K', 'OUTPUT');
  assert.equal(await isam.write(out, 'B', 'b-rec'), ISAM_STATUS.SUCCESS);
  assert.equal(await isam.write(out, 'A', 'a-rec'), ISAM_STATUS.SUCCESS);
  assert.equal(await isam.write(out, 'A', 'dup'), ISAM_STATUS.DUPLICATE_KEY);
  isam.close(out);

  const input = await isam.open('root', 'k.dat', 'K', 'INPUT');
  assert.deepEqual(isam.readNext(input), { status: '00', record: 'a-rec' });
  assert.deepEqual(isam.readNext(input), { status: '00', record: 'b-rec' });
  assert.deepEqual(isam.readNext(input), { status: '10', record: '' });
  assert.deepEqual(isam.read(input, 'Z'), { status: '23', record: '' });
  assert.equal(await isam.write(input, 'C', 'c'), ISAM_STATUS.MODE_CONFLICT);
  assert.equal(isam.start(input, 'A', '>'), ISAM_STATUS.SUCCESS);
  assert.equal(isam.readNext(input).record, 'b-rec');
  isam.close(input);

  assert.deepEqual([...parseIsamStore(storage.files.get('k.dat'), 'K').keys()], ['A', 'B']);
});

test('library reports missing files, double opens and mode conflicts', async () => {
  const isam = createIsamLibrary(memoryStorage());
  const missing = await isam.open('root', 'none.dat', 'K', 'INPUT');
  assert.equal(isam.status(missing), ISAM_STATUS.FILE_NOT_FOUND);
  const io = await isam.open('root', 'f.dat', 'K', 'OUTPUT');
  const again = await isam.open('root', 'f.dat', 'K', 'I-O');
  assert.equal(isam.status(again), ISAM_STATUS.ALREADY_OPEN);
  assert.equal(await isam.delete(io, 'X'), ISAM_STATUS.MODE_CONFLICT);
  assert.throws(() => createIsamLibrary({}), /storage adapter/);
});

test('runtime bindings delegate to the library through the filesystem handlers', async () => {
  const files = new Map();
  const bindings = createIsamBindings({
    'host.fs_exists': async (_root, path) => Number(files.has(path)),
    'host.fs_read_text': async (_root, path) => files.get(path),
    'host.fs_write_text': async (_root, path, contents) => { files.set(path, contents); return 0; }
  });
  const handle = await bindings['host.isam_open']('r', 'x.dat', 'K', 'OUTPUT');
  assert.equal(await bindings['host.isam_write'](handle, 'K1', 'rec1'), 0);
  assert.equal(await bindings['host.isam_write'](handle, 'K1', 'rec1'), 22);
  assert.equal(bindings['host.isam_status'](handle), '22');
  assert.equal(await bindings['host.isam_close'](handle), 0);
  const input = await bindings['host.isam_open']('r', 'x.dat', 'K', 'INPUT');
  assert.equal(await bindings['host.isam_read'](input, 'K1'), 'rec1');
  assert.equal(await bindings['host.isam_start'](input, 'K1', '='), 0);
  assert.equal(await bindings['host.isam_read_next'](input), 'rec1');
  assert.equal(await bindings['host.isam_read_next'](input), '');
  assert.equal(bindings['host.isam_status'](input), '10');
  assert.ok(files.has('x.dat'));
});
