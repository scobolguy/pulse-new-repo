const QM_BASE = process.env.QM_BASE || 'http://127.0.0.1:4100';
const BACKEND_BASE = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000';
const QUEUE = process.env.QUEUE || 'esp32.shared.inbound';
const WINDOW_MS = Number(process.env.WINDOW_MS || 60000);
const STEP_MS = Number(process.env.STEP_MS || 5000);
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

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} => ${res.status} ${text.slice(0, 240)}`);
  return JSON.parse(text);
}

async function getJsonSafe(url, fallback) {
  try {
    return await getJson(url);
  } catch {
    return fallback;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveBeaconedWorkerUrls() {
  const workerCandidates = await discoverWorkerCandidates();
  const urls = [];
  for (const baseUrl of workerCandidates) {
    try {
      const res = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) urls.push(`${baseUrl}/bonecrusher/worker/status`);
    } catch {
      // Ignore unreachable workers; only poll beaconed nodes.
    }
  }
  return urls;
}

async function snap(workerUrls) {
  const queue = await getJson(`${QM_BASE}/queues/${encodeURIComponent(QUEUE)}/status`);
  const workerPayloads = await Promise.all(workerUrls.map((u) => getJsonSafe(u, { stats: { completed: 0, claimed: 0 } })));
  const completed = workerPayloads.reduce((sum, s) => sum + Number(s?.stats?.completed || 0), 0);
  const claimed = workerPayloads.reduce((sum, s) => sum + Number(s?.stats?.claimed || 0), 0);
  return {
    t: Date.now(),
    depth: Number(queue?.length || 0),
    completed,
    claimed
  };
}

const workerCandidates = await discoverWorkerCandidates();
const workerUrls = await resolveBeaconedWorkerUrls();
const start = await snap(workerUrls);
const endAt = Date.now() + WINDOW_MS;
let latest = start;
while (Date.now() < endAt) {
  await sleep(STEP_MS);
  latest = await snap(workerUrls);
}

const elapsedSec = Math.max(1, (latest.t - start.t) / 1000);
const completedDelta = Math.max(0, latest.completed - start.completed);
const claimedDelta = Math.max(0, latest.claimed - start.claimed);
const depthDelta = start.depth - latest.depth;

console.log(JSON.stringify({
  queue: QUEUE,
  workerCandidates,
  beaconedWorkers: workerUrls,
  elapsedSec: Number(elapsedSec.toFixed(2)),
  start,
  end: latest,
  completedDelta,
  claimedDelta,
  depthDelta,
  processingTpsCompleted: Number((completedDelta / elapsedSec).toFixed(3)),
  processingTpsClaimed: Number((claimedDelta / elapsedSec).toFixed(3)),
  drainTpsByDepth: Number((depthDelta / elapsedSec).toFixed(3))
}, null, 2));
