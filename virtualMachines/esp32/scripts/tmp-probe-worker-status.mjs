const BACKEND_BASE = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000';
const MAX_NODE_AGE_MS = Number(process.env.ESP32_NODE_MAX_AGE_MS || 120000);

async function discoverWorkerBases() {
  if (String(process.env.ESP32_WORKERS || '').trim()) {
    return String(process.env.ESP32_WORKERS)
      .split(',')
      .map((v) => v.trim().replace(/\/$/, ''))
      .filter(Boolean);
  }

  const res = await fetch(`${BACKEND_BASE}/api/nodes`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`node discovery failed: ${res.status}`);
  const nodes = await res.json();
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

async function isBeaconed(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

const workerBases = await discoverWorkerBases();
const activeWorkerBases = [];
for (const baseUrl of workerBases) {
  if (await isBeaconed(baseUrl)) {
    activeWorkerBases.push(baseUrl);
  } else {
    console.log(`SKIP: ${baseUrl} (not beaconed/reachable)`);
  }
}

const urls = activeWorkerBases.map((baseUrl) => `${baseUrl}/bonecrusher/worker/status`);

for (const url of urls) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`URL: ${url}`);
    console.log(`HTTP: ${res.status}`);
    console.log(text);
    console.log('---');
  } catch (error) {
    console.log(`URL: ${url}`);
    console.log(`ERR: ${error?.message || String(error)}`);
    console.log('---');
  }
}

if (urls.length === 0) {
  console.log('No beaconed ESP32 workers found.');
}
