const base = process.env.BACKEND_BASE_URL || 'http://localhost:4000';
const intervalMs = 10 * 60 * 1000;

async function getJson(path) {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

function nowIso() {
  return new Date().toISOString();
}

function topQueues(statusPayload, topN = 8) {
  const queues = Array.isArray(statusPayload?.queues) ? statusPayload.queues : [];
  return queues
    .filter((q) => Number(q?.depth || 0) > 0)
    .sort((a, b) => Number(b.depth || 0) - Number(a.depth || 0))
    .slice(0, topN)
    .map((q) => `${q.queue}:${q.depth}`)
    .join(', ');
}

function gatewayLine(g) {
  const boc = g?.boc || {};
  const fed = g?.fed || {};
  const swift = g?.swift || {};
  const bocProcessed = Number(boc?.queueMetrics?.cumulativeProcessedCount || 0);
  const fedProcessed = Number(fed?.queueMetrics?.cumulativeProcessedCount || 0);
  const swiftProcessed = Number(swift?.queueMetrics?.cumulativeProcessedCount || 0);
  return `swift(run=${!!swift.running},proc=${swiftProcessed}) boc(run=${!!boc.running},proc=${bocProcessed}) fed(run=${!!fed.running},proc=${fedProcessed})`;
}

async function reportOnce() {
  try {
    const [health, gateways, queues] = await Promise.all([
      getJson('/api/system/health'),
      getJson('/api/gateways'),
      getJson('/api/queues/status')
    ]);

    const overall = health?.health?.overall || health?.status || 'unknown';
    const memory = Number(health?.health?.memory?.usagePercent || 0).toFixed(2);
    const top = topQueues(queues) || 'none';

    console.log(`[${nowIso()}] overall=${overall} mem=${memory}% ${gatewayLine(gateways)}`);
    console.log(`[${nowIso()}] topQueues=${top}`);
  } catch (error) {
    console.log(`[${nowIso()}] report_error=${error?.message || error}`);
  }
}

console.log(`[${nowIso()}] monitor_started base=${base} intervalMs=${intervalMs}`);
await reportOnce();
setInterval(reportOnce, intervalMs);
