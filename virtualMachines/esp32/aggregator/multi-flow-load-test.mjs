#!/usr/bin/env node

/**
 * Multi-Flow Load Test
 * Sends many concurrent message flows to test configuration under realistic multi-flow load
 */

import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:4000';
const NUM_FLOWS = 20;           // 20 concurrent flows
const MESSAGES_PER_FLOW = 50;   // 50 messages per flow
const TOTAL_MESSAGES = NUM_FLOWS * MESSAGES_PER_FLOW;
const PER_FLOW_CONCURRENCY = 5; // Cap in-flight sends per flow to avoid socket storms
const DELAY_BETWEEN_SENDS_MS = 5;  // 5ms between individual message sends

// Message types for variety
const MESSAGE_TYPES = [
  {
    queue: 'swift.mt103.inbound',
    type: 'MT103',
    generator: () => `MT103:\n:20:REFERENCE\n:23B:CRED\n:26F:160523\n:32A:160523USD123456.78\n:50A:/ACCT123\nCLIENT NAME\n:52A:/CLBANK22\nCLIENT BANK\n:53A:/REMBANK22\nREMITTING BANK\n:57A:/BENBANK99\nBENEFICIARY BANK\n:59:/ACCT999\nBENEFICIARY NAME\n:70:PURPOSE OF PAYMENT\n:71A:SHA`
  },
  {
    queue: 'pacs.inbound',
    type: 'PACS008',
    generator: () => ({
      Document: {
        CstmrCdtTrfInitn: {
          GrpHdr: {
            MsgId: `ID-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            CreDtTm: new Date().toISOString(),
            NbOfTxns: '1'
          }
        }
      }
    })
  },
  {
    queue: 'mt202.inbound',
    type: 'MT202',
    generator: () => `MT202:\n:20:REF202\n:21:RELATED\n:25:ACCT\n:28C:1/FIRST\n:32A:160523USD123.45\n:33B:USD123.45\n:50F:/CLBANK\nCLIENT\n:52A:/REMBANK\nREMITTING\n:56A:/INTBANK\nINTERMEDIARY\n:57A:/BENBANK\nBENEFICIARY\n:58A:/ACCT\nFINAL DEST\n:72:MSG`
  }
];

let successCount = 0;
let failureCount = 0;
let networkErrorCount = 0;
let totalLatency = 0;
let minLatency = Infinity;
let maxLatency = 0;
const latencies = [];
const startTime = Date.now();
const statusCounts = {};
const sampleFailures = [];

async function sendMessage(flowId, msgNum) {
  const msgType = MESSAGE_TYPES[Math.floor(Math.random() * MESSAGE_TYPES.length)];
  const message = msgType.generator();
  const sendTime = Date.now();

  try {
    const res = await fetch(`${BACKEND_URL}/api/queue/${msgType.queue}/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sourceService: `flow-${flowId}` })
    });

    statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;

    if (res.ok) {
      const latency = Date.now() - sendTime;
      successCount++;
      totalLatency += latency;
      minLatency = Math.min(minLatency, latency);
      maxLatency = Math.max(maxLatency, latency);
      latencies.push(latency);
    } else {
      failureCount++;
      if (sampleFailures.length < 5) {
        const body = await res.text();
        sampleFailures.push({
          queue: msgType.queue,
          status: res.status,
          body: body.slice(0, 220)
        });
      }
    }
  } catch (e) {
    failureCount++;
    networkErrorCount++;
    statusCounts.NETWORK_ERROR = (statusCounts.NETWORK_ERROR || 0) + 1;
    if (sampleFailures.length < 5) {
      sampleFailures.push({
        queue: msgType.queue,
        status: 'NETWORK_ERROR',
        body: String(e.message || e).slice(0, 220)
      });
    }
  }

  // Stagger messages slightly
  if (msgNum % 10 === 0) {
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SENDS_MS));
  }
}

async function runFlow(flowId) {
  console.log(`[FLOW ${flowId}] Starting ${MESSAGES_PER_FLOW} messages...`);

  for (let i = 0; i < MESSAGES_PER_FLOW; i += PER_FLOW_CONCURRENCY) {
    const promises = [];
    for (let j = i; j < Math.min(i + PER_FLOW_CONCURRENCY, MESSAGES_PER_FLOW); j++) {
      promises.push(sendMessage(flowId, j));
    }
    await Promise.all(promises);
  }

  console.log(`[FLOW ${flowId}] Complete`);
}

async function waitAndContinueProcessing(durationMs = 15000) {
  console.log(`\n⏳ Waiting ${durationMs / 1000}s for backend to process queued messages...`);
  
  const startWait = Date.now();
  let lastQueueDepth = 0;
  
  while (Date.now() - startWait < durationMs) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/queues/status`);
      if (res.ok) {
        const data = await res.json();
        let totalDepth = 0;
        let maxDepth = 0;
        
        for (const queue of data.queues || []) {
          totalDepth += queue.depth;
          maxDepth = Math.max(maxDepth, queue.depth);
        }
        
        if (totalDepth !== lastQueueDepth) {
          console.log(`  Queue depth: ${totalDepth} (max in any queue: ${maxDepth})`);
          lastQueueDepth = totalDepth;
        }
      }
    } catch (e) {
      // Ignore
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function getMetricsSnapshot() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/metrics/current`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

async function getSystemHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/system/health`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     Multi-Flow Load Test for Aggregator        ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`Configuration:`);
  console.log(`  - Flows: ${NUM_FLOWS} concurrent`);
  console.log(`  - Messages per flow: ${MESSAGES_PER_FLOW}`);
  console.log(`  - Total messages: ${TOTAL_MESSAGES}`);
  console.log(`  - Message types: MT103, PACS008, MT202`);
  console.log(`  - Backend: ${BACKEND_URL}\n`);

  // Phase 1: Send all messages
  console.log('Phase 1️⃣ : Sending messages from concurrent flows...');
  const sendStartTime = Date.now();

  const flowPromises = [];
  for (let flowId = 0; flowId < NUM_FLOWS; flowId++) {
    flowPromises.push(runFlow(flowId));
    // Stagger flow starts by 50ms
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await Promise.all(flowPromises);
  const sendDuration = Date.now() - sendStartTime;
  const httpThroughput = (TOTAL_MESSAGES / (sendDuration / 1000)).toFixed(2);

  console.log(`\n✅ Sent ${TOTAL_MESSAGES} messages in ${(sendDuration / 1000).toFixed(2)}s`);
  console.log(`   HTTP Throughput: ${httpThroughput} msg/s`);
  console.log(`   Success: ${successCount}, Failures: ${failureCount}`);
  console.log(`   Network Errors: ${networkErrorCount}`);
  console.log(`   Successful Throughput: ${(successCount / (sendDuration / 1000)).toFixed(2)} msg/s`);

  console.log('   Status breakdown:');
  Object.entries(statusCounts)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .forEach(([status, count]) => {
      console.log(`     - ${status}: ${count}`);
    });

  if (sampleFailures.length > 0) {
    console.log('   Sample failures:');
    sampleFailures.forEach((f, idx) => {
      console.log(`     ${idx + 1}. [${f.queue}] ${f.status} -> ${f.body}`);
    });
  }

  // Phase 2: Wait for processing
  await waitAndContinueProcessing(20000);

  // Phase 3: Collect metrics
  console.log('\n\nPhase 2️⃣ : Collecting metrics...\n');

  const metrics = await getMetricsSnapshot();
  const health = await getSystemHealth();

  if (metrics) {
    const m = metrics.metrics;
    
    console.log('📊 Processing Latencies:');
    for (const [queue, latencyData] of Object.entries(m.processingLatencies || {})) {
      if (latencyData.samples > 0) {
        console.log(`   ${queue}:`);
        console.log(`     - Samples: ${latencyData.samples}`);
        console.log(`     - Avg: ${latencyData.avg}ms, Min: ${latencyData.min}ms, Max: ${latencyData.max}ms`);
        console.log(`     - P95: ${latencyData.p95}ms, P99: ${latencyData.p99}ms`);
      }
    }
    
    console.log('\n📦 Queue Depths:');
    for (const [queue, depthData] of Object.entries(m.queueDepths || {})) {
      console.log(`   ${queue}:`);
      console.log(`     - Current: ${depthData.current}, Max: ${depthData.max}, Avg: ${depthData.avg}`);
    }
    
    console.log('\n👷 Worker Health:');
    for (const [workerId, healthData] of Object.entries(m.workerHealth || {})) {
      console.log(`   ${workerId}:`);
      console.log(`     - Processed: ${healthData.processed}, Failed: ${healthData.failed}, Error Rate: ${healthData.errorRate}%`);
    }
  }

  if (health) {
    const h = health.health;
    console.log('\n💻 System Health:');
    console.log(`   Overall: ${h.overall}`);
    console.log(`   CPU: ${h.cpu.usagePercent.toFixed(2)}% (threshold: ${h.cpu.threshold}%)`);
    console.log(`   Memory: ${h.memory.usagePercent.toFixed(2)}% (${(h.memory.used / 1024 / 1024).toFixed(0)}MB / ${(h.memory.total / 1024 / 1024).toFixed(0)}MB)`);
    console.log(`   Uptime: ${(h.uptime / 60 / 60).toFixed(2)}h`);
  }

  // HTTP latency analysis
  console.log('\n\n📈 HTTP Enqueue Latency Analysis:');
  if (latencies.length > 0) {
    const avgLatency = (totalLatency / successCount).toFixed(2);
    const sorted = latencies.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    console.log(`   Samples: ${successCount}`);
    console.log(`   Min: ${minLatency}ms, Max: ${maxLatency}ms, Avg: ${avgLatency}ms`);
    console.log(`   P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║            Test Summary                        ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║ Total Messages:  ${TOTAL_MESSAGES.toString().padEnd(36)}║`);
  console.log(`║ Success Rate:    ${((successCount / TOTAL_MESSAGES) * 100).toFixed(1)}%${' '.padEnd(32)}║`);
  console.log(`║ HTTP Throughput: ${httpThroughput} msg/s${' '.padEnd(32 - String(httpThroughput).length)}║`);
  if (latencies.length > 0) {
    const avgLatency = (totalLatency / successCount).toFixed(2);
    console.log(`║ Avg Latency:     ${avgLatency}ms${' '.padEnd(33 - String(avgLatency).length)}║`);
  }
  console.log(`║ Duration:        ${(sendDuration / 1000).toFixed(2)}s${' '.padEnd(35 - String((sendDuration / 1000).toFixed(2)).length)}║`);
  console.log('╚════════════════════════════════════════════════╝\n');

  if (failureCount > 0) {
    console.log(`⚠️  ${failureCount} messages failed to send or process`);
  } else {
    console.log('✅ All messages sent and processed successfully!');
  }
}

main().catch(e => {
  console.error('Test error:', e.message);
  process.exit(1);
});
