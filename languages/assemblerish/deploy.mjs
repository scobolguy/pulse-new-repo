import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { attachPcodeSignature } from '../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { compileAssemblerish } from './src/compiler.mjs';

const ENDPOINT = '/pmachine/assemblerish';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_MS = 120000;

function readOption(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1] ?? fallback;
}

function parsePins(raw) {
  if (!raw) throw new Error('Install requires --allowed-pins with the granted GPIO pins');
  if (raw === 'none') return [];
  const pieces = raw.split(',').map(value => value.trim());
  const pins = pieces.map(value => {
    if (!/^\d+$/.test(value)) throw new Error(`Invalid allowed pin '${value}'`);
    const pin = Number(value);
    if (!Number.isInteger(pin) || pin < 0 || pin > 48) throw new Error(`Allowed pin must be between 0 and 48: ${value}`);
    return pin;
  });
  if (new Set(pins).size !== pins.length) throw new Error('Allowed pins must not contain duplicates');
  return pins;
}

function endpointUrl(baseUrl) {
  if (!baseUrl) throw new Error('Provide --url for the PMachine host');
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('PMachine URL must use HTTP or HTTPS');
  return new URL(ENDPOINT, url);
}

function validateGrantPins(pins) {
  if (!Array.isArray(pins) || pins.some(pin => !Number.isInteger(pin) || pin < 0 || pin > 48)) {
    throw new Error('allowedPins must be an array of GPIO numbers 0..48');
  }
  if (new Set(pins).size !== pins.length) throw new Error('Allowed pins must not contain duplicates');
  return pins;
}

async function responseValue(response) {
  const body = await response.text();
  if (!response.ok) throw new Error(`PMachine returned HTTP ${response.status}: ${body.slice(0, 512)}`);
  if (!body.trim()) throw new Error(`PMachine returned HTTP ${response.status} without a JSON response body`);
  let value;
  try { value = JSON.parse(body); } catch {
    throw new Error(`PMachine returned malformed JSON with HTTP ${response.status}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`PMachine returned a non-object JSON response with HTTP ${response.status}`);
  }
  return value;
}

async function request(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await responseValue(await fetchImpl(url, { ...options, signal: controller.signal }));
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`PMachine request timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function deployAssemblerish({
  action, baseUrl, sourceText, fileName = 'program.asmish', allowedPins,
  confirmed = false, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  const url = endpointUrl(baseUrl);
  if (typeof fetchImpl !== 'function') throw new Error('This Node.js version does not provide fetch');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`Request timeout must be between 1 and ${MAX_TIMEOUT_MS} ms`);
  }
  if (action === 'status') return request(fetchImpl, url, { method: 'GET' }, timeoutMs);
  if (action === 'remove') {
    if (!confirmed) throw new Error('Remove requires explicit --confirm-remove');
    return request(fetchImpl, url, { method: 'DELETE' }, timeoutMs);
  }
  if (action !== 'install') throw new Error(`Unknown action '${action}' (expected install, status, or remove)`);
  if (!confirmed) throw new Error('Install requires explicit --confirm-install');
  const pins = validateGrantPins(Array.isArray(allowedPins) ? allowedPins : parsePins(allowedPins));
  const compiled = compileAssemblerish(sourceText, { fileName });
  const devicePins = compiled.programMap.assemblerish.devices.map(device => device.pin);
  const grants = new Set(pins);
  const missing = devicePins.filter(pin => !grants.has(pin));
  if (missing.length) throw new Error(`Missing allowed-pin grants for declared pin(s): ${missing.join(', ')}`);
  const deploymentMap = { ...compiled.programMap };
  delete deploymentMap.sourceMap;
  const signedMap = attachPcodeSignature(deploymentMap, compiled.pcodeText);
  const body = JSON.stringify({
    pcode: compiled.pcodeText,
    programMapText: JSON.stringify(signedMap),
    allowedPins: pins
  });
  if (Buffer.byteLength(body, 'utf8') > 49152) throw new Error('Handler deployment exceeds the 48 KiB request limit');
  return request(fetchImpl, url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body
  }, timeoutMs);
}

export async function runDeployCli(argv = process.argv.slice(2)) {
  const [action] = argv;
  const baseUrl = readOption(argv, '--url', process.env.PMACHINE_URL);
  const timeoutMs = Number(readOption(argv, '--timeout-ms', String(DEFAULT_TIMEOUT_MS)));
  let sourceText;
  let fileName;
  let allowedPins;
  if (action === 'install') {
    const sourcePath = readOption(argv, '--source');
    if (!sourcePath) throw new Error('Install requires --source handler.asmish');
    if (!argv.includes('--confirm-install')) throw new Error('Install requires explicit --confirm-install');
    sourceText = await fs.readFile(path.resolve(sourcePath), 'utf8');
    fileName = path.basename(sourcePath);
    allowedPins = parsePins(readOption(argv, '--allowed-pins'));
  }
  const result = await deployAssemblerish({
    action,
    baseUrl,
    sourceText,
    fileName,
    allowedPins,
    timeoutMs,
    confirmed: argv.includes(action === 'remove' ? '--confirm-remove' : '--confirm-install')
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDeployCli().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
