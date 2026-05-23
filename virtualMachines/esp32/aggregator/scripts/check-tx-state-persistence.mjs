const backendBase = process.env.BACKEND_BASE_URL || "http://localhost:4000";

async function run() {
  const res = await fetch(`${backendBase}/api/lifecycle/tx-state-persistence`, {
    headers: { "x-user-id": "system-admin" },
    signal: AbortSignal.timeout(10000)
  });
  const text = await res.text();
  console.log("STATUS", res.status);
  console.log(text);
}

run().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
