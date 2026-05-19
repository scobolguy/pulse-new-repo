import http from 'http';

async function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:4000' + path);
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
      res.on('data', (chunk) => { data += chunk; });
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

async function analyze() {
  console.log('\n🔍 DETAILED PERFORMANCE ANALYSIS\n');

  // Get queue managers
  console.log('1️⃣  Queue Manager Instances:');
  const registryQMs = await makeRequest('/api/registry/queue-managers');
  console.log(JSON.stringify(registryQMs, null, 2));

  // Get queue stats from both managers
  console.log('\n2️⃣  Queue Statistics:');
  const stats = await makeRequest('/api/queues/qm-primary/get-stats');
  if (stats) console.log('Primary QM:', JSON.stringify(stats, null, 2));

  // Check specific queue details
  console.log('\n3️⃣  Queue Details (swift.mt103.inbound):');
  const qDetails = await makeRequest('/api/queue/swift.mt103.inbound?detailed=true');
  console.log(JSON.stringify(qDetails, null, 2));

  // Check all DLQ events (not just analysis)
  console.log('\n4️⃣  DLQ Events (Raw):');
  const dlqEvents = await makeRequest('/api/queue/dlq/events?limit=10');
  if (dlqEvents && dlqEvents.items) {
    console.log(`Total in buffer: ${dlqEvents.totalBuffered}`);
    console.log('Latest 3 events:');
    dlqEvents.items.slice(0, 3).forEach((evt, i) => {
      console.log(`\n  Event ${i+1}:`);
      console.log(`    Error: ${evt.error}`);
      console.log(`    Queue: ${evt.queue}`);
      console.log(`    Worker: ${evt.worker}`);
      console.log(`    Message Shape: ${evt.shape}`);
      if (evt.message) {
        const msgStr = typeof evt.message === 'string' ? evt.message : JSON.stringify(evt.message);
        console.log(`    Message (first 100 chars): ${msgStr.substring(0, 100)}`);
      }
    });
  }

  // Check if there are any messages actually in queues
  console.log('\n5️⃣  Message Queue Depth:');
  const queueList = await makeRequest('/api/queues');
  if (queueList && queueList.queues) {
    const withMessages = queueList.queues.filter(q => (q.depth || q.messageCount || 0) > 0);
    if (withMessages.length === 0) {
      console.log('   ✅ All queues are empty (messages processed or in DLQ)');
    } else {
      console.log('   Queues with messages:');
      withMessages.forEach(q => {
        console.log(`     - ${q.name}: ${q.depth || q.messageCount}`);
      });
    }
  }

  console.log('\n');
}

analyze().catch(console.error);
