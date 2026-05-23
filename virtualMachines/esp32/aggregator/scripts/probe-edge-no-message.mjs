const base = "http://192.168.2.115/pmachine/edge_ingress_stage";

async function probe(method) {
  try {
    const res = await fetch(base, { method, signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    console.log(`${method} ${res.status} ${text}`);
  } catch (e) {
    console.log(`${method}_ERR ${e.message}`);
  }
}

await probe("POST");
await probe("GET");
