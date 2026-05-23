const base = "http://192.168.2.115";
const message = [
  "MT103",
  "transactionId=FLOW-ESP32-DIRECT-001",
  "sender=BANKAUS33",
  "receiver=BANKBUS44",
  "amount=100.01",
  "currency=USD"
].join("|");

async function run() {
  try {
    const statusRes = await fetch(`${base}/status`, { signal: AbortSignal.timeout(3000) });
    const statusText = await statusRes.text();
    console.log("STATUS", statusRes.status, statusText);
  } catch (e) {
    console.log("STATUS_ERR", e.message);
  }

  try {
    const url = new URL(`${base}/pmachine/edge_ingress_stage`);
    url.searchParams.set("message", message);
    url.searchParams.set("runRouter", "0");
    url.searchParams.set("async", "0");
    url.searchParams.set("convertMtToXml", "1");
    const flowRes = await fetch(url, { method: "POST", signal: AbortSignal.timeout(5000) });
    const flowText = await flowRes.text();
    console.log("FLOW", flowRes.status, flowText);
    try {
      const parsed = JSON.parse(flowText);
      const normalized = parsed?.normalizedMessage || "";
      const looksXml = typeof normalized === "string" && normalized.trimStart().startsWith("<?xml");
      console.log("ESP32_XML_PROOF", looksXml ? "true" : "false");
      if (looksXml) {
        console.log("ESP32_XML_PREFIX", normalized.slice(0, 120));
      }
    } catch {
      // keep raw output for debugging
    }
  } catch (e) {
    console.log("FLOW_ERR", e.message);
  }

  try {
    const url = new URL(`${base}/pmachine/edge_ingress_stage`);
    url.searchParams.set("message", message);
    const flowRes = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) });
    const flowText = await flowRes.text();
    console.log("FLOW_GET", flowRes.status, flowText);
  } catch (e) {
    console.log("FLOW_GET_ERR", e.message);
  }
}

run();
