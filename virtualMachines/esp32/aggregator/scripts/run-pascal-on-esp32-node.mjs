import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

const NODE_REGISTRY_URL = process.env.NODE_REGISTRY_URL || 'http://127.0.0.1:4000/api/nodes';
const FILESERVER_URL = process.env.PULSE_FILESERVER_URL || 'http://192.168.2.11:4000/api/fileserver';
const CANDIDATES_DIR = path.resolve(process.cwd(), 'data', 'ollama-mentor-candidates');
const REMOTE_PCODE = '/pulse-service.pcode';
const REMOTE_MAP = '/pulse-service.map.json';

function parseArgs(argv) {
  const args = {
    source: '',
    node: process.env.ESP32_NODE_NAME || 'neptune.child1',
    inputQueue: 'hanoi.run',
    message: ''
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--source') { args.source = String(argv[i + 1] || ''); i += 1; }
    if (token === '--node') { args.node = String(argv[i + 1] || args.node); i += 1; }
    if (token === '--message') { args.message = String(argv[i + 1] || ''); i += 1; }
  }
  return args;
}

async function latestCandidatePas() {
  const files = await fs.readdir(CANDIDATES_DIR).catch(() => []);
  const pas = files.filter((f) => f.endsWith('.pas')).sort();
  if (!pas.length) throw new Error('No mentor candidate .pas files found. Run dsl:ollama:mentor first.');
  return path.resolve(CANDIDATES_DIR, pas[pas.length - 1]);
}

export async function runPascalOnEsp32({ source = '', node = 'neptune.child1', inputQueue = 'hanoi.run', message = '' } = {}) {
  const sourcePath = source || await latestCandidatePas();
  const sourceText = await fs.readFile(sourcePath, 'utf-8');

  const { pcodeText, programMap } = compilePascalishProgramWithAntlr(sourceText);
  const signedMap = attachPcodeSignature(programMap, pcodeText);
  const signedMapText = `${JSON.stringify(signedMap, null, 2)}\n`;
  const remotePcode = `/pmachine/${path.basename(REMOTE_PCODE)}`;
  const remoteMap = `/pmachine/${path.basename(REMOTE_MAP)}`;

  const host = await resolveHost(node);
  const baseUrl = `http://${host}`;

  await putFileOnFileserver(remotePcode, pcodeText, 'publish pcode');
  await putFileOnFileserver(remoteMap, signedMapText, 'publish map');
  await ensureEphemeralFileserverMount(baseUrl);

  const isDirectService = Array.isArray(programMap.serviceEndpoints) && programMap.serviceEndpoints.length > 0;
  const executionPath = isDirectService ? '/pmachine/service' : '/pmachine/execute_file';
  const rawResult = await postForm(`${baseUrl}${executionPath}`, {
    file: remotePcode,
    programMap: remoteMap,
    inputQueue,
    message,
    max: '65536'
  }, 'execute_file');

  let result;
  try { result = JSON.parse(rawResult); } catch { result = { raw: rawResult }; }

  return { node, host, source: path.basename(sourcePath), executionPath, pcodeLines: pcodeText.split('\n').length, result };
}

function normalizeNodeName(v) {
  return String(v || '').trim().toLowerCase();
}

async function resolveHost(requestedNode) {
  try {
    const res = await fetch(NODE_REGISTRY_URL);
    if (!res.ok) return requestedNode;
    const payload = await res.json();
    const entries = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.nodes)
        ? payload.nodes
        : Array.isArray(payload?.value)
          ? payload.value
          : [];
    const wanted = normalizeNodeName(requestedNode);
    // Last segment of a dotted name (e.g., "neptune.child1" → "child1")
    const wantedTail = wanted.includes('.') ? wanted.split('.').pop() : wanted;
    const findHost = (candidates) => {
      // Priority: exact match → last-segment exact → substring
      for (const pass of ['exact', 'tail', 'substr']) {
        for (const entry of candidates) {
          const nodeName = normalizeNodeName(entry?.nodeName || entry?.details?.nodeName || '');
          const host = String(entry?.ip || '').trim();
          if (!host || host === '127.0.0.1') continue;
          if (pass === 'exact' && nodeName === wanted) return host;
          if (pass === 'tail' && nodeName === wantedTail) return host;
          if (pass === 'substr' && (nodeName.includes(wanted) || wanted.includes(nodeName))) return host;
        }
      }
      return '';
    };

    const registryHost = findHost(entries);
    if (registryHost) return registryHost;

    const pmachineRes = await fetch(new URL('/api/pmachine/nodes', NODE_REGISTRY_URL));
    if (pmachineRes.ok) {
      const pmachinePayload = await pmachineRes.json();
      const pmachineEntries = Array.isArray(pmachinePayload)
        ? pmachinePayload
        : Array.isArray(pmachinePayload?.nodes)
          ? pmachinePayload.nodes
          : Array.isArray(pmachinePayload?.value)
            ? pmachinePayload.value
            : [];
      const pmachineHost = findHost(pmachineEntries);
      if (pmachineHost) return pmachineHost;
    }
  } catch {
    // fall through to raw value
  }
  return requestedNode;
}

async function fetchWithContext(url, options, label) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const cause = error?.cause?.message ? `: ${error.cause.message}` : '';
    throw new Error(`${label} request failed for ${url}: ${error?.message || String(error)}${cause}`);
  }
}

async function postForm(url, params, label) {
  const body = new URLSearchParams(params);
  const res = await fetchWithContext(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  }, label);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status}): ${text.slice(0, 240)}`);
  }
  return text;
}

async function putFileOnFileserver(file, data, label) {
  const url = `${FILESERVER_URL}/ffs/put`;
  const response = await fetchWithContext(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: file, data })
  }, label);
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  }
}

async function ensureEphemeralFileserverMount(baseUrl) {
  const fileserver = new URL(FILESERVER_URL);
  const peerId = `${fileserver.host}${fileserver.pathname.replace(/\/$/, '')}`;
  const url = `${baseUrl}/ffs/mount`;
  const response = await fetchWithContext(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      mount: '/pmachine',
      target: '/pmachine',
      peer: peerId,
      type: 'peer',
      readOnly: '1',
      persist: '0'
    })
  }, 'configure ephemeral fileserver mount');
  if (!response.ok) {
    throw new Error(`configure ephemeral fileserver mount failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.error(`[run-pascal-on-esp32] compiling ${path.basename(args.source || '(latest candidate)')} ...`);
  const deployResult = await runPascalOnEsp32({ source: args.source, node: args.node, message: args.message });
  console.error(`[run-pascal-on-esp32] node=${deployResult.node}  host=${deployResult.host}`);
  console.log(JSON.stringify({ status: 'ok', ...deployResult }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[run-pascal-on-esp32]', err?.message || String(err));
    process.exitCode = 1;
  });
}
