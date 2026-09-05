// ESP32 PMachine conformance target: signs and uploads the case artifacts over FFS,
// executes them on the device, and normalises the response into the shared shape.
import { attachPcodeSignature } from './pcode-signing.mjs';

export const targetName = 'esp32';

// Short remote names: long filenames are rejected by the device FFS upload handler.
const REMOTE_PCODE = '/cf1.pcode';
const REMOTE_MAP = '/cf1.map.json';

function baseUrl() {
  const explicit = process.env.ESP32_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const host = process.env.ESP32_HOST;
  if (!host) {
    throw new Error('Set ESP32_HOST or ESP32_BASE_URL to run the esp32 conformance target');
  }
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
  return { ok: response.ok, status: response.status, text, label };
}

async function uploadOrThrow(url, params, label) {
  const result = await postForm(url, params, label);
  if (!result.ok) {
    throw new Error(`${label} failed (${result.status}): ${result.text.slice(0, 200)}`);
  }
  return result.text;
}

// Device globals arrive as a flat JSON object; ints stay numbers and strings stay strings.
function normaliseGlobals(payload) {
  const globals = payload?.globals;
  return globals && typeof globals === 'object' ? globals : {};
}

export async function runCase(testCase) {
  const root = baseUrl();
  const pcodeText = testCase.pcode.endsWith('\n') ? testCase.pcode : `${testCase.pcode}\n`;
  const signedMap = attachPcodeSignature(structuredClone(testCase.programMap), pcodeText);
  const signedMapText = `${JSON.stringify(signedMap, null, 2)}\n`;

  await uploadOrThrow(`${root}/ffs/upload`, { file: REMOTE_PCODE, body: pcodeText }, 'upload pcode');
  await uploadOrThrow(`${root}/ffs/upload`, { file: REMOTE_MAP, body: signedMapText }, 'upload program map');

  const run = await postForm(`${root}/pmachine/execute_file`, {
    file: REMOTE_PCODE,
    programMap: REMOTE_MAP,
    runRouter: '0',
    inputQueue: testCase.inputQueue,
    message: testCase.message,
    max: String(Math.max(32768, pcodeText.length * 2))
  }, 'execute_file');

  if (!run.ok) {
    return {
      ok: false,
      stdout: [],
      globals: {},
      state: {},
      deliveries: [],
      publishedCount: 0,
      runtimeError: `execute_file ${run.status}: ${run.text.slice(0, 200)}`
    };
  }

  let payload;
  try {
    payload = JSON.parse(run.text);
  } catch {
    return {
      ok: false,
      stdout: [],
      globals: {},
      state: {},
      deliveries: [],
      publishedCount: 0,
      runtimeError: `non-JSON device response: ${run.text.slice(0, 200)}`
    };
  }

  return {
    ok: true,
    stdout: Array.isArray(payload.stdout) ? payload.stdout : [],
    globals: normaliseGlobals(payload),
    state: payload.flowState && typeof payload.flowState === 'object' ? payload.flowState : {},
    deliveries: Array.isArray(payload.deliveries) ? payload.deliveries : [],
    publishedCount: Number(payload.publishedCount || 0),
    stepLimitHit: Boolean(payload.stepLimitHit),
    runtimeError: payload.runtimeError || null,
    device: {
      stepCount: payload.stepCount,
      stepLimitHit: payload.stepLimitHit,
      freeHeapBytes: payload.memoryPressure?.freeHeapBytes
    }
  };
}
