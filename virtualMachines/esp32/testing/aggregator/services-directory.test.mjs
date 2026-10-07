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

test('same-named registry services retain distinct endpoints and registration IDs without instance IDs', async () => {
  const result = await buildServicesDirectory({
    catalog: {},
    collectorUrls: ['http://127.0.0.1:4111'],
    fetchImpl: async () => Response.json({ services: [
      { serviceId: 'device-cache', endpoint: 'http://127.0.0.1:4307/' },
      { serviceId: 'device-cache', endpoint: 'http://127.0.0.1:4308/' },
      { serviceId: 'worker', id: 'worker-1', endpoint: '/worker' },
      { serviceId: 'worker', id: 'worker-2', endpoint: '/worker' }
    ] })
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.services.length, 4);
  assert.equal(new Set(result.services.map(service => service.id)).size, 4);
  assert.deepEqual(result.services.filter(service => service.serviceId === 'device-cache').map(service => service.endpoint).sort(),
    ['http://127.0.0.1:4307/', 'http://127.0.0.1:4308/']);
});

  test('any announced node service is visible even when its registry is unavailable', async () => {
    const result = await buildServicesDirectory({
      catalog: {}, nodes: [{
        nodeId: 'sensor', ip: '127.0.0.1', port: 4120,
        details: { runtime: 'sensor-runtime', services: [
          'temperature', { name: 'telemetry', endpoint: '/telemetry' }
        ] }
      }],
      fetchImpl: async () => Response.json({}, { status: 404 })
    });
    assert.equal(result.status, 'degraded');
    assert.deepEqual(result.services.map(service => service.serviceId).sort(), ['telemetry', 'temperature']);
    assert.equal(result.services.find(service => service.serviceId === 'telemetry').endpoint,
      'http://127.0.0.1:4120/telemetry');
  });

  test('node registries preserve runtime, service and daemon endpoints and instance identities', async () => {
    const result = await buildServicesDirectory({
      catalog: {}, nodes: [{
        nodeId: 'js-node', ip: '127.0.0.1', port: 4111,
        details: { runtime: 'js-pmachine', services: ['device-cache'] }
      }],
      fetchImpl: async () => Response.json({ services: [
        { serviceId: 'pmachine', provider: 'javascript', kind: 'runtime', endpoint: '/pmachine/execute_file' },
        { serviceId: 'device-cache', instanceId: 'tuya-js', kind: 'service', endpoint: 'http://127.0.0.1:4307/' },
        { serviceId: 'device-cache', instanceId: 'ssdp-js', kind: 'service', endpoint: 'http://127.0.0.1:4308/' },
        { serviceId: 'tuya-collector', kind: 'daemon', endpoint: '/pmachine/service_host/status?collectorId=tuya-js' }
      ] })
    });
    assert.equal(result.services.length, 4);
    assert.equal(result.services.find(service => service.serviceId === 'pmachine').provider, 'javascript');
    assert.equal(result.services.find(service => service.instanceId === 'tuya-js').endpoint, 'http://127.0.0.1:4307/');
    assert.equal(result.services.find(service => service.serviceId === 'tuya-collector').kind, 'daemon');
    assert.ok(result.services.every(service => service.source === 'node-registry'));
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

test('server catalog includes infrastructure while repeated service instances retain distinct identities', async () => {
    const result = await buildServicesDirectory({
      catalog: {
        servers: [{ id: 'host', name: 'Local host' }],
        serviceOfferings: [
          { id: 'rabbit', name: 'RabbitMQ', kind: 'messaging', provider: 'rabbitmq' },
          { id: 'gateway', name: 'Gateway', kind: 'api' }
        ],
        dataStores: [{ id: 'sql', name: 'MSSQL', kind: 'database', provider: 'mssql' }]
      },
      instances: [
        { instanceId: 'worker-1', serviceName: 'worker', ip: '127.0.0.1', port: 4111 },
        { instanceId: 'worker-2', serviceName: 'worker', ip: '127.0.0.1', port: 4112 }
      ],
      collectorUrls: ['http://127.0.0.1:4113'],
      fetchImpl: async () => Response.json({ services: [
        { serviceId: 'collector', instanceId: 'collector-1' },
        { serviceId: 'collector', instanceId: 'collector-2' }
      ] })
    });
    assert.deepEqual(result.servers.map(server => server.name), ['Local host', 'MSSQL', 'RabbitMQ']);
    assert.equal(result.services.filter(service => service.serviceId === 'worker').length, 2);
    const collectors = result.services.filter(service => service.serviceId === 'collector');
    assert.equal(collectors.length, 2);
    assert.notEqual(collectors[0].id, collectors[1].id);
});
