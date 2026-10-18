import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentGraph } from '../../aggregator/public/service-deployment-model.mjs';

test('deployment visualization never treats registration as readiness', () => {
  const nodes = deploymentGraph({
    version: 1,
    processes: [{ id: 'mapper', name: 'Mapper', dependencies: ['librarian'], readiness: { ready: false, state: 'blocked' } }],
    instances: [
      { instanceId: 'remote-1', serviceId: 'catalog', status: 'registered' },
      { instanceId: 'expired', serviceId: 'storage', reporting: 'stale', readiness: { ready: true } },
    ],
  });
  assert.equal(nodes.find(node => node.id === 'instance:remote-1').state, 'unknown');
  assert.equal(nodes.find(node => node.id === 'instance:expired').state, 'stale');
  assert.equal(nodes.find(node => node.id === 'process:librarian').state, 'unobserved');
  assert.equal(nodes.find(node => node.id === 'process:mapper').state, 'blocked');
});

test('deployment visualization preserves explicit remote bindings', () => {
  const nodes = deploymentGraph({
    version: 1, processes: [],
    instances: [{ instanceId: 'map-1', serviceId: 'mapper', readiness: { ready: true },
      dependencies: { catalog: { instanceId: 'catalog-esp32', endpoint: 'http://192.168.2.90' } } }],
  });
  assert.deepEqual(nodes[0].dependencies, ['instance:catalog-esp32']);
  assert.equal(nodes[1].state, 'unobserved');
  assert.throws(() => deploymentGraph({}), /Invalid/);
});

test('reported local readiness cannot hide a blocked aggregator dependency decision', () => {
  const nodes = deploymentGraph({
    version: 1, processes: [],
    instances: [{ instanceId: 'board', serviceId: 'catalog', reporting: 'fresh',
      readiness: { ready: true }, dependencyChainReady: false }],
  });
  assert.equal(nodes[0].state, 'blocked');
});
