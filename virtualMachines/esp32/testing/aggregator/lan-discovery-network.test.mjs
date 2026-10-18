import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import http from 'node:http';
import { test } from 'node:test';
import {
  attachDiscoveryResponder, boundHttpDiscoveryListeners, createLanDiscovery, ipv4InterfaceFacts,
} from '../../aggregator/src/service-lifecycle/lan-discovery.mjs';

test('real local IPv4 broadcast bootstrap learns an ephemeral HTTP endpoint with only the UDP port', {
  skip: process.env.PULSE_TEST_LAN_DISCOVERY !== '1', timeout: 90000,
}, async t => {
  if (!ipv4InterfaceFacts().some(item => !item.internal)) {
    t.skip('No LAN-visible IPv4 interface');
    return;
  }
  const server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end('{"status":"test-aggregator"}');
  });
  const socket = dgram.createSocket('udp4');
  let responder;
  let client;
  t.after(async () => {
    if (client) await client.stop();
    if (responder) await responder.stop();
    await new Promise((resolve, reject) => {
      try { socket.close(resolve); }
      catch (error) {
        if (error.code === 'ERR_SOCKET_DGRAM_NOT_RUNNING') resolve();
        else reject(error);
      }
    });
    server.closeAllConnections();
    if (server.listening) await new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(0, '0.0.0.0', () => {
      socket.removeListener('error', reject);
      resolve();
    });
  });
  socket.setBroadcast(true);
  const warnings = [];
  const logger = { warn: message => warnings.push(message), error: message => warnings.push(message) };
  responder = await attachDiscoveryResponder({
    socket, aggregatorId: 'discovery-network-fixture',
    getListeners: () => boundHttpDiscoveryListeners(server.address()), logger,
  });
  let received;
  const result = new Promise(resolve => { received = resolve; });
  client = await createLanDiscovery({
    nodeId: 'discovery-network-test-node', bootId: 'discovery-network-test-boot',
    port: socket.address().port, logger,
    onTargets: async targets => {
      const target = targets.find(item => item.aggregatorId === 'discovery-network-fixture');
      if (target) received(target);
    },
  });
  await client.start();
  let timeout;
  try {
    const target = await Promise.race([
      result,
      new Promise((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`LAN broadcast did not produce a reply: ${warnings.join('; ')}`)), 20000);
      }),
    ]);
    assert.equal(Number(new URL(target.endpoint).port), server.address().port);
    assert.notEqual(new URL(target.endpoint).hostname, '127.0.0.1');
    const response = await fetch(target.endpoint, { signal: AbortSignal.timeout(5000) });
    assert.deepEqual(await response.json(), { status: 'test-aggregator' });
  } finally {
    clearTimeout(timeout);
  }
});
