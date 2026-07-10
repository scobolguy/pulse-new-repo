const base = process.env.ESP32_BASE_URL || 'http://192.168.2.157';
const total = 100;

function buildMessage(i) {
  const tx = `XMLCHK-${Date.now()}-${String(i).padStart(3,'0')}`;
  const amount = (100 + i / 100).toFixed(2);
  return `MT103|transactionId=${tx}|sender=BANKAUS33|receiver=BANKBUS44|amount=${amount}|currency=USD`;
}

function extractCandidateXml(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';
  if (typeof parsed.normalizedMessage === 'string') return parsed.normalizedMessage;
  if (Array.isArray(parsed.deliveries) && parsed.deliveries.length > 0) {
    const msg = parsed.deliveries[0]?.message;
    if (typeof msg === 'string') return msg;
  }
  return '';
}

function looksLikePacsXml(xml) {
  if (typeof xml !== 'string' || !xml.trim()) return false;
  const s = xml.trim();
  return s.startsWith('<?xml') && s.includes('<Document') && (s.includes('pacs.008') || s.includes('FIToFICstmrCdtTrf'));
}

(async () => {
  let httpOk = 0;
  let xmlOk = 0;
  let failures = 0;
  const samples = [];

  for (let i = 1; i <= total; i += 1) {
    const url = new URL('/pmachine/edge_ingress_stage', base);
    url.searchParams.set('async', '0');
    url.searchParams.set('runRouter', '1');
    url.searchParams.set('convertMtToXml', '1');
    url.searchParams.set('inputQueue', 'swift.mt103.inbound');
    url.searchParams.set('sourceType', 'MT103');
    url.searchParams.set('destinationType', 'PACS008');
    url.searchParams.set('mapKey', 'MT103->PACS008');
    url.searchParams.set('message', buildMessage(i));

    try {
      const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(20000) });
      const txt = await res.text();
      if (res.status === 200) httpOk += 1;

      let parsed = null;
      try { parsed = JSON.parse(txt); } catch {}
      const xml = extractCandidateXml(parsed);
      const ok = res.status === 200 && looksLikePacsXml(xml);
      if (ok) {
        xmlOk += 1;
      } else {
        failures += 1;
        if (samples.length < 5) {
          samples.push({
            i,
            status: res.status,
            bodyPreview: txt.slice(0, 220).replace(/\s+/g, ' '),
            xmlPreview: String(xml).slice(0, 180).replace(/\s+/g, ' ')
          });
        }
      }
    } catch (e) {
      failures += 1;
      if (samples.length < 5) {
        samples.push({ i, status: -1, error: String(e && e.message ? e.message : e) });
      }
    }
  }

  console.log('=== XML VERIFICATION SUMMARY ===');
  console.log(`base=${base}`);
  console.log(`messages=${total}`);
  console.log(`http200=${httpOk}`);
  console.log(`xmlLooksCorrect=${xmlOk}`);
  console.log(`failures=${failures}`);
  if (samples.length) {
    console.log('sampleFailures=' + JSON.stringify(samples));
  }
})();
