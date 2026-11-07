import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import test from 'node:test';
import { parseSwarmNodes, loadSwarmNodes } from '../out/swarmBackend.js';

const node = (id, overrides = {}) => ({
  nodeId: id, nodeName: id, ip: '192.0.2.1', available: true, draining: false,
  details: { runtime: 'js-pmachine', services: ['js-pmachine'] }, ...overrides,
});

test('Swarm lists only explicitly available, non-draining p-code nodes', () => {
  assert.deepEqual(parseSwarmNodes([
    node('z'), node('a', { port: 4111 }),
    node('offline', { available: false }), node('unknown', { available: undefined }),
    node('draining', { draining: true }), node('stopped', { status: 'offline' }),
    node('service-only', { details: { services: ['data-librarian'] } }),
    node('no-address', { ip: '' }),
    node('nested-unavailable', { availability: { available: false } }),
  ]).map(item => item.id), ['a', 'z']);
});

test('Swarm handles capability objects, nested availability, identities, IPv6 and deduplication', () => {
  const input = node('id', {
    ip: '::1', port: 4111, nodeName: 'Node',
    available: false, availability: { available: true, draining: false },
    details: { hardware: 'JavaScript', services: [{ serviceName: 'js-pmachine' }] },
  });
  assert.deepEqual(parseSwarmNodes({ nodes: [input, input] }), [{
    id: 'id', name: 'Node', address: '[::1]:4111', runtime: 'JavaScript',
  }]);
  assert.deepEqual(parseSwarmNodes([]), []);
  for (const payload of [{}, { nodes: null }, [null], ['bad']])
    assert.throws(() => parseSwarmNodes(payload), /discovery response/);
});

test('Swarm fetches the PMachine inventory and surfaces HTTP and payload errors', async () => {
  let status = 200, payload = [node('one')];
  const server = http.createServer((request, response) => {
    assert.equal(request.url, '/api/pmachine/nodes');
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(payload));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;
    assert.equal((await loadSwarmNodes(url))[0].id, 'one');
    status = 503;
    await assert.rejects(loadSwarmNodes(url), /HTTP 503/);
    status = 200; payload = {};
    await assert.rejects(loadSwarmNodes(url), /does not contain nodes/);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Swarm is contributed to the Pulse sidebar with a refresh action', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(manifest.contributes.views.pulseCatalogStudio.some(view =>
    view.id === 'pulseCatalogStudio.swarm' && view.name === 'Swarm' && view.type === 'tree'));
  assert.ok(manifest.contributes.commands.some(command => command.command === 'pulse-pmachine.refreshSwarm'));
  assert.ok(manifest.contributes.menus['view/title'].some(item =>
    item.command === 'pulse-pmachine.refreshSwarm' && item.when === 'view == pulseCatalogStudio.swarm'));
});
