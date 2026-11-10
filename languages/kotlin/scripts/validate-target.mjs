import fs from 'node:fs/promises';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { kotlinCoreSpecCases } from '../tests/spec-cases.mjs';
import { upstreamCases, upstreamRevision } from '../tests/upstream-cases.mjs';
import { runFixture } from '../tests/upstream-runner.mjs';
import { createExecutionTarget, assertExecution } from '../tests/execution-targets.mjs';

const [target = 'js', reportFile] = process.argv.slice(2);
if (process.argv.length > 4) throw new Error('Usage: validate-target.mjs <js|native|esp32> [report.json]');
const report = { target, upstreamRevision, cases: [] };
const executor = await createExecutionTarget(target);
try {
  for (const item of kotlinCoreSpecCases) {
    try {
      const artifact = compileKotlinToPcode(item.source, { fileName: `${item.id}.kt`, target: target === 'esp32' ? 'esp32' : 'js' });
      const result = await executor.execute(artifact);
      assertExecution(result, item.stdout, item.id);
      report.cases.push({ id: item.id, feature: item.section, kind: 'spec', status: 'passed', ...result });
      console.log(`PASS ${target} ${item.id}`);
    } catch (error) {
      report.cases.push({ id: item.id, kind: 'spec', status: 'failed', diagnostic: error.message });
      console.error(`FAIL ${target} ${item.id}: ${error.message}`);
    }
  }
  const root = process.env.KOTLIN_CORPUS_ROOT;
  for (const item of upstreamCases) {
    const entry = { id: item.path, kind: item.kind, sha256: item.sha256,
      verification: item.kind === 'diagnostic' ? 'compiler-only' : 'execution' };
    if (!root || item.status !== 'supported') {
      report.cases.push({ ...entry, status: 'blocked', reason: !root ? 'KOTLIN_CORPUS_ROOT not configured' : 'Recorded compatibility gap' });
      continue;
    }
    try {
      await runFixture(root, item, executor);
      report.cases.push({ ...entry, status: 'passed' });
      console.log(`PASS ${target} ${item.path}`);
    } catch (error) {
      report.cases.push({ ...entry, status: 'failed', diagnostic: error.message });
      console.error(`FAIL ${target} ${item.path}: ${error.message}`);
    }
  }
} finally {
  try { await executor.stop(); }
  finally {
    report.counts = Object.fromEntries(['passed', 'failed', 'blocked'].map(status =>
      [status, report.cases.filter(item => item.status === status).length]));
    if (reportFile) await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  }
}
console.log(JSON.stringify(report.counts));
if (report.counts.failed) process.exitCode = 1;
