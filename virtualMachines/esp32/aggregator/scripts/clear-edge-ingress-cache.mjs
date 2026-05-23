const base = process.env.ESP32_BASE_URL || "http://192.168.2.115";

async function run() {
  const res = await fetch(`${base}/pmachine/edge_ingress_cache/clear`, {
    method: "POST",
    signal: AbortSignal.timeout(5000)
  });

  const text = await res.text();
  console.log(`status=${res.status}`);
  console.log(text);
}

run().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
