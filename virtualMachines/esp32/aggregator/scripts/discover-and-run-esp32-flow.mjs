import { execSync } from "node:child_process";

const FLOW_MESSAGE = [
  "MT103",
  "transactionId=FLOW-ESP32-002",
  "sender=BANKAUS33",
  "receiver=BANKBUS44",
  "amount=777.01",
  "currency=USD"
].join("|");

function readArpIps() {
  const out = execSync("arp -a", { encoding: "utf8" });
  const ips = new Set();
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/\b192\.168\.2\.(\d{1,3})\b/);
    if (m) ips.add(`192.168.2.${m[1]}`);
  }
  return [...ips].sort((a, b) => Number(a.split(".")[3]) - Number(b.split(".")[3]));
}

async function fetchText(url, method = "GET", body = null) {
  const opts = { method, signal: AbortSignal.timeout(2500) };
  if (body) {
    opts.headers = { "Content-Type": "application/json", "x-user-id": "system-admin" };
    opts.body = body;
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function discoverEsp32() {
  const ips = readArpIps();
  for (const ip of ips) {
    try {
      const s = await fetchText(`http://${ip}/status`);
      if (!s.ok) continue;
      if (/ESP32|pmachine|FFS|nodeName/i.test(s.text)) {
        return { ip, statusPayload: s.text };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function run() {
  console.log("=== Discover ESP32 ===");
  const found = await discoverEsp32();
  if (!found) {
    console.log(JSON.stringify({ found: false, reason: "No ESP32 status endpoint detected on ARP-known IPs" }, null, 2));
    process.exit(2);
  }

  console.log(JSON.stringify({ found: true, ip: found.ip, status: found.statusPayload }, null, 2));

  console.log("\n=== Direct Flow On ESP32 ===");
  const u = new URL(`http://${found.ip}/pmachine/edge_ingress_stage`);
  u.searchParams.set("message", FLOW_MESSAGE);
  const direct = await fetchText(u.toString(), "POST");
  console.log(JSON.stringify(direct, null, 2));

  console.log("\n=== Backend Edge Ingest (for comparison) ===");
  const backendBody = JSON.stringify({
    inputQueue: "swift.mt103.inbound",
    message: FLOW_MESSAGE,
    sourceService: "copilot-edge-test",
    useEdge: true
  });
  const backend = await fetchText("http://127.0.0.1:4000/api/edge/ingest", "POST", backendBody);
  console.log(JSON.stringify(backend, null, 2));

  console.log("\n=== Metrics Snapshot ===");
  const metrics = await fetchText("http://127.0.0.1:4000/api/metrics/edge-offload");
  console.log(JSON.stringify(metrics, null, 2));
}

run().catch((e) => {
  console.error("Runner failure:", e.message);
  process.exit(1);
});
