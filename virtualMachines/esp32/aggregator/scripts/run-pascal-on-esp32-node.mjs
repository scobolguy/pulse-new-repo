import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';

const NODE_REGISTRY_URL = process.env.NODE_REGISTRY_URL || 'http://127.0.0.1:4000/api/nodes';
const CANDIDATES_DIR = path.resolve(process.cwd(), 'data', 'ollama-mentor-candidates');

// Short remote names; long names are unreliable on some ESP32 FFS uploads.
const REMOTE_PCODE = '/hanoi.pcode';
const REMOTE_MAP = '/hanoi.map.json';

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

  const host = await resolveHost(node);
  const baseUrl = `http://${host}`;

  await postForm(`${baseUrl}/ffs/upload`, { file: REMOTE_PCODE, body: pcodeText }, 'upload pcode');
  await postForm(`${baseUrl}/ffs/upload`, { file: REMOTE_MAP, body: signedMapText }, 'upload map');

  const rawResult = await postForm(`${baseUrl}/pmachine/execute_file`, {
    file: REMOTE_PCODE,
    programMap: REMOTE_MAP,
    runRouter: '0',
    inputQueue,
    message,
    max: '65536'
  }, 'execute_file');

  let result;
  try { result = JSON.parse(rawResult); } catch { result = { raw: rawResult }; }

  return { node, host, source: path.basename(sourcePath), pcodeLines: pcodeText.split('\n').length, result };
}

export async function runPcodeOnEsp32({
  pcodeText = '',
  programMap = {},
  daemonPcodeText = '',
  daemonProgramMap = null,
  node = 'neptune.child1',
  inputQueue = 'vscode.pmachine',
  message = '',
  maxSteps = 200000,
  sourceFileName = 'program.pcode'
} = {}) {
  const pcode = String(pcodeText || '');
  if (!pcode.trim()) throw new Error('pcodeText is required');
  if (!programMap || typeof programMap !== 'object' || Array.isArray(programMap)) {
    throw new Error('programMap must be an object');
  }

  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const remotePcode = `/v${tag}.pcode`;
  const remoteMap = `/v${tag}.json`;
  const signedMap = attachPcodeSignature(programMap, pcode);
  const signedMapText = `${JSON.stringify(signedMap, null, 2)}\n`;
  const host = await resolveHost(node);
  const baseUrl = `http://${host}`;

  if (signedMap.hostBindingsVersion === 1) {
    if (signedMap.runtimeUnit?.kind !== 'service') {
      throw new Error('Hosted direct execution requires a Pascalish service; daemon units must be installed with a service');
    }
    const daemon = daemonPcodeText && daemonProgramMap
      ? { pcodeText: String(daemonPcodeText), programMap: daemonProgramMap }
      : compilePascalishProgramWithAntlr(
        "daemon 'vscode-idle' every 60000 ms; begin end.",
        { fileName: 'vscode-idle-daemon.pas', hostServices: true },
      );
    if (!daemonProgramMap && daemonPcodeText) throw new Error('daemonProgramMap is required with daemonPcodeText');
    if (daemonProgramMap && !daemonPcodeText) throw new Error('daemonPcodeText is required with daemonProgramMap');
    if (daemon.programMap?.hostBindingsVersion !== 1 || daemon.programMap.runtimeUnit?.kind !== 'daemon') {
      throw new Error('Hosted service daemon artifact is invalid');
    }

    const isJsNode = /:\d+$/.test(host);
    const serviceMap = isJsNode ? signedMap : attachPcodeSignature(compactServiceHostProgramMap(signedMap), pcode);
    const daemonMap = isJsNode
      ? daemon.programMap
      : compactServiceHostProgramMap(daemon.programMap);
    const signedDaemonMap = attachPcodeSignature(daemonMap, daemon.pcodeText);
    const signedDaemonMapText = `${JSON.stringify(signedDaemonMap, null, 2)}\n`;
    const daemonPcodeFile = `/v${tag}-daemon.pcode`;
    const daemonMapFile = `/v${tag}-daemon.json`;
    await postForm(`${baseUrl}/ffs/upload`, { file: remotePcode, body: pcode }, 'upload hosted service pcode');
    await postForm(`${baseUrl}/ffs/upload`, {
      file: remoteMap, body: `${JSON.stringify(serviceMap, null, 2)}\n`,
    }, 'upload hosted service map');
    await postForm(`${baseUrl}/ffs/upload`, { file: daemonPcodeFile, body: daemon.pcodeText }, 'upload hosted daemon pcode');
    await postForm(`${baseUrl}/ffs/upload`, { file: daemonMapFile, body: signedDaemonMapText }, 'upload hosted daemon map');

    const udpPort = isJsNode ? '0' : '4210';
    const rawInstall = await postForm(`${baseUrl}/pmachine/service_host/install`, {
      serviceFile: remotePcode,
      serviceMap: remoteMap,
      daemonFile: daemonPcodeFile,
      daemonMap: daemonMapFile,
      collectorId: String(signedMap.runtimeUnit.id || path.basename(String(sourceFileName), path.extname(String(sourceFileName)))),
      udpPort,
      observationTtlMs: '180000',
      announcementIntervalMs: String(daemon.programMap.runtimeUnit.refreshMs || 60000),
    }, 'install hosted service');
    let result;
    try { result = JSON.parse(rawInstall); } catch { result = { raw: rawInstall }; }
    if (result?.running !== true) throw new Error(`Hosted service did not start: ${rawInstall.slice(0, 240)}`);
    return {
      node,
      host,
      source: path.basename(String(sourceFileName || 'program.pas')),
      pcodeLines: pcode.split('\n').length,
      hosted: true,
      result,
    };
  }

  await postForm(`${baseUrl}/ffs/upload`, { file: remotePcode, body: pcode }, 'upload pcode');
  await postForm(`${baseUrl}/ffs/upload`, { file: remoteMap, body: signedMapText }, 'upload map');

  const rawResult = await postForm(`${baseUrl}/pmachine/execute_file`, {
    file: remotePcode,
    programMap: remoteMap,
    runRouter: '0',
    inputQueue,
    message,
    max: String(Math.max(1, Number(maxSteps) || 200000))
  }, 'execute_file');

  let result;
  try { result = JSON.parse(rawResult); } catch { result = { raw: rawResult }; }
  return {
    node,
    host,
    source: path.basename(String(sourceFileName || 'program.pcode')),
    pcodeLines: pcode.split('\n').length,
    result
  };
}

function normalizeNodeName(v) {
  return String(v || '').trim().toLowerCase();
}

async function resolveHost(requestedNode) {
  if (/^(?:\d{1,3}(?:\.\d{1,3}){3}|localhost)(?::\d{1,5})?$/i.test(String(requestedNode || '').trim())) {
    return String(requestedNode).trim();
  }
  try {
    const res = await fetch(NODE_REGISTRY_URL);
    if (!res.ok) return requestedNode;
    const nodes = await res.json();
    const entries = Array.isArray(nodes) ? nodes : [];
    const wanted = normalizeNodeName(requestedNode);
    // Last segment of a dotted name (e.g. "neptune.child1" → "child1")
    const wantedTail = wanted.includes('.') ? wanted.split('.').pop() : wanted;

    // Priority: exact match → last-segment exact → substring
    for (const pass of ['exact', 'tail', 'substr']) {
      for (const entry of entries) {
        const nodeName = normalizeNodeName(entry?.nodeName || entry?.details?.nodeName || '');
        const host = String(entry?.ip || '').trim();
        if (!host || host === '127.0.0.1') continue;
        if (pass === 'exact' && nodeName === wanted) return host;
        if (pass === 'tail' && nodeName === wantedTail) return host;
        if (pass === 'substr' && (nodeName.includes(wanted) || wanted.includes(nodeName))) return host;
      }
    }
  } catch {
    // fall through to raw value
  }
  return requestedNode;
}

async function postForm(url, params, label) {
  const body = new URLSearchParams(params);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status}): ${text.slice(0, 240)}`);
  }
  return text;
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
