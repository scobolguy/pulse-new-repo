import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { compileKotlinToPcode } from '../../../../languages/kotlin/src/compile-kotlin-to-pcode.mjs';
import { createExecutionTarget, assertExecution } from '../../../../languages/kotlin/tests/execution-targets.mjs';
import { requestEsp32 } from '../../testing/pmachines/esp32-http.mjs';
import { SwarmCheckpointPair, SwarmCheckpointStore } from '../src/backend/swarmCheckpointStore.mjs';
import { SwarmLeadershipWitness } from '../src/backend/swarmLeadershipWitness.mjs';
import { SwarmTaskJournal } from '../src/backend/swarmTaskCoordinator.mjs';
import { WitnessedTaskAdmission } from '../src/backend/witnessedTaskAdmission.mjs';
import { SwarmResourceRegistry } from '../src/backend/swarmResourceRegistry.mjs';
import { collectEsp32Resources } from '../src/backend/swarmResourceReporter.mjs';

test('physical board resource snapshot preserves degraded health in registry admission', {
  skip: process.env.PULSE_ESP32_TEST_URL ? false : 'Set PULSE_ESP32_TEST_URL to an explicitly selected board',
}, async t => {
  const origin = process.env.PULSE_ESP32_TEST_URL;
  const health = await collectEsp32Resources(origin);
  const resources = new SwarmResourceRegistry({ clusterId: 'hardware-resource-test' });
  resources.enroll({ nodeId: health.nodeName, capabilities: ['pmachine'] });
  resources.report(health.nodeName, {
    sequence: 1, status: health.status,
    estimatedFreeSlots: health.estimatedFreeSlots, freeMemoryBytes: health.freeMemoryBytes,
  });
  if (health.status === 'degraded') assert.deepEqual(resources.candidates(), []);
  else assert.deepEqual(resources.candidates()[0].codeIds, [], 'Discovery does not verify executable bundles');
  t.diagnostic(`Measured ${health.nodeName}: ${health.status}; degraded boards excluded; no fabricated bundle registration.`);
});

test('signed ESP32 computation recovers at a witnessed application checkpoint on JS', {
  skip: process.env.PULSE_ESP32_TEST_URL ? false : 'Set PULSE_ESP32_TEST_URL to an explicitly selected idle board',
}, async t => {
  const origin = process.env.PULSE_ESP32_TEST_URL;
  const statusResponse = await requestEsp32(new URL('/status', origin), { timeoutMs: 15000 });
  assert.equal(statusResponse.status, 200, await statusResponse.text());
  const identity = JSON.parse(await statusResponse.text());
  assert.ok(identity.nodeName, 'Board must identify itself');
  t.diagnostic(`Board ${identity.nodeName} at ${origin}: ${identity.status}, ${identity.freeHeap} free heap bytes`);
  // Admission here is test-harness controlled. Firmware does not yet enforce epochs.
  const esp32 = await createExecutionTarget('esp32', { origin });
  t.after(() => esp32.stop());
  const js = await createExecutionTarget('js');
  t.after(() => js.stop());
  const phases = [0, 1].map(counter => compileKotlinToPcode(`fun main() { println(${counter} + 1) }`));
  const codeId = createHash('sha256').update(JSON.stringify(phases)).digest('hex');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-hardware-recovery-'));
  const stores = [];
  let witness, journal;
  t.after(() => {
    witness?.close();
    journal?.close();
    stores.forEach(store => store.close());
    fs.rmSync(directory, { recursive: true });
  });
  for (const id of ['active', 'standby'])
    stores.push(new SwarmCheckpointStore({ id, filePath: path.join(directory, `${id}.bin`) }));
  let timestamp = Date.now();
  const now = () => timestamp;
  witness = new SwarmLeadershipWitness({
    filePath: path.join(directory, 'witness.jsonl'), clusterId: 'hardware-test',
    managerIds: ['active', 'standby'], pair: new SwarmCheckpointPair(stores),
    now, leaseMs: 100, initialize: true,
  });
  journal = new SwarmTaskJournal(path.join(directory, 'admission.jsonl'));
  const admission = new WitnessedTaskAdmission({ witness, journal, now, leaseMs: 200 });
  const oldLeader = witness.grant('active');
  const task = admission.submit(oldLeader, {
    clusterId: 'hardware-test', codeId, memoryBytes: 1024, state: { counter: 0 },
  });
  const resourceResponse = await requestEsp32(new URL('/pmachine/status', origin), { timeoutMs: 15000 });
  assert.equal(resourceResponse.status, 200, await resourceResponse.text());
  const resource = JSON.parse(await resourceResponse.text());
  const node = (nodeId, freeMemoryBytes) => ({
    nodeId, clusterId: 'hardware-test', status: 'online', codeIds: [codeId],
    capabilities: ['pmachine'], estimatedFreeSlots: 1, freeMemoryBytes, observedAt: timestamp,
  });
  const board = node('esp32-com9', resource.memoryPressure.freeHeapBytes);
  const oldWorker = admission.claim(oldLeader, task.id, [board]);
  assertExecution(await esp32.execute(phases[0]), ['1'], 'ESP32 committed phase');
  const committed = await admission.publish(oldLeader, oldWorker, 0, { counter: 1 });
  assert.equal(committed.sequence, 1);
  assertExecution(await esp32.execute(phases[1]), ['2'], 'ESP32 uncommitted phase');
  // Simulate loss of harness ownership, not a board power failure. Do not send
  // any more work to the old worker after this point.
  timestamp += 200;
  const replacementLeader = witness.grant('standby');
  const replacementWorker = admission.claim(replacementLeader, task.id, [
    node('esp32-com9', board.freeMemoryBytes), node('js-worker', 4096),
  ]);
  assert.equal(replacementWorker.owner, 'js-worker');
  assert.throws(() => admission.complete(replacementLeader, oldWorker, 2), /superseded/);
  const restored = await admission.restore(replacementLeader, replacementWorker);
  assert.equal(restored.degraded, false);
  assert.deepEqual(restored.state, { counter: 1 });
  assertExecution(await js.execute(phases[restored.state.counter]), ['2'], 'JS replay from committed state');
  await admission.publish(replacementLeader, replacementWorker, 1, { counter: 2 });
  admission.complete(replacementLeader, replacementWorker, 2);
  assert.equal(admission.get(task.id).status, 'completed');
  assert.equal(admission.get(task.id).result, 2);
  t.diagnostic('PASS: physical ESP32 execution -> witnessed application checkpoint -> JS recovery. No board crash or firmware epoch fencing tested.');
});
