import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSqlFixture, sqlEnabled } from './sql-fixture.mjs';
import { createInventoryAuthority } from '../src/inventory-authority.mjs';
import { createInventoryClient } from '../../pmachines/javascript/src/inventory-client.mjs';

test('SQL Server concurrent replay, numeric counts, rollback, capacity and authority restart', {
  skip: !sqlEnabled, timeout: 30000,
}, async () => {
  const fixture = await createSqlFixture({ maxRequests: 6 });
  let store = fixture.store, authority;
  try {
    const token = 'sql-inventory-integration-test-credential';
    authority = await createInventoryAuthority({ store, token, logger: { warn() {} } });
    const client = createInventoryClient({ endpoint: authority.endpoint, token });
    const secondAuthority = await fixture.open();
    const replies = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      (index % 2 ? store : secondAuthority).apply('sql-request-stable-1', 'RESERVE WIDGET 2 ORDER1')));
    assert.ok(replies.every(reply => reply === 'RESERVED ORDER1 WIDGET QTY 2 AVAILABLE 98'));
    assert.equal(await client('RESERVE WIDGET 2 ORDER1', 'sql-request-stable-1'), replies[0]);
    assert.deepEqual(await store.stock('widget'), { inStock: 100, committed: 2 });
    await assert.rejects(store.apply('sql-request-stable-1', 'RESERVE WIDGET 3 ORDER1'), error => error.status === 409);
    await assert.rejects(store.stock('UNKNOWN'), error => error.status === 404);
    await assert.rejects(store.stock("WIDGET';DELETE"), error => error.status === 400);
    await fixture.query(`CREATE TRIGGER pathway_test_reject ON dbo.pathway_inventory_requests
      AFTER INSERT AS THROW 51001, 'Simulated ledger failure', 1;`);
    await assert.rejects(store.apply('sql-request-stable-2', 'RESERVE WIDGET 5 ORDER2'), /ledger failure/);
    await fixture.query('DROP TRIGGER dbo.pathway_test_reject');
    assert.deepEqual(await store.stock('WIDGET'), { inStock: 100, committed: 2 });
    assert.equal((await fixture.query('SELECT COUNT(*) AS n FROM dbo.pathway_inventory_reservations')).recordset[0].n, 1);
    const port = Number(new URL(authority.endpoint).port);
    await authority.close(); authority = null;
    await store.close(); store = await fixture.open();
    authority = await createInventoryAuthority({ store, token, port });
    assert.equal(await client('RESERVE WIDGET 2 ORDER1', 'sql-request-stable-1'), replies[0]);
    assert.deepEqual(await store.stock('WIDGET'), { inStock: 100, committed: 2 });
    assert.equal(await store.apply('sql-request-stable-2', 'RELEASE ORDER1'), 'RELEASED ORDER1 WIDGET AVAILABLE 100');
    assert.deepEqual(await store.stock('WIDGET'), { inStock: 100, committed: 0 });
    assert.equal(await store.apply('sql-request-stable-3', 'RELEASE ORDER1'), 'ALREADY RELEASED ORDER1');
    assert.equal(await store.apply('sql-request-stable-4', 'RESERVE WIDGET 101 OTHER'), 'INSUFFICIENT WIDGET AVAILABLE 100');
    assert.equal(await store.apply('sql-request-stable-5', 'INQUIRE UNKNOWN'), 'NOT FOUND sku UNKNOWN');
    assert.equal(await store.apply('sql-request-stable-6', 'INQUIRE WIDGET'), 'WIDGET AVAILABLE 100 RESERVED 0');
    await assert.rejects(store.apply('sql-request-stable-7', 'RESERVE WIDGET 1 OTHER'), error => error.status === 507);
    assert.equal(await store.apply('sql-request-stable-1', 'RESERVE WIDGET 2 ORDER1'), replies[0]);
    assert.deepEqual(await store.stock('WIDGET'), { inStock: 100, committed: 0 });
    await fixture.query("UPDATE dbo.pathway_inventory_stock SET available=99 WHERE sku='WIDGET'");
    await assert.rejects(store.stock('WIDGET'), error => error.status === 503 && /counts/.test(error.message));
  } finally {
    if (authority) await authority.close();
    await fixture.close();
  }
});
