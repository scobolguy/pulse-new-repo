import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSchemaBranchCache } from '../../aggregator/src/librarian/schema-branch-cache.mjs';

function page(nodeId = 'n0', extra = {}) {
  return {
    schemaKey: '1'.repeat(64), revision: '2'.repeat(64), nodeId,
    node: { name: nodeId, nodeId, childCount: 1 },
    items: [{ name: 'Child', nodeId: `${nodeId}.0`, childCount: 1 }],
    nextCursor: null, ...extra,
  };
}

test('branches load only on expansion and collapsing removes descendants and cancels late replies', async () => {
  const requests = [];
  let finish;
  const cache = createSchemaBranchCache(async request => {
    requests.push(request);
    if (request.nodeId === 'n0.0.0') return new Promise(resolve => { finish = resolve; });
    return page(request.nodeId);
  });
  assert.equal(requests.length, 0);
  await cache.expand('schema', { path: 'schema.json' });
  assert.equal(requests.length, 1);
  await cache.expand('schema', { path: 'schema.json', nodeId: 'n0.0', revision: '2'.repeat(64) });
  const loading = cache.expand('schema', { path: 'schema.json', nodeId: 'n0.0.0' });
  cache.collapse('schema', 'n0.0');
  assert.equal(requests[2].signal.aborted, true);
  finish(page('n0.0.0'));
  await loading;
  assert.equal(cache.get('schema', 'n0.0'), undefined);
  assert.equal(cache.get('schema', 'n0.0.0'), undefined);
  assert.equal(cache.status().entries, 1);
  cache.collapse('schema');
  assert.equal(cache.status().bytes, 0);
  await cache.expand('schema', { path: 'schema.json' });
  assert.equal(requests.length, 4, 're-expansion must reload evicted data');
});

test('paging replaces rather than accumulates sibling pages and discards expanded descendants', async () => {
  const cache = createSchemaBranchCache(async request => page(request.nodeId, {
    nextCursor: request.cursor === '1' ? null : '1',
    items: [{ nodeId: `${request.nodeId}.${request.cursor || '0'}`, name: 'Child', childCount: 1 }],
  }));
  await cache.expand('schema', {});
  await cache.expand('schema', { nodeId: 'n0.0' });
  await cache.expand('schema', { cursor: '1' });
  assert.equal(cache.status().entries, 1);
  assert.equal(cache.get('schema').page.items[0].nodeId, 'n0.1');
  assert.equal(cache.get('schema').cursor, '1');
});

test('shared cache stays within its byte limit and explicitly evicts unrelated branches', async () => {
  const cache = createSchemaBranchCache(async request => page(request.nodeId, {
    node: { ...page(request.nodeId).node, description: 'x'.repeat(800) },
  }), { maxBytes: 1500 });
  await cache.expand('first', {});
  await cache.expand('second', {});
  assert.equal(cache.get('first'), undefined);
  assert.ok(cache.get('second').page);
  assert.ok(cache.status().bytes <= 1500);
  assert.match(cache.status().notice, /collapsed/);
  cache.clear();
  assert.deepEqual(cache.status(), { bytes: 0, entries: 0, notice: '' });
});

test('invalid, oversized and stale pages become visible errors rather than success-shaped data', async () => {
  for (const response of [
    page('wrong'),
    page('n0', { revision: '3'.repeat(64) }),
    page('n0', { node: { ...page().node, description: 'x'.repeat(2000) } }),
  ]) {
    const cache = createSchemaBranchCache(async () => response);
    await cache.expand('schema', { revision: '2'.repeat(64) });
    assert.ok(cache.get('schema').error);
    assert.equal(cache.get('schema').page, undefined);
    assert.equal(cache.status().bytes, 0);
  }
});
