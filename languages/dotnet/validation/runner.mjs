import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { evaluate } from './evaluate.mjs';

const run = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const SUITES = ['all', 'core', 'generics', 'overloads', 'numeric', 'integers', 'negative', 'runtime', 'unsupported'];
const WORKER_TIMEOUT_MS = 120000;

export function createValidationRunner(config) {
  const { cases: CASES, validateInventory, summarizeCoverage } = config;
  const root = fileURLToPath(config.root);
  function selectCases(argv) {
    let suite = 'all', caseId, out, jobs = 1;
    const seen = new Set();
    for (let index = 0; index < argv.length; index += 2) {
      const option = argv[index], value = argv[index + 1];
      if (!['--suite', '--case', '--out', '--jobs'].includes(option) || !value || value.startsWith('--') || seen.has(option))
        throw new Error(`Invalid validation argument: ${option}`);
      seen.add(option);
      if (option === '--suite') suite = value;
      if (option === '--case') caseId = value;
      if (option === '--out') out = path.resolve(value);
      if (option === '--jobs') {
        if (!/^[1-8]$/.test(value)) throw new Error('--jobs must be an integer from 1 to 8');
        jobs = Number(value);
      }
    }
    if (!SUITES.includes(suite)) throw new Error(`Unknown suite '${suite}'; use ${SUITES.join(', ')}`);
    validateInventory(CASES);
    const cases = CASES.filter(item => (suite === 'all' || item.suite === suite
      || suite === 'integers' && item.feature === 'integers') && (!caseId || item.id === caseId));
    if (!cases.length) throw new Error('No validation cases match the requested selection');
    return { cases, suite, caseId, out, jobs };
  }

  async function fingerprint() {
    return sha256(Buffer.concat(await Promise.all(config.compilerFiles.map(file => fs.readFile(file)))));
  }

  async function runValidation(argv = process.argv.slice(2)) {
    const { cases, suite, caseId, out, jobs } = selectCases(argv);
    const output = out || path.join(root, 'validation', 'output', 'latest');
    const reportFile = out ? path.join(out, 'results.json') : path.join(root, 'reports', config.reportName);
    await fs.mkdir(output, { recursive: true });
    await fs.mkdir(path.dirname(reportFile), { recursive: true });
    const report = {
      schemaVersion: 2,
      suite: config.suiteName, standard: config.standard,
      provenance: 'Original Pulse tests; not an official standards conformance corpus',
      specification: config.specification,
      fullStandardConformance: false,
      target: 'js', hardware: 'not-run', node: process.version, platform: process.platform,
      compilerFingerprint: await fingerprint(), corpusSha256: sha256(JSON.stringify(CASES)),
      harnessFingerprint: sha256(Buffer.concat(await Promise.all(
        [...config.harnessFiles, new URL('./runner.mjs', import.meta.url), new URL('./observe.mjs', import.meta.url),
          new URL('./evaluate.mjs', import.meta.url)].map(file => fs.readFile(file))))),
      limits: { workerTimeoutMs: WORKER_TIMEOUT_MS, maxSteps: 100000, maxCallDepth: 64, jobs },
      coverage: { inventory: summarizeCoverage(CASES), selection: summarizeCoverage(cases) },
      selection: { suite, caseId: caseId || null }, selectedCases: cases.length, inventoryCases: CASES.length,
      startedAt: new Date().toISOString(), complete: false, cases: []
    };
    let persistence = Promise.resolve();
    const persist = () => {
      persistence = persistence.then(async () => {
        report.counts = Object.fromEntries(['pass', 'fail', 'unsupported', 'timeout', 'infrastructure-error']
          .map(status => [status, report.cases.filter(item => item.status === status).length]));
        const temporary = reportFile + '.tmp';
        await fs.writeFile(temporary, JSON.stringify(report, null, 2) + '\n', 'utf8');
        await fs.rename(temporary, reportFile);
      });
      return persistence;
    };
    await persist();
    const order = new Map(cases.map((item, index) => [item.id, index]));
    async function runCase(item) {
      const directory = path.join(output, item.id);
      await fs.mkdir(directory, { recursive: true });
      const sourceFile = path.join(directory, item.id + config.extension);
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
          fileURLToPath(config.worker), sourceFile, prefix,
          ['negative', 'unsupported'].includes(item.kind) ? 'compile' : 'execute'
        ], { timeout: WORKER_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
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
      report.cases.sort((a, b) => order.get(a.id) - order.get(b.id));
      console.log(`${entry.status.toUpperCase()} ${item.id} [${item.clause}]${entry.status === 'fail' ? ': ' + entry.reason : ''}`);
      await persist();
    }
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(jobs, cases.length) }, async () => {
      while (next < cases.length) await runCase(cases[next++]);
    }));
    report.complete = true;
    report.finishedAt = new Date().toISOString();
    report.subsetPassed = report.cases.every(item => item.status === 'pass' || item.status === 'unsupported');
    await persist();
    console.log(JSON.stringify({ report: reportFile, ...report.counts, fullStandardConformance: false }));
    return report;
  }

  return { selectCases, runValidation };
}
