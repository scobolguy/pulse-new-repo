import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { upstreamCases, upstreamRevision } from '../tests/upstream-cases.mjs';
import { stripDiagnosticMarkers } from '../tests/upstream-runner.mjs';

const [root, output] = process.argv.slice(2);
if (!root || !output || process.argv.length !== 4)
  throw new Error('Usage: inventory-corpus.mjs <corpus-root> <report.json>');
const manifest = new Map(upstreamCases.map(item => [item.path, item]));
const cases = [];
async function visit(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await visit(file); continue; }
    if (!entry.isFile() || !entry.name.endsWith('.kt')) continue;
    const relative = path.relative(root, file).split(path.sep).join('/');
    const bytes = await fs.readFile(file);
    const source = bytes.toString('utf8'), sha256 = createHash('sha256').update(bytes).digest('hex');
    const pinned = manifest.get(relative);
    const provenance = pinned ? pinned.sha256 === sha256 ? 'verified' : 'hash-mismatch' : 'unverified';
    const infrastructure = /^\s*\/\/\s*(?:FILE|MODULE):/m.test(source);
    const kind = relative.startsWith('diagnostics/') ? 'diagnostic' : /\bfun\s+box\s*\(/.test(source) ? 'box' : 'other';
    const item = { id: relative, feature: relative.split('/').slice(0, -1).join('/'), sha256,
      provenance, revision: provenance === 'verified' ? upstreamRevision : null, kind };
    if (infrastructure || kind === 'other') {
      cases.push({ ...item, status: 'blocked', reason: infrastructure ? 'Upstream multi-file/module infrastructure' : 'No supported entry-point adapter' });
      continue;
    }
    const clean = kind === 'diagnostic' ? stripDiagnosticMarkers(source).source : source;
    try {
      compileKotlinToPcode(`${clean}\nfun main() { ${kind === 'box' ? 'println(box())' : ''} }\n`, { fileName: relative });
      cases.push({ ...item, status: 'compile-candidate', reason: 'Compilation alone is not an execution or diagnostic pass' });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      cases.push({ ...item, status: 'rejected', diagnostic: error.message,
        reason: kind === 'diagnostic' ? 'Requires expected semantic diagnostic comparison' : 'First observed compatibility gap; additional blockers may remain' });
    }
  }
}
await visit(path.resolve(root));
const counts = Object.fromEntries(['compile-candidate', 'rejected', 'blocked'].map(status =>
  [status, cases.filter(item => item.status === status).length]));
await fs.writeFile(output, JSON.stringify({ upstreamRevision, total: cases.length, counts, cases }, null, 2) + '\n');
console.log(JSON.stringify({ total: cases.length, counts }));
