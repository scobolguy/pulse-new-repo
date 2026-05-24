const backendBase = process.env.BACKEND_BASE_URL || 'http://localhost:4000';
const durationSeconds = Math.max(1, Number(process.env.DURATION_SECONDS || 3600));
const ratePerSecond = Math.max(1, Number(process.env.RATE_PER_SECOND || 1));
const intervalMs = Math.round(1000 / ratePerSecond);
const totalMessages = durationSeconds * ratePerSecond;
const sourceService = process.env.SOURCE_SERVICE || 'bonecrusher-1tps-1h';

function yymmddUtc() {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function mt103(index, runId) {
  const ref = `BC103${runId}${String(index).padStart(6, '0')}`;
  const amount = (1000 + (index % 9000) + ((index % 97) / 100)).toFixed(2).replace('.', ',');
  return [
    'MT103',
    `:20:${ref}`,
    ':23B:CRED',
    `:32A:${yymmddUtc()}USD${amount}`,
    ':50K:/1234567890',
    'SENDER TEST',
    ':59:/9876543210',
    'RECEIVER TEST',
    ':71A:SHA'
  ].join('\n');
}

function mt202(index, runId) {
  const ref = `BC202${runId}${String(index).padStart(6, '0')}`;
  const rel = `REL${String(index).padStart(8, '0')}`;
  const amount = (2000 + (index % 8000) + ((index % 83) / 100)).toFixed(2).replace('.', ',');
  return [
    'MT202',
    `:20:${ref}`,
    `:21:${rel}`,
    `:32A:${yymmddUtc()}USD${amount}`,
    ':58A:BANKUS33'
  ].join('\n');
}

function buildPayload(index, runId) {
  const isMt103 = index % 2 === 1;
  return isMt103
    ? {
        type: 'MT103',
        inputQueue: 'swift.inbound',
        message: mt103(index, runId)
      }
    : {
        type: 'MT202',
        inputQueue: 'mt202.inbound',
        message: mt202(index, runId)
      };
}

async function sendOne(index, runId) {
  const payload = buildPayload(index, runId);
  const started = Date.now();
  try {
    const res = await fetch(`${backendBase}/api/edge/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inputQueue: payload.inputQueue,
        message: payload.message,
        sourceService,
        convertMtToXml: false
      }),
      signal: AbortSignal.timeout(20000)
    });

    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - started,
      type: payload.type,
      queue: payload.inputQueue,
      bodySnippet: body.slice(0, 240)
    };
  } catch (error) {
    return {
      ok: false,
      status: 'NETWORK_ERROR',
      latencyMs: Date.now() - started,
      type: payload.type,
      queue: payload.inputQueue,
      bodySnippet: String(error?.message || error)
    };
  }
}

async function run() {
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  console.log(`Starting runId=${runId}`);
  console.log(`backendBase=${backendBase}`);
  console.log(`durationSeconds=${durationSeconds}`);
  console.log(`ratePerSecond=${ratePerSecond}`);
  console.log(`intervalMs=${intervalMs}`);
  console.log(`totalMessages=${totalMessages}`);

  let sent = 0;
  let ok = 0;
  let fail = 0;
  let ok103 = 0;
  let ok202 = 0;
  let fail103 = 0;
  let fail202 = 0;

  const latencies = [];
  const startedAt = Date.now();
  let nextTickAt = startedAt;

  while (sent < totalMessages) {
    sent += 1;
    const result = await sendOne(sent, runId);

    if (result.ok) {
      ok += 1;
      latencies.push(result.latencyMs);
      if (result.type === 'MT103') ok103 += 1;
      else ok202 += 1;
    } else {
      fail += 1;
      if (result.type === 'MT103') fail103 += 1;
      else fail202 += 1;
      console.log(`ERR idx=${sent} type=${result.type} status=${result.status} msg=${result.bodySnippet}`);
    }

    if (sent % 60 === 0 || sent === totalMessages) {
      const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const achievedRate = (sent / elapsedSec).toFixed(2);
      console.log(`Progress sent=${sent}/${totalMessages} ok=${ok} fail=${fail} achievedRate=${achievedRate}/s`);
    }

    nextTickAt += intervalMs;
    const delay = nextTickAt - Date.now();
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const sorted = latencies.slice().sort((a, b) => a - b);
  const avg = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : -1;
  const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : -1;
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : -1;

  const summary = {
    runId,
    backendBase,
    durationSeconds,
    ratePerSecond,
    totalMessages,
    sent,
    ok,
    fail,
    byType: {
      mt103: { ok: ok103, fail: fail103 },
      mt202: { ok: ok202, fail: fail202 }
    },
    elapsedMs,
    achievedRatePerSecond: Number((sent / Math.max(1, elapsedMs / 1000)).toFixed(3)),
    latencyMs: {
      avg,
      p50,
      p95,
      min: sorted[0] ?? -1,
      max: sorted[sorted.length - 1] ?? -1
    }
  };

  console.log('=== FINAL SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  if (fail > 0) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error(`FATAL ${error?.message || error}`);
  process.exit(1);
});
