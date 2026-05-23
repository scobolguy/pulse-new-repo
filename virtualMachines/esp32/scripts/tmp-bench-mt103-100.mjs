#!/usr/bin/env node

const EDGE_URL = process.env.EDGE_URL || 'http://192.168.2.115/pmachine/edge_ingress_stage';
const TOTAL = Number(process.env.TOTAL || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 10000);

function todayYYMMDD() {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function mt103(i) {
  const ref = `BENCH103${Date.now()}${String(i).padStart(4, '0')}`;
  const amt = (1000 + (i % 9000)).toFixed(2).replace('.', ',');
  return `MT103\n:20:${ref}\n:23B:CRED\n:32A:${todayYYMMDD()}USD${amt}\n:50K:/ACCT${String(i).padStart(6, '0')}\nSENDER ${i}\n:59:/BEN${String(i).padStart(6, '0')}\nRECEIVER ${i}\n:71A:SHA`;
}

async function sendOne(i) {
  const form = new URLSearchParams({
    inputQueue: 'swift.mt103.inbound',
    message: mt103(i),
    runRouter: '1',
    convertMtToXml: '0',
    file: '/router-mapper.pcode',
    programMap: '/router-mapper.program.json',
    async: '1'
  });

  const start = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error(`timeout ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: ac.signal
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - start,
      publishedCount: Number(parsed?.publishedCount || 0),
      err: res.ok ? null : text.slice(0, 200)
    };
  } catch (e) {
    return {
      ok: false,
      status: 'ERR',
      latencyMs: Date.now() - start,
      publishedCount: 0,
      err: String(e?.message || e)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  console.log(`EDGE_URL=${EDGE_URL}`);
  console.log(`TOTAL=${TOTAL} CONCURRENCY=${CONCURRENCY} TIMEOUT_MS=${TIMEOUT_MS}`);

  const results = [];
  const t0 = Date.now();

  for (let i = 0; i < TOTAL; i += CONCURRENCY) {
    const batch = [];
    const end = Math.min(i + CONCURRENCY, TOTAL);
    for (let j = i; j < end; j++) batch.push(sendOne(j));
    const out = await Promise.all(batch);
    results.push(...out);
    const okSoFar = results.filter(r => r.ok).length;
    process.stdout.write(`batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(TOTAL / CONCURRENCY)} ok=${okSoFar}/${results.length}\n`);
  }

  const elapsedMs = Date.now() - t0;
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  const lats = results.map(r => r.latencyMs).sort((a, b) => a - b);
  const avg = lats.reduce((a, b) => a + b, 0) / Math.max(1, lats.length);
  const p95 = lats[Math.floor(lats.length * 0.95)] || 0;

  const tpsAll = results.length / Math.max(1, elapsedMs / 1000);
  const tpsSuccess = ok / Math.max(1, elapsedMs / 1000);

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify({
    total: results.length,
    success: ok,
    failed: fail,
    elapsedMs,
    throughputPerSecAll: Number(tpsAll.toFixed(2)),
    throughputPerSecSuccessOnly: Number(tpsSuccess.toFixed(2)),
    latencyMs: {
      min: lats[0] || 0,
      avg: Number(avg.toFixed(2)),
      p95,
      max: lats[lats.length - 1] || 0
    },
    firstErrors: results.filter(r => !r.ok).slice(0, 5)
  }, null, 2));

  if (fail > 0) process.exitCode = 2;
}

run().catch((e) => {
  console.error('Fatal', e?.stack || e);
  process.exit(1);
});
