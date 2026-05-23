const backendBase = process.env.BACKEND_BASE_URL || "http://localhost:4000";

const message = [
  "MT103",
  "transactionId=FLOW-BACKEND-EDGE-CHECK-001",
  "sender=BANKAUS33",
  "receiver=BANKBUS44",
  "amount=123.45",
  "currency=USD"
].join("|");

async function run() {
  const res = await fetch(`${backendBase}/api/edge/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      inputQueue: "swift.inbound",
      message,
      sourceService: "backend-edge-check",
      convertMtToXml: true
    }),
    signal: AbortSignal.timeout(10000)
  });

  const text = await res.text();
  console.log("STATUS", res.status);
  console.log(text);

  try {
    const payload = JSON.parse(text);
    const normalized = payload?.result?.deliveries?.[0]?.delivery?.normalizedMessage
      || payload?.result?.normalizedMessage
      || "";
    const looksXml = typeof normalized === "string" && normalized.trimStart().startsWith("<?xml");
    console.log("CONVERSION_LOCATION", payload?.conversion?.location || "unknown");
    console.log("XML_PROOF", looksXml ? "true" : "false");
    if (looksXml) {
      console.log("XML_PREFIX", normalized.slice(0, 120));
    }
  } catch {
    // Keep raw output for troubleshooting when backend doesn't return JSON.
  }
}

run().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
