import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);

const ACTOR_HEADERS = {
  'x-user-id': 'system-admin',
  'content-type': 'application/json'
};

async function runNodeScript(args) {
  const result = await execFileAsync(process.execPath, args, {
    cwd: process.cwd(),
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8
  });
  return result;
}

function parseLastJsonObject(text) {
  const raw = String(text || '').trim();
  const start = raw.lastIndexOf('\n{');
  const candidate = start >= 0 ? raw.slice(start + 1) : raw;
  return JSON.parse(candidate);
}

async function fetchJson(url, init, label) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (errorValue) {
    throw new Error(`${label} failed: ${errorValue?.message || String(errorValue)}`);
  }

  const text = await res.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    const detail = payload?.error || payload?.details || payload?.raw || `HTTP ${res.status}`;
    throw new Error(`${label} failed: ${detail}`);
  }
  return payload;
}

async function compileAndRunPascalishSmoke() {
  await runNodeScript([
    'scripts/compile-pascal-to-pcode.mjs',
    '--in', './data/allocator-shadow-smoke.pas',
    '--out', '../pcode/allocator-shadow-smoke.pcode',
    '--map-out', '../pcode/allocator-shadow-smoke.program.json'
  ]);

  const runResult = await runNodeScript([
    'scripts/run-js-pmachine.mjs',
    '--pcode', '../pcode/allocator-shadow-smoke.pcode',
    '--program-map', '../pcode/allocator-shadow-smoke.program.json',
    '--input-queue', 'allocator.shadow.test.in',
    '--message', '{"test":"allocator-e2e"}'
  ]);

  const runtimePayload = parseLastJsonObject(runResult.stdout || '');
  assert.equal(runtimePayload?.publishedCount, 1, 'Pascalish smoke should publish one output message');
  assert.equal(runtimePayload?.deliveries?.[0]?.queueName, 'allocator.shadow.test.out');

  return {
    publishedCount: runtimePayload.publishedCount,
    deliveryQueue: runtimePayload?.deliveries?.[0]?.queueName || null
  };
}

async function registerSyntheticPmachineInstances(baseUrl, runTag) {
  const instances = [
    {
      serviceName: 'pmachine',
      instanceId: `pmachine:${runTag}:a`,
      nodeId: `pmachine-node-${runTag}-a`,
      ip: '127.0.0.1',
      port: 4701,
      status: 'up',
      metadata: {
        failureDomain: 'fd-a',
        capabilities: ['pcode'],
        successRate15m: 0.995,
        estimatedFreeSlots: 4,
        p95LatencyMs: 12,
        queueDelayMs: 2
      }
    },
    {
      serviceName: 'pmachine',
      instanceId: `pmachine:${runTag}:b`,
      nodeId: `pmachine-node-${runTag}-b`,
      ip: '127.0.0.1',
      port: 4702,
      status: 'up',
      metadata: {
        failureDomain: 'fd-b',
        capabilities: ['pcode'],
        successRate15m: 0.992,
        estimatedFreeSlots: 3,
        p95LatencyMs: 15,
        queueDelayMs: 3
      }
    }
  ];

  for (const instance of instances) {
    await fetchJson(`${baseUrl}/api/registry/service-instances/heartbeat`, {
      method: 'POST',
      headers: ACTOR_HEADERS,
      body: JSON.stringify(instance)
    }, 'service instance heartbeat');
  }
}

async function main() {
  const baseUrl = process.env.PULSE_ALLOCATOR_E2E_BASE_URL || 'http://localhost:4000';
  const runTag = `${Date.now()}`;

  const pascalishResult = await compileAndRunPascalishSmoke();

  const beforeSummary = await fetchJson(`${baseUrl}/api/allocator/summary?limit=1000`, {
    headers: { 'x-user-id': 'system-admin' }
  }, 'allocator summary (before)');
  const beforeTotal = Number(beforeSummary?.summary?.total || 0);

  await registerSyntheticPmachineInstances(baseUrl, runTag);

  const routePayload = await fetchJson(`${baseUrl}/api/pmachine/route/pmachine`, {
    method: 'POST',
    headers: ACTOR_HEADERS,
    body: JSON.stringify({
      allocatorMode: 'shadow',
      policyId: 'balanced',
      slaClass: 'interactive',
      requiredCapability: 'pcode',
      placementPolicy: {
        minReplicas: 1,
        requireDistinctFailureDomain: false
      }
    })
  }, 'pmachine route');

  assert.equal(routePayload?.status, 'ok');
  assert.equal(routePayload?.allocator?.mode, 'shadow');

  const afterSummary = await fetchJson(`${baseUrl}/api/allocator/summary?limit=1000`, {
    headers: { 'x-user-id': 'system-admin' }
  }, 'allocator summary (after)');
  const afterTotal = Number(afterSummary?.summary?.total || 0);

  assert.ok(afterTotal >= beforeTotal + 1, `Expected allocator summary total to increase by >=1 (before=${beforeTotal}, after=${afterTotal})`);

  const decisions = await fetchJson(`${baseUrl}/api/allocator/decisions?limit=1`, {
    headers: { 'x-user-id': 'system-admin' }
  }, 'allocator decisions');
  const latest = Array.isArray(decisions?.decisions) ? decisions.decisions[0] : null;

  assert.equal(String(latest?.serviceName || ''), 'pmachine');
  assert.equal(String(latest?.mode || ''), 'shadow');

  console.log(JSON.stringify({
    status: 'ok',
    pascalish: pascalishResult,
    allocatorSummaryBefore: beforeTotal,
    allocatorSummaryAfter: afterTotal,
    latestDecision: {
      serviceName: latest?.serviceName || null,
      mode: latest?.mode || null,
      selectedSource: latest?.selected?.source || null,
      policyId: latest?.policyId || null
    }
  }, null, 2));
}

main().catch((errorValue) => {
  console.error('[allocator-e2e-pascalish] failed:', errorValue?.message || String(errorValue));
  process.exitCode = 1;
});
