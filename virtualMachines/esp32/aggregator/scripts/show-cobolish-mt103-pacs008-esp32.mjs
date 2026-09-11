import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve('.');
const DEMO_DIR = path.join(ROOT, 'data', 'cbds', 'cobolish-demo');
const BASE = (process.env.ESP32_BASE_URL || `http://${process.env.ESP32_HOST || '192.168.2.155'}`).replace(/\/+$/, '');

async function postForm(url, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} failed (${response.status}): ${text}`);
  return text;
}

function section(title, body) {
  console.log(`\n=== ${title} ${'='.repeat(Math.max(0, 64 - title.length))}`);
  console.log(body);
}

export async function runCobolishMt103ToPacs008() {
  const source = await fs.readFile(path.join(DEMO_DIR, 'cbds-converter.cob'), 'utf8');
  const pcode = await fs.readFile(path.join(DEMO_DIR, 'cbds-converter.pcode'), 'utf8');
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
  const remotePcode = '/cobolish.pc';
  const remoteMap = '/cobolish.map.json';

  const responseText = await postForm(`${BASE}/pmachine/execute_file`, {
    file: remotePcode,
    programMap: remoteMap,
    inputQueue: 'swift.mt103.parsed',
    message: input,
    max: String(Math.max(32768, pcode.length * 2))
  });
  const response = JSON.parse(responseText);
  const delivery = response.deliveries?.find((item) => item.queueName === 'cbds.pacs.outbound');

  section('ESP32 SERVICE', source);
  section('MT103 INPUT', input);
  section('ESP32 EXECUTION', JSON.stringify({
    device: BASE,
    runtime: response.runtimeUnit,
    stepCount: response.stepCount,
    publishedCount: response.publishedCount,
    deliveryQueue: delivery?.queueName || null,
    messageFormat: delivery?.messageFormat || 'json'
  }, null, 2));
  section('PACS.008 REPLY FROM ESP32', delivery?.message || '(no delivery)');

  if (!delivery) process.exitCode = 1;

  return {
    response,
    delivery,
    input,
    serviceSource: source
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCobolishMt103ToPacs008().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
  });
}
