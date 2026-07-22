import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileStandardPascalWithAntlr } from './compile-standard-pascal-antlr-to-pcode.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

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

  const { pcodeText, programMap } = compileStandardPascalWithAntlr(sourceText);
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

function normalizeNodeName(v) {
  return String(v || '').trim().toLowerCase();
}

async function resolveHost(requestedNode) {
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
