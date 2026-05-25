#!/usr/bin/env node

const QM_BASE = process.env.QM_BASE || 'http://192.168.2.11:4100';
const BACKEND_BASE = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000';
const SHARED_QUEUE = process.env.SHARED_QUEUE || 'esp32.shared.inbound';
const TOTAL = Number(process.env.TOTAL || 1000);
const ENQUEUE_CONCURRENCY = Number(process.env.ENQUEUE_CONCURRENCY || 30);
const DRAIN_TIMEOUT_MS = Number(process.env.DRAIN_TIMEOUT_MS || 300000);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 1000);
const MAX_NODE_AGE_MS = Number(process.env.ESP32_NODE_MAX_AGE_MS || 120000);

async function discoverWorkerCandidates() {
  if (String(process.env.ESP32_WORKERS || '').trim()) {
    return String(process.env.ESP32_WORKERS)
      .split(',')
      .map((v) => v.trim().replace(/\/$/, ''))
      .filter(Boolean);
  }

  const res = await fetch(`${BACKEND_BASE}/api/nodes`, { signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`node discovery failed ${res.status}: ${text.slice(0, 200)}`);

  let nodes = [];
  try { nodes = JSON.parse(text); } catch { nodes = []; }
  const now = Date.now();

  return (Array.isArray(nodes) ? nodes : [])
    .filter((n) => {
      const ip = String(n?.ip || '').trim();
      if (!ip || ip === '127.0.0.1') return false;
      const ageOk = Number(n?.lastSeen || 0) > 0 && (now - Number(n.lastSeen)) <= MAX_NODE_AGE_MS;
      const hardware = String(n?.details?.hardware || '').toUpperCase();
      return ageOk && hardware === 'ESP32';
    })
    .map((n) => `http://${String(n.ip).trim()}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayYYMMDD() {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function mt103(i) {
  const ref = `R103${Date.now()}${String(i).padStart(5, '0')}`;
  const amt = (1000 + (i % 9000)).toFixed(2).replace('.', ',');
  return `MT103\n:20:${ref}\n:23B:CRED\n:32A:${todayYYMMDD()}USD${amt}\n:50K:/ACCT${String(i).padStart(8, '0')}\nSENDER ${i}\n:59:/BEN${String(i).padStart(8, '0')}\nRECEIVER ${i}\n:71A:SHA`;
}

function mt202(i) {
  const ref = `R202${Date.now()}${String(i).padStart(5, '0')}`;
  const rel = `REL${String(i).padStart(8, '0')}`;
  const amt = (2000 + (i % 12000)).toFixed(2).replace('.', ',');
  return `MT202\n:20:${ref}\n:21:${rel}\n:32A:${todayYYMMDD()}USD${amt}\n:52A:BANKUS33XXX\n:58A:BANKGB22XXX\n:72:INFO ${i}`;
}

function buildMessage(i) {
  return i % 2 === 0 ? mt103(i) : mt202(i);
}

async function getJson(url, timeoutMs = 8000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(`${url} => ${res.status} ${text.slice(0, 280)}`);
  }
  return json;
}

async function postForm(url, values, timeoutMs = 8000) {
  const body = new URLSearchParams(values);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(`${url} => ${res.status} ${text.slice(0, 280)}`);
  }
  return json;
}

async function enqueueOne(i) {
  const payload = {
    queueName: SHARED_QUEUE,
    message: buildMessage(i),
    sourceService: 'bench-esp32-1000-mix'
  };
  const res = await fetch(`${QM_BASE}/enqueue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`enqueue failed ${res.status}: ${text.slice(0, 280)}`);
  }
}

async function getWorkerStatus(baseUrl) {
  return getJson(`${baseUrl}/bonecrusher/worker/status`, 8000);
}

async function resolveBeaconedWorkers() {
  const workerCandidates = await discoverWorkerCandidates();
  const active = [];
  for (const baseUrl of workerCandidates) {
    try {
      const res = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) active.push(baseUrl);
    } catch {
      // Ignore unreachable workers; only poll beaconed nodes.
    }
  }
  return active;
}

function getCompletedFromStatus(status) {
  return Number(status?.stats?.completed || 0);
}

function getClaimedFromStatus(status) {
  return Number(status?.stats?.claimed || 0);
}

async function run() {
  console.log(`QM_BASE=${QM_BASE}`);
  console.log(`SHARED_QUEUE=${SHARED_QUEUE}`);
  console.log(`TOTAL=${TOTAL} ENQUEUE_CONCURRENCY=${ENQUEUE_CONCURRENCY}`);

  const health = await getJson(`${QM_BASE}/health`, 8000);
  console.log(`qmHealth.managerId=${health?.managerId || 'unknown'} port=${health?.port || 'n/a'}`);

  const workerCandidates = await discoverWorkerCandidates();
  const workers = await resolveBeaconedWorkers();
  console.log(`workers.candidates=${JSON.stringify(workerCandidates)}`);
  console.log(`workers.beaconed=${JSON.stringify(workers)}`);
  if (workers.length === 0) {
    throw new Error('No beaconed ESP32 workers are reachable.');
  }

  const workerBefore = {};
  for (const worker of workers) {
    workerBefore[worker] = await getWorkerStatus(worker);
  }

  for (const worker of workers) {
    await postForm(`${worker}/bonecrusher/worker/config`, {
      enabled: '1',
      queueManagerUrl: QM_BASE,
      queueName: SHARED_QUEUE,
      pollIntervalMs: '250',
      persist: '1'
    }, 10000);
  }

  await sleep(1000);

  const workerConfigured = {};
  for (const worker of workers) {
    workerConfigured[worker] = await getWorkerStatus(worker);
  }

  const queueBefore = await getJson(`${QM_BASE}/queues/${encodeURIComponent(SHARED_QUEUE)}/status`, 8000);
  const baseQueueDepth = Number(queueBefore?.length || 0);

  const enqueueStartedAt = Date.now();
  let sent = 0;
  for (let start = 0; start < TOTAL; start += ENQUEUE_CONCURRENCY) {
    const jobs = [];
    const end = Math.min(start + ENQUEUE_CONCURRENCY, TOTAL);
    for (let i = start; i < end; i += 1) {
      jobs.push(enqueueOne(i));
    }
    await Promise.all(jobs);
    sent += jobs.length;
  }
  const enqueueElapsedMs = Math.max(1, Date.now() - enqueueStartedAt);
  const enqueueTps = Number(((sent * 1000) / enqueueElapsedMs).toFixed(2));

  const drainStartedAt = Date.now();
  let finalQueueDepth = baseQueueDepth;
  let finalInflight = null;
  let finalWorkerStats = null;
  let timedOut = false;

  while (true) {
    const queueNow = await getJson(`${QM_BASE}/queues/${encodeURIComponent(SHARED_QUEUE)}/status`, 8000);
    finalQueueDepth = Number(queueNow?.length || 0);

    let inflight = null;
    try {
      const claimMetrics = await getJson(`${QM_BASE}/claim/metrics?queueName=${encodeURIComponent(SHARED_QUEUE)}`, 8000);
      inflight = Number(claimMetrics?.metrics?.[SHARED_QUEUE]?.inflight || 0);
      finalInflight = inflight;
    } catch {
      inflight = 0;
      finalInflight = null;
    }

    const workerNow = {};
    for (const worker of workers) {
      workerNow[worker] = await getWorkerStatus(worker);
    }
    finalWorkerStats = workerNow;

    const settled = finalQueueDepth === 0 && inflight === 0;
    if (settled) break;

    if ((Date.now() - drainStartedAt) > DRAIN_TIMEOUT_MS) {
      timedOut = true;
      break;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const drainElapsedMs = Math.max(1, Date.now() - drainStartedAt);

  const beforeCompleted = workers.reduce((sum, worker) => sum + getCompletedFromStatus(workerBefore[worker]), 0);
  const afterCompleted = workers.reduce((sum, worker) => sum + getCompletedFromStatus(finalWorkerStats?.[worker]), 0);
  const completedDelta = Math.max(0, afterCompleted - beforeCompleted);

  const processingTps = Number(((completedDelta * 1000) / drainElapsedMs).toFixed(2));

  const workerBreakdown = workers.map((worker) => ({
    worker,
    before: {
      workerId: workerBefore[worker]?.workerId,
      queueName: workerBefore[worker]?.queueName,
      pollIntervalMs: workerBefore[worker]?.pollIntervalMs,
      claimed: getClaimedFromStatus(workerBefore[worker]),
      completed: getCompletedFromStatus(workerBefore[worker]),
      lastError: String(workerBefore[worker]?.stats?.lastError || '')
    },
    configured: {
      queueName: workerConfigured[worker]?.queueName,
      pollIntervalMs: workerConfigured[worker]?.pollIntervalMs,
      queueManagerUrl: workerConfigured[worker]?.queueManagerUrl
    },
    after: {
      claimed: getClaimedFromStatus(finalWorkerStats?.[worker]),
      completed: getCompletedFromStatus(finalWorkerStats?.[worker]),
      lastError: String(finalWorkerStats?.[worker]?.stats?.lastError || '')
    }
  }));

  const result = {
    sent,
    enqueueElapsedMs,
    enqueueTps,
    completedDelta,
    drainElapsedMs,
    processingTps,
    timedOut,
    queue: {
      name: SHARED_QUEUE,
      initialDepth: baseQueueDepth,
      finalDepth: finalQueueDepth,
      finalInflight
    },
    workerBreakdown
  };

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));

  if (timedOut || completedDelta < Math.floor(sent * 0.9)) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error('Fatal:', error?.message || error);
  process.exit(1);
});
