const base = process.env.ESP32_BASE_URL || "http://192.168.2.115";

async function main() {
  const params = new URLSearchParams({
    async: "1",
    runRouter: "0",
    message: "MT103\n:20:SMOKE-ASYNC-1\n:23B:CRED"
  });

  const submitUrl = `${base}/pmachine/edge_ingress_stage?${params.toString()}`;
  const startedAt = Date.now();
  const submitRes = await fetch(submitUrl, { method: "GET" });
  const submitText = await submitRes.text();

  console.log(`submitStatus=${submitRes.status}`);
  console.log(`submitBody=${submitText}`);

  let submitJson;
  try {
    submitJson = JSON.parse(submitText);
  } catch {
    throw new Error("submit response is not JSON");
  }

  const jobId = submitJson.jobId;
  if (!jobId) {
    throw new Error("submit response missing jobId");
  }

  const statusUrl = `${base}/pmachine/edge_ingress_status?jobId=${encodeURIComponent(jobId)}`;

  let polls = 0;
  let lastStatus = 0;
  let lastText = "";
  while (polls < 30) {
    polls += 1;
    const statusRes = await fetch(statusUrl);
    lastStatus = statusRes.status;
    lastText = await statusRes.text();

    let statusJson;
    try {
      statusJson = JSON.parse(lastText);
    } catch {
      statusJson = null;
    }

    if (statusJson && statusJson.state === "completed") {
      const elapsedMs = Date.now() - startedAt;
      console.log(`jobId=${jobId}`);
      console.log(`polls=${polls}`);
      console.log(`statusPoll=${lastStatus}`);
      console.log(`elapsedMs=${elapsedMs}`);
      console.log(`statusBody=${lastText}`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`job did not complete in time; lastStatus=${lastStatus}; lastBody=${lastText}`);
}

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
