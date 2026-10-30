import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createStockGateway } from '../src/stock-gateway.mjs';
import { compileStockService } from '../../pathwayDemo/build.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { validateDefinition } from '../src/controller.mjs';
import { createSqlFixture, sqlEnabled } from './sql-fixture.mjs';

async function hostFixture(store) {
  const gateway = await createStockGateway({ store, logger: { warn() {} } });
  const compiled = await compileStockService({ address: '127.0.0.1', port: gateway.port });
  assert.ok(compiled.programMap.targets.includes('esp32'));
  assert.match(encodeHostedImage(compiled.pcodeText), /^PHI1/);
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'stock-test', httpPort: null, udpPort: null,
    networkPeers: [{ ip: '127.0.0.1', port: gateway.port }],
  });
  await host.start();
  return { compiled, gateway, host, close: async () => { await host.stop(); await gateway.close(); } };
}
test('formally compiled native stock service returns two integers and propagates missing-item/database failures', async () => {
  const fixture = await hostFixture({ async stock(item) {
    if (item === 'UNKNOWN') throw Object.assign(new Error('Inventory item not found'), { status: 404 });
    if (item === 'FAIL') throw new Error('Database offline');
    assert.equal(item.trim(), 'WIDGET');
    return { inStock: 100, committed: 7 };
  } });
  try {
    const query = item => fixture.host.dispatch({
      method: 'POST', path: '/api/inventory/stock', body: JSON.stringify({ item }),
    });
    assert.deepEqual((await query('WIDGET')).body, { inStock: 100, committed: 7 });
    assert.equal((await query('UNKNOWN')).status, 404);
    assert.equal((await query('FAIL')).status, 503);
    const reply = await fixture.host.dispatch({ method: 'POST', path: '/api/pathway/inventory-stock',
      body: JSON.stringify({ data: 'WIDGET' }) });
    assert.deepEqual(JSON.parse(reply.body.data), { inStock: 100, committed: 7 });
    assert.equal(reply.body.code, 0);
    assert.doesNotThrow(() => validateDefinition({ name: 'inventory-stock', replicas: 1, idempotent: true,
      artifact: fixture.compiled, networkPeers: [{ ip: '127.0.0.1', port: fixture.gateway.port }] }));
    assert.throws(() => validateDefinition({ name: 'inventory-stock', replicas: 1, idempotent: true,
      artifact: fixture.compiled, networkPeers: [{ ip: 'example.org', port: 4325 }] }), /peer grants/);
  } finally { await fixture.close(); }
});

test('stock service reads actual MSSQL reservations without confusing physical stock with available stock', {
  skip: !sqlEnabled, timeout: 30000,
}, async () => {
  const sql = await createSqlFixture();
  const fixture = await hostFixture(sql.store);
  try {
    await sql.store.apply('stock-test-reserve-1', 'RESERVE WIDGET 7 STOCK1');
    const result = await fixture.host.dispatch({ method: 'POST', path: '/api/inventory/stock',
      body: '{"item":"WIDGET"}' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { inStock: 100, committed: 7 });
    await sql.store.apply('stock-test-release-1', 'RELEASE STOCK1');
    assert.deepEqual((await fixture.host.dispatch({ method: 'POST', path: '/api/inventory/stock',
      body: '{"item":"WIDGET"}' })).body, { inStock: 100, committed: 0 });
  } finally { await fixture.close(); await sql.close(); }
});

test('stock gateway rejects ungranted clients and oversized frames without querying the database', async () => {
  let calls = 0;
  const store = { async stock() { calls++; return { inStock: 0, committed: 0 }; } };
  for (const allowedClients of [['127.0.0.2'], ['127.0.0.1']]) {
    const gateway = await createStockGateway({ store, allowedClients, logger: { warn() {} } });
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection(gateway.port, '127.0.0.1', () => {
          const bytes = Buffer.alloc(4); bytes.writeUInt32BE(10000); socket.write(bytes);
        });
        socket.on('error', error => error.code === 'ECONNRESET' ? resolve() : reject(error));
        socket.on('close', resolve);
      });
    } finally { await gateway.close(); }
  }
  assert.equal(calls, 0);
});
