const base = 'http://192.168.2.115';

async function getStatus(label) {
  const res = await fetch(`${base}/bonecrusher/worker/status`);
  const text = await res.text();
  console.log(`=== ${label} ===`);
  console.log(`HTTP ${res.status}`);
  console.log(text);
}

async function setConfig() {
  const body = new URLSearchParams({
    queueName: 'esp32.shared.persist.proof',
    pollIntervalMs: '333',
    persist: '1',
    enabled: '1'
  });

  const res = await fetch(`${base}/bonecrusher/worker/config`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const text = await res.text();
  console.log('=== UPDATE RESPONSE ===');
  console.log(`HTTP ${res.status}`);
  console.log(text);
  if (!res.ok) {
    process.exitCode = 1;
  }
}

(async () => {
  try {
    await getStatus('BEFORE UPDATE');
    await setConfig();
    await getStatus('AFTER UPDATE');
  } catch (error) {
    console.error('Persist proof failed:', error?.message || String(error));
    process.exitCode = 1;
  }
})();
