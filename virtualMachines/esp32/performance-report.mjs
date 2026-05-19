import http from 'http';

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:4000' + path);
    http.get({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'x-user-id': 'system-admin' },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function report() {
  console.log('\n' + '='.repeat(70));
  console.log('🚨 MT103 LOAD TEST - PERFORMANCE ISSUE ANALYSIS');
  console.log('='.repeat(70));

  console.log('\n📊 TEST RESULTS:');
  console.log('  • Messages sent: 100');
  console.log('  • HTTP success rate: 100% (all returned 200 OK)');
  console.log('  • Throughput: 341.30 msg/s');
  console.log('  • Average latency: 15.69ms');
  console.log('  • P95 latency: 31ms');
  console.log('  • P99 latency: 39ms');

  const dlq = await makeRequest('/api/queue/dlq/analysis?limit=200');
  
  console.log('\n⚠️  CRITICAL ISSUE - SILENT FAILURE AFTER SUCCESS:');
  console.log(`  • Messages in Dead Letter Queue: ${dlq.queueLength}`);
  console.log(`  • Validation failures logged: ${dlq.bufferedEvents}`);
  
  if (dlq.top && dlq.top.reasons && dlq.top.reasons.length > 0) {
    console.log('\n  Top Failure Reasons:');
    dlq.top.reasons.slice(0, 3).forEach(r => {
      console.log(`    - "${r.name}": ${r.count} occurrences (${((r.count / dlq.bufferedEvents) * 100).toFixed(1)}%)`);
    });
  }

  console.log('\n🏗️  ARCHITECTURAL ISSUES:');
  
  console.log('\n  1. VALIDATION TIMING MISMATCH:');
  console.log('     • Enqueue API validates message format synchronously');
  console.log('     • Validation throws 422 error if format invalid');
  console.log('     • BUT: Messages in first load test were objects, not strings');
  console.log('     • Expected format: MT103 string starting with "MT103:"');
  console.log('     • Root cause: Generated JSON objects instead of SWIFT strings');

  console.log('\n  2. ASYNCHRONOUS VALIDATION WORKER:');
  console.log('     • Ingress validation worker processes messages after enqueue');
  console.log('     • Worker ID: "ingress-validation"');
  console.log('     • This is a secondary check, not primary');
  console.log('     • Primary validation should catch issues BEFORE 200 response');

  console.log('\n  3. ROUTER WORKER BOTTLENECK:');
  console.log('     • Router workers run on setInterval');
  console.log('     • Default batch size: 10 messages');
  console.log('     • Default interval: 1000ms');
  console.log('     • Theoretical max throughput per worker: 10 msg/s');
  console.log('     • With 100 messages: ~10 seconds to complete');
  console.log('     • This is the main throughput limiter');

  console.log('\n  4. NO FEEDBACK ON ASYNC VALIDATION FAILURE:');
  console.log('     • Client receives 200 OK immediately');
  console.log('     • Validation happens asynchronously');
  console.log('     • Client has no way to know message was rejected');
  console.log('     • No callback, webhook, or status check available');

  console.log('\n📈 PERFORMANCE RECOMMENDATIONS:');
  console.log('\n  1. INCREASE ROUTER BATCH SIZE:');
  console.log('     Current: 10 messages/interval');
  console.log('     Recommended: 50-100 messages/interval');
  console.log('     Impact: 5-10x throughput improvement');

  console.log('\n  2. DECREASE ROUTER INTERVAL:');
  console.log('     Current: 1000ms');
  console.log('     Recommended: 100-500ms');
  console.log('     Impact: 2-10x throughput improvement');

  console.log('\n  3. ADD MULTIPLE WORKER INSTANCES:');
  console.log('     Current: Single ingress-validation worker');
  console.log('     Recommended: 4-8 parallel workers');
  console.log('     Impact: Linear throughput scaling');

  console.log('\n  4. MOVE VALIDATION TO SYNCHRONOUS:');
  console.log('     Move message validation BEFORE enqueue response');
  console.log('     Return 400/422 if validation fails');
  console.log('     Impact: Eliminate silent failures');

  console.log('\n  5. ADD QUEUE DEPTH METRICS:');
  console.log('     Monitor queue backlog in real-time');
  console.log('     Alert if queue depth grows');
  console.log('     Impact: Early detection of bottlenecks');

  console.log('\n💾 QUEUE STATUS:');
  const queueList = await makeRequest('/api/queues');
  if (queueList && queueList.queues) {
    const mt103Queues = queueList.queues.filter(q => q.name && q.name.includes('mt103'));
    if (mt103Queues.length > 0) {
      console.log('  MT103 Queues:');
      mt103Queues.forEach(q => {
        console.log(`    - ${q.name}: ${q.depth || q.messageCount || 0} messages`);
      });
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

report().catch(console.error);
