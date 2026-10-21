import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { executeProgram, parsePcode, parseProgramMapMappings } from '../../pmachines/javascript/src/runtime.mjs';
import { createJsonObjectBindings } from '../../pmachines/javascript/src/json-object-bindings.mjs';
import { createJsonCollectionBindings } from '../../pmachines/javascript/src/json-collection-bindings.mjs';
import { createNetworkBindings } from '../../pmachines/javascript/src/network-bindings.mjs';
import { createBoundedTextBindings } from '../../pmachines/javascript/src/bounded-text.mjs';
import { PMachineMemory, PMachineMemoryError } from '../../pmachines/javascript/src/memory.mjs';

const source = await fs.readFile(new URL('../../src/service-lifecycle/discovery.pas', import.meta.url), 'utf8');
const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
const instructions = parsePcode(compiled.pcodeText);
const mappingsById = parseProgramMapMappings(compiled.programMap);
const mutations = new Set(['host.json_merge', 'host.json_set', 'host.json_embed', 'host.json_array_append']);

async function dispatch(route, input, memoryManager) {
  const json = { ...createJsonObjectBindings(), ...createJsonCollectionBindings() };
  const handlers = {
    ...json, ...createNetworkBindings(), ...createBoundedTextBindings(),
    'host.event_body': () => JSON.stringify(input),
    'host.event_method': () => 'POST',
    'host.event_path': () => route,
    'host.json_has': (text, key) => Number(Object.hasOwn(JSON.parse(text), key)),
    'host.raise_error': message => { throw new Error(message); },
  };
  const metrics = { calls: 0, inputBytes: 0, rewrites: 0, rewrittenBytes: 0 };
  const result = await executeProgram({
    instructions, mappingsById, opcodeMap: new Map(),
    runtimeContext: { maxSteps: 100000, memoryManager, callHost(name, args) {
      assert.equal(typeof handlers[name], 'function', name);
      const value = handlers[name](...args);
      if (name.startsWith('host.json_')) {
        ++metrics.calls;
        metrics.inputBytes += args.filter(arg => typeof arg === 'string')
          .reduce((sum, arg) => sum + Buffer.byteLength(arg), 0);
        if (mutations.has(name)) {
          ++metrics.rewrites;
          metrics.rewrittenBytes += Buffer.byteLength(value);
        }
      }
      return value;
    } },
    debugLogger() {},
  });
  return { body: result.response, metrics };
}

test('discovery runs under a JS VM budget and releases tracked storage on failure and success', async () => {
  const denied = new PMachineMemory({ limitBytes: 64 });
  await assert.rejects(dispatch('/settings', {}, denied), PMachineMemoryError);
  assert.equal(denied.diagnostics().usedBytes, 0);
  assert.equal(denied.diagnostics().liveScopes, 0);
  assert.ok(denied.diagnostics().allocationFailures > 0);

  const memory = new PMachineMemory({ limitBytes: 32768 });
  for (let invocation = 0; invocation < 10; ++invocation) {
    const { body } = await dispatch('/advertise', {
      nodeId: 'esp32-vm-2bf4', localAddress: '192.168.2.63',
      listeners: [{ protocol: 'http', host: '192.168.2.63', port: 80 }],
      metadata: { hardware: 'ESP32', runtime: 'esp32-pmachine', services: ['pmachine'] },
    }, memory);
    assert.equal(body.ok, true);
    assert.equal(body.endpoint, 'http://192.168.2.63:80');
    assert.equal(memory.diagnostics().usedBytes, 0);
    assert.equal(memory.diagnostics().liveScopes, 0);
    assert.equal(memory.diagnostics().allocationFailures, 0);
  }
});

test('discovery advertise JSON work and exact packet shape', async () => {
  const input = {
    nodeId: 'esp32-vm-2bf4', localAddress: '192.168.2.63',
    listeners: [{ protocol: 'http', host: '192.168.2.63', port: 80 }],
    metadata: { hardware: 'ESP32', runtime: 'esp32-pmachine', services: ['pmachine'] },
  };
  const { body, metrics } = await dispatch('/advertise', input);
  assert.deepEqual(body, {
    ok: true, packet: {
      kind: 'nodeBeacon', status: 'here', available: true, nodeId: input.nodeId, nodeName: input.nodeId,
      ip: input.localAddress, httpPort: 80, port: 80, protocol: 'http', ...input.metadata,
    },
    endpoint: 'http://192.168.2.63:80', listeners: input.listeners,
  });
  // Original policy: 58 JSON calls, 6655 input bytes, 19 rewrites.
  assert.ok(metrics.calls <= 40, JSON.stringify(metrics));
  assert.ok(metrics.inputBytes <= 5115, JSON.stringify(metrics));
  assert.ok(metrics.rewrites <= 16, JSON.stringify(metrics));
  assert.ok(metrics.rewrittenBytes <= 2703, JSON.stringify(metrics));
});

test('discovery request JSON work and exact packet shape', async () => {
  const { body, metrics } = await dispatch('/request', {
    requestId: 'nonce', nodeId: 'esp32-vm-2bf4', bootId: 'boot', nowMs: 100, jitterMs: 7,
  });
  assert.deepEqual(body, {
    ok: true,
    packet: { kind: 'pulseDiscoveryRequest', version: 1, requestId: 'nonce', nodeId: 'esp32-vm-2bf4', bootId: 'boot' },
    nextAt: 5107,
  });
  // Original policy: 27 JSON calls, 2175 input bytes, 8 rewrites.
  assert.ok(metrics.calls <= 20, JSON.stringify(metrics));
  assert.ok(metrics.inputBytes <= 1644, JSON.stringify(metrics));
  assert.ok(metrics.rewrites <= 6, JSON.stringify(metrics));
});

test('advertisement preserves escaping, optional metadata, wildcard listeners and validation', async () => {
  const nodeId = 'node"\\\n\u540d';
  const input = {
    nodeId, localAddress: '192.0.2.3',
    listeners: [{ protocol: 'https', host: '0.0.0.0', port: 8443, extra: 'retained' }],
    metadata: { hardware: 'board"\\', runtime: 'runtime\n', services: ['quoted"'], ignored: 'not advertised' },
  };
  const { body } = await dispatch('/advertise', input);
  assert.deepEqual(body, {
    ok: true,
    packet: {
      kind: 'nodeBeacon', status: 'here', available: true, nodeId, nodeName: nodeId,
      ip: input.localAddress, httpPort: 8443, port: 8443, protocol: 'https',
      hardware: input.metadata.hardware, runtime: input.metadata.runtime, services: input.metadata.services,
    },
    endpoint: 'https://192.0.2.3:8443',
    listeners: [{ ...input.listeners[0], host: input.localAddress }],
  });
  const withoutMetadata = await dispatch('/advertise', { ...input, metadata: {} });
  assert.equal(Object.hasOwn(withoutMetadata.body.packet, 'hardware'), false);
  const noMetadata = { ...input };
  delete noMetadata.metadata;
  assert.deepEqual((await dispatch('/advertise', noMetadata)).body, withoutMetadata.body);
  for (const change of [{ nodeId: '' }, { nodeId: 1 }, { nodeId: 'x'.repeat(129) },
    { localAddress: '127.0.0.1' }, { listeners: [] },
    { listeners: [{ protocol: 'http', host: input.localAddress, port: 0 }] },
    { listeners: [{ protocol: 'http', host: input.localAddress, port: 65536 }] }]) {
    assert.equal((await dispatch('/advertise', { ...input, ...change })).body.ok, false);
  }
  await assert.rejects(dispatch('/advertise', { ...input, metadata: { hardware: 1 } }), /Expected string/);
});

test('poll uses literal responses without rewriting them and keeps exact deadline behavior', async () => {
  for (const [nextAt, nowMs, send] of [[-1, 0, true], [100, 99, false], [100, 100, true]]) {
    const { body, metrics } = await dispatch('/poll', { nextAt, nowMs });
    assert.deepEqual(body, { ok: true, send });
    assert.equal(metrics.rewrites, 1); // Only validation of the incoming object.
  }
});

test('request retains escaped identities and rejects invalid jitter bounds', async () => {
  const input = { requestId: '"\\', nodeId: '\u540d', bootId: 'boot\n', nowMs: 0, jitterMs: 0 };
  const { body } = await dispatch('/request', input);
  assert.deepEqual(body.packet, {
    kind: 'pulseDiscoveryRequest', version: 1,
    requestId: input.requestId, nodeId: input.nodeId, bootId: input.bootId,
  });
  for (const jitterMs of [-1, 1001]) {
    assert.deepEqual((await dispatch('/request', { ...input, jitterMs })).body,
      { ok: false, error: 'Invalid discovery jitter' });
  }
});
