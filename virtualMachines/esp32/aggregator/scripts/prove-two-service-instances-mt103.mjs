import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const BACKEND_BASE_URL = (process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const SERVICE_ID = process.env.SERVICE_ID || 'mt103-to-pacs008';
const REQUEST_QUEUE = `service.${SERVICE_ID}.requests`;
const COUNT = Math.max(1, Number.parseInt(process.env.COUNT || '1000', 10));
const CONCURRENCY = Math.max(1, Number.parseInt(process.env.CONCURRENCY || '20', 10));
const POLL_MS = Math.max(25, Number.parseInt(process.env.POLL_MS || '100', 10));
const TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.TIMEOUT_MS || '120000', 10));
const REPORT_PATH = process.env.REPORT_PATH || `./data/${SERVICE_ID}-instance-proof-${Date.now()}.json`;
const SERVICE_INSTANCE_URLS = String(process.env.SERVICE_INSTANCE_URLS || 'http://192.168.2.155,http://192.168.2.83')
  .split(',')
  .map(value => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

function buildMt103(index, runId) {
  const field20 = `INSTANCE-PROOF-${runId}-${String(index).padStart(4, '0')}`;
  const amount = (100 + index * 1.37).toFixed(2);
  return {
    field20,
    amount,
    message: [
      'MT103',
      `:20:${field20}`,
      `:21:INSTANCE-E2E-${String(index).padStart(4, '0')}`,
      ':23B:CRED',
      `:32A:260907USD${amount.replace('.', ',')}`,
      ':50K:ALPHA IMPORTS LTD',
      ':57A:BKTRUS33',
      ':59:/000123456',
      'BETA SUPPLIES INC',
      `:70:Two-instance proof ${index}`,
      ':71A:SHA'
    ].join('\n')
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!response.ok) throw new Error(`${response.status} ${url}: ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

async function snapshot() {
  const [queue, registry] = await Promise.all([
    fetchJson(`${BACKEND_BASE_URL}/api/queue/${encodeURIComponent(REQUEST_QUEUE)}/status`).catch(error => ({ error: error.message })),
    fetchJson(`${BACKEND_BASE_URL}/api/registry/services`).catch(error => ({ error: error.message }))
  ]);
  return { queue, registry, capturedAt: new Date().toISOString() };
}

function collectInstanceEvidence(jobPayload, instances) {
  const candidates = [
    jobPayload?.result?.instanceId,
    jobPayload?.result?.serviceInstanceId,
    jobPayload?.result?.edgeResult?.instanceId,
    jobPayload?.result?.edgeResult?.serviceInstanceId,
    jobPayload?.result?.edgeResult?.edgeNode,
    jobPayload?.result?.sourceService
  ].filter(value => value != null && String(value).trim());
  for (const value of candidates) instances.add(String(value));
  return candidates;
}

async function submitOne(index, runId) {
  const expected = buildMt103(index, runId);
  const startedAt = performance.now();
  const accepted = await fetchJson(`${BACKEND_BASE_URL}/api/services/${encodeURIComponent(SERVICE_ID)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messageId: `${runId}-${String(index).padStart(4, '0')}`,
      message: expected.message,
      inputQueue: 'swift.mt103.inbound',
      sourceService: 'two-instance-proof-client'
    })
  });

  const deadline = Date.now() + TIMEOUT_MS;
  let completed;
  while (Date.now() < deadline) {
    completed = await fetchJson(`${BACKEND_BASE_URL}/api/service-jobs/${encodeURIComponent(accepted.jobId)}`);
    if (completed.state === 'completed' || completed.state === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }

  const result = completed?.result || {};
  const output = String(result.value || result.response || result.edgeResult?.normalizedMessage || '');
  const instanceCandidates = [result.serviceInstanceId].filter(Boolean);
  const valid = completed?.state === 'completed'
    && output.includes(`<MsgId>${expected.field20}</MsgId>`)
    && new RegExp(`<IntrBkSttlmAmt[^>]*>${expected.amount}</IntrBkSttlmAmt>`).test(output);
  process.stdout.write(valid ? '.' : 'x');

  return {
    index,
    jobId: accepted.jobId,
    state: completed?.state || 'timeout',
    valid,
    field20: expected.field20,
    amount: expected.amount,
    elapsedMs: Math.round(performance.now() - startedAt),
    serviceInstanceId: instanceCandidates[0] || null,
    instanceCandidates
  };
}

async function runPool(items, limit, worker) {
  const results = [];
  let cursor = 0;
  async function consume() {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        process.stdout.write('x');
        results[index] = { index: items[index], state: 'error', valid: false, error: error.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

function startServiceWorkers() {
  if (process.env.START_SERVICE_WORKERS === 'false') return [];
  const perWorker = Math.ceil(COUNT / Math.max(1, SERVICE_INSTANCE_URLS.length)) + CONCURRENCY;
  return SERVICE_INSTANCE_URLS.map((instanceUrl, index) => {
    const child = spawn(process.execPath, ['./scripts/mt103-pacs008-service-instance-worker.mjs'], {
      cwd: process.cwd(),
      windowsHide: true,
      env: {
        ...process.env,
        BACKEND_BASE_URL,
        SERVICE_ID,
        INSTANCE_URL: instanceUrl,
        WORKER_ID: `${SERVICE_ID}:worker-${index + 1}:${instanceUrl}`,
        MAX_MESSAGES: String(perWorker),
        IDLE_EXIT_MS: '10000'
      },
      stdio: ['ignore', 'ignore', 'pipe']
    });
    child.stderr.on('data', chunk => process.stderr.write(String(chunk)));
    return child;
  });
}

async function stopServiceWorkers(workers) {
  await Promise.all(workers.map(worker => new Promise(resolve => {
    if (worker.exitCode != null) return resolve();
    worker.once('exit', resolve);
    setTimeout(() => {
      if (worker.exitCode == null) worker.kill();
      resolve();
    }, 15000);
  })));
}

async function main() {
  const runId = `run-${Date.now()}`;
  const before = await snapshot();
  const workers = startServiceWorkers();
  const instanceIds = new Set();
  const startedAt = performance.now();
  let results = [];
  try {
    results = await runPool(
      Array.from({ length: COUNT }, (_, index) => index + 1),
      CONCURRENCY,
      async index => {
        const result = await submitOne(index, runId);
        return result;
      }
    );
  } finally {
    await stopServiceWorkers(workers);
  }
  process.stdout.write('\n');
  const after = await snapshot();
  const elapsedMs = performance.now() - startedAt;
  const passed = results.filter(result => result.valid).length;
  const failed = results.length - passed;
  const latencies = results.filter(result => Number.isFinite(result.elapsedMs)).map(result => result.elapsedMs);

  // The current central worker may not yet expose downstream instance identity.
  // Keep this explicit: conversion success is not proof of multi-instance claims.
  for (const result of results) {
    for (const candidate of result.instanceCandidates || []) instanceIds.add(candidate);
  }

  const byServiceInstance = {};
  for (const result of results) {
    const instanceId = result.serviceInstanceId || 'unknown';
    const current = byServiceInstance[instanceId] || { count: 0, passed: 0, failed: 0, totalMs: 0, averageMs: 0 };
    current.count += 1;
    if (result.valid) current.passed += 1;
    else current.failed += 1;
    if (Number.isFinite(result.elapsedMs)) current.totalMs += result.elapsedMs;
    byServiceInstance[instanceId] = current;
  }
  for (const current of Object.values(byServiceInstance)) {
    current.averageMs = current.count > 0 ? Number((current.totalMs / current.count).toFixed(2)) : null;
    delete current.totalMs;
  }

  const report = {
    runId,
    serviceId: SERVICE_ID,
    submissionInterface: `/api/services/${SERVICE_ID}`,
    requestQueue: REQUEST_QUEUE,
    count: COUNT,
    concurrency: CONCURRENCY,
    elapsedMs: Math.round(elapsedMs),
    averageMs: latencies.length ? Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)) : null,
    passed,
    failed,
    queueBefore: before.queue,
    queueAfter: after.queue,
    observedInstanceIds: [...instanceIds],
    observedInstanceCount: instanceIds.size,
    byServiceInstance,
    proofStatus: instanceIds.size >= 2 ? 'TWO_INSTANCES_OBSERVED' : 'INSTANCE_EVIDENCE_INSUFFICIENT',
    note: instanceIds.size >= 2
      ? 'At least two distinct instance identities were reported by service completions.'
      : 'The generic service path completed requests, but completion telemetry did not expose two distinct downstream instance identities.',
    failures: results.filter(result => !result.valid).slice(0, 20),
    serviceRegistryBefore: before.registry,
    serviceRegistryAfter: after.registry
  };

  await fs.mkdir(new URL('.', `file://${process.cwd().replace(/\\/g, '/')}/`).pathname, { recursive: true }).catch(() => {});
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (failed > 0) process.exitCode = 2;
}

main().catch(error => {
  console.error(`[two-instance-proof] ${error.stack || error.message || String(error)}`);
  process.exitCode = 1;
});
