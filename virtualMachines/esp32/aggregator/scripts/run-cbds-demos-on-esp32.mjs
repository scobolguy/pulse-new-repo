// Run the three CBDS demos (Pascalish / VBish / Cobolish) on an ESP32 PMachine
// and verify each produces the same PACS.008 as the JS PMachine.
//
//   node scripts/run-cbds-demos-on-esp32.mjs
//   ESP32_HOST=192.168.2.155 node scripts/run-cbds-demos-on-esp32.mjs
//
// Reuses the proven device flow from pmachine-target-esp32.mjs: sign the program
// map, upload pcode + map over FFS with short names, then execute_file with the
// router context. Output is compared to the JS demo artifacts (timestamp excluded).
import fs from 'fs/promises';
import path from 'path';
import { attachPcodeSignature } from './pcode-signing.mjs';

const ROOT = path.resolve('.');
const HOST = (process.env.ESP32_HOST || '192.168.2.155').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const BASE = process.env.ESP32_BASE_URL || `http://${HOST}`;

const DEMOS = [
  { name: 'pascalish', dir: 'data/cbds/pascalish-demo', pcode: 'cbds-converter.pcode' },
  { name: 'vbish', dir: 'data/cbds/vbish-demo', pcode: 'vbish-mt103-to-pacs008.pcode' },
  { name: 'cobolish', dir: 'data/cbds/cobolish-demo', pcode: 'cbds-converter.pcode' }
];

async function postForm(url, params, label) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text, label };
}

async function uploadOrThrow(url, params, label) {
  const r = await postForm(url, params, label);
  if (!r.ok) throw new Error(`${label} failed (${r.status}): ${r.text.slice(0, 200)}`);
  return r.text;
}

// Strip the run-timestamp so device and JS outputs can be compared for parity.
function stripVolatile(pacsObject) {
  const clone = JSON.parse(JSON.stringify(pacsObject));
  try { delete clone.Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm; } catch { /* ignore */ }
  return clone;
}

async function runDemo(demo) {
  const pcodePath = path.join(ROOT, demo.dir, demo.pcode);
  const inputPath = path.join(ROOT, demo.dir, 'mt103-input.json');
  const programMapPath = path.join(ROOT, demo.dir, 'cbds-converter.program.json');
  const jsOutPath = path.join(ROOT, demo.dir, 'pacs008-output.json');

  const pcodeText = await fs.readFile(pcodePath, 'utf-8');
  const pcode = pcodeText.endsWith('\n') ? pcodeText : `${pcodeText}\n`;
  const programMap = attachPcodeSignature(JSON.parse(await fs.readFile(programMapPath, 'utf-8')), pcode);
  const programMapText = `${JSON.stringify(programMap, null, 2)}\n`;
  const inputMessage = await fs.readFile(inputPath, 'utf-8');

  // Short remote names: the FFS upload handler rejects long filenames.
  const remotePcode = `/${demo.name}.pc`;
  const remoteMap = `/${demo.name}.map.json`;
  const remoteInput = `/${demo.name}-input.json`;

  await uploadOrThrow(`${BASE}/ffs/upload`, { file: remotePcode, body: pcode }, `[${demo.name}] upload pcode`);
  await uploadOrThrow(`${BASE}/ffs/upload`, { file: remoteMap, body: programMapText }, `[${demo.name}] upload program map`);
  await uploadOrThrow(`${BASE}/ffs/upload`, { file: remoteInput, body: inputMessage }, `[${demo.name}] upload input`);

  const run = await postForm(`${BASE}/pmachine/execute_file`, {
    file: remotePcode,
    programMap: remoteMap,
    inputQueue: 'swift.mt103.parsed',
    message: inputMessage,
    max: String(Math.max(32768, pcode.length * 2))
  }, `[${demo.name}] execute_file`);

  if (!run.ok) {
    return { name: demo.name, pass: false, error: `execute_file ${run.status}: ${run.text.slice(0, 300)}` };
  }

  let payload;
  try { payload = JSON.parse(run.text); } catch {
    return { name: demo.name, pass: false, error: `non-JSON device response: ${run.text.slice(0, 300)}` };
  }
  if (payload.runtimeError) {
    return { name: demo.name, pass: false, error: `runtimeError: ${payload.runtimeError}` };
  }

  const delivery = (payload.deliveries || []).find((d) => d.queueName === 'cbds.pacs.outbound');
  if (!delivery) {
    return { name: demo.name, pass: false, error: 'no cbds.pacs.outbound delivery', deliveries: payload.deliveries || [] };
  }

  let devicePacs;
  try { devicePacs = JSON.parse(String(delivery.message || '{}')); } catch {
    return { name: demo.name, pass: false, error: 'delivery message was not valid JSON' };
  }

  // Parity vs the JS PMachine output for the same demo.
  const jsPacs = JSON.parse(await fs.readFile(jsOutPath, 'utf-8'));
  const match = JSON.stringify(stripVolatile(devicePacs)) === JSON.stringify(stripVolatile(jsPacs));

  return {
    name: demo.name,
    pass: match,
    parity: match,
    instructionCount: payload.instructionCount,
    binaryBytes: payload.binaryBytes,
    stepCount: payload.stepCount,
    freeHeapBytes: payload.memoryPressure?.freeHeapBytes,
    deliveries: (payload.deliveries || []).length,
    mapperId: (payload.deliveries || [])[0] ? '(delivered)' : null,
    device: payload
  };
}

async function main() {
  console.log(`ESP32 target: ${BASE}`);
  const results = [];
  for (const demo of DEMOS) {
    try {
      results.push(await runDemo(demo));
    } catch (err) {
      results.push({ name: demo.name, pass: false, error: err.message });
    }
  }

  console.log('\n=== ESP32 RESULTS ==============================================');
  for (const r of results) {
    if (r.pass) {
      console.log(`  PASS  ${r.name.padEnd(10)} instructions=${r.instructionCount} steps=${r.stepCount} deliveries=${r.deliveries} freeHeap=${r.freeHeapBytes}B  (output identical to JS)`);
    } else {
      console.log(`  FAIL  ${r.name.padEnd(10)} ${r.error}`);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} demos passed on the ESP32 with output identical to the JS PMachine`);

  const outPath = path.join(ROOT, 'data', 'cbds', 'esp32-demo-results.json');
  await fs.writeFile(outPath, `${JSON.stringify({ target: BASE, ranAt: new Date().toISOString(), results: results.map(({ device, ...rest }) => rest) }, null, 2)}\n`, 'utf-8');
  console.log(`Results written to ${path.relative(ROOT, outPath)}`);

  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
