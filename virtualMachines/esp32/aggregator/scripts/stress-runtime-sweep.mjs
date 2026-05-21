#!/usr/bin/env node

import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStressFlows } from '../stress-flows-load-test.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(os.tmpdir(), 'pulse-stress-reports');
const OUTPUT_DIR = process.env.OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const FLOW_COUNT = Number(process.env.FLOW_COUNT || 3);
const FLOW_STAGGER_MS = Number(process.env.FLOW_STAGGER_MS || 30);
const INTER_BATCH_DELAY_MS = Number(process.env.INTER_BATCH_DELAY_MS || 5);
const BETWEEN_PHASE_DELAY_MS = Number(process.env.BETWEEN_PHASE_DELAY_MS || 1000);
const SWEEP_SCALE = Number(process.env.SWEEP_SCALE || 1);
const SWEEP_REGRESSION_GATE = String(process.env.SWEEP_REGRESSION_GATE || '').toLowerCase() === '1'
  || String(process.env.SWEEP_REGRESSION_GATE || '').toLowerCase() === 'true';
const BASELINE_REPORT = process.env.BASELINE_REPORT || null;

const THROUGHPUT_DROP_THRESHOLD_PCT = Number(process.env.THROUGHPUT_DROP_THRESHOLD_PCT || 15);
const LATENCY_INCREASE_THRESHOLD_PCT = Number(process.env.LATENCY_INCREASE_THRESHOLD_PCT || 25);
const LOOP_P99_INCREASE_THRESHOLD_PCT = Number(process.env.LOOP_P99_INCREASE_THRESHOLD_PCT || 25);
const HEAP_INCREASE_THRESHOLD_PTS = Number(process.env.HEAP_INCREASE_THRESHOLD_PTS || 8);
const CPU_INCREASE_THRESHOLD_PTS = Number(process.env.CPU_INCREASE_THRESHOLD_PTS || 10);
const ERROR_RATE_INCREASE_THRESHOLD_PTS = Number(process.env.ERROR_RATE_INCREASE_THRESHOLD_PTS || 0.25);

const BASE_PHASES = [
  { name: 'light', messagesPerFlow: 150, flowConcurrency: 4 },
  { name: 'medium', messagesPerFlow: 400, flowConcurrency: 8 },
  { name: 'heavy', messagesPerFlow: 900, flowConcurrency: 14 }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stampUtc() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function buildPhases() {
  return BASE_PHASES.map((phase) => ({
    ...phase,
    messagesPerFlow: Math.max(1, Math.round(phase.messagesPerFlow * SWEEP_SCALE))
  }));
}

function buildHotspotSignals(phaseResults) {
  if (phaseResults.length === 0) return [];

  const byHeap = [...phaseResults]
    .filter((p) => p.runtimeDiagnostics?.process?.heapUsedPercent != null)
    .sort((a, b) => b.runtimeDiagnostics.process.heapUsedPercent - a.runtimeDiagnostics.process.heapUsedPercent)[0];

  const byLoopDelay = [...phaseResults]
    .filter((p) => p.runtimeDiagnostics?.eventLoop?.delayP99Ms != null)
    .sort((a, b) => b.runtimeDiagnostics.eventLoop.delayP99Ms - a.runtimeDiagnostics.eventLoop.delayP99Ms)[0];

  const byCpu = [...phaseResults]
    .filter((p) => p.runtimeDiagnostics?.cpu?.usagePercentAllCores != null)
    .sort((a, b) => b.runtimeDiagnostics.cpu.usagePercentAllCores - a.runtimeDiagnostics.cpu.usagePercentAllCores)[0];

  const byThroughput = [...phaseResults]
    .filter((p) => p.summary?.throughputMsgsPerSec != null)
    .sort((a, b) => b.summary.throughputMsgsPerSec - a.summary.throughputMsgsPerSec)[0];

  const signals = [];
  if (byHeap) {
    signals.push(`Highest heap pressure in ${byHeap.phase}: ${byHeap.runtimeDiagnostics.process.heapUsedPercent}% heap used (${byHeap.runtimeDiagnostics.process.heapUsedMb}MB).`);
  }
  if (byLoopDelay) {
    signals.push(`Highest event-loop delay in ${byLoopDelay.phase}: p99=${byLoopDelay.runtimeDiagnostics.eventLoop.delayP99Ms}ms, p95=${byLoopDelay.runtimeDiagnostics.eventLoop.delayP95Ms}ms.`);
  }
  if (byCpu) {
    signals.push(`Highest CPU pressure in ${byCpu.phase}: all-cores=${byCpu.runtimeDiagnostics.cpu.usagePercentAllCores}%, single-core=${byCpu.runtimeDiagnostics.cpu.usagePercentSingleCore}%.`);
  }
  if (byThroughput) {
    signals.push(`Peak throughput in ${byThroughput.phase}: ${byThroughput.summary.throughputMsgsPerSec} msg/s; compare this against heavier phases for saturation signs.`);
  }
  return signals.slice(0, 3);
}

function toPct(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function percentChange(base, candidate) {
  if (!Number.isFinite(base) || base === 0 || !Number.isFinite(candidate)) return null;
  return Number((((candidate - base) / base) * 100).toFixed(2));
}

function summarizePhaseForGate(phase) {
  const attempted = phase.summary.attempted || 0;
  const failed = phase.summary.failed || 0;
  const avgLatencyMs = attempted > 0
    ? Number((phase.statsByFlow.reduce((sum, flow) => sum + flow.totalLatencyMs, 0) / attempted).toFixed(2))
    : 0;
  return {
    phase: phase.phase,
    attempted,
    failedRatePct: toPct(failed, attempted),
    throughputMsgsPerSec: phase.summary.throughputMsgsPerSec || 0,
    avgLatencyMs,
    heapUsedPercent: phase.runtimeDiagnostics?.process?.heapUsedPercent ?? null,
    cpuAllCoresPercent: phase.runtimeDiagnostics?.cpu?.usagePercentAllCores ?? null,
    eventLoopP99Ms: phase.runtimeDiagnostics?.eventLoop?.delayP99Ms ?? null
  };
}

function evaluatePhaseRegression(baseSummary, candidateSummary) {
  const deltas = {
    throughputChangePct: percentChange(baseSummary.throughputMsgsPerSec, candidateSummary.throughputMsgsPerSec),
    latencyChangePct: percentChange(baseSummary.avgLatencyMs, candidateSummary.avgLatencyMs),
    eventLoopP99ChangePct: percentChange(baseSummary.eventLoopP99Ms, candidateSummary.eventLoopP99Ms),
    heapDeltaPts: baseSummary.heapUsedPercent != null && candidateSummary.heapUsedPercent != null
      ? Number((candidateSummary.heapUsedPercent - baseSummary.heapUsedPercent).toFixed(2))
      : null,
    cpuDeltaPts: baseSummary.cpuAllCoresPercent != null && candidateSummary.cpuAllCoresPercent != null
      ? Number((candidateSummary.cpuAllCoresPercent - baseSummary.cpuAllCoresPercent).toFixed(2))
      : null,
    errorRateDeltaPts: Number((candidateSummary.failedRatePct - baseSummary.failedRatePct).toFixed(2))
  };

  const findings = [];
  if (deltas.throughputChangePct != null && deltas.throughputChangePct <= -THROUGHPUT_DROP_THRESHOLD_PCT) {
    findings.push(`Throughput regression in ${baseSummary.phase}: ${Math.abs(deltas.throughputChangePct)}% drop.`);
  }
  if (deltas.latencyChangePct != null && deltas.latencyChangePct >= LATENCY_INCREASE_THRESHOLD_PCT) {
    findings.push(`Latency regression in ${baseSummary.phase}: ${deltas.latencyChangePct}% increase.`);
  }
  if (deltas.eventLoopP99ChangePct != null && deltas.eventLoopP99ChangePct >= LOOP_P99_INCREASE_THRESHOLD_PCT) {
    findings.push(`Event-loop p99 regression in ${baseSummary.phase}: ${deltas.eventLoopP99ChangePct}% increase.`);
  }
  if (deltas.heapDeltaPts != null && deltas.heapDeltaPts >= HEAP_INCREASE_THRESHOLD_PTS) {
    findings.push(`Heap regression in ${baseSummary.phase}: +${deltas.heapDeltaPts} points.`);
  }
  if (deltas.cpuDeltaPts != null && deltas.cpuDeltaPts >= CPU_INCREASE_THRESHOLD_PTS) {
    findings.push(`CPU regression in ${baseSummary.phase}: +${deltas.cpuDeltaPts} points.`);
  }
  if (deltas.errorRateDeltaPts >= ERROR_RATE_INCREASE_THRESHOLD_PTS) {
    findings.push(`Error-rate regression in ${baseSummary.phase}: +${deltas.errorRateDeltaPts} points.`);
  }

  return {
    phase: baseSummary.phase,
    deltas,
    findings
  };
}

async function resolveBaselineReportPath() {
  if (BASELINE_REPORT) {
    return path.resolve(BASELINE_REPORT);
  }
  try {
    const items = await readdir(OUTPUT_DIR, { withFileTypes: true });
    const jsonFiles = items
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name.startsWith('sweep-'))
      .map((entry) => entry.name)
      .sort();
    if (jsonFiles.length === 0) return null;
    return path.join(OUTPUT_DIR, jsonFiles[jsonFiles.length - 1]);
  } catch {
    return null;
  }
}

async function runRegressionGate(candidateReport) {
  if (!SWEEP_REGRESSION_GATE) {
    return {
      enabled: false,
      passed: true,
      baselinePath: null,
      findings: [],
      phaseComparisons: []
    };
  }

  const baselinePath = await resolveBaselineReportPath();
  if (!baselinePath) {
    return {
      enabled: true,
      passed: true,
      baselinePath: null,
      findings: [],
      phaseComparisons: [],
      skippedReason: 'No baseline report available in output directory.'
    };
  }

  const baselineReport = JSON.parse(await readFile(baselinePath, 'utf8'));
  const baseByPhase = new Map((baselineReport.phases || []).map((phase) => [phase.phase, summarizePhaseForGate(phase)]));
  const candidateByPhase = new Map((candidateReport.phases || []).map((phase) => [phase.phase, summarizePhaseForGate(phase)]));
  const sharedPhases = [...baseByPhase.keys()].filter((phase) => candidateByPhase.has(phase));
  if (sharedPhases.length === 0) {
    return {
      enabled: true,
      passed: true,
      baselinePath,
      findings: [],
      phaseComparisons: [],
      skippedReason: 'No shared phase names between baseline and candidate reports.'
    };
  }

  const phaseComparisons = sharedPhases.map((phase) => evaluatePhaseRegression(baseByPhase.get(phase), candidateByPhase.get(phase)));
  const findings = phaseComparisons.flatMap((item) => item.findings);

  return {
    enabled: true,
    passed: findings.length === 0,
    baselinePath,
    findings,
    phaseComparisons,
    thresholds: {
      throughputDropPct: THROUGHPUT_DROP_THRESHOLD_PCT,
      latencyIncreasePct: LATENCY_INCREASE_THRESHOLD_PCT,
      loopP99IncreasePct: LOOP_P99_INCREASE_THRESHOLD_PCT,
      heapIncreasePts: HEAP_INCREASE_THRESHOLD_PTS,
      cpuIncreasePts: CPU_INCREASE_THRESHOLD_PTS,
      errorRateIncreasePts: ERROR_RATE_INCREASE_THRESHOLD_PTS
    }
  };
}

function renderMarkdownReport(report) {
  const lines = [];
  lines.push('# Stress Runtime Sweep Report');
  lines.push('');
  lines.push(`- Run ID: ${report.runId}`);
  lines.push(`- Captured At (UTC): ${report.capturedAt}`);
  lines.push(`- Backend: ${report.backendUrl}`);
  lines.push(`- Flow Count: ${report.flowCount}`);
  lines.push(`- Sweep Scale: ${report.sweepScale}`);
  lines.push('');

  lines.push('## Phase Summary');
  lines.push('');
  lines.push('| Phase | Attempted | Success | Failed | Throughput (msg/s) | Avg Latency (ms) | Heap Used % | CPU All Cores % | Event Loop p99 (ms) |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

  for (const phase of report.phases) {
    const attempted = phase.summary.attempted;
    const avgLatency = attempted > 0 ? Number((phase.statsByFlow.reduce((sum, flow) => sum + flow.totalLatencyMs, 0) / attempted).toFixed(2)) : 0;
    const heapUsedPercent = phase.runtimeDiagnostics?.process?.heapUsedPercent ?? 'n/a';
    const cpuAllCoresPercent = phase.runtimeDiagnostics?.cpu?.usagePercentAllCores ?? 'n/a';
    const loopP99 = phase.runtimeDiagnostics?.eventLoop?.delayP99Ms ?? 'n/a';

    lines.push(`| ${phase.phase} | ${phase.summary.attempted} | ${phase.summary.ok} | ${phase.summary.failed} | ${phase.summary.throughputMsgsPerSec} | ${avgLatency} | ${heapUsedPercent} | ${cpuAllCoresPercent} | ${loopP99} |`);
  }

  lines.push('');
  lines.push('## Top Bottleneck Signals');
  lines.push('');
  if (report.hotspotSignals.length === 0) {
    lines.push('- No hotspot signals could be derived from this run.');
  } else {
    for (const signal of report.hotspotSignals) {
      lines.push(`- ${signal}`);
    }
  }

  lines.push('');
  lines.push('## Per-Phase Flow Details');
  lines.push('');
  for (const phase of report.phases) {
    lines.push(`### ${phase.phase}`);
    for (const flow of phase.statsByFlow) {
      lines.push(`- ${flow.flow} (${flow.queue}): attempted=${flow.attempted}, ok=${flow.ok}, failed=${flow.failed}, latency[min/avg/max]=${flow.minLatencyMs}/${flow.avgLatencyMs}/${flow.maxLatencyMs}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function runSweep() {
  const runId = `sweep-${stampUtc()}`;
  const phases = buildPhases();

  console.log('=== Stress Runtime Sweep ===');
  console.log(`Run ID: ${runId}`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Flow count: ${FLOW_COUNT}`);
  console.log(`Sweep scale: ${SWEEP_SCALE}`);
  console.log('');

  const phaseResults = [];
  for (let i = 0; i < phases.length; i += 1) {
    const phase = phases[i];
    console.log(`Running phase ${phase.name} (messagesPerFlow=${phase.messagesPerFlow}, concurrency=${phase.flowConcurrency})`);

    const result = await runStressFlows({
      backendUrl: BACKEND_URL,
      flowCount: FLOW_COUNT,
      messagesPerFlow: phase.messagesPerFlow,
      flowConcurrency: phase.flowConcurrency,
      flowStaggerMs: FLOW_STAGGER_MS,
      interBatchDelayMs: INTER_BATCH_DELAY_MS
    });

    phaseResults.push({ phase: phase.name, ...result });
    console.log(`Completed ${phase.name}: throughput=${result.summary.throughputMsgsPerSec} msg/s failed=${result.summary.failed}`);

    if (i < phases.length - 1 && BETWEEN_PHASE_DELAY_MS > 0) {
      await sleep(BETWEEN_PHASE_DELAY_MS);
    }
  }

  const report = {
    runId,
    capturedAt: new Date().toISOString(),
    backendUrl: BACKEND_URL,
    flowCount: FLOW_COUNT,
    sweepScale: SWEEP_SCALE,
    phases: phaseResults,
    hotspotSignals: buildHotspotSignals(phaseResults)
  };

  const regressionGate = await runRegressionGate(report);
  report.regressionGate = regressionGate;

  await mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, `${runId}.json`);
  const mdPath = path.join(OUTPUT_DIR, `${runId}.md`);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(mdPath, `${renderMarkdownReport(report)}\n`, 'utf8');

  console.log('');
  console.log('Sweep complete. Reports written:');
  console.log(`- ${jsonPath}`);
  console.log(`- ${mdPath}`);

  if (report.hotspotSignals.length > 0) {
    console.log('Top bottleneck signals:');
    for (const signal of report.hotspotSignals) {
      console.log(`- ${signal}`);
    }
  }

  if (regressionGate.enabled) {
    if (regressionGate.skippedReason) {
      console.log(`Regression gate skipped: ${regressionGate.skippedReason}`);
    } else if (!regressionGate.passed) {
      console.error('Regression gate failed:');
      for (const finding of regressionGate.findings) {
        console.error(`- ${finding}`);
      }
      process.exitCode = 2;
    } else {
      console.log('Regression gate passed.');
    }
  }
}

runSweep().catch((error) => {
  console.error('Stress sweep failed:', error?.message || error);
  process.exitCode = 1;
});
