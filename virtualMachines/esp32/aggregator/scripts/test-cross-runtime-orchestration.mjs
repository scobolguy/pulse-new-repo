#!/usr/bin/env node
// Cross-runtime orchestration proof: a Pascalish parent program runs on the JS PMachine
// and spawns two async subflows whose worker pcode executes on the ESP32 PMachine.
//
// The parent's ORCH_WAIT_ALL dispatches through runtimeContext.invokeSubflow, which this
// test implements as a direct ESP32 transport (FFS upload + /pmachine/execute_file).
//
//   ESP32_HOST=192.168.2.155 node scripts/test-cross-runtime-orchestration.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

const PARENT_SOURCE = path.resolve(process.cwd(), 'data', 'esp32-dual-worker-orchestration.pas');
const PARENT_PAYLOAD = '21';

// Worker executed on the device: doubles the integer carried in the source message.
const WORKER_PCODE = [
  'START:',
  'LOAD_NAME src',
  'TRIM',
  'PARSE_INT',
  'PUSH_INT 2',
  'MUL',
  'STORE doubled',
  'HALT',
  ''
].join('\n');

const WORKER_PROGRAM_MAP = {
  runtimeUnit: { kind: 'program', id: 'Esp32DoubleWorker' },
  globals: ['doubled'],
  entries: [],
  procedures: {}
};

const REMOTE_WORKER_PCODE = '/dbl.pcode';
const REMOTE_WORKER_MAP = '/dbl.map.json';

function baseUrl() {
  const explicit = process.env.ESP32_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const host = process.env.ESP32_HOST;
  if (!host) throw new Error('Set ESP32_HOST or ESP32_BASE_URL to run the cross-runtime orchestration test');
  return host.startsWith('http') ? host.replace(/\/+$/, '') : `http://${host}`;
}

async function postForm(url, params, label) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${text.slice(0, 200)}`);
  return text;
}

async function deployWorker(root) {
  const signedMap = attachPcodeSignature(structuredClone(WORKER_PROGRAM_MAP), WORKER_PCODE);
  await postForm(`${root}/ffs/upload`, { file: REMOTE_WORKER_PCODE, body: WORKER_PCODE }, 'upload worker pcode');
  await postForm(`${root}/ffs/upload`, {
    file: REMOTE_WORKER_MAP,
    body: `${JSON.stringify(signedMap, null, 2)}\n`
  }, 'upload worker program map');
}

function makeEsp32SubflowTransport(root, invocationLog) {
  return async ({ subflowId, nodeId, payload, timeoutMs }) => {
    const started = Date.now();
    const raw = await postForm(`${root}/pmachine/execute_file`, {
      file: REMOTE_WORKER_PCODE,
      programMap: REMOTE_WORKER_MAP,
      runRouter: '0',
      inputQueue: `${subflowId}.in`,
      message: String(payload ?? ''),
      max: '32768'
    }, `execute worker ${subflowId}`);

    const device = JSON.parse(raw);
    const doubled = device?.globals?.doubled;

    invocationLog.push({
      subflowId,
      nodeId,
      doubled,
      stepCount: device?.stepCount,
      freeHeapBytes: device?.memoryPressure?.freeHeapBytes,
      elapsedMs: Date.now() - started,
      timeoutMs
    });

    return {
      success: true,
      response: JSON.stringify({
        success: true,
        subflowId,
        runtime: 'esp32-pmachine',
        input: String(payload ?? ''),
        doubled
      }),
      errorCode: null,
      errorMessage: null
    };
  };
}

async function main() {
  const root = baseUrl();
  await deployWorker(root);

  const parentSource = await fs.readFile(PARENT_SOURCE, 'utf-8');
  const { pcodeText, programMap } = compilePascalishProgramWithAntlr(parentSource);

  const spawnLines = pcodeText.split('\n').filter(l => l.startsWith('ORCH_SPAWN'));
  assert.equal(spawnLines.length, 2, 'parent program should lower to two ORCH_SPAWN instructions');

  const invocationLog = [];
  const result = await executeProgram({
    instructions: parsePcode(pcodeText),
    opcodeMap: await loadOpcodeMap(),
    mappingsById: { __globals: programMap.globals || [] },
    queueTypesByName: new Map(),
    isoTypeIds: new Set(),
    inputQueue: 'orchestration.in',
    sourceMessage: PARENT_PAYLOAD,
    runtimeContext: { invokeSubflow: makeEsp32SubflowTransport(root, invocationLog) }
  });

  const orchestration = result?.state?.__orchestration;
  assert.ok(orchestration, 'parent run should record an __orchestration summary');
  assert.equal(orchestration.success, true, `orchestration failed: ${JSON.stringify(orchestration.results)}`);
  assert.equal(orchestration.results.length, 2, 'expected two subflow results');

  assert.equal(invocationLog.length, 2, 'both subflows should have executed on the device');
  for (const invocation of invocationLog) {
    assert.equal(invocation.nodeId, 'esp32', `subflow ${invocation.subflowId} targeted the wrong node`);
    assert.equal(invocation.doubled, 42, `ESP32 worker for ${invocation.subflowId} returned ${invocation.doubled}, expected 42`);
  }

  const subflowIds = orchestration.results.map(r => r.subflowId).sort();
  assert.deepEqual(subflowIds, ['double_a', 'double_b'], 'unexpected subflow ids');

  const handleRefs = orchestration.results.map(r => r.handleRef).sort();
  assert.deepEqual(handleRefs, ['h_esp_a', 'h_esp_b'], 'unexpected orchestration handles');

  console.log(JSON.stringify({
    status: 'ok',
    parentRuntime: 'js-pmachine',
    workerRuntime: 'esp32-pmachine',
    host: root,
    parentPayload: PARENT_PAYLOAD,
    invocations: invocationLog
  }, null, 2));
  console.log('[cross-runtime-orchestration] PASS: JS parent spawned two ESP32 workers and merged their replies');
}

main().catch((error) => {
  console.error('[cross-runtime-orchestration] FAIL:', error?.message || String(error));
  process.exitCode = 1;
});
