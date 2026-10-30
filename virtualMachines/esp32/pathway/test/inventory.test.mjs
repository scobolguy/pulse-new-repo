import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandOf, createInventoryAuthority } from '../src/inventory-authority.mjs';
import { createInventoryClient } from '../../pmachines/javascript/src/inventory-client.mjs';
import { createPendingRequestStore } from '../public/request-recovery.mjs';

test('inventory command validation preserves canonical requests and rejects invalid quantities', () => {
  assert.deepEqual(commandOf(' reserve widget 2 order1 '),
    { operation: 'RESERVE', item: 'WIDGET', quantity: 2, reservation: 'ORDER1' });
  for (const command of ['', 'DELETE WIDGET', 'RESERVE WIDGET 0 A', 'RESERVE WIDGET -1 A',
    'RESERVE WIDGET 1.5 A', 'INQUIRE A extra', '\nINQUIRE WIDGET']) {
    assert.throws(() => commandOf(command), error => error.status === 400);
  }
});

test('authority authenticates clients, awaits database completion and surfaces failures', async t => {
  const token = 'inventory-test-token-not-a-real-secret';
  const calls = [];
  const store = { async apply(requestId, record) {
    await new Promise(resolve => setTimeout(resolve, 5));
    calls.push({ requestId, record });
    if (record === 'FAIL') throw Object.assign(new Error('Database unavailable'), { status: 503 });
    return 'WIDGET AVAILABLE 100 RESERVED 0';
  } };
  const authority = await createInventoryAuthority({ store, token, logger: { warn() {} } });
  t.after(() => authority.close());
  const apply = createInventoryClient({ endpoint: authority.endpoint, token });
  const denied = await fetch(authority.endpoint, { method: 'POST', body: '{}' });
  assert.equal(denied.status, 403);
  assert.equal(calls.length, 0);
  assert.equal(await apply('INQUIRE WIDGET', 'inventory-request-1'), 'WIDGET AVAILABLE 100 RESERVED 0');
  await assert.rejects(apply('FAIL', 'inventory-request-2'), error => error.status === 503);
  assert.equal(calls.length, 2);
});

test('browser recovery persists exact ID and values before sending and clears only a matching confirmed reply', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const recovery = createPendingRequestStore(storage, 'screen');
  const request = recovery.begin({ COMMAND: 'RESERVE WIDGET 2 ORDER1' }, 'inventory-request-1');
  const refreshed = createPendingRequestStore(storage, 'screen');
  assert.deepEqual(refreshed.load(), request);
  assert.deepEqual(refreshed.begin({ COMMAND: 'RESERVE WIDGET 5 OTHER' }, 'inventory-request-2'), request);
  assert.throws(() => refreshed.complete('inventory-request-2'), /identity changed/);
  assert.deepEqual(refreshed.load(), request);
  refreshed.complete('inventory-request-1');
  assert.equal(recovery.load(), null);
  storage.setItem('screen', '{"requestId":"invalid"}');
  assert.throws(() => recovery.load(), /recovery data is invalid/);
  assert.throws(() => createPendingRequestStore({
    ...storage, setItem() { throw new Error('Storage unavailable'); },
  }, 'other').begin({}, 'inventory-request-1'), /Storage unavailable/);
});
