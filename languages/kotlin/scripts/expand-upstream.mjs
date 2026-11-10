import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { upstreamCases, upstreamRevision } from '../tests/upstream-cases.mjs';
import { createExecutionTarget } from '../tests/execution-targets.mjs';

// Selects the next batch of unpinned JetBrains codegen/box cases in
// deterministic path order, downloads them with integrity pinning, classifies
// each by compiling and executing box() on the JS p-machine, and regenerates
// tests/upstream-cases.mjs with the combined manifest.
// With --reclassify, re-runs classification for every pinned box case instead,
// so compiler improvements update statuses and reasons in place.
const reclassify = process.argv.includes('--reclassify');
const positional = process.argv.slice(2).filter(argument => argument !== '--reclassify');
const [root, listingFile, countText, reportFile] = reclassify
  ? [positional[0], null, '0', positional[1]] : positional;
const count = Number(countText);
if (!root || (!reclassify && !listingFile) || !reportFile
  || (!reclassify && (!Number.isInteger(count) || count < 1)) || positional.length !== (reclassify ? 2 : 4))
  throw new Error('Usage: node scripts/expand-upstream.mjs <corpus-root> <listing.json> <count> <report.json> | <corpus-root> --reclassify <report.json>');

const listing = reclassify ? [] : JSON.parse(await fs.readFile(listingFile, 'utf8'));
if (!Array.isArray(listing) || listing.some(item => typeof item !== 'string'))
  throw new Error('Listing must be a JSON array of corpus-relative paths');
const pinned = new Set(upstreamCases.map(item => item.path));
const selected = reclassify
  ? upstreamCases.filter(item => item.kind === 'box').map(item => item.path)
  : [...listing].sort().filter(item => !pinned.has(item)).slice(0, count);
if (!reclassify && selected.length < count) console.warn(`Only ${selected.length} unpinned cases remain in the listing`);

async function download(relative) {
  const file = path.join(root, ...relative.split('/'));
  let bytes;
  try {
    bytes = await fs.readFile(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!bytes) {
    const url = `https://raw.githubusercontent.com/JetBrains/kotlin/${upstreamRevision}/compiler/testData/${relative}`;
    for (let attempt = 1; ; ++attempt) {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (response.ok) { bytes = Buffer.from(await response.arrayBuffer()); break; }
      if (attempt === 3) throw new Error(`Downloading ${url} failed: HTTP ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes, { flag: 'wx' });
  }
  return { relative, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

const downloads = [];
let cursor = 0;
const pinnedHashes = new Map(upstreamCases.map(item => [item.path, item.sha256]));
await Promise.all(Array.from({ length: 16 }, async () => {
  while (cursor < selected.length) {
    const index = cursor++;
    downloads[index] = await download(selected[index]);
    const expected = pinnedHashes.get(downloads[index].relative);
    if (expected && expected !== downloads[index].sha256)
      throw new Error(`Fixture ${downloads[index].relative} differs from its pinned hash`);
    if ((index + 1) % 200 === 0) console.log(`Downloaded ${index + 1}/${selected.length}`);
  }
}));

const executor = await createExecutionTarget('js');
const results = [];
for (const [index, item] of downloads.entries()) {
  const source = item.bytes.toString('utf8');
  let status, reason;
  if (/^\s*\/\/\s*(?:FILE|MODULE):/m.test(source)) {
    status = 'blocked'; reason = 'Upstream multi-file/module infrastructure';
  } else if (!/\bfun\s+box\s*\(/.test(source)) {
    status = 'blocked'; reason = 'No supported entry-point adapter';
  } else {
    let artifact;
    try {
      artifact = compileKotlinToPcode(`${source}\nfun main() { println(box()) }\n`, { fileName: item.relative });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      status = 'rejected'; reason = error.message.split('\n')[0];
    }
    if (artifact) {
      try {
        const outcome = await executor.execute(artifact);
        if (outcome.error) { status = 'failing'; reason = `Runtime error: ${outcome.error}`; }
        else if (outcome.stepLimitHit) { status = 'failing'; reason = 'PMachine instruction limit exceeded'; }
        else if (outcome.stdout.length === 1 && outcome.stdout[0] === 'OK') status = 'supported';
        else { status = 'failing'; reason = `Expected OK, got ${JSON.stringify(outcome.stdout)}`; }
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        status = 'failing'; reason = `Execution fault: ${error.message.split('\n')[0]}`;
      }
    }
  }
  results.push({ path: item.relative, sha256: item.sha256, kind: 'box', status, ...(reason ? { reason } : {}) });
  if ((index + 1) % 100 === 0) console.log(`Classified ${index + 1}/${downloads.length}`);
}
await executor.stop();

const counts = {};
for (const result of results) counts[result.status] = (counts[result.status] || 0) + 1;
await fs.mkdir(path.dirname(path.resolve(reportFile)), { recursive: true });
await fs.writeFile(reportFile, JSON.stringify({
  generatedAt: new Date().toISOString(), upstreamRevision, requested: reclassify ? results.length : count,
  reclassified: reclassify, selected: results.length, counts, results,
}, null, 2) + '\n');

const reclassified = new Map(results.map(item => [item.path, item]));
const combined = [
  ...upstreamCases.map(item => {
    const updated = reclassify ? reclassified.get(item.path) : null;
    return updated ? [item.path, item.sha256, item.kind, updated.status, updated.reason]
      : [item.path, item.sha256, item.kind, item.status, item.reason];
  }),
  ...(reclassify ? [] : results.map(item => [item.path, item.sha256, item.kind, item.status, item.reason])),
];
const manifest = `export const upstreamRevision = '${upstreamRevision}';

// Paths are relative to JetBrains/kotlin's compiler/testData directory.
// Statuses: supported = executes box() with output OK on the JS p-machine;
// failing = compiles but does not produce OK; rejected = compiler diagnostic;
// blocked = needs harness features (multi-file/module or no box entry point).
// Regenerate batches with scripts/expand-upstream.mjs; do not edit hashes.
export const upstreamCases = [
${combined.map(([casePath, sha256, kind, status, reason]) =>
    `  [${[casePath, sha256, kind, status, ...(reason === undefined ? [] : [reason])]
      .map(value => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`).join(', ')}],`).join('\n')}
].map(([path, sha256, kind, status, reason]) => ({ path, sha256, kind, status, ...(reason === undefined ? {} : { reason }) }));
`;
await fs.writeFile(fileURLToPath(new URL('../tests/upstream-cases.mjs', import.meta.url)), manifest);
console.log(JSON.stringify({ selected: results.length, counts }));
