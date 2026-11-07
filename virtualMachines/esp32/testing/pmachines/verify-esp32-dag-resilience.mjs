import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from '../../../../languages/pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';
import { executeExecutionDagSequential } from '../../../../languages/pascalish/src/execution-dag.mjs';
import { createEsp32DagScheduler } from '../../../../languages/pascalish/src/esp32-dag-swarm.mjs';

const aggregator = new URL(process.env.PULSE_AGGREGATOR_TEST_URL);
const origins = (process.env.PULSE_ESP32_TEST_URLS || '').split(',').map(value => new URL(value.trim()));
const reboot = process.env.PULSE_DAG_TEST_REBOOT === '1';
assert.equal(origins.length, 2, 'Set PULSE_ESP32_TEST_URLS to two comma-separated trusted HTTPS origins');
assert.equal(new Set(origins.map(url => url.hostname)).size, 2, 'Select two distinct boards');
for (const origin of [aggregator, ...origins]) {
  assert.ok(['http:', 'https:'].includes(origin.protocol));
  assert.equal(origin.pathname, '/');
  assert.ok(!origin.search && !origin.hash && !origin.username && !origin.password);
}
assert.ok(origins.every(origin => origin.protocol === 'https:'), 'Both boards must use trusted HTTPS');
const lookup = await fetch(new URL('/api/nodes', aggregator), { signal: AbortSignal.timeout(10000) });
assert.equal(lookup.status, 200);
const discovered = await lookup.json();
const nodes = origins.map(origin => {
  const node = discovered.find(value => value.ip === origin.hostname && value.beacon?.kind === 'nodeBeacon');
  assert.ok(node, `No beacon-derived record for ${origin.hostname}`);
  assert.equal(node.availability?.available, true);
  assert.equal(node.availability?.draining, false);
  assert.ok(['https', 'https:'].includes(node.protocol), 'Discovery must advertise HTTPS');
  return node;
});
const jobs = [1, 11, 21, 31].map(seed => {
  const dag = compilePascalishProgramWithAntlr(`
program Resilience;
var x, y, a, b, total: integer;
begin
  x := ${seed};
  y := ${seed + 3};
  a := x + 1;
  b := y + 2;
  total := a + b;
end.
`, { includeExecutionDag: true }).executionDag;
  return { dag, expected: executeExecutionDagSequential(dag) };
});
function check(execution, job, mode) {
  if (mode) assert.equal(execution.mode, mode, execution.reason);
  assert.ok(['swarm', 'sequential-fallback'].includes(execution.mode));
  assert.deepEqual({ ...execution.result.state }, job.expected.state);
  assert.deepEqual(execution.result.completedNodes, job.expected.completedNodes);
  if (execution.mode === 'sequential-fallback') assert.ok(execution.reason);
}
const active = new Set();
const used = new Set();
const taskIds = new Set();
let peak = 0;
let fault = null;
let dispatches = 0;
let faultInjected = false;
let rebootOrigin;
let restartOutcome;
const transportErrors = new Set(['ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'TimeoutError']);
function isTransportError(error) {
  return [error.cause?.code, error.code, error.name].some(code => transportErrors.has(code));
}
async function restartAndObserveOutage(url) {
  rebootOrigin = origins.find(origin => origin.hostname === url.hostname);
  const route = new URL('/node/restart?reason=dag-resilience-test&delayMs=1000', rebootOrigin);
  restartOutcome = (async () => {
    const response = await fetch(route, {
      method: 'POST', headers: { connection: 'close' }, signal: AbortSignal.timeout(10000)
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).restartRequested, true);
  })().then(() => null, error => error);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL('/tls/status', rebootOrigin), {
        headers: { connection: 'close' }, signal: AbortSignal.timeout(2000)
      });
      assert.equal(response.status, 200);
      await response.json();
    } catch (error) {
      if (!isTransportError(error)) throw error;
      console.log(`Physical board outage observed: ${error.cause?.code || error.name}`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Requested reboot produced no observable outage');
}
const scheduler = createEsp32DagScheduler({
  getNodes: () => nodes,
  fetchImpl: async (url, options) => {
    assert.equal(url.protocol, 'https:');
    assert.ok(origins.some(origin => origin.hostname === url.hostname));
    assert.ok(!active.has(url.hostname), 'Concurrent jobs shared a leased worker');
    const task = JSON.parse(options.body);
    assert.ok(!taskIds.has(task.taskId), 'Task identity reused between jobs');
    taskIds.add(task.taskId);
    active.add(url.hostname);
    used.add(url.hostname);
    peak = Math.max(peak, active.size);
    dispatches += 1;
    try {
      if (fault && dispatches === 3) {
        faultInjected = true;
        if (fault === 'reboot') await restartAndObserveOutage(url);
        else throw new Error('Injected node transport loss after first dependency batch');
      }
      // Hold the lease through response consumption, not just response headers.
      const response = await fetch(url, options);
      const body = await response.json();
      return { ok: response.ok, status: response.status, json: async () => body };
    } finally {
      active.delete(url.hostname);
    }
  }
});
check(await scheduler.execute(jobs[0].dag), jobs[0], 'swarm');
assert.equal(used.size, 2);
assert.equal(peak, 2);
const competing = await Promise.all(jobs.map(async job => {
  const result = await scheduler.execute(job.dag);
  check(result, job);
  return result;
}));
assert.ok(competing.some(result => result.mode === 'swarm'));
assert.ok(competing.some(result => result.mode === 'sequential-fallback'), 'Saturated workers must cause explicit fallback');
assert.equal(active.size, 0);
console.log('Two-board concurrent scheduler jobs passed: exclusive leases, distinct task IDs, isolated results');

fault = 'transport-loss';
dispatches = 0;
const lost = await scheduler.execute(jobs[1].dag);
assert.equal(faultInjected, true);
assert.equal(dispatches, 4);
check(lost, jobs[1], 'sequential-fallback');
assert.match(lost.reason, /Injected node transport loss/);
assert.equal(active.size, 0);
fault = null;
used.clear();
check(await scheduler.execute(jobs[2].dag), jobs[2], 'swarm');
assert.equal(used.size, 2, 'Both workers must be usable after transport recovery');
console.log('Injected transport loss after a committed batch passed: complete sequential recomputation and two-board recovery');

const stale = createEsp32DagScheduler({
  getNodes: () => nodes.map(node => ({ ...node, beacon: { ...node.beacon, seenAt: Date.now() - 180001 } })),
  fetchImpl: async () => { throw new Error('Stale beacons must never be contacted'); }
});
const expired = await stale.execute(jobs[0].dag);
check(expired, jobs[0], 'sequential-fallback');
assert.match(expired.reason, /No fresh, available/);
console.log('Simulated three-minute beacon expiry passed without dispatch');

const apiResults = await Promise.all(jobs.map(async job => {
  const response = await fetch(new URL('/api/pmachine/dag/execute', aggregator), {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close' },
    body: JSON.stringify({ dag: job.dag, initialState: {} }),
    signal: AbortSignal.timeout(60000)
  });
  assert.equal(response.status, 200, await response.clone().text());
  const execution = await response.json();
  check(execution, job);
  return execution;
}));
assert.ok(apiResults.some(result => result.mode === 'swarm'), 'API must actually use hardware');
const fallbackCount = apiResults.filter(result => result.mode === 'sequential-fallback').length;
console.log(`Concurrent Aggregator API jobs passed: ${apiResults.length} isolated results, ${fallbackCount} explicit fallbacks`);

if (reboot) {
  fault = 'reboot';
  dispatches = 0;
  faultInjected = false;
  const restartTime = Date.now();
  const interrupted = await scheduler.execute(jobs[3].dag);
  const restartError = await restartOutcome;
  if (restartError) {
    if (!isTransportError(restartError)) throw restartError;
    console.log(`Restart response interrupted: ${restartError.cause?.code || restartError.name}`);
  }
  assert.equal(faultInjected, true);
  check(interrupted, jobs[3], 'sequential-fallback');
  assert.match(interrupted.reason, /dispatch failed/);
  fault = null;
  let recovered = false;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const response = await fetch(new URL('/tls/status', rebootOrigin), {
        headers: { connection: 'close' }, signal: AbortSignal.timeout(3000)
      });
      assert.equal(response.status, 200);
      const status = await response.json();
      assert.equal(status.enrollmentState, 'enrolled');
      assert.equal(status.bundledFallback, false);
      const lookup = await fetch(new URL('/api/nodes', aggregator), { signal: AbortSignal.timeout(10000) });
      assert.equal(lookup.status, 200);
      const current = await lookup.json();
      const returning = current.find(node => node.ip === rebootOrigin.hostname);
      if (!(returning?.beacon?.seenAt > restartTime)) continue;
      for (let index = 0; index < nodes.length; index++) {
        const node = current.find(value => value.ip === nodes[index].ip);
        assert.ok(node, 'Both boards must remain discovered');
        nodes[index] = node;
      }
      recovered = true;
      break;
    } catch (error) {
      if (!isTransportError(error)) throw error;
      console.log(`Waiting for reboot recovery: ${error.cause?.code || error.name}`);
    }
  }
  assert.equal(recovered, true, 'Board must restore trusted TLS and send a post-reboot beacon within 120 seconds');
  used.clear();
  check(await scheduler.execute(jobs[0].dag), jobs[0], 'swarm');
  assert.equal(used.size, 2);
  console.log(`Physical reboot during dispatch passed: ${rebootOrigin.hostname}, explicit fallback, renewed beacon, trusted TLS, two-board recovery`);
}
console.log('Resilience gate passed; beacon expiry was simulated; physical power removal was not tested');
