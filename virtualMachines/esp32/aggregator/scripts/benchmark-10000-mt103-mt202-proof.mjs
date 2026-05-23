const backendBase = process.env.BACKEND_BASE_URL || "http://localhost:4000";
const totalCount = Number(process.env.BENCH_COUNT || 10000);
const concurrency = Number(process.env.BENCH_CONCURRENCY || 50);
const convertMtToXml = String(process.env.BENCH_CONVERT_MT_TO_XML || "0").trim() === "1";
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

function pad(n, w = 5) {
  return String(n).padStart(w, "0");
}

function mt103Message(index) {
  const ref = `R${runId}A${pad(index)}`;
  const amount = (100 + (index % 900) + (index % 99) / 100).toFixed(2).replace(".", ",");
  return [
    "MT103",
    `:20:${ref}`,
    ":23B:CRED",
    `:32A:260522USD${amount}`,
    ":50K:/123456789",
    "SENDER CORP",
    ":59:/987654321",
    "RECEIVER LTD",
    ":71A:SHA"
  ].join("\n");
}

function mt202Message(index) {
  const ref = `R${runId}B${pad(index)}`;
  const rel = `REL${pad(index, 6)}`;
  const amount = (250 + (index % 750) + (index % 89) / 100).toFixed(2).replace(".", ",");
  return [
    "MT202",
    `:20:${ref}`,
    `:21:${rel}`,
    `:32A:260522USD${amount}`,
    ":58A:BANKUS33"
  ].join("\n");
}

function buildJob(index) {
  const is103 = index % 2 === 1;
  return is103
    ? { inputQueue: "swift.inbound", message: mt103Message(index), kind: "MT103" }
    : { inputQueue: "mt202.inbound", message: mt202Message(index), kind: "MT202" };
}

async function sendOne(index) {
  const job = buildJob(index);
  const started = Date.now();
  const res = await fetch(`${backendBase}/api/edge/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      inputQueue: job.inputQueue,
      message: job.message,
      sourceService: "bench-10000-mt103-mt202",
      convertMtToXml
    }),
    signal: AbortSignal.timeout(20000)
  });
  const body = await res.text();
  return {
    index,
    kind: job.kind,
    status: res.status,
    ms: Date.now() - started,
    body
  };
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
  const jobs = Array.from({ length: totalCount }, (_, i) => i + 1);
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
  const ok103 = ok.filter(x => x.kind === "MT103").length;
  const ok202 = ok.filter(x => x.kind === "MT202").length;

  console.log("=== 10000 MT103/MT202 Benchmark ===");
  console.log(`runId=${runId}`);
  console.log(`count=${totalCount}`);
  console.log(`concurrency=${concurrency}`);
  console.log(`convertMtToXml=${convertMtToXml}`);
  console.log(`ok=${ok.length}`);
  console.log(`okMT103=${ok103}`);
  console.log(`okMT202=${ok202}`);
  console.log(`failed=${failed.length}`);
  console.log(`elapsedMs=${elapsedMs}`);
  console.log(`txPerSecond=${tps.toFixed(2)}`);
  console.log(`latencyMs_avg=${avg} p50=${p50} p95=${p95}`);

  if (failed.length > 0) {
    console.log(`sampleFailure=${JSON.stringify(failed[0]).slice(0, 800)}`);
    process.exitCode = 2;
  }
}

run().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
