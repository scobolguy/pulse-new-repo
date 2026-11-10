import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { loadSwarmResourceConfiguration } from '../src/backend/swarmResourceConfiguration.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function validConfig(token) {
  return {
    resources: {
      version: 1, clusterId: 'swarm-a',
      nodes: [{ nodeId: '127.0.0.1', capabilities: ['pmachine'], codeIds: [hash('bundle')] }],
    },
    credentials: {
      version: 1,
      credentials: [{
        tokenSha256: hash(token), nodeId: '127.0.0.1', serviceId: 'pmachine-agent',
        ownerAggregatorId: 'aggregator-a', resourceReports: true,
        childRequests: [{ serviceId: 'child', method: 'POST', path: '/run' }],
      }],
    },
  };
}

async function fixture(t, changes = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-resource-config-'));
  t.after(() => fs.rm(directory, { recursive: true }));
  const token = randomBytes(32).toString('hex');
  const initial = validConfig(token);
  const resources = changes.resources ?? initial.resources;
  const credentials = changes.credentials ?? initial.credentials;
  const configPath = path.join(directory, 'resources.json');
  const credentialsPath = path.join(directory, 'credentials.json');
  await Promise.all([
    fs.writeFile(configPath, JSON.stringify(resources)),
    fs.writeFile(credentialsPath, JSON.stringify(credentials)),
  ]);
  const loaded = () => loadSwarmResourceConfiguration({
    configPath, credentialsPath, ownerAggregatorId: 'aggregator-a', logger: { info() {} },
  });
  return { token, resources, credentials, loaded };
}

test('explicit configuration enrolls only declared IPv4 nodes, capabilities and bundle hashes', async t => {
  const f = await fixture(t);
  const runtime = await f.loaded();
  assert.equal(runtime.clusterId, 'swarm-a');
  assert.equal(runtime.ownerAggregatorId, 'aggregator-a');
  assert.deepEqual(runtime.resources.candidates(), []);
  runtime.resources.report('127.0.0.1', {
    sequence: 1, status: 'online', estimatedFreeSlots: 1, freeMemoryBytes: 4096,
  });
  assert.deepEqual(runtime.resources.candidates()[0].codeIds, [hash('bundle')]);
  assert.equal(typeof runtime.machineAuth.guard, 'function');
});

test('missing report credentials, un-enrolled credentials and incomplete capability records fail closed', async t => {
  {
    const f = await fixture(t, {
      credentials: { version: 1, credentials: [{ ...validConfig('x'.repeat(32)).credentials.credentials[0], resourceReports: false }] },
    });
    await assert.rejects(f.loaded(), /no resource-report credential/);
  }
  {
    const f = await fixture(t, {
      credentials: { version: 1, credentials: [{
        ...validConfig('x'.repeat(32)).credentials.credentials[0], nodeId: '127.0.0.2',
      }] },
    });
    await assert.rejects(f.loaded(), /not enrolled/);
  }
  for (const nodes of [
    [{ nodeId: 'board.local', capabilities: ['pmachine'], codeIds: [hash('bundle')] }],
    [{ nodeId: '127.0.0.1', capabilities: [], codeIds: [hash('bundle')] }],
    [{ nodeId: '127.0.0.1', capabilities: ['pmachine'] }],
  ]) {
    const f = await fixture(t, { resources: { ...validConfig('x'.repeat(32)).resources, nodes } });
    await assert.rejects(f.loaded(), /IPv4|capabilities|hashes/);
  }
});

test('unknown configuration fields, duplicate nodes, malformed credentials and owner mismatch fail closed', async t => {
  const base = validConfig('x'.repeat(32));
  for (const resources of [
    { ...base.resources, mode: 'unsafe' },
    { ...base.resources, nodes: [base.resources.nodes[0], base.resources.nodes[0]] },
    { ...base.resources, nodes: [{ ...base.resources.nodes[0], debug: true }] },
  ]) {
    const f = await fixture(t, { resources });
    await assert.rejects(f.loaded());
  }
  {
    const f = await fixture(t, {
      credentials: { ...base.credentials, credentials: [{ ...base.credentials.credentials[0], tokenSha256: 'bad' }] },
    });
    await assert.rejects(f.loaded(), /Invalid or duplicate/);
  }
  {
    const f = await fixture(t, {
      credentials: { ...base.credentials, credentials: [{ ...base.credentials.credentials[0], ownerAggregatorId: 'other' }] },
    });
    await assert.rejects(f.loaded(), /owner aggregator|no resource-report credential/);
  }
});
