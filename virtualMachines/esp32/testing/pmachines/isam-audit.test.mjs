import assert from 'node:assert/strict';
import test from 'node:test';
import { createIsamBindings } from '../../pmachines/javascript/src/isam-bindings.mjs';

function memoryFilesystem() {
  const files = new Map();
  return {
    files,
    handlers: {
      'host.fs_exists': async (_root, path) => Number(files.has(path)),
      'host.fs_read_text': async (_root, path) => files.get(path) ?? '',
      'host.fs_write_text': async (_root, path, value) => {
        files.set(path, value);
        return 0;
      },
    },
  };
}

test('ISAM audit is opt-in and records successful mutations with transaction context', async () => {
  const storage = memoryFilesystem();
  const events = [];
  const host = createIsamBindings(storage.handlers, {
    audit: event => { events.push(event); },
  });
  const handle = await host['host.isam_open']('data', 'audit.json', 'key', 'OUTPUT');
  assert.equal(await host['host.isam_write'](handle, 'A', 'one', {
    processId: 'process-1', transactionId: 'tx-1',
  }), 0);
  assert.equal(await host['host.isam_rewrite'](handle, 'A', 'two', {
    processId: 'process-1', transactionId: 'tx-1',
  }), 49);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    version: 1,
    operation: 'write',
    root: 'data',
    path: 'audit.json',
    handle,
    key: 'A',
    recordSha256: '7692c3ad3540bb803c020b3aee66cd8887123234ea0c6e7143c0add73ff431ed',
    status: '00',
    processId: 'process-1',
    transactionId: 'tx-1',
    timestamp: events[0].timestamp,
  });
});

test('ISAM audit remains disabled by default', async () => {
  const storage = memoryFilesystem();
  const host = createIsamBindings(storage.handlers);
  const handle = await host['host.isam_open']('data', 'no-audit.json', 'key', 'OUTPUT');
  assert.equal(await host['host.isam_write'](handle, 'A', 'one'), 0);
});
