import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_ROOT = path.resolve(process.cwd(), '..');
const OUTPUT_PATH = path.resolve(process.cwd(), 'data', 'dsl-ollama-corpus.json');

const INCLUDED_EXTENSIONS = new Set(['.g4', '.pas']);
const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  '.antlr',
  'generated-modern',
  'generated-test',
  'archive',
  'logs',
  'run-reports',
  'stress-reports',
  'mapper-authoring-artifacts'
]);

const SOURCE_ROOTS = [
  path.resolve(process.cwd(), 'grammar'),
  path.resolve(process.cwd(), 'data')
];

const CHUNK_SIZE = 1400;
const CHUNK_OVERLAP = 180;
const MAX_FILE_BYTES = 256 * 1024;

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter(Boolean);
}

function estimateLineAtOffset(text, offset) {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  let count = 1;
  for (let i = 0; i < safeOffset; i += 1) {
    if (text.charCodeAt(i) === 10) count += 1;
  }
  return count;
}

function toWorkspaceRelative(absPath) {
  return path.relative(WORKSPACE_ROOT, absPath).replace(/\\/g, '/');
}

async function listFiles(rootPath, out = []) {
  let entries = [];
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      await listFiles(fullPath, out);
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!INCLUDED_EXTENSIONS.has(ext)) continue;

    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (stat.size <= 0 || stat.size > MAX_FILE_BYTES) continue;

    out.push(fullPath);
  }

  return out;
}

function splitIntoChunks(content) {
  const chunks = [];
  let start = 0;

  while (start < content.length) {
    const end = Math.min(content.length, start + CHUNK_SIZE);
    const snippet = content.slice(start, end);
    chunks.push({
      startOffset: start,
      endOffset: end,
      text: snippet
    });
    if (end >= content.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

async function buildCorpus() {
  const files = [];
  for (const root of SOURCE_ROOTS) {
    await listFiles(root, files);
  }

  const corpus = [];
  let chunkId = 0;

  for (const absPath of files) {
    let content = '';
    try {
      content = await fs.readFile(absPath, 'utf-8');
    } catch {
      continue;
    }
    if (!content.trim()) continue;

    const relativePath = toWorkspaceRelative(absPath);
    const chunks = splitIntoChunks(content);

    for (const chunk of chunks) {
      const lineStart = estimateLineAtOffset(content, chunk.startOffset);
      const lineEnd = estimateLineAtOffset(content, chunk.endOffset);
      const tokens = tokenize(chunk.text);

      if (tokens.length === 0) continue;

      corpus.push({
        id: `dsl-chunk-${chunkId++}`,
        path: relativePath,
        lineStart,
        lineEnd,
        tokenCount: tokens.length,
        tokens,
        text: chunk.text
      });
    }
  }

  const payload = {
    version: 1,
    builtAt: new Date().toISOString(),
    workspaceRoot: WORKSPACE_ROOT.replace(/\\/g, '/'),
    chunkSize: CHUNK_SIZE,
    overlap: CHUNK_OVERLAP,
    totalChunks: corpus.length,
    chunks: corpus
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

  console.log(JSON.stringify({
    status: 'ok',
    output: toWorkspaceRelative(OUTPUT_PATH),
    filesIndexed: files.length,
    chunksIndexed: corpus.length
  }, null, 2));
}

buildCorpus().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
