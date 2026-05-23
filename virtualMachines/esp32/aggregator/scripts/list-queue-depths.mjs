const backendBase = process.env.BACKEND_BASE_URL || "http://localhost:4000";

async function run() {
  const res = await fetch(`${backendBase}/api/queues/status`, {
    headers: { "x-user-id": "system-admin" },
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`status=${res.status} body=${text.slice(0, 300)}`);
  }

  const payload = await res.json();
  const queues = Array.isArray(payload.queues) ? payload.queues : [];

  if (queues.length === 0) {
    console.log("NO_QUEUES");
    return;
  }

  queues.sort((a, b) => String(a.queue).localeCompare(String(b.queue)));

  for (const q of queues) {
    console.log(`${q.queue}\t${Number(q.depth || 0)}`);
  }
}

run().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
