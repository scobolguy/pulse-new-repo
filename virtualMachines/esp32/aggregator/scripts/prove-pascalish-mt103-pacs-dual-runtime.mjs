import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';
import { compileRouterMapperDSL } from './compile-pascal.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

const ROOT = path.resolve('.');
const SOURCE_PATH = path.resolve(process.env.PASCALISH_SOURCE || 'data/cbds/pascalish-demo/cbds-converter.pas');
const EVIDENCE_PATH = path.resolve(process.env.PASCALISH_PROOF_OUT || 'data/cbds/pascalish-demo/dual-runtime-proof.json');
const DISPLAY_BASE_URL = String(process.env.DISPLAY_BASE_URL || process.env.ESP32_BASE_URL || '').replace(/\/+$/, '');
const DISPLAY_ONLY = String(process.env.DISPLAY_ONLY || '').trim().toLowerCase() === '1'
  || String(process.env.DISPLAY_ONLY || '').trim().toLowerCase() === 'true';
const SKIP_DISPLAY_UPLOAD = String(process.env.SKIP_DISPLAY_UPLOAD || '').trim().toLowerCase() === '1'
  || String(process.env.SKIP_DISPLAY_UPLOAD || '').trim().toLowerCase() === 'true';
const DISPLAY_ASYNC = String(process.env.DISPLAY_ASYNC || '').trim().toLowerCase() === '1'
  || String(process.env.DISPLAY_ASYNC || '').trim().toLowerCase() === 'true';
const DISPLAY_STARTUP_WAIT_MS = Math.max(0, Number.parseInt(process.env.DISPLAY_STARTUP_WAIT_MS || '20000', 10) || 0);
const REPEAT_COUNT = Math.max(1, Number.parseInt(process.env.PROOF_REPEAT_COUNT || '1', 10) || 1);
const REMOTE_PCODE = '/display-mt103.pcode';
const REMOTE_MAP = '/display-mt103.map.json';
const INPUT_QUEUE = 'swift.mt103.parsed';
const OUTPUT_QUEUE = 'cbds.pacs.outbound';
const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: true,
  trimValues: true
});

const MT103_TEXT = [
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

function parseMt103ToObject(mtText) {
  const fields = {};
  let currentTag = null;
  for (const line of String(mtText).split(/\r?\n/)) {
    const match = line.match(/^:([0-9]{2}[A-Z]?):(.*)$/);
    if (match) {
      currentTag = match[1];
      fields[currentTag] = match[2] || '';
    } else if (currentTag) {
      fields[currentTag] = `${fields[currentTag]}\n${line}`.trim();
    }
  }
  const amount32 = String(fields['32A'] || '').match(/^(\d{6})([A-Z]{3})([0-9,.]+)$/);
  const amount33 = String(fields['33B'] || '').match(/^([A-Z]{3})([0-9,.]+)$/);
  return {
    block4: {
      '20': fields['20'] || '',
      '21': fields['21'] || '',
      '23B': fields['23B'] || '',
      '32A': { date: amount32?.[1] || '', currency: amount32?.[2] || '', amount: amount32?.[3] || '' },
      '33B': { currency: amount33?.[1] || '', amount: amount33?.[2] || '' },
      '50K': fields['50K'] || '',
      '52A': fields['52A'] || '',
      '53A': fields['53A'] || '',
      '56A': fields['56A'] || '',
      '57A': fields['57A'] || '',
      '59': fields['59'] || '',
      '70': fields['70'] || '',
      '71A': fields['71A'] || '',
      '71B': fields['71B'] || '',
      '72': fields['72'] || ''
    },
    meta: { createdAt: 'PROOF-TIMESTAMP' }
  };
}

function getByPath(value, dottedPath) {
  return String(dottedPath).split('.').reduce((cursor, part) => cursor?.[part], value);
}

function assertPacsDelivery(payload, label) {
  const delivery = (payload?.deliveries || []).find((item) => item?.queueName === OUTPUT_QUEUE || item?.outputQueue === OUTPUT_QUEUE);
  assert.ok(delivery, `${label}: missing ${OUTPUT_QUEUE} delivery`);
  const rawMessage = String(delivery.message || '{}');
  const message = rawMessage.trimStart().startsWith('<?xml')
    ? XML_PARSER.parse(rawMessage)
    : JSON.parse(rawMessage);
  const expected = {
    'Document.FIToFICstmrCdtTrf.GrpHdr.MsgId': 'CBDSREF123456',
    'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId': 'CBDS-E2E-0001',
    'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt': '2026-07-02',
    'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt': '12500.45',
    'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm': 'ALPHA IMPORTS LTD',
    'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm': 'BETA SUPPLIES INC',
    'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr': 'SHA'
  };
  for (const [field, value] of Object.entries(expected)) {
    assert.equal(String(getByPath(message, field)), String(value), `${label}: ${field}`);
  }
  return { queue: OUTPUT_QUEUE, rawMessage, message };
}

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function postForm(url, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', connection: 'close' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(60000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function postQuery(url, params) {
  const response = await fetch(`${url}?${new URLSearchParams(params).toString()}`, {
    method: 'POST',
    headers: { connection: 'close' },
    signal: AbortSignal.timeout(60000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHttpText(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers: { connection: 'close' } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode || 0, body }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(Object.assign(new Error('HTTP status poll timed out'), { name: 'TimeoutError' })));
    request.on('error', reject);
  });
}

async function runJs(pcodePath, mapPath, message) {
  const run = await runNode([
    'scripts/run-js-pmachine.mjs',
    '--pcode', pcodePath,
    '--program-map', mapPath,
    '--input-queue', INPUT_QUEUE,
    '--message', JSON.stringify(message)
  ]);
  if (run.code !== 0) throw new Error(`JS PMachine failed: ${run.stderr || run.stdout}`);
  return JSON.parse(run.stdout);
}

async function uploadDisplayArtifacts(pcodeText, signedMapText) {
  await postForm(`${DISPLAY_BASE_URL}/ffs/upload`, { file: REMOTE_PCODE, body: pcodeText });
  await postForm(`${DISPLAY_BASE_URL}/ffs/upload`, { file: REMOTE_MAP, body: signedMapText });
}

async function runDisplay(message) {
  return postQuery(`${DISPLAY_BASE_URL}/pmachine/execute_file`, {
    file: REMOTE_PCODE,
    programMap: REMOTE_MAP,
    runRouter: '0',
    inputQueue: INPUT_QUEUE,
    message: JSON.stringify(message),
    max: '65536'
  });
}

async function runDisplayAsync(message) {
  const accepted = await postForm(`${DISPLAY_BASE_URL}/pmachine/edge_ingress_stage`, {
    file: REMOTE_PCODE,
    programMap: REMOTE_MAP,
    inputQueue: INPUT_QUEUE,
    message: JSON.stringify(message),
    runRouter: '1',
    async: '1',
    max: '65536'
  });
  assert.ok(accepted?.jobId, 'Display async call did not return a job ID');

  const statusUrl = String(accepted.statusUrl || `/pmachine/edge_ingress_status?jobId=${accepted.jobId}`);
  const absoluteStatusUrl = statusUrl.startsWith('http') ? statusUrl : `${DISPLAY_BASE_URL}${statusUrl}`;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const statusResponse = await getHttpText(absoluteStatusUrl, 5000);
      const statusText = statusResponse.body;
      if (statusResponse.statusCode < 200 || statusResponse.statusCode >= 300) throw new Error(`Display async status HTTP ${statusResponse.statusCode}: ${statusText.slice(0, 300)}`);
      const status = JSON.parse(statusText);
      const terminalState = ['complete', 'completed', 'failed', 'error'].includes(String(status.state || '').toLowerCase());
      if (terminalState || Number(status.statusCode || 0) >= 400) {
        if (Number(status.statusCode || 0) >= 400) throw new Error(`Display async job failed: ${status.body || statusText}`);
        return {
          acknowledgement: accepted,
          completion: status,
          payload: typeof status.body === 'string' ? JSON.parse(status.body) : status.body
        };
      }
    } catch (error) {
      const errorName = String(error?.name || '').toLowerCase();
      if (!errorName.includes('abort') && !errorName.includes('timeout')) throw error;
    }
    await wait(250);
  }
  throw new Error(`Display async job ${accepted.jobId} timed out`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const source = await fs.readFile(SOURCE_PATH, 'utf8');
  const artifact = compileRouterMapperDSL(source);
  const pcodeText = artifact.pcodeText;
  const signedMap = attachPcodeSignature(structuredClone(artifact.programMap), pcodeText);
  const pacsRoute = (artifact.programMap?.entries || []).find((entry) => entry?.kind === 'router' && entry?.inputQueue === INPUT_QUEUE);
  assert.equal(pacsRoute?.outputs?.[0]?.dataTypeId, 'pacs', 'Pascalish route must declare PACS output type');
  const signedMapText = `${JSON.stringify(signedMap, null, 2)}\n`;
  const message = parseMt103ToObject(MT103_TEXT);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pascalish-dual-proof-'));
  const pcodePath = path.join(tmpDir, 'service.pcode');
  const mapPath = path.join(tmpDir, 'service.program.json');
  await fs.writeFile(pcodePath, pcodeText, 'utf8');
  await fs.writeFile(mapPath, signedMapText, 'utf8');

  const js = DISPLAY_ONLY
    ? { status: 'skipped', reason: 'DISPLAY_ONLY is enabled; no JS PMachine message was sent' }
    : { status: 'passed', delivery: assertPacsDelivery(await runJs(pcodePath, mapPath, message), 'JS PMachine') };
  const proof = {
    status: 'ok',
    startedAt,
    sourcePath: path.relative(ROOT, SOURCE_PATH),
    serviceId: artifact.programMap?.serviceId || null,
    inputQueue: INPUT_QUEUE,
    outputQueue: OUTPUT_QUEUE,
    fixture: { rawMt103: MT103_TEXT, parsedMessage: message },
    artifacts: {
      pcodeBytes: Buffer.byteLength(pcodeText),
      mapperIds: (artifact.programMap?.entries || []).filter((entry) => entry.kind === 'mapper').map((entry) => entry.id),
      signedMap: Boolean(signedMap.signing)
    },
    js,
    display: { status: 'skipped', reason: DISPLAY_BASE_URL ? null : 'Set DISPLAY_BASE_URL to run FFS/hardware proof' }
  };

  if (DISPLAY_BASE_URL) {
    if (!SKIP_DISPLAY_UPLOAD) await uploadDisplayArtifacts(pcodeText, signedMapText);
    if (DISPLAY_ASYNC && DISPLAY_STARTUP_WAIT_MS > 0) await wait(DISPLAY_STARTUP_WAIT_MS);
    const displayRuns = [];
    for (let index = 0; index < REPEAT_COUNT; index += 1) {
      const displayExecution = DISPLAY_ASYNC
        ? await runDisplayAsync(message)
        : { payload: await runDisplay(message), acknowledgement: null, completion: null };
      const displayPayload = displayExecution.payload;
      displayRuns.push({
        run: index + 1,
        status: 'passed',
        acknowledgement: displayExecution.acknowledgement,
        completion: displayExecution.completion,
        delivery: assertPacsDelivery(displayPayload, `Display ESP32 PMachine run ${index + 1}`)
      });
    }
    proof.display = {
      status: 'passed',
      baseUrl: DISPLAY_BASE_URL,
      remotePcode: REMOTE_PCODE,
      remoteProgramMap: REMOTE_MAP,
      mode: DISPLAY_ASYNC ? 'async-promise' : 'sync-http',
      startupWaitMs: DISPLAY_ASYNC ? DISPLAY_STARTUP_WAIT_MS : 0,
      repeatCount: REPEAT_COUNT,
      runs: displayRuns
    };
  }

  await fs.mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
  await fs.writeFile(EVIDENCE_PATH, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...proof, evidencePath: path.relative(ROOT, EVIDENCE_PATH) }, null, 2));
}

main().catch((error) => {
  console.error(`[pascalish-dual-proof] FAIL: ${error.stack || error}`);
  process.exitCode = 1;
});
