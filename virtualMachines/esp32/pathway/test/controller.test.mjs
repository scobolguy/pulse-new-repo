import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PathwayController } from '../src/controller.mjs';
import { compileCobolishToPcode } from '../../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';

const artifact = compileCobolishToPcode(await fs.readFile(new URL('../examples/echo.cob', import.meta.url), 'utf8'), { hostServices: true });
const definition = { name: 'echo', replicas: 2, idempotent: true, artifact };
const silent = { warn() {} };
function beacon(nodeId, runtime = 'js-pmachine') {
  return { kind: 'nodeBeacon', nodeId, runtime, ip: '127.0.0.1', port: 4000 };
}
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-pathway-'));
  let now = 0;
  const installed = new Map(), down = new Set(), calls = [];
  const adapter = {
    async describe(node) { return { runtime: node.runtime ?? 'esp32' }; },
    async install(node, _definition, collectorId) {
      if (down.has(node.id)) throw new Error('offline');
      const previous = installed.get(node.id);
      if (previous && previous !== collectorId) throw new Error('occupied');
      installed.set(node.id, collectorId);
    },
    async retire(node, collectorId) {
      if (installed.get(node.id) === collectorId) installed.delete(node.id);
    },
    async send(node, _definition, data) {
      calls.push(node.id);
      if (down.has(node.id)) throw new Error('connection lost after possible execution');
      return { data, code: 0 };
    },
  };
  const options = { stateFile: path.join(dir, 'state.json'), adapter, clock: () => now,
    beaconTtlMs: 1000, reconcileMs: 100, logger: silent };
  const controllers = [];
  const open = async () => { const c = await new PathwayController(options).open(); controllers.push(c); return c; };
  t.after(async () => {
    for (const controller of controllers) if (controller.lock) await controller.close();
    await fs.rm(dir, { recursive: true });
  });
  return { controller: await open(), open, options, installed, down, calls, advance: ms => { now += ms; } };
}
test('places two replicas, fails over on request loss and deploys a spare', async t => {
  const { controller: c, down, calls, advance, installed } = await fixture(t);
  for (const id of ['one', 'two', 'three']) c.observe(beacon(id), '127.0.0.1');
  await c.define(definition);
  assert.equal(c.placements.length, 2);
  const primary = c.placements[0].nodeId;
  down.add(primary);
  assert.equal((await c.send('echo', 'hello')).data, 'hello');
  assert.equal(calls.length, 2);
  await c.reconcile();
  assert.equal(c.placements.length, 2);
  assert.ok(c.placements.every(item => item.nodeId !== primary));
  down.delete(primary);
  advance(201);
  c.observe(beacon(primary), '127.0.0.1');
  await c.reconcile();
  assert.equal(installed.size, 2, 'The recovered old replica must be retired rather than leaking an occupied slot');
});
test('non-idempotent uncertainty is surfaced and never retried', async t => {
  const { controller: c, down, calls } = await fixture(t);
  for (const id of ['one', 'two']) c.observe(beacon(id), '127.0.0.1');
  await c.define({ ...definition, idempotent: false });
  down.add(c.placements[0].nodeId);
  await assert.rejects(c.send('echo', 'update'), error => error.uncertain === true && /uncertain/.test(error.message));
  assert.equal(calls.length, 1);
});
test('explicit application rejection preserves healthy replicas and is not reported as uncertain', async t => {
  const { controller: c } = await fixture(t);
  for (const id of ['one', 'two']) c.observe(beacon(id), '127.0.0.1');
  await c.define(definition);
  let calls = 0;
  c.adapter.send = async () => {
    calls++;
    throw Object.assign(new Error('Inventory item not found'), { status: 404 });
  };
  await assert.rejects(c.send('echo', 'UNKNOWN'), error => error.status === 404 && error.uncertain === false);
  assert.equal(calls, 1);
  assert.equal(c.placements.length, 2);
  assert.ok([...c.nodes.values()].every(node => !node.retryAt));
});
test('restart adopts matching instances only after fresh beacons; state lock prevents two controllers', async t => {
  const { controller: c, open, installed } = await fixture(t);
  c.observe(beacon('one'), '127.0.0.1');
  await c.define({ ...definition, replicas: 1 });
  const identity = c.id;
  await assert.rejects(open(), /locked/);
  await c.close();
  const restarted = await open();
  assert.equal(restarted.id, identity);
  await assert.rejects(restarted.send('echo', 'hello'), /No available/);
  restarted.observe(beacon('one'), '127.0.0.1');
  await restarted.reconcile();
  assert.equal(installed.size, 1);
  assert.equal((await restarted.send('echo', 'hello')).data, 'hello');
});
test('expires beacons and excludes draining, occupied and incompatible nodes', async t => {
  const { controller: c, advance, installed } = await fixture(t);
  installed.set('occupied', 'someone-else');
  c.observe(beacon('occupied'), '127.0.0.1');
  c.observe({ ...beacon('draining'), draining: true }, '127.0.0.1');
  c.observe(beacon('embedded', 'esp32'), '127.0.0.1');
  const desktopOnly = structuredClone(artifact);
  desktopOnly.programMap.targets = ['js'];
  await c.define({ ...definition, artifact: desktopOnly });
  assert.equal(c.placements.length, 0);
  c.observe(beacon('free'), '127.0.0.1');
  await c.reconcile();
  assert.equal(c.placements.length, 1);
  advance(1001);
  await assert.rejects(c.send('echo', 'hello'), /No available/);
  await c.reconcile();
  assert.equal(c.nodes.size, 0);
});
test('rejects untrusted/spoofed beacons and unsupported capability requirements', async t => {
  const { controller: c } = await fixture(t);
  assert.throws(() => c.observe(beacon('one'), '192.168.1.1'), /allowlist/);
  assert.throws(() => c.observe({ ...beacon('one'), ip: '192.168.1.1' }, '127.0.0.1'), /Invalid/);
  c.observe(beacon('one'), '127.0.0.1');
  const privileged = structuredClone(artifact);
  privileged.programMap.requiredHostCapabilities = ['unavailable-device'];
  await c.define({ ...definition, artifact: privileged });
  assert.equal(c.placements.length, 0);
});

test('a beacon arriving during capability probing cannot discard verification or failure state', async t => {
  const { controller: c } = await fixture(t);
  c.observe(beacon('one'), '127.0.0.1');
  c.adapter.describe = async node => {
    c.observe(beacon(node.id), '127.0.0.1');
    return { runtime: 'js' };
  };
  await c.define({ ...definition, replicas: 1 });
  assert.equal(c.nodes.get('one').verified, true);
  assert.equal(c.placements.length, 1);
});

test('recompiling the same source with fresh build metadata does not change deployed identity', async t => {
  const { controller: c } = await fixture(t);
  await c.define(definition);
  const fresh = structuredClone(artifact);
  fresh.programMap.generatedAt = 'different-build-time';
  fresh.programMap.sourceMap = { irrelevant: true };
  await assert.doesNotReject(c.define({ ...definition, artifact: fresh }));
});
