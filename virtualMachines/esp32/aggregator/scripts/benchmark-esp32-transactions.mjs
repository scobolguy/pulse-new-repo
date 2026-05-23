const directBase = process.env.ESP32_BASE_URL || "http://192.168.2.115";
const backendBase = process.env.BACKEND_BASE_URL || "http://localhost:4000";
const mode = (process.env.BENCH_MODE || "backend-edge").trim().toLowerCase();
const count = 10;

function buildMessage(index) {
  return [
    "MT103",
    `transactionId=FLOW-ESP32-BENCH-${String(index).padStart(3, "0")}`,
    "sender=BANKAUS33",
    "receiver=BANKBUS44",
    `amount=${(100 + index * 0.01).toFixed(2)}`,
    "currency=USD"
  ].join("|");
}

async function sendOne(index) {
  const start = Date.now();
  let res;
  if (mode === "direct") {
    const url = new URL(`${directBase}/pmachine/edge_ingress_stage`);
    url.searchParams.set("message", buildMessage(index));
    url.searchParams.set("inputQueue", "swift.inbound");
    res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10000) });
  } else {
    res = await fetch(`${backendBase}/api/edge/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inputQueue: "swift.inbound",
        message: buildMessage(index),
        sourceService: "esp32-bench"
      }),
      signal: AbortSignal.timeout(10000)
    });
  }
  const body = await res.text();
  const ms = Date.now() - start;

  return { index, status: res.status, ms, body };
}

async function run() {
  const statusStart = Date.now();
  const statusRes = await fetch(`${directBase}/status`, { signal: AbortSignal.timeout(5000) });
  const statusMs = Date.now() - statusStart;
  if (!statusRes.ok) {
    throw new Error(`ESP32 status check failed: ${statusRes.status}`);
  }

  const results = [];
  const totalStart = Date.now();

  for (let i = 1; i <= count; i += 1) {
    try {
      const r = await sendOne(i);
      results.push(r);
      console.log(`TX ${i}/${count} status=${r.status} timeMs=${r.ms}`);
    } catch (e) {
      results.push({ index: i, status: -1, ms: -1, body: String(e.message || e) });
      console.log(`TX ${i}/${count} status=ERR timeMs=-1 err=${e.message}`);
    }
  }

  const totalMs = Date.now() - totalStart;
  const ok = results.filter(r => r.status === 200);
  const failed = results.length - ok.length;
  const latencies = ok.map(r => r.ms).sort((a, b) => a - b);

  const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : -1;
  const min = latencies.length ? latencies[0] : -1;
  const max = latencies.length ? latencies[latencies.length - 1] : -1;
  const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : -1;
  const p95 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : -1;

  console.log("\n=== ESP32 Benchmark Summary ===");
  console.log(`mode=${mode}`);
  console.log(`statusCheckMs=${statusMs}`);
  console.log(`count=${count} ok=${ok.length} failed=${failed}`);
  console.log(`totalBatchMs=${totalMs}`);
  console.log(`singleTxMs_avg=${avg} min=${min} p50=${p50} p95=${p95} max=${max}`);
}

run().catch((e) => {
  console.error("BENCH_ERR", e.message);
  process.exit(1);
});
