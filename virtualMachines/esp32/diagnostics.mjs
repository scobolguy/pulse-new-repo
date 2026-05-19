import http from 'http';

const BASE_URL = 'http://localhost:4000';

async function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'x-user-id': 'system-admin',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runDiagnostics() {
  console.log('\n📊 SYSTEM DIAGNOSTICS\n');

  try {
    // Check queue status
    console.log('📤 Checking queue: swift.mt103.inbound');
    const queueStatus = await makeRequest('/api/queue/swift.mt103.inbound/status');
    console.log(JSON.stringify(queueStatus, null, 2));

    // Check all queues
    console.log('\n📋 All Registered Queues:');
    const allQueues = await makeRequest('/api/queues');
    if (allQueues && allQueues.queues) {
      allQueues.queues.slice(0, 10).forEach(q => {
        console.log(`   - ${q.name}: ${q.status} (${q.messageCount || 0} messages)`);
      });
      if (allQueues.queues.length > 10) {
        console.log(`   ... and ${allQueues.queues.length - 10} more`);
      }
    }

    // Check DLQ events (dead letter queue)
    console.log('\n💀 Dead Letter Queue Analysis:');
    const dlqAnalysis = await makeRequest('/api/queue/dlq/analysis?limit=100');
    if (dlqAnalysis) {
      console.log(`   Queue Length: ${dlqAnalysis.queueLength}`);
      console.log(`   Analyzed Window: ${dlqAnalysis.analyzedWindow} events`);
      console.log(`   Top Reasons for DLQ:`);
      if (dlqAnalysis.top && dlqAnalysis.top.reasons) {
        dlqAnalysis.top.reasons.slice(0, 5).forEach(r => {
          console.log(`      - ${r.name}: ${r.count}`);
        });
      }
      if (dlqAnalysis.likelyFindings && dlqAnalysis.likelyFindings.length > 0) {
        console.log(`   Findings:`);
        dlqAnalysis.likelyFindings.forEach(f => {
          console.log(`      - ${f}`);
        });
      }
    }

    // Check validation errors
    console.log('\n⚠️  Recent Validation Errors:');
    const validationErrors = await makeRequest('/api/queue/validation-errors?limit=5');
    if (validationErrors && validationErrors.items) {
      if (validationErrors.items.length === 0) {
        console.log('   ✅ No validation errors');
      } else {
        validationErrors.items.forEach((err, idx) => {
          console.log(`   ${idx + 1}. ${err.error || err.reason}`);
        });
      }
    }

    // Check router status
    console.log('\n🔄 Router Status:');
    const routerStatus = await makeRequest('/api/router/status');
    console.log(JSON.stringify(routerStatus, null, 2));

  } catch (e) {
    console.error('❌ Error:', e.message);
  }

  console.log('\n');
}

runDiagnostics().catch(console.error);
