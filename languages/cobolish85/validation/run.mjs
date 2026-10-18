import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { CORPUS_SHA256, CORPUS_URL, sha256, extractCorpus } from './corpus.mjs';

export async function runWorker(worker, payload, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      worker.off('message', message);
      worker.off('error', error);
      worker.off('exit', exit);
    };
    const message = value => { cleanup(); resolve(value); };
    const error = value => { cleanup(); reject(value); };
    const exit = code => error(new Error(`Validation worker exited (${code})`));
    const timer = setTimeout(async () => {
      cleanup();
      await worker.terminate();
      resolve({ outcome: 'timeout', diagnostic: `Program exceeded ${timeoutMs} ms` });
    }, timeoutMs);
    worker.on('message', message);
    worker.on('error', error);
    worker.on('exit', exit);
    if (payload) worker.postMessage(payload);
  });
}

async function fingerprint() {
  const root = new URL('../', import.meta.url);
  const files = ['src/compile-cobolish-to-pcode.mjs', 'src/cobol-picture.mjs', 'grammar/Cobolish85.g4',
    'grammar/generated/Cobolish85Parser.js', 'validation/corpus.mjs', 'validation/worker.mjs'];
  return sha256(Buffer.concat(await Promise.all(files.map(file => fs.readFile(new URL(file, root))))));
}

async function main() {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!['--corpus', '--out', '--program', '--module'].includes(key) || !process.argv[i + 1]) {
      throw new Error(`Invalid argument ${key}`);
    }
    args.set(key, process.argv[i + 1]);
  }
  if (!args.has('--corpus')) throw new Error('Usage: node validation/run.mjs --corpus newcob.val [--out directory] [--program ID] [--module IX]');
  const bytes = await fs.readFile(args.get('--corpus'));
  const hash = sha256(bytes);
  if (hash !== CORPUS_SHA256) throw new Error(`Unverified CCVS corpus SHA-256: ${hash}`);
  const text = bytes.toString('utf8');
  const units = extractCorpus(text);
  const out = path.resolve(args.get('--out') || fileURLToPath(new URL('./runs/latest', import.meta.url)));
  await fs.mkdir(out, { recursive: true });
  const inventory = units.map(({ source, ...unit }) => unit);
  await fs.writeFile(path.join(out, 'manifest.json'), `${JSON.stringify(inventory, null, 2)}\n`);
  const programs = units.filter(unit => unit.type === 'COBOL'
    && (!args.has('--program') || unit.id === args.get('--program'))
    && (!args.has('--module') || unit.module === args.get('--module')));
  if (!programs.length) throw new Error('No CCVS programs match the requested selectors');
  const results = { schemaVersion: 1, corpus: { url: CORPUS_URL, sha256: hash, header: text.split('\n')[0].trim(),
    units: units.length, cobolUnits: units.filter(unit => unit.type === 'COBOL').length },
  compilerFingerprint: await fingerprint(), node: process.version, startedAt: new Date().toISOString(),
  selection: Object.fromEntries([...args].filter(([key]) => ['--program', '--module'].includes(key))),
  complete: false, programs: [] };
  let worker;
  try {
    for (const unit of programs) {
      if (!worker) {
        worker = new Worker(new URL('./worker.mjs', import.meta.url));
        const ready = await runWorker(worker, null, 120000);
        if (!ready.ready) throw new Error(`Worker did not initialize: ${ready.diagnostic}`);
      }
      const directory = path.join(out, `${unit.parent}-${unit.id}`);
      await fs.mkdir(directory, { recursive: true });
      let result;
      try {
        result = await runWorker(worker, { unit, directory });
      } catch (error) {
        result = { outcome: 'worker_failure', diagnostic: error.message };
        await worker.terminate();
        worker = null;
      }
      if (result.outcome === 'timeout') worker = null;
      const { source, ...identity } = unit;
      results.programs.push({ ...identity, ...result });
      await fs.writeFile(path.join(out, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
      console.log(`[CCVS] ${unit.id}: ${result.outcome}`);
    }
    results.complete = true;
    results.finishedAt = new Date().toISOString();
    results.summary = {};
    for (const program of results.programs) results.summary[program.outcome] = (results.summary[program.outcome] || 0) + 1;
    await fs.writeFile(path.join(out, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
    const report = '# COBOLish85 CCVS baseline\n\n'
      + `Corpus: ${hash}\n\nCompiler fingerprint: ${results.compilerFingerprint}\n\n`
      + `${results.programs.length} of ${results.corpus.cobolUnits} COBOL units attempted in this selection. `
      + 'Harness/support units are identified separately in the manifest. No unexecuted test is a pass.\n\n'
      + '| Program | Module | Role | Outcome |\n|---|---|---|---|\n'
      + results.programs.map(program => `| ${program.id} | ${program.module} | ${program.role} | ${program.outcome} |`).join('\n') + '\n';
    await fs.writeFile(path.join(out, 'summary.md'), report);
    console.log(JSON.stringify(results.summary));
    if (results.programs.some(program => program.outcome !== 'pass')) process.exitCode = 1;
  } finally {
    if (worker) await worker.terminate();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 2; });
}
