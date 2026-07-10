const base = process.env.ESP32_BASE_URL || 'http://192.168.2.157';
const total = 100;
const maxRetries = 20;

function buildMessage(i) {
  const tx = `RETRY200-${Date.now()}-${String(i).padStart(3,'0')}`;
  const amount = (100 + i / 100).toFixed(2);
  return `MT103|transactionId=${tx}|sender=BANKAUS33|receiver=BANKBUS44|amount=${amount}|currency=USD`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendOne(i) {
  let attempts = 0;
  while (attempts < maxRetries) {
    attempts += 1;
    const msg = buildMessage(i);
    const url = new URL('/pmachine/edge_ingress_stage', base);
    url.searchParams.set('async', '0');
    url.searchParams.set('runRouter', '1');
    url.searchParams.set('inputQueue', 'swift.mt103.inbound');
    url.searchParams.set('sourceType', 'MT103');
    url.searchParams.set('destinationType', 'PACS008');
    url.searchParams.set('mapKey', 'MT103->PACS008');
    url.searchParams.set('message', msg);

    let status = -1;
    let body = '';
    try {
      const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(20000) });
      status = res.status;
      body = await res.text();
      if (status === 200) {
        return { ok: true, attempts, status };
      }
    } catch (e) {
      body = e && e.message ? e.message : String(e);
    }

    console.log(`msg=${i} attempt=${attempts} status=${status} retrying_in_ms=1000 sample=${String(body).slice(0,120).replace(/\s+/g,' ')}`);
    await sleep(1000);
  }
  return { ok: false, attempts: maxRetries, status: -1 };
}

(async () => {
  const started = Date.now();
  let ok = 0;
  let failed = 0;
  let totalAttempts = 0;

  for (let i = 1; i <= total; i += 1) {
    const r = await sendOne(i);
    totalAttempts += r.attempts;
    if (r.ok) {
      ok += 1;
      console.log(`accepted msg=${i} attempts=${r.attempts} status=200`);
    } else {
      failed += 1;
      console.log(`failed msg=${i} attempts=${r.attempts}`);
    }
  }

  const elapsedMs = Date.now() - started;
  console.log('=== RETRY-200 SUMMARY ===');
  console.log(`base=${base}`);
  console.log(`messages=${total}`);
  console.log(`ok=${ok}`);
  console.log(`failed=${failed}`);
  console.log(`totalAttempts=${totalAttempts}`);
  console.log(`elapsedMs=${elapsedMs}`);
})();
