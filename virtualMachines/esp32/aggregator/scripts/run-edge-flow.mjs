const esp32Base = process.env.ESP32_BASE_URL || "http://192.168.2.115";
const backendBase = process.env.BACKEND_BASE_URL || "http://127.0.0.1:4000";

const message = [
  "MT103",
  "transactionId=FLOW-ESP32-001",
  "sender=BANKAUS33",
  "receiver=BANKBUS44",
  "amount=1250.50",
  "currency=USD"
].join("|");

async function callEsp32Direct() {
  const url = new URL("/pmachine/edge_ingress_stage", esp32Base);
  url.searchParams.set("message", message);

  const response = await fetch(url, { method: "POST" });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text
  };
}

async function callBackendEdgeIngest() {
  const url = new URL("/api/edge/ingest", backendBase);
  const payload = {
    inputQueue: "swift.mt103.inbound",
    message,
    sourceService: "copilot-edge-test",
    useEdge: true
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "system-admin" },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text
  };
}

async function callEdgeMetrics() {
  const url = new URL("/api/metrics/edge-offload", backendBase);
  const response = await fetch(url);
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text
  };
}

async function main() {
  console.log("=== ESP32 Direct Flow Test ===");
  try {
    const direct = await callEsp32Direct();
    console.log(JSON.stringify(direct, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  }

  console.log("\n=== Backend Edge Ingest Test ===");
  try {
    const backend = await callBackendEdgeIngest();
    console.log(JSON.stringify(backend, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  }

  console.log("\n=== Edge Metrics After Test ===");
  try {
    const metrics = await callEdgeMetrics();
    console.log(JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  }
}

main().catch((error) => {
  console.error("Test runner failed:", error.message);
  process.exit(1);
});
