import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';
import { compileCobolishToPcode } from '../../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';
import { compileScreenCobol } from '../../../../languages/screencobol/src/compiler.mjs';
import { PathwayController } from '../src/controller.mjs';
import { createNodeAdapter } from '../src/node-adapter.mjs';
import { createPathwayHttpServer } from '../src/http-server.mjs';
import { createInventoryAuthority } from '../src/inventory-authority.mjs';
import { createSqlFixture, sqlEnabled } from './sql-fixture.mjs';
const silent = { log() {}, warn() {}, error() {} };
const token = 'inventory-integration-test-only-credential';

test('legacy granted COBOL MSSQL inventory commits once across lost replies, replica failover, requester recovery and controller/authority restart', { skip: !sqlEnabled, timeout: 30000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-inventory-live-'));
  const fixture = await createSqlFixture();
  let store = fixture.store;
  let authority = await createInventoryAuthority({ store, token, logger: silent });
  const authorityPort = Number(new URL(authority.endpoint).port);
  const realAdapter = createNodeAdapter();
  const calls = [];
  let loseReplies = 1;
  const adapter = {
    ...realAdapter,
    async send(node, definition, record, options) {
      const reply = await realAdapter.send(node, definition, record, options);
      calls.push({ nodeId: node.id, record, ...options });
      if (loseReplies > 0) { loseReplies--; throw new Error('Simulated connection loss AFTER committed server reply'); }
      return reply;
    },
  };
  const options = { stateFile: path.join(dir, 'controller.json'), adapter,
    reconcileMs: 100, beaconTtlMs: 1000, logger: silent };
  let controller = await new PathwayController(options).open();
  const udp = await controller.listen({ udpPort: 0, host: '127.0.0.1' });
  const nodes = [];
  let web;
  t.after(async () => {
    if (web) await new Promise(resolve => web.close(resolve));
    await controller.close();
    for (const node of nodes) if (node.listening) await new Promise(resolve => node.close(resolve));
    await authority.close();
    await fixture.close();
    await fs.rm(dir, { recursive: true });
  });
  for (let i = 0; i < 5; i++) {
    const inventoryGrants = i < 3 ? { 'inventory-service': { endpoint: authority.endpoint, token } } :
      i === 3 ? { 'some-other-service': { endpoint: authority.endpoint, token } } : {};
    const node = createJsPmachineNodeServer({
      name: `stock-${i}`, port: 0, logger: silent, inventoryGrants,
      udpAnnounceHost: '127.0.0.1', udpAnnouncePort: udp.port, announceIntervalMs: 100,
    });
    await new Promise(resolve => node.listen(0, '127.0.0.1', resolve));
    nodes.push(node);
  }
  const artifact = compileCobolishToPcode(`IDENTIFICATION DIVISION.
PROGRAM-ID. INVENTORY-SERVER.
PULSE SERVICE inventory-service.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 REQUEST-TEXT PIC X(64).
01 REPLY-TEXT PIC X(96).
PROCEDURE DIVISION.
    PULSE RECEIVE INTO REQUEST-TEXT
    PULSE INVENTORY REQUEST-TEXT INTO REPLY-TEXT
    PULSE SEND REPLY-TEXT.`, { hostServices: true });
  const requester = compileScreenCobol(await fs.readFile(new URL('../../pathwayDemo/application/inventory.scob', import.meta.url), 'utf8'));
  await controller.define({ name: 'inventory-service', replicas: 2, idempotent: true, artifact });
  async function waitFor(predicate) {
    const deadline = Date.now() + 8000;
    while (!predicate() && Date.now() < deadline) await delay(50);
    assert.ok(predicate(), JSON.stringify(controller.snapshot()));
  }
  await waitFor(() => controller.placements.length === 2);
  assert.ok(controller.placements.every(item => Number(item.nodeId.split('-')[1]) < 3));
  web = await createPathwayHttpServer(controller, requester, { port: 0 });
  let origin = `http://127.0.0.1:${web.address().port}`;
  async function submit(requestId, command) {
    const response = await fetch(`${origin}/api/requester`, { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId, values: { 'REQUEST-TEXT': command } }),
    });
    return { status: response.status, body: await response.json() };
  }
  const firstId = 'inventory-screen-request-1';
  const first = await submit(firstId, 'RESERVE WIDGET 2 ORDER1');
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.requestId, firstId);
  assert.equal(first.body.values['REPLY-TEXT'].trimEnd(), 'RESERVED ORDER1 WIDGET QTY 2 AVAILABLE 98');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].requestId, calls[1].requestId);
  assert.notEqual(calls[0].nodeId, calls[1].nodeId);
  assert.equal(await store.apply('inventory-inspect-1', 'INQUIRE WIDGET'), 'WIDGET AVAILABLE 98 RESERVED 2');
  await waitFor(() => controller.placements.length === 2);

  loseReplies = 2;
  const pendingId = 'inventory-screen-request-2';
  const uncertain = await submit(pendingId, 'RESERVE WIDGET 3 ORDER2');
  assert.equal(uncertain.status, 503);
  assert.equal(uncertain.body.uncertain, true);
  assert.equal(await store.apply('inventory-inspect-2', 'INQUIRE WIDGET'), 'WIDGET AVAILABLE 95 RESERVED 5');
  await waitFor(() => controller.placements.length === 2);
  const recovered = await submit(pendingId, 'RESERVE WIDGET 3 ORDER2');
  assert.equal(recovered.status, 200, JSON.stringify(recovered.body));
  assert.equal(recovered.body.values['REPLY-TEXT'].trimEnd(), 'RESERVED ORDER2 WIDGET QTY 3 AVAILABLE 95');
  assert.equal(await store.apply('inventory-inspect-3', 'INQUIRE WIDGET'), 'WIDGET AVAILABLE 95 RESERVED 5');

  const identity = controller.id;
  await new Promise(resolve => web.close(resolve)); web = null;
  await controller.close();
  await authority.close(); await store.close();
  store = await fixture.open();
  authority = await createInventoryAuthority({ store, token, port: authorityPort, logger: silent });
  controller = await new PathwayController(options).open();
  await controller.listen({ udpPort: udp.port, host: '127.0.0.1' });
  await waitFor(() => controller.placements.length === 2);
  assert.equal(controller.id, identity);
  web = await createPathwayHttpServer(controller, requester, { port: 0 });
  origin = `http://127.0.0.1:${web.address().port}`;
  const replay = await submit(firstId, 'RESERVE WIDGET 2 ORDER1');
  assert.equal(replay.status, 200, JSON.stringify(replay.body));
  assert.equal(replay.body.values['REPLY-TEXT'].trimEnd(), 'RESERVED ORDER1 WIDGET QTY 2 AVAILABLE 98');
  assert.equal(await store.apply('inventory-inspect-4', 'INQUIRE WIDGET'), 'WIDGET AVAILABLE 95 RESERVED 5');
  const release = await submit('inventory-screen-request-3', 'RELEASE ORDER1');
  assert.equal(release.body.values['REPLY-TEXT'].trimEnd(), 'RELEASED ORDER1 WIDGET AVAILABLE 97');
  const missingId = await submit(undefined, 'RESERVE WIDGET 1 ORDER3');
  assert.equal(missingId.status, 400);
});
