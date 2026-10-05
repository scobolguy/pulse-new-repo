import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildServicesDirectory } from '../../aggregator/src/backend/modules/servicesDirectory.mjs';

test('directory includes catalog, runtime, and all named services from node registries', async () => {
  const requests = [];
  const result = await buildServicesDirectory({
    catalog: { serviceOfferings: [{ id: 'broker', name: 'Broker' }] },
    instances: [{ instanceId: 'worker-1', serviceName: 'worker', ip: '127.0.0.1', port: 4100 }],
    nodes: [{ nodeId: 'esp', ip: '192.168.2.115', details: { hardware: 'ESP32' } }],
    collectorUrls: ['http://192.168.2.115', 'http://127.0.0.1:4000'],
    origin: 'http://127.0.0.1:4000',
    fetchImpl: async url => {
      requests.push(url);
      return Response.json({ services: [
        { serviceId: 'blink10', enabled: true }, { serviceId: 'factorialService', enabled: true }
      ] });
    }
  });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.services.map(service => service.serviceId).sort(), ['blink10', 'broker', 'factorialService', 'worker']);
  assert.equal(result.services.find(service => service.serviceId === 'blink10').endpoint,
    'http://192.168.2.115/api/service/blink10');
  assert.equal(requests.length, 1);
});

test('unreachable registries are explicit without hiding other services', async () => {
  const result = await buildServicesDirectory({
    catalog: { serviceOfferings: [{ id: 'broker', name: 'Broker' }] },
    collectorUrls: ['http://192.168.2.115'],
    fetchImpl: async () => { throw new Error('unreachable'); }
  });

  assert.equal(result.status, 'degraded');
  assert.equal(result.services.length, 1);
  assert.deepEqual(result.errors, [{ endpoint: 'http://192.168.2.115/api/services', error: 'unreachable' }]);
});

test('configured Pascalish host remains queryable when discovery has no nodes', async () => {
  const result = await buildServicesDirectory({
    catalog: { serviceOfferings: [
      { id: 'collector', name: 'Collector', provider: 'pascalish', endpoint: 'http://192.168.2.115' }
    ] },
    fetchImpl: async url => {
      assert.equal(url, 'http://192.168.2.115/api/services');
      return Response.json({ services: [{ serviceId: 'factorialService' }] });
    }
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.services.find(service => service.serviceId === 'factorialService').ip, '192.168.2.115');
});
