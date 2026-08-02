import assert from 'node:assert/strict';
import { matchAgentIntent, reloadAgentRoutes } from '../src/backend/agentRouteLoader.mjs';

const correctionCases = [
  ['show me the topology', 'topology'],
  ['show me the network as a mermaid diagram', 'topology-live'],
  ['show me the network as a tree diagram', 'topology-tree'],
  ['show all fsms', 'all-fsms'],
  ['show all devices', 'all-devices'],
  ['show all services', 'services'],
  ['how many queues are defined in the message broker', 'queues'],
  ['show me the size of all queues', 'queues'],
];

await reloadAgentRoutes();

for (const [message, expectedIntentId] of correctionCases) {
  const match = await matchAgentIntent(message);
  assert.equal(
    match?.intent?.id,
    expectedIntentId,
    `Expected "${message}" to match ${expectedIntentId}, got ${match?.intent?.id || 'no match'}`,
  );
}

console.log(`[agent-corrections] PASS: ${correctionCases.length} corrected phrases matched their intended routes`);