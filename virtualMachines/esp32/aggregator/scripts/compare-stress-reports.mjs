#!/usr/bin/env node

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_REPORT_DIR = path.join(os.tmpdir(), 'pulse-stress-reports');
const REPORT_DIR = process.env.REPORT_DIR || DEFAULT_REPORT_DIR;
const FAIL_ON_REGRESSION = String(process.env.FAIL_ON_REGRESSION || '').toLowerCase() === '1'
  || String(process.env.FAIL_ON_REGRESSION || '').toLowerCase() === 'true';

const THROUGHPUT_DROP_THRESHOLD_PCT = Number(process.env.THROUGHPUT_DROP_THRESHOLD_PCT || 15);
const LATENCY_INCREASE_THRESHOLD_PCT = Number(process.env.LATENCY_INCREASE_THRESHOLD_PCT || 25);
const LOOP_P99_INCREASE_THRESHOLD_PCT = Number(process.env.LOOP_P99_INCREASE_THRESHOLD_PCT || 25);
const HEAP_INCREASE_THRESHOLD_PTS = Number(process.env.HEAP_INCREASE_THRESHOLD_PTS || 8);
const CPU_INCREASE_THRESHOLD_PTS = Number(process.env.CPU_INCREASE_THRESHOLD_PTS || 10);
const ERROR_RATE_INCREASE_THRESHOLD_PTS = Number(process.env.ERROR_RATE_INCREASE_THRESHOLD_PTS || 0.25);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    out[key] = value;
    if (value !== true) i += 1;
  }
  return out;
}

async function resolveDefaultReports() {
  const items = await readdir(REPORT_DIR, { withFileTypes: true });
  const jsonFiles = items
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name.startsWith('sweep-'))
    .map((entry) => entry.name)
    .sort();

  if (jsonFiles.length < 2) {
    throw new Error(`Need at least 2 sweep JSON reports in ${REPORT_DIR}.`);
  }

  return {
    base: path.join(REPORT_DIR, jsonFiles[jsonFiles.length - 2]),
    candidate: path.join(REPORT_DIR, jsonFiles[jsonFiles.length - 1])
  };
}

function toPct(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function percentChange(base, candidate) {
  if (!Number.isFinite(base) || base === 0 || !Number.isFinite(candidate)) return null;
  return Number((((candidate - base) / base) * 100).toFixed(2));
}

function phaseSummary(phase) {
  const attempted = phase.summary.attempted || 0;
  const failed = phase.summary.failed || 0;
  const avgLatencyMs = attempted > 0
    ? Number((phase.statsByFlow.reduce((sum, flow) => sum + flow.totalLatencyMs, 0) / attempted).toFixed(2))
    : 0;

  return {
    phase: phase.phase,
    attempted,
    failed,
    failedRatePct: toPct(failed, attempted),
    throughputMsgsPerSec: phase.summary.throughputMsgsPerSec || 0,
    avgLatencyMs,
    heapUsedPercent: phase.runtimeDiagnostics?.process?.heapUsedPercent ?? null,
    cpuAllCoresPercent: phase.runtimeDiagnostics?.cpu?.usagePercentAllCores ?? null,
    eventLoopP99Ms: phase.runtimeDiagnostics?.eventLoop?.delayP99Ms ?? null
  };
}

function analyzeDeltas(baseSummary, candidateSummary) {
  const throughputChangePct = percentChange(baseSummary.throughputMsgsPerSec, candidateSummary.throughputMsgsPerSec);
  const latencyChangePct = percentChange(baseSummary.avgLatencyMs, candidateSummary.avgLatencyMs);
  const loopP99ChangePct = percentChange(baseSummary.eventLoopP99Ms, candidateSummary.eventLoopP99Ms);

  const heapDeltaPts = baseSummary.heapUsedPercent != null && candidateSummary.heapUsedPercent != null
    ? Number((candidateSummary.heapUsedPercent - baseSummary.heapUsedPercent).toFixed(2))
    : null;

  const cpuDeltaPts = baseSummary.cpuAllCoresPercent != null && candidateSummary.cpuAllCoresPercent != null
    ? Number((candidateSummary.cpuAllCoresPercent - baseSummary.cpuAllCoresPercent).toFixed(2))
    : null;

  const errorRateDeltaPts = Number((candidateSummary.failedRatePct - baseSummary.failedRatePct).toFixed(2));

  const findings = [];
  if (throughputChangePct != null && throughputChangePct <= -THROUGHPUT_DROP_THRESHOLD_PCT) {
    findings.push(`Throughput regression: ${baseSummary.phase} dropped ${Math.abs(throughputChangePct)}%.`);
  }
  if (latencyChangePct != null && latencyChangePct >= LATENCY_INCREASE_THRESHOLD_PCT) {
    findings.push(`Latency regression: ${baseSummary.phase} increased ${latencyChangePct}%.`);
  }
  if (loopP99ChangePct != null && loopP99ChangePct >= LOOP_P99_INCREASE_THRESHOLD_PCT) {
    findings.push(`Event-loop regression: ${baseSummary.phase} p99 increased ${loopP99ChangePct}%.`);
  }
  if (heapDeltaPts != null && heapDeltaPts >= HEAP_INCREASE_THRESHOLD_PTS) {
    findings.push(`Heap pressure regression: ${baseSummary.phase} increased ${heapDeltaPts} pts.`);
  }
  if (cpuDeltaPts != null && cpuDeltaPts >= CPU_INCREASE_THRESHOLD_PTS) {
    findings.push(`CPU regression: ${baseSummary.phase} increased ${cpuDeltaPts} pts.`);
  }
  if (errorRateDeltaPts >= ERROR_RATE_INCREASE_THRESHOLD_PTS) {
    findings.push(`Error-rate regression: ${baseSummary.phase} increased ${errorRateDeltaPts} pts.`);
  }

  return {
    phase: baseSummary.phase,
    base: baseSummary,
    candidate: candidateSummary,
    deltas: {
      throughputChangePct,
      latencyChangePct,
      eventLoopP99ChangePct: loopP99ChangePct,
      heapDeltaPts,
      cpuDeltaPts,
      errorRateDeltaPts
    },
    findings
  };
}

function renderCompareMarkdown(compareReport) {
  const lines = [];
  lines.push('# Stress Report Comparison');
  lines.push('');
  lines.push(`- Base: ${compareReport.basePath}`);
  lines.push(`- Candidate: ${compareReport.candidatePath}`);
  lines.push(`- Compared At: ${compareReport.comparedAt}`);
  lines.push('');
  lines.push('## Phase Delta Table');
  lines.push('');
  lines.push('| Phase | Throughput Δ% | Avg Latency Δ% | Error Rate Δ pts | Heap Δ pts | CPU Δ pts | Loop p99 Δ% |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');

  for (const p of compareReport.phaseComparisons) {
    lines.push(`| ${p.phase} | ${p.deltas.throughputChangePct ?? 'n/a'} | ${p.deltas.latencyChangePct ?? 'n/a'} | ${p.deltas.errorRateDeltaPts ?? 'n/a'} | ${p.deltas.heapDeltaPts ?? 'n/a'} | ${p.deltas.cpuDeltaPts ?? 'n/a'} | ${p.deltas.eventLoopP99ChangePct ?? 'n/a'} |`);
  }

  lines.push('');
  lines.push('## Regression Findings');
  lines.push('');
  if (compareReport.findings.length === 0) {
    lines.push('- No regressions crossed configured thresholds.');
  } else {
    for (const finding of compareReport.findings) {
      lines.push(`- ${finding}`);
    }
  }

  lines.push('');
  lines.push('## Thresholds');
  lines.push('');
  lines.push(`- Throughput drop threshold: ${THROUGHPUT_DROP_THRESHOLD_PCT}%`);
  lines.push(`- Latency increase threshold: ${LATENCY_INCREASE_THRESHOLD_PCT}%`);
  lines.push(`- Event-loop p99 increase threshold: ${LOOP_P99_INCREASE_THRESHOLD_PCT}%`);
  lines.push(`- Heap increase threshold: ${HEAP_INCREASE_THRESHOLD_PTS} points`);
  lines.push(`- CPU increase threshold: ${CPU_INCREASE_THRESHOLD_PTS} points`);
  lines.push(`- Error-rate increase threshold: ${ERROR_RATE_INCREASE_THRESHOLD_PTS} points`);

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const defaults = await resolveDefaultReports();

  const basePath = path.resolve(args.base || defaults.base);
  const candidatePath = path.resolve(args.candidate || defaults.candidate);

  const baseReport = JSON.parse(await readFile(basePath, 'utf8'));
  const candidateReport = JSON.parse(await readFile(candidatePath, 'utf8'));

  const baseByPhase = new Map(baseReport.phases.map((phase) => [phase.phase, phaseSummary(phase)]));
  const candidateByPhase = new Map(candidateReport.phases.map((phase) => [phase.phase, phaseSummary(phase)]));

  const sharedPhases = [...baseByPhase.keys()].filter((phase) => candidateByPhase.has(phase));
  if (sharedPhases.length === 0) {
    throw new Error('No matching phase names between base and candidate reports.');
  }

  const phaseComparisons = sharedPhases.map((phase) => analyzeDeltas(baseByPhase.get(phase), candidateByPhase.get(phase)));
  const findings = phaseComparisons.flatMap((phase) => phase.findings);

  const compareReport = {
    comparedAt: new Date().toISOString(),
    basePath,
    candidatePath,
    phaseComparisons,
    findings
  };

  await mkdir(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const outputBase = path.join(REPORT_DIR, `compare-${stamp}`);
  const jsonOut = `${outputBase}.json`;
  const mdOut = `${outputBase}.md`;

  await writeFile(jsonOut, `${JSON.stringify(compareReport, null, 2)}\n`, 'utf8');
  await writeFile(mdOut, `${renderCompareMarkdown(compareReport)}\n`, 'utf8');

  console.log('Stress comparison complete.');
  console.log(`Base: ${basePath}`);
  console.log(`Candidate: ${candidatePath}`);
  console.log(`JSON report: ${jsonOut}`);
  console.log(`Markdown report: ${mdOut}`);

  if (findings.length > 0) {
    console.log('Regression findings:');
    for (const finding of findings) {
      console.log(`- ${finding}`);
    }
    if (FAIL_ON_REGRESSION) {
      process.exitCode = 2;
    }
  } else {
    console.log('No regressions crossed thresholds.');
  }
}

main().catch((error) => {
  console.error('Stress report comparison failed:', error?.message || error);
  process.exitCode = 1;
});
