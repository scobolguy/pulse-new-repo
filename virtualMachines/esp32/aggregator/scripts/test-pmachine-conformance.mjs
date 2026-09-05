#!/usr/bin/env node
// PMachine conformance runner.
//
//   --target js|esp32   run one runtime and check each case's expectations
//   --diff              run both runtimes and report field-level result differences
//   --case <id>         run a single case
//   --family <name>     run one case family
//   --json              emit a machine-readable gap report
import { selectCases } from './pmachine-conformance-cases.mjs';
import * as jsTarget from './pmachine-target-js.mjs';

function parseArgs(argv) {
  const args = { target: 'js', diff: false, caseId: '', family: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--target') args.target = String(argv[i + 1] || 'js');
    if (token === '--diff') args.diff = true;
    if (token === '--case') args.caseId = String(argv[i + 1] || '');
    if (token === '--family') args.family = String(argv[i + 1] || '');
    if (token === '--json') args.json = true;
  }
  return args;
}

async function loadTarget(name) {
  if (name === 'js') return jsTarget;
  if (name === 'esp32') return import('./pmachine-target-esp32.mjs');
  throw new Error(`Unknown target: ${name}`);
}

function describe(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === undefined) return 'undefined';
  return JSON.stringify(value);
}

function checkExpectations(testCase, result) {
  if (typeof testCase.expect !== 'function') return [];
  const failures = [];
  for (const [label, actual, expected] of testCase.expect(result)) {
    if (actual !== expected) {
      failures.push(`${label}: expected ${describe(expected)}, got ${describe(actual)}`);
    }
  }
  return failures;
}

// JSON object key order is insignificant, and the two runtimes order keys differently
// (JS hoists integer-like keys). Canonicalise before comparing; arrays keep their order.
function canonicalize(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
    try {
      return JSON.stringify(canonicalize(JSON.parse(trimmed)));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key]);
    return sorted;
  }
  return value;
}

// Compares the fields both runtimes are contractually required to agree on.
function diffResults(left, right, ignore = []) {
  const differences = [];
  const skip = new Set(ignore);

  const record = (field, a, b) => {
    if (skip.has(field)) return;
    if (JSON.stringify(canonicalize(a)) !== JSON.stringify(canonicalize(b))) {
      differences.push({ field, js: a, esp32: b });
    }
  };

  record('stdout', left.stdout, right.stdout);
  record('publishedCount', left.publishedCount, right.publishedCount);
  record('deliveries', left.deliveries, right.deliveries);
  record('stepLimitHit', left.stepLimitHit, right.stepLimitHit);

  for (const key of new Set([...Object.keys(left.globals), ...Object.keys(right.globals)])) {
    record(`globals.${key}`, left.globals[key], right.globals[key]);
  }

  for (const key of new Set([...Object.keys(left.state), ...Object.keys(right.state)])) {
    // Device-only diagnostics carry no parity contract.
    if (key === '__memory_pressure') continue;
    record(`state.${key}`, left.state[key], right.state[key]);
  }

  return differences;
}

async function runSingleTarget(cases, targetName) {
  const target = await loadTarget(targetName);
  const report = [];

  for (const testCase of cases) {
    let result;
    try {
      result = await target.runCase(testCase);
    } catch (error) {
      report.push({ id: testCase.id, family: testCase.family, status: 'ERROR', failures: [error?.message || String(error)] });
      console.error(`FAIL ${testCase.id} (${testCase.family}) — ${error?.message || error}`);
      continue;
    }

    const failures = checkExpectations(testCase, result);
    if (result.runtimeError && failures.length === 0 && typeof testCase.expect !== 'function') {
      failures.push(`unexpected runtimeError: ${result.runtimeError}`);
    }

    const status = failures.length === 0 ? 'PASS' : 'FAIL';
    report.push({ id: testCase.id, family: testCase.family, status, failures, result });
    console.log(`${status} ${testCase.id} (${testCase.family})`);
    for (const failure of failures) console.log(`     ${failure}`);
  }

  return report;
}

async function runDiff(cases) {
  const esp32Target = await loadTarget('esp32');
  const report = [];

  for (const testCase of cases) {
    let jsResult;
    let espResult;
    try {
      jsResult = await jsTarget.runCase(testCase);
      espResult = await esp32Target.runCase(testCase);
    } catch (error) {
      report.push({ id: testCase.id, family: testCase.family, status: 'ERROR', differences: [{ field: 'run', error: error?.message || String(error) }] });
      console.error(`ERROR ${testCase.id} (${testCase.family}) — ${error?.message || error}`);
      continue;
    }

    const differences = diffResults(jsResult, espResult, testCase.diffIgnore);
    const status = differences.length === 0 ? 'MATCH' : 'DIFF';
    report.push({ id: testCase.id, family: testCase.family, status, differences });
    console.log(`${status} ${testCase.id} (${testCase.family})`);
    for (const difference of differences) {
      console.log(`     ${difference.field}: js=${describe(difference.js)} esp32=${describe(difference.esp32)}`);
    }
  }

  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = selectCases({ caseId: args.caseId, family: args.family });

  if (cases.length === 0) {
    console.error('[pmachine-conformance] no cases matched the given filters');
    process.exitCode = 1;
    return;
  }

  const report = args.diff ? await runDiff(cases) : await runSingleTarget(cases, args.target);
  const failed = report.filter(entry => entry.status !== 'PASS' && entry.status !== 'MATCH');

  if (args.json) {
    console.log(JSON.stringify({ mode: args.diff ? 'diff' : args.target, total: report.length, failed: failed.length, report }, null, 2));
  }

  const label = args.diff ? 'diff' : args.target;
  console.log(`\n[pmachine-conformance:${label}] ${report.length - failed.length}/${report.length} ok`);

  if (failed.length > 0) {
    console.error(`[pmachine-conformance:${label}] gaps: ${failed.map(entry => entry.id).join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[pmachine-conformance] FAILED:', error?.message || String(error));
  process.exitCode = 1;
});
