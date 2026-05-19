import http from 'http';

const BASE_URL = 'http://localhost:4000';
const QUEUE_NAME = 'swift.mt103.inbound';
const NUM_MESSAGES = 1000;
const CONCURRENT_REQUESTS = 10;

// Generate a realistic MT103 SWIFT message string
function generateMT103(index) {
  const timestamp = new Date().toISOString();
  const messageId = `MSG${String(index).padStart(6, '0')}`;
  const referenceId = `REF${Date.now()}${String(index).padStart(4, '0')}`;
  const senderBank = `BANK${String(Math.floor(index / 10) % 5 + 1).padStart(2, '0')}USNY`;
  const receiverBank = `BANK${String(Math.floor(index / 10) % 5 + 2).padStart(2, '0')}GBLO`;
  const amount = (Math.floor(Math.random() * 1000000) + 100000).toFixed(2);
  const transDate = new Date(Date.now() + 86400000).toISOString().split('T')[0].replace(/-/g, '');
  
  // Build SWIFT MT103 message string format
  // Basic SWIFT message structure: Block1:AppHeader, Block2:InputHeader, Block3:TrailerHeader, Block4:MessageBody, Block5:TrailerFooter
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

// Make HTTP request
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: message,
      sourceService: 'load-test',
      messageEnvelope: {
        timestamp: new Date().toISOString(),
        correlationId: message.id,
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
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data,
          responseTime: Date.now(),
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function runLoadTest() {
  console.log(`\n🚀 Starting load test: ${NUM_MESSAGES} MT103 messages`);
  console.log(`📤 Queue: ${QUEUE_NAME}`);
  console.log(`⚡ Concurrent requests: ${CONCURRENT_REQUESTS}\n`);

  const startTime = Date.now();
  const results = [];
  const responseTimes = [];
  const errors = [];

  // Send messages in batches
  for (let i = 0; i < NUM_MESSAGES; i += CONCURRENT_REQUESTS) {
    const batch = [];
    const batchSize = Math.min(CONCURRENT_REQUESTS, NUM_MESSAGES - i);
    
    if (i % 100 === 0) {
      console.log(`📨 Progress: ${i + 1}-${Math.min(i + batchSize, NUM_MESSAGES)} / ${NUM_MESSAGES}`);
    }
    
    for (let j = 0; j < batchSize; j++) {
      const msgIndex = i + j;
      const message = generateMT103(msgIndex);
      const reqStartTime = Date.now();
      
      batch.push(
        sendMessage(message)
          .then(result => {
            const latency = Date.now() - reqStartTime;
            responseTimes.push(latency);
            results.push(result);
            
            if (result.statusCode !== 200) {
              errors.push({
                index: msgIndex,
                statusCode: result.statusCode,
                body: result.body,
              });
            }
          })
          .catch(error => {
            errors.push({
              index: msgIndex,
              error: error.message,
            });
          })
      );
    }

    await Promise.all(batch);
  }

  const totalTime = Date.now() - startTime;

  // Calculate statistics
  const successCount = results.filter(r => r.statusCode === 200).length;
  const avgLatency = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const maxLatency = Math.max(...responseTimes);
  const minLatency = Math.min(...responseTimes);
  const throughput = (NUM_MESSAGES / (totalTime / 1000)).toFixed(2);

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Successful messages: ${successCount}/${NUM_MESSAGES}`);
  console.log(`❌ Failed messages: ${errors.length}/${NUM_MESSAGES}`);
  console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`🔄 Throughput: ${throughput} msg/s`);
  console.log(`\n📈 Latency Statistics:`);
  console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
  console.log(`   Min:     ${minLatency}ms`);
  console.log(`   Max:     ${maxLatency}ms`);
  console.log(`   P50:     ${responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.5)]?.toFixed(2) || 'N/A'}ms`);
  console.log(`   P95:     ${responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]?.toFixed(2) || 'N/A'}ms`);
  console.log(`   P99:     ${responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.99)]?.toFixed(2) || 'N/A'}ms`);

  if (errors.length > 0) {
    console.log(`\n⚠️  First 5 errors:`);
    errors.slice(0, 5).forEach(err => {
      console.log(`   Message ${err.index}: ${err.statusCode || err.error}`);
      if (err.body) console.log(`   Response: ${err.body.substring(0, 100)}`);
    });
  }

  console.log('='.repeat(60) + '\n');

  return {
    successCount,
    errorCount: errors.length,
    totalTime: totalTime / 1000,
    avgLatency,
    maxLatency,
    minLatency,
    throughput,
  };
}

runLoadTest().catch(console.error);
