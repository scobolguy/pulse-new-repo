#!/usr/bin/env node

import fetch from 'node-fetch';
import { pathToFileURL } from 'node:url';

const DEFAULT_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const DEFAULT_FLOW_COUNT = Number(process.env.FLOW_COUNT || 3);
const DEFAULT_MESSAGES_PER_FLOW = Number(process.env.MESSAGES_PER_FLOW || 400);
const DEFAULT_FLOW_CONCURRENCY = Number(process.env.FLOW_CONCURRENCY || 8);
const DEFAULT_FLOW_STAGGER_MS = Number(process.env.FLOW_STAGGER_MS || 30);
const DEFAULT_INTER_BATCH_DELAY_MS = Number(process.env.INTER_BATCH_DELAY_MS || 5);

export const FLOWS = [
  {
    id: 'stress-ingress-mt103',
    queue: 'swift.mt103.inbound',
    type: 'MT103',
    messageFactory: (flowId, index) => {
      const reference = `REF${flowId}-${Date.now()}-${index}`;
      const amount = (1000 + (index % 5000)).toFixed(2);
      return `MT103\n:20:${reference}\n:23B:CRED\n:32A:260520USD${amount}\n:50K:/ACCT${String(index % 100000).padStart(5, '0')}\nORIGINATOR ${flowId}\n:59:/ACCT${String((index + 777) % 100000).padStart(5, '0')}\nBENEFICIARY ${index}\n:70:STRESS TEST ${flowId}/${index}\n:71A:SHA`;
    }
  },
  {
    id: 'stress-pacs-json',
    queue: 'pacs.inbound',
    type: 'PACS008',
    messageFactory: (flowId, index) => ({
      Document: {
        CstmrCdtTrfInitn: {
          GrpHdr: {
            MsgId: `${flowId}-${Date.now()}-${index}`,
            CreDtTm: new Date().toISOString(),
            NbOfTxns: '1'
          },
          PmtInf: {
            PmtInfId: `${flowId}-P-${index}`,
            PmtMtd: 'TRF'
          }
        }
      }
    })
  },
  {
    id: 'stress-mt202',
    queue: 'mt202.inbound',
    type: 'MT202',
    messageFactory: (flowId, index) => `MT202\n:20:${flowId}-${index}\n:21:REL-${index}\n:32A:260520USD${(500 + (index % 9000)).toFixed(2)}\n:53A:REMITBANK\n:57A:BENEBANK\n:72:STRESS ${flowId} IDX ${index}`
  }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueueMessage(flow, flowRunId, index, backendUrl) {
  const start = Date.now();
  const body = {
    message: flow.messageFactory(flowRunId, index),
    sourceService: `stress-${flow.id}`,
    messageEnvelope: {
      flowRunId,
      type: flow.type,
      index,
      timestamp: new Date().toISOString()
    }
  };

  try {
    const response = await fetch(`${backendUrl}/api/queue/${flow.queue}/enqueue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'system-admin'
      },
      body: JSON.stringify(body)
    });

    const latencyMs = Date.now() - start;
    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      error: response.ok ? null : await response.text().catch(() => 'unknown')
    };
  } catch (error) {
    return {
      ok: false,
      status: 'NETWORK_ERROR',
      latencyMs: Date.now() - start,
      error: String(error?.message || error)
    };
  }
}

async function runFlow(flow, flowRunId, options) {
  const { messagesPerFlow, flowConcurrency, interBatchDelayMs, backendUrl } = options;
  const stats = {
    flow: flow.id,
    queue: flow.queue,
    attempted: 0,
    ok: 0,
    failed: 0,
    minLatencyMs: Number.POSITIVE_INFINITY,
    maxLatencyMs: 0,
    totalLatencyMs: 0,
    statusCounts: {},
    sampleErrors: []
  };

  for (let i = 0; i < messagesPerFlow; i += flowConcurrency) {
    const tasks = [];
    const upper = Math.min(i + flowConcurrency, messagesPerFlow);
    for (let j = i; j < upper; j += 1) {
      tasks.push(enqueueMessage(flow, flowRunId, j, backendUrl));
    }

    const results = await Promise.all(tasks);
    for (const result of results) {
      stats.attempted += 1;
      stats.statusCounts[result.status] = (stats.statusCounts[result.status] || 0) + 1;

      if (result.ok) {
        stats.ok += 1;
      } else {
        stats.failed += 1;
        if (stats.sampleErrors.length < 5) {
          stats.sampleErrors.push({ status: result.status, error: String(result.error || '').slice(0, 180) });
        }
      }

      stats.totalLatencyMs += result.latencyMs;
      stats.minLatencyMs = Math.min(stats.minLatencyMs, result.latencyMs);
      stats.maxLatencyMs = Math.max(stats.maxLatencyMs, result.latencyMs);
    }

    if (interBatchDelayMs > 0) {
      await sleep(interBatchDelayMs);
    }
  }

  stats.avgLatencyMs = stats.attempted > 0 ? Number((stats.totalLatencyMs / stats.attempted).toFixed(2)) : 0;
  if (!Number.isFinite(stats.minLatencyMs)) stats.minLatencyMs = 0;
  return stats;
}

async function getRuntimeDiagnostics(backendUrl) {
  try {
    const response = await fetch(`${backendUrl}/api/metrics/runtime`, {
      headers: { 'x-user-id': 'system-admin' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function runStressFlows(runOptions = {}) {
  const backendUrl = runOptions.backendUrl || DEFAULT_BACKEND_URL;
  const flowCount = Number(runOptions.flowCount ?? DEFAULT_FLOW_COUNT);
  const messagesPerFlow = Number(runOptions.messagesPerFlow ?? DEFAULT_MESSAGES_PER_FLOW);
  const flowConcurrency = Number(runOptions.flowConcurrency ?? DEFAULT_FLOW_CONCURRENCY);
  const flowStaggerMs = Number(runOptions.flowStaggerMs ?? DEFAULT_FLOW_STAGGER_MS);
  const interBatchDelayMs = Number(runOptions.interBatchDelayMs ?? DEFAULT_INTER_BATCH_DELAY_MS);

  const activeFlowCount = Math.max(1, Math.min(flowCount, FLOWS.length));
  const selectedFlows = FLOWS.slice(0, activeFlowCount);

  const t0 = Date.now();
  const runTasks = [];
  for (const flow of selectedFlows) {
    const flowRunId = `${flow.id}-${Date.now()}`;
    runTasks.push(runFlow(flow, flowRunId, { messagesPerFlow, flowConcurrency, interBatchDelayMs, backendUrl }));
    if (flowStaggerMs > 0) {
      await sleep(flowStaggerMs);
    }
  }

  const statsByFlow = await Promise.all(runTasks);
  const elapsedMs = Date.now() - t0;

  const attempted = statsByFlow.reduce((sum, item) => sum + item.attempted, 0);
  const ok = statsByFlow.reduce((sum, item) => sum + item.ok, 0);
  const failed = statsByFlow.reduce((sum, item) => sum + item.failed, 0);
  const throughput = elapsedMs > 0 ? Number(((attempted / elapsedMs) * 1000).toFixed(2)) : 0;

  const diagnostics = await getRuntimeDiagnostics(backendUrl);

  return {
    config: {
      backendUrl,
      flowCount: activeFlowCount,
      messagesPerFlow,
      flowConcurrency,
      flowStaggerMs,
      interBatchDelayMs,
      selectedFlowIds: selectedFlows.map((f) => f.id)
    },
    statsByFlow,
    summary: {
      attempted,
      ok,
      failed,
      elapsedMs,
      throughputMsgsPerSec: throughput
    },
    runtimeDiagnostics: diagnostics?.diagnostics || null,
    capturedAt: new Date().toISOString()
  };
}

export function printStressRunResult(result, log = console.log) {
  log('=== Stress Flows Load Test ===');
  log(`Backend: ${result.config.backendUrl}`);
  log(`Flows: ${result.config.selectedFlowIds.join(', ')}`);
  log(`Messages per flow: ${result.config.messagesPerFlow}`);
  log(`Flow concurrency: ${result.config.flowConcurrency}`);
  log('');

  log('--- Per Flow ---');
  for (const stats of result.statsByFlow) {
    log(`${stats.flow} (${stats.queue})`);
    log(`  attempted=${stats.attempted} ok=${stats.ok} failed=${stats.failed}`);
    log(`  latency ms: min=${stats.minLatencyMs} avg=${stats.avgLatencyMs} max=${stats.maxLatencyMs}`);
    if (stats.sampleErrors.length > 0) {
      for (const sample of stats.sampleErrors) {
        log(`  error sample [${sample.status}] ${sample.error}`);
      }
    }
  }

  log('--- Summary ---');
  log(`attempted=${result.summary.attempted} ok=${result.summary.ok} failed=${result.summary.failed}`);
  log(`elapsed=${(result.summary.elapsedMs / 1000).toFixed(2)}s throughput=${result.summary.throughputMsgsPerSec} msg/s`);

  if (result.runtimeDiagnostics) {
    const d = result.runtimeDiagnostics;
    log('--- Runtime Diagnostics ---');
    log(`rssMb=${d.process.rssMb} heapUsedMb=${d.process.heapUsedMb} heapUsedPercent=${d.process.heapUsedPercent}`);
    log(`eventLoop utilization=${d.eventLoop.utilization} delayP95Ms=${d.eventLoop.delayP95Ms} delayP99Ms=${d.eventLoop.delayP99Ms}`);
  } else {
    log('Runtime diagnostics endpoint unavailable.');
  }
}

async function main() {
  const result = await runStressFlows();
  printStressRunResult(result);
}

const isDirectRun = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error('Stress test failed:', error?.message || error);
    process.exitCode = 1;
  });
}
