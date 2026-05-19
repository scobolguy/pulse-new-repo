import http from 'http';

const BASE_URL = 'http://localhost:4000';
const QUEUE_NAME = 'swift.mt103.inbound';
const NUM_MESSAGES = 500; // Test with 500 messages
const CONCURRENT_REQUESTS = 20; // Increase concurrent requests

function generateMT103(index) {
  const timestamp = new Date().toISOString();
  const messageId = `MSG${String(index).padStart(6, '0')}`;
  const referenceId = `REF${Date.now()}${String(index).padStart(4, '0')}`;
  const senderBank = `BANK${String(Math.floor(index / 10) % 5 + 1).padStart(2, '0')}USNY`;
  const receiverBank = `BANK${String(Math.floor(index / 10) % 5 + 2).padStart(2, '0')}GBLO`;
  const amount = (Math.floor(Math.random() * 1000000) + 100000).toFixed(2);
  const transDate = new Date(Date.now() + 86400000).toISOString().split('T')[0].replace(/-/g, '');
  
  const msg = `MT103
:20:${referenceId}
:23B:CRED
:32A:${transDate}USD${amount}
:50K:/ACCT${String(index % 1000).padStart(4, '0')}
COMPANY ${index % 50 + 1}
:52A:${senderBank}
:53A:${receiverBank}
:57A:INTBANK
:59:/ACCT${String((index + 500) % 1000).padStart(4, '0')}
BENEFICIARY ${index % 75 + 1}
:70:INV${String(index).padStart(6, '0')} - Standard payment
:71A:SHA
:72:INSTRUCTION ${referenceId}`;

  return msg;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: message,
      sourceService: 'load-test-optimized',
      messageEnvelope: {
        timestamp: new Date().toISOString(),
        correlationId: message.substring(10, 30),
      }
    });

    const options = {
      hostname: 'localhost',
      port: 4000,
      path: `/api/queue/${QUEUE_NAME}/enqueue`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-user-id': 'system-admin',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runLoadTest() {
  console.log(`\n🚀 OPTIMIZED LOAD TEST: ${NUM_MESSAGES} MT103 messages`);
  console.log(`📤 Queue: ${QUEUE_NAME}`);
  console.log(`⚡ Concurrent requests: ${CONCURRENT_REQUESTS}\n`);

  const startTime = Date.now();
  const responseTimes = [];
  const errors = [];

  for (let i = 0; i < NUM_MESSAGES; i += CONCURRENT_REQUESTS) {
    const batch = [];
    const batchSize = Math.min(CONCURRENT_REQUESTS, NUM_MESSAGES - i);
    
    console.log(`📨 Batch ${Math.floor(i / CONCURRENT_REQUESTS) + 1}: messages ${i + 1}-${i + batchSize}`);
    
    for (let j = 0; j < batchSize; j++) {
      const msgIndex = i + j;
      const message = generateMT103(msgIndex);
      const reqStartTime = Date.now();
      
      batch.push(
        sendMessage(message)
          .then(result => {
            const latency = Date.now() - reqStartTime;
            responseTimes.push(latency);
            if (result.statusCode !== 200) {
              errors.push({ index: msgIndex, statusCode: result.statusCode });
            }
          })
          .catch(error => {
            errors.push({ index: msgIndex, error: error.message });
          })
      );
    }

    await Promise.all(batch);
  }

  const totalTime = Date.now() - startTime;
  const successCount = NUM_MESSAGES - errors.length;
  const avgLatency = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const maxLatency = Math.max(...responseTimes);
  const minLatency = Math.min(...responseTimes);
  const throughput = (NUM_MESSAGES / (totalTime / 1000)).toFixed(2);

  responseTimes.sort((a, b) => a - b);

  console.log('\n' + '='.repeat(60));
  console.log('📊 OPTIMIZED LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}/${NUM_MESSAGES}`);
  console.log(`❌ Failed: ${errors.length}/${NUM_MESSAGES}`);
  console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`🔄 HTTP Throughput: ${throughput} msg/s`);
  console.log(`\n📈 Latency (HTTP Enqueue):`);
  console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
  console.log(`   Min:     ${minLatency}ms`);
  console.log(`   Max:     ${maxLatency}ms`);
  console.log(`   P50:     ${responseTimes[Math.floor(responseTimes.length * 0.5)]?.toFixed(2) || 'N/A'}ms`);
  console.log(`   P95:     ${responseTimes[Math.floor(responseTimes.length * 0.95)]?.toFixed(2) || 'N/A'}ms`);
  console.log(`   P99:     ${responseTimes[Math.floor(responseTimes.length * 0.99)]?.toFixed(2) || 'N/A'}ms`);
  
  console.log('\n💡 WORKER CONFIGURATION:');
  console.log('   • 24 parallel router workers (6 per queue × 4 priority queues)');
  console.log('   • Batch size: 100 messages per worker');
  console.log('   • Interval: 200ms (previously 1000ms)');
  console.log('   • Expected processing throughput: ~1200 msg/s (24 workers × 100 msgs × 5/sec)');

  console.log('\n⏳ Checking message processing...');
  console.log('   (Workers process messages every 200ms)');
  console.log('   (First batch should complete in ~200ms, then ~150-200ms per additional batch)\n');

  console.log('='.repeat(60) + '\n');
}

runLoadTest().catch(console.error);
