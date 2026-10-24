import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { CASES } from './cases.mjs';
import { evaluate } from './evaluate.mjs';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const SUITES = ['all', 'core', 'generics', 'negative', 'runtime', 'unsupported'];

export function selectCases(argv) {
  let suite = 'all', caseId, out;
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index], value = argv[index + 1];
    if (!['--suite', '--case', '--out'].includes(option) || !value || value.startsWith('--') || seen.has(option))
      throw new Error(`Invalid validation argument: ${option}`);
    seen.add(option);
    if (option === '--suite') suite = value;
    if (option === '--case') caseId = value;
    if (option === '--out') out = path.resolve(value);
  }
  if (!SUITES.includes(suite)) throw new Error(`Unknown suite '${suite}'; use ${SUITES.join(', ')}`);
  const ids = new Set();
  for (const item of CASES) {
    if (!/^CS-[A-Z]+-\d{3}$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate case id: ${item.id}`);
    ids.add(item.id);
  }
  const cases = CASES.filter(item => (suite === 'all' || item.suite === suite) && (!caseId || item.id === caseId));
  if (!cases.length) throw new Error('No validation cases match the requested selection');
  return { cases, suite, caseId, out };
}

async function fingerprint() {
  const files = [
    new URL('../src/parser.mjs', import.meta.url), new URL('../src/semantics.mjs', import.meta.url),
    new URL('../src/compile-csharp-to-pcode.mjs', import.meta.url),
    new URL('../../dotnet/system-library.mjs', import.meta.url),
    new URL('../../dotnet/libraries/System/library.json', import.meta.url),
    new URL('../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs', import.meta.url)
  ];
  return sha256(Buffer.concat(await Promise.all(files.map(file => fs.readFile(file)))));
}

export async function runValidation(argv = process.argv.slice(2)) {
  const { cases, suite, caseId, out } = selectCases(argv);
  const output = out || path.join(root, 'validation', 'output', 'latest');
  const reportFile = out ? path.join(out, 'results.json') : path.join(root, 'reports', 'ecma334-js-validation.json');
  await fs.mkdir(output, { recursive: true });
  await fs.mkdir(path.dirname(reportFile), { recursive: true });
  const report = {
    schemaVersion: 1,
    suite: 'Pulse C# Validation Suite', standard: 'ECMA-334',
    provenance: 'Original Pulse tests; not an official ECMA or third-party conformance corpus',
    specification: 'https://github.com/dotnet/csharpstandard/tree/standard-v7/standard',
    fullStandardConformance: false,
    target: 'js', hardware: 'not-run', node: process.version, platform: process.platform,
    compilerFingerprint: await fingerprint(), corpusSha256: sha256(JSON.stringify(CASES)),
    selection: { suite, caseId: caseId || null }, selectedCases: cases.length, inventoryCases: CASES.length,
    startedAt: new Date().toISOString(), complete: false, cases: []
  };
  const persist = async () => {
    report.counts = Object.fromEntries(['pass', 'fail', 'unsupported', 'timeout', 'infrastructure-error']
      .map(status => [status, report.cases.filter(item => item.status === status).length]));
    const temporary = reportFile + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(report, null, 2) + '\n', 'utf8');
    await fs.rename(temporary, reportFile);
  };
  await persist();
  for (const item of cases) {
    const directory = path.join(output, item.id);
    await fs.mkdir(directory, { recursive: true });
    const sourceFile = path.join(directory, item.id + '.cs');
    const prefix = path.join(directory, item.id);
    const entry = {
      id: item.id, clause: item.clause, suite: item.suite, kind: item.kind,
      sourceSha256: sha256(item.source), sourceFile: path.relative(path.dirname(reportFile), sourceFile).replaceAll('\\', '/'),
      expected: item.kind === 'positive'
        ? { stdout: item.stdout, exitCode: item.exitCode ?? null, specializations: item.specializations || {} }
        : { diagnostic: item.diagnostic, errorName: item.errorName || 'SyntaxError' }
    };
    const start = performance.now();
    try {
      await fs.writeFile(sourceFile, item.source, 'utf8');
      for (const suffix of ['.pcode', '.program.json']) await fs.rm(prefix + suffix, { force: true });
      const { stdout, stderr } = await run(process.execPath, [
        fileURLToPath(new URL('./worker.mjs', import.meta.url)), sourceFile, prefix,
        ['negative', 'unsupported'].includes(item.kind) ? 'compile' : 'execute'
      ], { timeout: 10000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
      const actual = JSON.parse(stdout);
      entry.actual = actual;
      Object.assign(entry, evaluate(item, actual));
      if (stderr) entry.stderr = stderr;
    } catch (error) {
      entry.status = error.killed ? 'timeout' : 'infrastructure-error';
      entry.reason = error.message;
      if (error.stderr) entry.stderr = String(error.stderr);
    }
    entry.durationMs = Math.round(performance.now() - start);
    report.cases.push(entry);
    console.log(`${entry.status.toUpperCase()} ${item.id} [${item.clause}]${entry.status === 'fail' ? ': ' + entry.reason : ''}`);
    await persist();
  }
  report.complete = true;
  report.finishedAt = new Date().toISOString();
  report.subsetPassed = report.cases.every(item => item.status === 'pass' || item.status === 'unsupported');
  await persist();
  console.log(JSON.stringify({ report: reportFile, ...report.counts, fullStandardConformance: false }));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runValidation().then(report => { process.exitCode = report.subsetPassed ? 0 : 1; })
    .catch(error => { console.error(`[C# validation] ${error.message}`); process.exitCode = 2; });
}
