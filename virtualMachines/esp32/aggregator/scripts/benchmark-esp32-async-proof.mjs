const backendBase = process.env.BACKEND_BASE_URL || "http://localhost:4000";
const count = Number(process.env.BENCH_COUNT || 50);
const concurrency = Number(process.env.BENCH_CONCURRENCY || 10);
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

function buildMessage(index) {
  const tx = `ASYNCPROOF-${runId}-${String(index).padStart(4, "0")}`;
  return [
    "MT103",
    `transactionId=${tx}`,
    "sender=BANKAUS33",
    "receiver=BANKBUS44",
    `amount=${(100 + index * 0.01).toFixed(2)}`,
    "currency=USD"
  ].join("|");
}

async function sendOne(index) {
  const started = Date.now();
  const res = await fetch(`${backendBase}/api/edge/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      inputQueue: "swift.inbound",
      message: buildMessage(index),
      sourceService: "esp32-async-proof"
    }),
    signal: AbortSignal.timeout(15000)
  });
  const body = await res.text();
  return { index, status: res.status, ms: Date.now() - started, body };
}

async function runPool(items, limit, worker) {
  const inFlight = new Set();
  const out = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => worker(item));
    out.push(p);
    inFlight.add(p);
    p.finally(() => inFlight.delete(p));
    if (inFlight.size >= limit) {
      await Promise.race(inFlight);
    }
  }
  return Promise.allSettled(out);
}

async function run() {
  const jobs = Array.from({ length: count }, (_, i) => i + 1);
  const started = Date.now();
  const settled = await runPool(jobs, Math.max(1, concurrency), sendOne);
  const elapsedMs = Date.now() - started;

  const ok = [];
  const failed = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value.status === 200) ok.push(s.value);
    else failed.push(s);
  }

  const lat = ok.map(x => x.ms).sort((a, b) => a - b);
  const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : -1;
  const p50 = lat.length ? lat[Math.floor(lat.length * 0.5)] : -1;
  const p95 = lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : -1;
  const tps = elapsedMs > 0 ? (ok.length / (elapsedMs / 1000)) : 0;

  console.log("=== ESP32 Async Proof Benchmark ===");
  console.log(`runId=${runId}`);
  console.log(`count=${count}`);
  console.log(`concurrency=${concurrency}`);
  console.log(`ok=${ok.length}`);
  console.log(`failed=${failed.length}`);
  console.log(`elapsedMs=${elapsedMs}`);
  console.log(`txPerSecond=${tps.toFixed(2)}`);
  console.log(`latencyMs_avg=${avg} p50=${p50} p95=${p95}`);

  if (failed.length > 0) {
    console.log(`sampleFailure=${JSON.stringify(failed[0]).slice(0, 600)}`);
    process.exitCode = 2;
  }
}

run().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
