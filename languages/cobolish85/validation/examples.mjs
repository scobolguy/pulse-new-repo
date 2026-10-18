import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { sha256 } from './corpus.mjs';
import { runWorker } from './run.mjs';
import { githubClient } from './github-issues.mjs';

export const EXAMPLES = [
  { id: 'BDS0801', description: 'Shop sales totals', source: 'Mainframe/ZOS/Normal/cbl/BDS0801.cbl',
    requirements: ['sequential input', 'group records and alternate 01 layouts', '88-level conditions',
      'COPY REPLACING', 'edited numeric pictures', 'PERFORM UNTIL', 'file status and EOF'] },
  { id: 'ODS0106', description: 'Financial account reports', source: 'Mainframe/ZOS/Normal/cbl/ODS0106.cbl',
    requirements: ['sequential input/output', 'group records', 'packed decimal COMP-3',
      'OCCURS and subscripts', 'edited numeric pictures', 'FUNCTION CURRENT-DATE', 'GOBACK', 'printer advancing'] }
];
const revision = '2cc05108d07d8d1ee2297e4f5bd6d274638b7f6e';
const repository = 'dscobol/Cobol-Projects';

async function publish(results, output) {
  const request = await githubClient();
  const issues = [];
  for (let page = 1; ; page++) {
    const rows = await request(`/repos/scobolguy/pulse-new-repo/issues?state=all&per_page=100&page=${page}`);
    issues.push(...rows);
    if (rows.length < 100) break;
  }
  const mapping = {};
  for (const result of results.programs) {
    if (result.outcome === 'pass') continue;
    const marker = `<!-- pulse-cobol-example:${result.id} -->`;
    const matches = issues.filter(issue => !issue.pull_request && issue.body?.includes(marker));
    if (matches.length > 1) throw new Error(`Duplicate example issues for ${result.id}`);
    const existing = matches[0];
    const body = `${marker}\n## Upstream example compatibility\n\n`
      + `Program: **${result.id}**, ${result.description}.\n\n`
      + `Source: ${result.url}\nSource SHA-256: \`${result.sha256}\`\n`
      + `Compiler fingerprint: \`${results.compilerFingerprint}\`\n\n`
      + 'Reproduce from `languages/cobolish85`:\n```text\nnpm run validate:examples\n```\n\n'
      + `Expected: compile the original source, then execute with its required input files and verify its business report.\n\n`
      + `Actual: **${result.outcome}**. Execution/report assertions have not passed.\n\n`
      + `Required facilities (source inspection): ${result.requirements.join(', ')}.\n\n`
      + `First observed diagnostic:\n\`\`\`text\n${String(result.diagnostic || '').slice(0, 8000).replace(/```/g, "'''")}\n\`\`\`\n\n`
      + 'This ticket tracks the complete program, not just the first parser error. '
      + 'Unsupported general COBOL facilities are outside the current ISAM-fix scope. '
      + 'The upstream source is fetched for local testing, not vendored or rewritten to pass. '
      + 'Runtime test data, copybooks, record encoding and expected report checks must be configured before claiming end-to-end compatibility.\n';
    const issue = existing
      ? await request(`/repos/scobolguy/pulse-new-repo/issues/${existing.number}`, 'PATCH', { body, state: 'open' })
      : await request('/repos/scobolguy/pulse-new-repo/issues', 'POST',
        { title: `[COBOLish85] ${result.id}: sales/financial example compatibility`, body });
    mapping[result.id] = { number: issue.number, url: issue.html_url };
    await fs.writeFile(path.join(output, 'issues.json'), `${JSON.stringify(mapping, null, 2)}\n`);
    console.log(`[GitHub] ${result.id}: #${issue.number}`);
    await new Promise(resolve => setTimeout(resolve, 3500));
  }
}

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.some(argument => argument !== '--publish')) throw new Error('Usage: node validation/examples.mjs [--publish]');
  const root = new URL('../', import.meta.url);
  const output = fileURLToPath(new URL('validation/runs/examples', root));
  await fs.mkdir(output, { recursive: true });
  const results = { schemaVersion: 1, repository, revision, reference:
    'https://deepwiki.com/dscobol/Cobol-Projects/5.1-sales-and-financial-reports',
  compilerFingerprint: sha256(Buffer.concat(await Promise.all(
    ['src/compile-cobolish-to-pcode.mjs', 'src/cobol-picture.mjs', 'grammar/Cobolish85.g4',
      'grammar/generated/Cobolish85Parser.js', 'validation/corpus.mjs', 'validation/worker.mjs']
      .map(file => fs.readFile(new URL(file, root)))))), startedAt: new Date().toISOString(), complete: false, programs: [] };
  const worker = new Worker(new URL('./worker.mjs', import.meta.url));
  try {
    const ready = await runWorker(worker, null, 120000);
    if (!ready.ready) throw new Error('Example compiler worker failed to initialize');
    for (const example of EXAMPLES) {
      const url = `https://raw.githubusercontent.com/${repository}/${revision}/${example.source}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Cannot acquire ${example.id}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const directory = path.join(output, example.id);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, 'upstream.cob'), bytes);
      const result = await runWorker(worker, { unit: { ...example, source: bytes.toString('utf8') }, directory });
      results.programs.push({ ...example, url, sha256: sha256(bytes), ...result });
      console.log(`[EXAMPLE] ${example.id}: ${result.outcome}`);
      await fs.writeFile(path.join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
      if (result.outcome === 'timeout') throw new Error(`Worker timed out compiling ${example.id}; run is incomplete`);
    }
    results.complete = true;
    results.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
    if (argumentsList.includes('--publish')) await publish(results, output);
    if (results.programs.some(program => program.outcome !== 'pass')) process.exitCode = 1;
  } finally {
    await worker.terminate();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 2; });
}
