import assert from 'node:assert/strict';

const baseUrl = process.env.PULSE_AGENT_BASE_URL || 'http://127.0.0.1:4000';

async function ask(message) {
  const body = new FormData();
  body.set('message', message);
  const response = await fetch(`${baseUrl}/agent`, {
    method: 'POST',
    headers: { 'x-agent-test': '1' },
    body,
  });
  assert.equal(response.status, 200, `${message}: expected HTTP 200`);
  return response.json();
}

const topology = await ask('show me the topology');
assert.equal(topology._intentId, 'topology');
assert.ok(!String(topology.output).trim().startsWith('<'), 'Default topology should be plain text');
assert.match(topology.output, /nodes?, \d+ roots?/i);

const liveTopology = await ask('show me the network as a mermaid diagram');
assert.equal(liveTopology._intentId, 'topology-live');
assert.match(liveTopology.output, /refreshes every 30 seconds/i);
assert.match(liveTopology.output, /<iframe[^>]+src="\/topology"/i);

const treeTopology = await ask('show me the network as a tree diagram');
assert.equal(treeTopology._intentId, 'topology-tree');
assert.match(treeTopology.output, /<details/i);

const fsms = await ask('show all fsms');
assert.equal(fsms._intentId, 'all-fsms');
assert.match(fsms.output, /finite state machine/i);

const devices = await ask('show all devices');
assert.equal(devices._intentId, 'all-devices');
assert.match(devices.output, /<th[^>]*>Node<\/th>/i);
assert.match(devices.output, /<th[^>]*>Devices<\/th>/i);

const services = await ask('show all services');
assert.equal(services._intentId, 'services');
assert.match(services.output, /<th[^>]*>Service<\/th>/i);
assert.match(services.output, /<th[^>]*>Providers<\/th>/i);

const queues = await ask('how many queues are defined in the message broker');
assert.equal(queues._intentId, 'queues');
assert.match(queues.output, /<th[^>]*>Queue<\/th>/i);
assert.doesNotMatch(queues.output, />Gateways</i);
assert.doesNotMatch(queues.output, />Queue Managers</i);

console.log('[agent-corrections-e2e] PASS: corrected phrases returned the requested behavior');