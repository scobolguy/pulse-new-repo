#!/usr/bin/env node

const EDGE_URL = process.env.EDGE_URL || 'http://192.168.2.115/pmachine/edge_ingress_stage';
const TOTAL = Number(process.env.TOTAL || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const MODE = String(process.env.MODE || 'MIX').toUpperCase();
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const ROUTER_FILE = process.env.ROUTER_FILE || '/router-mapper.pcode';
const PROGRAM_MAP = process.env.PROGRAM_MAP || '/router-mapper.program.json';

function todayYYMMDD() {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function mt103(i) {
  const ref = `REF103${Date.now()}${String(i).padStart(4, '0')}`;
  const amt = (1000 + (i % 9000)).toFixed(2).replace('.', ',');
  return `MT103\n:20:${ref}\n:23B:CRED\n:32A:${todayYYMMDD()}USD${amt}\n:50K:/ACCT${String(i).padStart(6, '0')}\nSENDER ${i}\n:59:/BEN${String(i).padStart(6, '0')}\nRECEIVER ${i}\n:71A:SHA`;
}

function mt202(i) {
  const ref = `REF202${Date.now()}${String(i).padStart(4, '0')}`;
  const rel = `REL${String(i).padStart(6, '0')}`;
  const amt = (2000 + (i % 12000)).toFixed(2).replace('.', ',');
  return `MT202\n:20:${ref}\n:21:${rel}\n:32A:${todayYYMMDD()}USD${amt}\n:52A:BANKUS33XXX\n:58A:BANKGB22XXX\n:72:INFO ${i}`;
}

function buildMessage(i) {
  const is103 = MODE === 'MT103' ? true : MODE === 'MT202' ? false : i % 2 === 0;
  return {
    type: is103 ? 'MT103' : 'MT202',
    inputQueue: is103 ? 'swift.mt103.inbound' : 'mt202.inbound',
    message: is103 ? mt103(i) : mt202(i)
  };
}

async function sendOne(i) {
  const m = buildMessage(i);
  const form = new URLSearchParams({
    inputQueue: m.inputQueue,
    message: m.message,
    runRouter: '1',
    convertMtToXml: '0',
    file: ROUTER_FILE,
    programMap: PROGRAM_MAP,
    async: '1'
  });

  const start = Date.now();
  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - start,
      type: m.type,
      inputQueue: m.inputQueue,
      publishedCount: Number(parsed?.publishedCount || 0),
      messageType: parsed?.messageType || null,
      error: res.ok ? null : text.slice(0, 240)
    };
  } catch (e) {
    return {
      ok: false,
      status: 'NETWORK_ERROR',
      latencyMs: Date.now() - start,
      type: m.type,
      inputQueue: m.inputQueue,
      publishedCount: 0,
      messageType: null,
      error: String(e?.message || e)
    };
  }
}

async function run() {
  console.log(`EDGE_URL=${EDGE_URL}`);
  console.log(`TOTAL=${TOTAL} CONCURRENCY=${CONCURRENCY} MODE=${MODE} REQUEST_TIMEOUT_MS=${REQUEST_TIMEOUT_MS}`);

  const results = [];
  const start = Date.now();

  for (let i = 0; i < TOTAL; i += CONCURRENCY) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, TOTAL); j++) {
      batch.push(sendOne(j));
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }

  const elapsedMs = Date.now() - start;
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  const byType = {
    MT103: results.filter(r => r.type === 'MT103'),
    MT202: results.filter(r => r.type === 'MT202')
  };

  function summarize(list) {
    const s = list.filter(r => r.ok).length;
    const f = list.length - s;
    const pub = list.reduce((acc, r) => acc + (Number.isFinite(r.publishedCount) ? r.publishedCount : 0), 0);
    return { total: list.length, success: s, failed: f, publishedCountSum: pub };
  }

  const s103 = summarize(byType.MT103);
  const s202 = summarize(byType.MT202);

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify({
    total: results.length,
    success: ok,
    failed: fail,
    elapsedMs,
    throughputPerSec: Number(((results.length / Math.max(1, elapsedMs)) * 1000).toFixed(2)),
    latencyMs: {
      min: latencies[0] || 0,
      avg: Number(avg.toFixed(2)),
      p95,
      max: latencies[latencies.length - 1] || 0
    },
    mt103: s103,
    mt202: s202,
    firstErrors: results.filter(r => !r.ok).slice(0, 5)
  }, null, 2));

  if (fail > 0) {
    process.exitCode = 2;
  }
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
