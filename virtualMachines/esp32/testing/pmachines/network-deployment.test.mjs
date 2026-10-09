import assert from 'node:assert/strict';
import os from 'node:os';
import { test } from 'node:test';
import { installNetworkCollectors } from '../../pmachines/javascript/install-network-collectors.mjs';
import { installPulseNodeCollector } from '../../pmachines/javascript/install-pulse-node-collector.mjs';

const lanInterface = Object.values(os.networkInterfaces()).flat()
  .find(item => item.family === 'IPv4' && !item.internal)?.address;
const config = {
  esp32Origin: 'http://192.168.2.115', lanInterface,
  kasaPeers: ['192.168.2.28', '192.168.2.29'],
  kasaHttpPort: 4309, tuyaHttpPort: 4307, ssdpHttpPort: 4308,
  tuyaUdpPort: 6667, ssdpUdpPort: 1900
};

function transport({ existing = false, failCollector = '' } = {}) {
  const installs = [], stops = [], uploads = [];
  async function fetchImpl(url, options) {
    assert.ok(options.signal);
    if (url.pathname === '/ffs/upload') {
      uploads.push(Object.fromEntries(options.body));
      return new Response('File uploaded');
    }
    if (url.pathname.endsWith('/status')) return new Response('{}', { status: existing ? 200 : 404 });
    const fields = Object.fromEntries(options.body);
    if (url.pathname.endsWith('/stop')) {
      stops.push(url.searchParams.get('collectorId'));
      return Response.json({ running: false });
    }
    if (url.pathname.endsWith('/install')) {
      installs.push(fields);
      if (fields.collectorId === failCollector) return new Response('bind failed', { status: 503 });
      return Response.json({
        collectorId: fields.collectorId, running: true, httpPort: Number(fields.httpPort),
        daemonDiagnostics: [{ udpPort: 0 }]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }
  return { fetchImpl, installs, stops, uploads };
}

test('network deployment uploads signed service and three daemon contexts with their port grants', async () => {
  const mock = transport();
  const result = await installNetworkCollectors({ config, ...mock, logger: { log() {} } });
  assert.deepEqual(result.collectorIds, ['kasa-js', 'tuya-js', 'ssdp-js']);
  assert.equal(mock.uploads.length, 8);
  assert.deepEqual(mock.installs.map(item => item.httpPort), ['4309', '4307', '4308']);
  assert.ok(mock.installs.every(item => item.additional === 'true'));
  const ssdp = JSON.parse(mock.installs[2].daemons)[0];
  assert.equal(ssdp.multicastInterface, lanInterface);
  assert.equal(ssdp.multicastGroup, '239.255.255.250');
  assert.equal(ssdp.udpPort, 1900);
  assert.ok(mock.uploads.filter(item => item.file.endsWith('.map.json'))
    .every(item => /^[a-f0-9]{64}$/.test(JSON.parse(item.body).signing?.signature)));
});

test('network deployment refuses existing contexts without installing replacements', async () => {
  const mock = transport({ existing: true });
  await assert.rejects(installNetworkCollectors({ config, ...mock }), /already installed/);
  assert.equal(mock.installs.length, 0);
  assert.equal(mock.stops.length, 0);
});

test('network deployment rolls back only contexts it installed on a partial failure', async () => {
  const mock = transport({ failCollector: 'ssdp-js' });
  await assert.rejects(installNetworkCollectors({ config, ...mock, logger: { log() {} } }), /503.*bind failed/);
  assert.deepEqual(mock.stops, ['tuya-js', 'kasa-js']);
});

test('Pulse collector installs its signed service, declared tables and shared UDP daemon without stopping other contexts', async () => {
  const uploads = [];
  let install;
  const status = await installPulseNodeCollector({
    fetchImpl: async (url, options) => {
      assert.ok(options.signal);
      if (url.pathname.endsWith('/status')) return Response.json({ running: false });
      if (url.pathname === '/ffs/upload') {
        uploads.push(Object.fromEntries(options.body));
        return new Response('File uploaded');
      }
      assert.equal(url.pathname, '/pmachine/service_host/install');
      install = Object.fromEntries(options.body);
      return Response.json({ running: true, collectorId: 'pulse-node-collector' });
    }
  });
  assert.equal(status.running, true);
  assert.equal(uploads.length, 4);
  assert.ok(JSON.parse(uploads[1].body).hostTables.length);
  assert.ok(JSON.parse(uploads[1].body).signing.signature);
  assert.equal(install.udpPort, '0');
  assert.deepEqual(JSON.parse(install.daemons).map(item => [item.udpPort, item.udpShared]), [[4210, true]]);
});

test('Pulse collector refuses occupied or unknown primary status before uploading', async () => {
  for (const status of [{ running: true }, {}]) {
    let calls = 0;
    await assert.rejects(installPulseNodeCollector({
      fetchImpl: async url => {
        calls++;
        assert.equal(url.pathname, '/pmachine/service_host/status');
        return Response.json(status);
      }
    }), /occupied|unknown/);
    assert.equal(calls, 1);
  }
});
