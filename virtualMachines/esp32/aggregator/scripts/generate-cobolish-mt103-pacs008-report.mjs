import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('.');
const DEMO_DIR = path.join(ROOT, 'data', 'cbds', 'cobolish-demo');
const BASE = (process.env.ESP32_BASE_URL || `http://${process.env.ESP32_HOST || '192.168.2.155'}`).replace(/\/+$/, '');
const OUTPUT = path.join(DEMO_DIR, 'mt103-pacs008-esp32-test.html');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function executeOnEsp32(message) {
  const response = await fetch(`${BASE}/pmachine/execute_file`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      file: '/cobolish.pc',
      programMap: '/cobolish.map.json',
      inputQueue: 'swift.mt103.parsed',
      message,
      max: '32768'
    }),
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`ESP32 execution failed (${response.status}): ${text}`);
  return JSON.parse(text);
}

async function main() {
  const source = await fs.readFile(path.join(DEMO_DIR, 'cbds-converter.cob'), 'utf8');
  const input = [
    'MT103',
    ':20:CBDSREF123456',
    ':21:CBDS-E2E-0001',
    ':23B:CRED',
    ':32A:260702CAD12500,45',
    ':33B:CAD12500,45',
    ':50K:/123456789',
    'ALPHA IMPORTS LTD',
    ':52A:ROYCCAT2',
    ':53A:BOFACATT',
    ':56A:CITIUS33',
    ':57A:TDOMCATTTOR',
    ':59:/000987654321',
    'BETA SUPPLIES INC',
    ':70:INV-2026-07-02',
    ':71A:SHA',
    ':71B:15,00',
    ':72:/INS/CBDS ROUTING'
  ].join('\n');
  const execution = await executeOnEsp32(input);
  const delivery = execution.deliveries?.find((item) => item.queueName === 'cbds.pacs.outbound');
  if (!delivery) throw new Error('ESP32 returned no cbds.pacs.outbound delivery');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>COBOLish MT103 to PACS.008 ESP32 Test</title>
<style>
:root { color-scheme: light; --ink:#17212b; --muted:#65727e; --line:#d8e0e7; --blue:#1769aa; --green:#087f5b; --paper:#f5f7fa; }
* { box-sizing:border-box; }
body { margin:0; color:var(--ink); background:var(--paper); font:15px/1.5 Georgia, serif; }
main { max-width:1280px; margin:0 auto; padding:32px 22px 64px; }
header { border-bottom:4px solid var(--blue); padding-bottom:22px; margin-bottom:24px; }
h1 { margin:0 0 8px; font:700 34px/1.1 Georgia, serif; }
h2 { margin:28px 0 10px; font:700 22px/1.2 Georgia, serif; }
p { margin:6px 0; }
.meta { color:var(--muted); }
.status { display:inline-block; padding:6px 12px; color:white; background:var(--green); border-radius:4px; font:700 13px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; margin:18px 0; }
.card { background:white; border:1px solid var(--line); padding:14px; }
.label { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
.value { margin-top:4px; font:600 15px ui-monospace, SFMono-Regular, Consolas, monospace; word-break:break-word; }
pre { overflow:auto; white-space:pre-wrap; word-break:break-word; background:#101820; color:#e8f0f5; border-left:4px solid var(--blue); padding:18px; margin:0; font:13px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }
.xml { border-left-color:var(--green); }
.note { color:var(--muted); font-style:italic; }
</style>
</head>
<body>
<main>
<header>
  <span class="status">ESP32 TEST PASSED</span>
  <h1>COBOLish MT103 to PACS.008</h1>
  <p class="meta">Fresh execution against ${escapeHtml(BASE)} using FFS-resident <code>/cobolish.pc</code> and <code>/cobolish.map.json</code>.</p>
</header>
<section class="grid">
  <div class="card"><div class="label">Service</div><div class="value">${escapeHtml(execution.runtimeUnit?.id || 'cbds-converter')}</div></div>
  <div class="card"><div class="label">Input Queue</div><div class="value">swift.mt103.parsed</div></div>
  <div class="card"><div class="label">Output Queue</div><div class="value">${escapeHtml(delivery.queueName)}</div></div>
  <div class="card"><div class="label">Message Format</div><div class="value">${escapeHtml(delivery.messageFormat || 'xml')}</div></div>
  <div class="card"><div class="label">Instructions / Steps</div><div class="value">${escapeHtml(execution.instructionCount)} / ${escapeHtml(execution.stepCount)}</div></div>
</section>
<h2>COBOLish Service Source</h2>
<pre>${escapeHtml(source)}</pre>
<h2>MT103 Input</h2>
<pre>${escapeHtml(input)}</pre>
<h2>PACS.008 XML Reply</h2>
<pre class="xml">${escapeHtml(delivery.message)}</pre>
<p class="note">The mapper is declared in the COBOLish DATA DIVISION MAPPING SECTION and executed by the ESP32 PMachine.</p>
</main>
</body>
</html>
`;

  await fs.writeFile(OUTPUT, html, 'utf8');
  console.log(path.relative(ROOT, OUTPUT));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
