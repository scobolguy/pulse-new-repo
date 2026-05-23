async function probe(method, msg) {
  try {
    const url = new URL("http://192.168.2.115/pmachine/edge_ingress_stage");
    url.searchParams.set("message", msg);
    const res = await fetch(url, { method, signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    console.log(`${method} msg='${msg}' => ${res.status} ${text}`);
  } catch (e) {
    console.log(`${method} msg='${msg}' => ERR ${e.message}`);
  }
}

await probe("GET", "ping");
await probe("POST", "ping");
await probe("GET", "MT103");
await probe("POST", "MT103");
