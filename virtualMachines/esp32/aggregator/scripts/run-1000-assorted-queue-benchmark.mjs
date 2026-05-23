const backendBase = process.env.BACKEND_BASE_URL || "http://localhost:4000";
const actorHeader = { "x-user-id": "system-admin", "content-type": "application/json" };

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const queueNames = {
  mt103: `bench.${runId}.mt103.inbound`,
  mt202: `bench.${runId}.mt202.inbound`,
  mt202cov: `bench.${runId}.mt202cov.inbound`
};

const targetMix = {
  [queueNames.mt103]: 334,
  [queueNames.mt202]: 333,
  [queueNames.mt202cov]: 333
};

async function getQueueStatus() {
  const res = await fetch(`${backendBase}/api/queues/status`, {
    headers: { "x-user-id": "system-admin" },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`queue status failed: ${res.status}`);
  const payload = await res.json();
  return Array.isArray(payload.queues) ? payload.queues : [];
}

function toDepthMap(statusRows) {
  return new Map(
    statusRows.map((q) => [String(q.queue || ""), Number(q.depth || 0)])
  );
}

async function dequeueOnce(queueName) {
  const res = await fetch(`${backendBase}/api/queue/${encodeURIComponent(queueName)}/dequeue`, {
    method: "POST",
    headers: actorHeader,
    body: JSON.stringify({ consumerService: "bench-reset" }),
    signal: AbortSignal.timeout(10000)
  });
  if (res.status === 404) return false;
  if (res.status === 500) {
    const text = await res.text();
    if (text.includes('not configured')) return false;
    throw new Error(`dequeue ${queueName} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`dequeue ${queueName} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return true;
}

async function drainQueue(queueName, maxOps = 20000) {
  let removed = 0;
  while (removed < maxOps) {
    const hadItem = await dequeueOnce(queueName);
    if (!hadItem) break;
    removed += 1;
  }
  return removed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMessage(kind, index) {
  const ref = `${kind}-${String(index).padStart(6, "0")}`;
  if (kind === "MT103") {
    return `MT103\n:20:${ref}\n:23B:CRED\n:32A:260522USD1000,00\n:50K:/11112222\nSENDER\n:59:/33334444\nRECEIVER\n:71A:SHA`;
  }
  if (kind === "MT202") {
    return `MT202\n:20:${ref}\n:21:REL${ref}\n:32A:260522USD2500,00\n:58A:BANKUS33`;
  }
  return `MT202COV\n:20:${ref}\n:21:REL${ref}\n:32A:260522USD3500,00\n:58A:BANKUS33\n:72:/INS/cover-payment`;
}

async function enqueue(queueName, message, sourceService) {
  const res = await fetch(`${backendBase}/api/queue/${encodeURIComponent(queueName)}/enqueue`, {
    method: "POST",
    headers: actorHeader,
    body: JSON.stringify({ message, sourceService }),
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`enqueue ${queueName} failed: ${res.status} ${text.slice(0, 240)}`);
  }
  return res.json();
}

async function run() {
  console.log("PHASE 1: resetting benchmark queues only");
  const resetCounts = {};
  for (const queueName of Object.keys(targetMix)) {
    resetCounts[queueName] = await drainQueue(queueName);
  }
  console.log(`resetRemoved=${JSON.stringify(resetCounts)}`);

  console.log("PHASE 2: capturing baseline counters");
  const initial = await getQueueStatus();
  const initialMap = toDepthMap(initial);
  const baseline = {
    [queueNames.mt103]: initialMap.get(queueNames.mt103) || 0,
    [queueNames.mt202]: initialMap.get(queueNames.mt202) || 0,
    [queueNames.mt202cov]: initialMap.get(queueNames.mt202cov) || 0
  };

  console.log(`baseline=${JSON.stringify(baseline)}`);

  console.log("PHASE 3: enqueueing 1000 assorted messages");
  const jobs = [];
  let idx = 0;
  for (let i = 0; i < targetMix[queueNames.mt103]; i += 1) {
    idx += 1;
    jobs.push({ queueName: queueNames.mt103, kind: "MT103", index: idx });
  }
  for (let i = 0; i < targetMix[queueNames.mt202]; i += 1) {
    idx += 1;
    jobs.push({ queueName: queueNames.mt202, kind: "MT202", index: idx });
  }
  for (let i = 0; i < targetMix[queueNames.mt202cov]; i += 1) {
    idx += 1;
    jobs.push({ queueName: queueNames.mt202cov, kind: "MT202COV", index: idx });
  }

  const started = performance.now();
  let ok = 0;
  for (const job of jobs) {
    await enqueue(job.queueName, buildMessage(job.kind, job.index), "bench-1000-assorted");
    ok += 1;
  }
  const elapsedMs = Math.max(1, performance.now() - started);
  const tps = (ok / (elapsedMs / 1000));

  const expected = {
    [queueNames.mt103]: targetMix[queueNames.mt103],
    [queueNames.mt202]: targetMix[queueNames.mt202],
    [queueNames.mt202cov]: targetMix[queueNames.mt202cov]
  };

  console.log("PHASE 4: validating final queue counts");
  let final = {
    [queueNames.mt103]: 0,
    [queueNames.mt202]: 0,
    [queueNames.mt202cov]: 0
  };
  let actualDelta = {
    [queueNames.mt103]: 0,
    [queueNames.mt202]: 0,
    [queueNames.mt202cov]: 0
  };
  let attempts = 0;
  while (attempts < 10) {
    attempts += 1;
    const finalStatus = await getQueueStatus();
    const finalMap = toDepthMap(finalStatus);

    final = {
      [queueNames.mt103]: finalMap.get(queueNames.mt103) || 0,
      [queueNames.mt202]: finalMap.get(queueNames.mt202) || 0,
      [queueNames.mt202cov]: finalMap.get(queueNames.mt202cov) || 0
    };

    actualDelta = {
      [queueNames.mt103]: final[queueNames.mt103] - baseline[queueNames.mt103],
      [queueNames.mt202]: final[queueNames.mt202] - baseline[queueNames.mt202],
      [queueNames.mt202cov]: final[queueNames.mt202cov] - baseline[queueNames.mt202cov]
    };

    const settled = Object.keys(expected).every((k) => actualDelta[k] === expected[k]);
    if (settled) break;
    await sleep(500);
  }

  const mismatches = Object.keys(expected).filter(k => expected[k] !== actualDelta[k]);

  console.log("\n=== RESULT ===");
  console.log(`runId=${runId}`);
  console.log(`queues=${JSON.stringify(queueNames)}`);
  console.log(`sent=${ok}`);
  console.log(`elapsedMs=${Math.round(elapsedMs)}`);
  console.log(`txPerSecond=${tps.toFixed(2)}`);
  console.log(`baseline=${JSON.stringify(baseline)}`);
  console.log(`final=${JSON.stringify(final)}`);
  console.log(`validationAttempts=${attempts}`);
  console.log(`expected=${JSON.stringify(expected)}`);
  console.log(`actualDelta=${JSON.stringify(actualDelta)}`);
  console.log(`countsMatch=${mismatches.length === 0}`);

  if (mismatches.length > 0) {
    console.log(`mismatches=${JSON.stringify(mismatches)}`);
    process.exitCode = 2;
  }
}

run().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
