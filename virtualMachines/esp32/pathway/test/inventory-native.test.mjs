import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileCobolishToPcode } from '../../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';
import { createStockGateway } from '../src/stock-gateway.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { createSqlFixture, sqlEnabled } from './sql-fixture.mjs';

const source = await fs.readFile(new URL('../../pathwayDemo/application/inventory.cob', import.meta.url), 'utf8');
const token = 'native-inventory-test-credential-123456789';
async function fixture(store) {
  const gateway = await createStockGateway({ store, transactionToken: token, logger: { warn() {} } });
  const options = { hostServices: true, nativeTarget: true, inventoryGateway: { address: '127.0.0.1', port: gateway.port } };
  const compiled = compileCobolishToPcode(source, options);
  assert.deepEqual(compiled.programMap.targets, ['js', 'esp32']);
  assert.deepEqual(compiled.programMap.requiredHostCapabilities, []);
  assert.match(encodeHostedImage(compiled.pcodeText, { profile: 'extended' }), /^PHI1/);
  assert.equal(compiled.pcodeText.includes(token), false);
  const deployed = { ...compiled, programMap: compactServiceHostProgramMap(compiled.programMap) };
  assert.ok(Object.keys(deployed.programMap.procedures).some(label => label.includes('APPLY_STOCK_RULES')));
  assert.equal(compiled.pcodeText.includes('COBOL_RT_INVENTORY'), false);
  assert.equal(compiled.pcodeText.includes('host.inventory_apply'), false);
  assert.ok(deployed.programMap.globals.length <= 128);
  const localNames = Object.values(deployed.programMap.procedures).flatMap(procedure => procedure.locals ?? []);
  assert.ok(localNames.length > 0);
  assert.ok(localNames.every(name => !deployed.programMap.globals.includes(name)));
  const host = await createPascalishServiceHost({ compiled: deployed, collectorId: 'native-inventory-test',
    httpPort: null, udpPort: null, networkPeers: [{ ip: '127.0.0.1', port: gateway.port }] });
  await host.start();
  return {
    host, gateway,
    call: (record, requestId, inventoryToken = token) => host.dispatch({ method: 'POST',
      path: '/api/pathway/inventory-service', body: JSON.stringify({ data: record, requestId, inventoryToken }) }),
    close: async () => { await host.stop(); await gateway.close(); },
  };
}
test('native COBOL inventory frames requests over 255 bytes, authenticates and preserves error status', async () => {
  let calls = 0;
  const f = await fixture({ stock() {}, async exchange(query) {
    calls++;
    assert.equal(query.requestId.length, 96);
    assert.equal(query.item, 'WIDGET');
    assert.equal(query.action, 'read');
    assert.deepEqual(JSON.parse(query.canonical), { operation: 'INQUIRE', item: 'WIDGET' });
    if (calls === 2) throw Object.assign(new Error('Request ID conflict'), { status: 409 });
    return { status: 200, reply: 'WIDGET AVAILABLE 100 RESERVED 0' };
  } });
  try {
    const id = 'x'.repeat(96);
    assert.equal((await f.call('INQUIRE WIDGET', id, 'wrong')).status, 403);
    assert.equal(calls, 0);
    assert.equal((await f.call('INQUIRE WIDGET', id)).body.data.trimEnd(), 'WIDGET AVAILABLE 100 RESERVED 0');
    const conflict = await f.call('INQUIRE WIDGET', id);
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error, 'Request ID conflict');
    assert.throws(() => compileCobolishToPcode(source, { hostServices: true,
      inventoryGateway: { address: '999.1.1.1', port: 4326 } }), /Invalid inventory gateway/);
  } finally { await f.close(); }
});
test('portable inventory rules build replies and row changes without calling a PC command handler', async () => {
  const snapshot = JSON.stringify({ sku: 'WIDGET', total: 100, available: 100,
    reservationSku: '', quantity: 0, released: 0 });
  const commits = [];
  let reads = 0;
  const f = await fixture({ stock() {}, async exchange(query) {
    if (query.action === 'read') { reads++; return { status: 200, snapshot }; }
    commits.push(query);
    return { status: 200, reply: query.reply };
  } });
  try {
    const reply = await f.call('  reserve widget 3 order1  ', 'portable-request-id-1');
    assert.equal(reply.status, 200);
    assert.equal(reply.body.data.trimEnd(), 'RESERVED ORDER1 WIDGET QTY 3 AVAILABLE 97');
    assert.equal(commits[0].available, 97);
    assert.equal(commits[0].quantity, 3);
    assert.equal(commits[0].writeRow, 1);
    assert.equal(commits[0].snapshot, snapshot);
    assert.equal(Object.hasOwn(commits[0], 'record'), false);
    for (const command of ['RESERVE WIDGET 0 BAD', 'RESERVE WIDGET 01 BAD', 'INQUIRE WIDGET EXTRA',
      'RELEASE 1BAD', 'RESERVE WIDGET 1000000 BAD', 'INQUIRE WIDGET\n']) {
      assert.equal((await f.call(command, 'portable-invalid-id')).status, 400, command);
    }
    assert.equal(reads, 1);
  } finally { await f.close(); }
});
test('native-compatible COBOL mutations share SQL ledger with JS recovery after lost reply', {
  skip: !sqlEnabled, timeout: 30000,
}, async () => {
  const sql = await createSqlFixture();
  const f = await fixture(sql.store);
  try {
    const first = await f.call('RESERVE WIDGET 3 NATIVE1', 'native-recovery-request-1');
    assert.equal(first.status, 200);
    const original = first.body.data.trimEnd();
    assert.deepEqual(await sql.store.stock('WIDGET'), { inStock: 100, committed: 3 });
    assert.equal(await sql.store.apply('native-recovery-request-1', 'RESERVE WIDGET 3 NATIVE1'), original);
    assert.equal((await f.call('RESERVE WIDGET 3 NATIVE1', 'native-recovery-request-1')).body.data.trimEnd(), original);
    assert.deepEqual(await sql.store.stock('WIDGET'), { inStock: 100, committed: 3 });
    assert.equal((await f.call('RELEASE NATIVE1', 'native-recovery-request-1')).status, 409);
    assert.equal((await f.call('RELEASE NATIVE1', 'native-release-request-1')).status, 200);
    assert.deepEqual(await sql.store.stock('WIDGET'), { inStock: 100, committed: 0 });
    assert.equal((await f.call('RESERVE WIDGET 1 BAD', 'short')).status, 400);
    assert.equal((await f.call('RESERVE WIDGET 101 TOO_BIG', 'native-insufficient-id')).body.data.trimEnd(),
      'INSUFFICIENT WIDGET AVAILABLE 100');
    assert.equal((await f.call('RELEASE NATIVE1', 'native-release-again')).body.data.trimEnd(), 'ALREADY RELEASED NATIVE1');
    assert.equal((await f.call('INQUIRE UNKNOWN', 'native-missing-item')).body.data.trimEnd(), 'NOT FOUND sku UNKNOWN');
  } finally { await f.close(); await sql.close(); }
});
test('database bridge rejects stale row snapshots and atomically rolls back invalid writes', {
  skip: !sqlEnabled, timeout: 30000,
}, async () => {
  const sql = await createSqlFixture();
  try {
    const query = { action: 'read', requestId: 'snapshot-race-id-1',
      canonical: '{"operation":"RESERVE","item":"WIDGET","quantity":2,"reservation":"RACE1"}',
      item: 'WIDGET', reservation: 'RACE1' };
    const { snapshot } = await sql.store.exchange(query);
    await sql.store.apply('snapshot-other-request', 'RESERVE WIDGET 3 OTHER1');
    await assert.rejects(sql.store.exchange({ ...query, action: 'commit', snapshot,
      available: 98, quantity: 2, released: 0, writeRow: 1, reply: 'should not commit' }), { status: 503 });
    const fresh = await sql.store.exchange(query);
    await assert.rejects(sql.store.exchange({ ...query, action: 'commit', snapshot: fresh.snapshot,
      available: 96, quantity: 2, released: 0, writeRow: 1, reply: 'inconsistent write' }), /Inventory row invariant failed/);
    assert.deepEqual(await sql.store.stock('WIDGET'), { inStock: 100, committed: 3 });
    assert.equal((await sql.query("SELECT COUNT(*) AS n FROM dbo.pathway_inventory_requests WHERE id='snapshot-race-id-1'")).recordset[0].n, 0);
  } finally { await sql.close(); }
});
