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
import { createPathwayHttpServer } from '../src/http-server.mjs';
const silent = { log() {}, warn() {}, error() {} };

test('real UDP beacons -> automatic deployment -> screen request/reply -> server death -> replacement -> controller restart', { timeout: 30000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-pathway-live-'));
  const options = { stateFile: path.join(dir, 'state.json'), reconcileMs: 100, beaconTtlMs: 1000, logger: silent };
  let controller = await new PathwayController(options).open();
  const udp = await controller.listen({ udpPort: 0, host: '127.0.0.1' });
  const nodes = [];
  let web;
  t.after(async () => {
    if (web) await new Promise(resolve => web.close(resolve));
    await controller.close();
    for (const node of nodes) if (node.listening) await new Promise(resolve => node.close(resolve));
    await fs.rm(dir, { recursive: true });
  });
  for (let i = 0; i < 3; i++) {
    const node = createJsPmachineNodeServer({ name: `node-${i}`, port: 0, logger: silent,
      udpAnnounceHost: '127.0.0.1', udpAnnouncePort: udp.port, announceIntervalMs: 100 });
    await new Promise(resolve => node.listen(0, '127.0.0.1', resolve));
    nodes.push(node);
  }
  const artifact = compileCobolishToPcode(await fs.readFile(new URL('../examples/echo.cob', import.meta.url), 'utf8'), { hostServices: true });
  const requester = compileScreenCobol(await fs.readFile(new URL('../examples/echo.scob', import.meta.url), 'utf8'));
  await controller.define({ name: 'echo', replicas: 2, idempotent: true, artifact });
  async function waitFor(predicate) {
    const deadline = Date.now() + 8000;
    while (!predicate() && Date.now() < deadline) await delay(50);
    assert.ok(predicate(), JSON.stringify(controller.snapshot()));
  }
  await waitFor(() => controller.placements.length === 2);
  web = await createPathwayHttpServer(controller, requester, { port: 0 });
  const origin = `http://127.0.0.1:${web.address().port}`;
  async function submit(value) {
    const response = await fetch(`${origin}/api/requester`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ values: { 'REQUEST-TEXT': value } }) });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.values['REPLY-TEXT'], value.padEnd(40));
  }
  await submit('before failure');
  const victim = controller.placements[0].nodeId;
  const index = Number(victim.split('-')[1]);
  await new Promise(resolve => nodes[index].close(resolve));
  await submit('after server failure');
  await waitFor(() => controller.placements.length === 2 && !controller.placements.some(p => p.nodeId === victim));
  const identity = controller.id;
  await new Promise(resolve => web.close(resolve)); web = null;
  await controller.close();
  controller = await new PathwayController(options).open();
  await controller.listen({ udpPort: udp.port, host: '127.0.0.1' });
  assert.equal(controller.id, identity);
  assert.equal(controller.placements.length, 0);
  await waitFor(() => controller.placements.length === 2);
  web = await createPathwayHttpServer(controller, requester, { port: Number(new URL(origin).port) });
  await submit('after controller restart');
  const invalid = await fetch(`${origin}/api/requester`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ values: { 'REPLY-TEXT': 'spoofed' } }) });
  assert.equal(invalid.status, 400);
});
