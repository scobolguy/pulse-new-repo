import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SwarmResourceRegistry } from '../src/backend/swarmResourceRegistry.mjs';

const codeId = 'a'.repeat(64);
const report = { sequence: 1, status: 'online', estimatedFreeSlots: 1, freeMemoryBytes: 4096 };
function fixture() {
  let timestamp = 1000;
  const registry = new SwarmResourceRegistry({ clusterId: 'swarm-a', now: () => timestamp, maxAgeMs: 100 });
  registry.enroll({ nodeId: 'board-a', capabilities: ['pmachine'] });
  return { registry, advance(ms) { timestamp += ms; } };
}

test('only enrolled, measured and fresh online nodes produce candidates', () => {
  const f = fixture();
  assert.deepEqual(f.registry.candidates(), []);
  assert.throws(() => f.registry.report('other', report), /not enrolled/);
  f.registry.report('board-a', report);
  assert.deepEqual(f.registry.candidates()[0].codeIds, []);
  f.registry.verifyBundle('board-a', codeId);
  assert.deepEqual(f.registry.candidates()[0].codeIds, [codeId]);
  f.advance(100);
  assert.equal(f.registry.candidates().length, 1);
  f.advance(1);
  assert.deepEqual(f.registry.candidates(), []);
  f.registry.report('board-a', { ...report, sequence: 2, status: 'degraded' });
  assert.deepEqual(f.registry.candidates(), []);
  f.registry.report('board-a', { ...report, sequence: 3, status: 'offline' });
  assert.deepEqual(f.registry.candidates(), []);
});

test('out-of-order reports cannot refresh liveness or replace measured capacity', () => {
  const f = fixture();
  f.registry.report('board-a', report);
  f.advance(99);
  assert.throws(() => f.registry.report('board-a', report), /Stale/);
  assert.throws(() => f.registry.report('board-a', { ...report, sequence: 0 }), /Stale/);
  f.advance(2);
  assert.equal(f.registry.candidates().length, 0);
});

test('resource snapshots are isolated and bundle revocation removes compatibility', () => {
  const f = fixture();
  f.registry.verifyBundle('board-a', codeId);
  f.registry.report('board-a', report);
  const snapshot = f.registry.candidates()[0];
  snapshot.codeIds.push('b'.repeat(64));
  snapshot.capabilities.length = 0;
  snapshot.freeMemoryBytes = 99999;
  assert.equal(f.registry.candidates()[0].freeMemoryBytes, 4096);
  assert.deepEqual(f.registry.candidates()[0].capabilities, ['pmachine']);
  assert.deepEqual(f.registry.candidates()[0].codeIds, [codeId]);
  f.registry.revokeBundle('board-a', codeId);
  assert.deepEqual(f.registry.candidates()[0].codeIds, []);
  assert.throws(() => f.registry.revokeBundle('board-a', codeId), /not verified/);
});

test('missing/invalid measurements are errors, never invented capacity', () => {
  const f = fixture();
  for (const changes of [
    { sequence: NaN }, { freeMemoryBytes: undefined }, { estimatedFreeSlots: undefined },
    { status: undefined }, { estimatedFreeSlots: -1 }, { estimatedFreeSlots: 1.5 },
    { freeMemoryBytes: 2 ** 40 },
  ]) assert.throws(() => f.registry.report('board-a', { ...report, ...changes }), /Invalid|Explicit/);
  assert.equal(f.registry.candidates().length, 0);
  f.registry.report('board-a', { ...report, estimatedFreeSlots: 0, freeMemoryBytes: 0 });
  assert.equal(f.registry.candidates()[0].estimatedFreeSlots, 0);
  assert.equal(f.registry.candidates()[0].freeMemoryBytes, 0);
  assert.throws(() => f.registry.verifyBundle('board-a', 'not a hash'), /SHA-256/);
});

test('registry bounds and clock rollback fail explicitly', () => {
  const registry = new SwarmResourceRegistry({ clusterId: 'swarm-a', maxNodes: 1 });
  registry.enroll({ nodeId: 'board-a', capabilities: ['pmachine'] });
  assert.throws(() => registry.enroll({ nodeId: 'board-a', capabilities: ['pmachine'] }), /already/);
  assert.throws(() => registry.enroll({ nodeId: 'board-b', capabilities: ['pmachine'] }), /capacity/);
  for (let index = 0; index < 128; index += 1)
    registry.verifyBundle('board-a', index.toString(16).padStart(64, '0'));
  assert.throws(() => registry.verifyBundle('board-a', codeId), /capacity/);
  const f = fixture();
  f.registry.report('board-a', report);
  f.advance(-1);
  assert.throws(() => f.registry.report('board-a', { ...report, sequence: 2 }), /backwards/);
  assert.throws(() => f.registry.candidates(), /backwards/);
});
