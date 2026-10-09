import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerRuntimeRegistryRoutes } from '../../aggregator/src/backend/roles/runtimeRegistryRoutes.mjs';
import { createRouteManifestDependencyFactories } from '../../aggregator/src/backend/modules/routeManifestDependencies.mjs';

test('gateway services route exposes Librarian, Mapper, servers and discovered runtime instances', async () => {
  const routes = new Map();
  const app = {
    get(route, ...handlers) { routes.set(route, handlers.at(-1)); },
    post() {}, put() {}, delete() {},
  };
  const discoveredNodes = new Map([['js', { nodeId: 'js-test', ip: '127.0.0.1', port: 49999, details: { runtime: 'js-pmachine' } }]]);
  const serviceInstanceRegistry = new Map([['worker', { instanceId: 'worker-test', serviceName: 'worker', nodeId: 'js-test' }]]);
  const factory = createRouteManifestDependencyFactories({ discoveredNodes, serviceInstanceRegistry });
  assert.equal(factory.runtimeRegistry().discoveredNodes, discoveredNodes);
  registerRuntimeRegistryRoutes(app, { ...factory.runtimeRegistry(), requirePermission: () => () => {} });
  const originalFetch = globalThis.fetch;
  const originalCollectors = process.env.PULSE_DISCOVERY_COLLECTOR_URLS;
  const originalMode = process.env.PULSE_DISCOVERY_MODE;
  process.env.PULSE_DISCOVERY_MODE = 'local';
  process.env.PULSE_DISCOVERY_COLLECTOR_URLS = '';
  globalThis.fetch = async () => Response.json({ services: [{ serviceId: 'named-service', enabled: true }] });
  let result;
  try {
    await routes.get('/api/services')({ protocol: 'http', get: () => '127.0.0.1:4000' }, {
      json(body) { result = body; },
      status(code) { assert.fail(`Unexpected HTTP ${code}`); },
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.services.some(service => service.serviceId === 'service.librarian'
      && service.name === 'Pulse Data Librarian' && service.endpoint === 'http://127.0.0.1:4300'), true);
    assert.equal(result.services.some(service => service.serviceId === 'service.mapper'), true);
    assert.equal(result.services.some(service => service.serviceId === 'worker'), true);
    assert.equal(result.services.some(service => service.serviceId === 'named-service' && service.nodeId === 'js-test'), true);
    assert.equal(result.servers.some(server => server.name === 'Local Pulse Workspace'), true);
    assert.deepEqual(result.errors, []);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of [['PULSE_DISCOVERY_COLLECTOR_URLS', originalCollectors], ['PULSE_DISCOVERY_MODE', originalMode]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
