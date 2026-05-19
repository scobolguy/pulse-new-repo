import http from 'http';
import fs from 'fs';

const QUEUE_NAME = 'swift.mt103.inbound';
const NUM_MESSAGES = 2000;
const CONCURRENT_REQUESTS = 20;

function generateMT103(index) {
  const referenceId = `REF${Date.now()}${String(index).padStart(6, '0')}`;
  const senderBank = `BANK${String(Math.floor(index / 10) % 5 + 1).padStart(2, '0')}USNY`;
  const receiverBank = `BANK${String(Math.floor(index / 10) % 5 + 2).padStart(2, '0')}GBLO`;
  const amount = (Math.floor(Math.random() * 1000000) + 100000).toFixed(2);
  const transDate = new Date(Date.now() + 86400000).toISOString().split('T')[0].replace(/-/g, '');

  return `MT103\n:20:${referenceId}\n:23B:CRED\n:32A:${transDate}USD${amount}\n:50K:/ACCT${String(index % 1000).padStart(4, '0')}\nCOMPANY ${index % 50 + 1}\n:52A:${senderBank}\n:53A:${receiverBank}\n:57A:INTBANK\n:59:/ACCT${String((index + 500) % 1000).padStart(4, '0')}\nBENEFICIARY ${index % 75 + 1}\n:70:INV${String(index).padStart(6, '0')}\n:71A:SHA\n:72:INSTRUCTION ${referenceId}`;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message,
      sourceService: 'load-test-2000-quiet',
      messageEnvelope: {
        timestamp: new Date().toISOString(),
        correlationId: message.slice(10, 32)
      }
    });

    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/queue/${QUEUE_NAME}/enqueue`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-user-id': 'system-admin'
      }
    }, (res) => {
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

async function run() {
  console.log(`Starting quiet burst: ${NUM_MESSAGES} messages @ concurrency ${CONCURRENT_REQUESTS}`);
  const start = Date.now();
  const responseTimes = [];
  let failed = 0;

  for (let i = 0; i < NUM_MESSAGES; i += CONCURRENT_REQUESTS) {
    const batchSize = Math.min(CONCURRENT_REQUESTS, NUM_MESSAGES - i);
    const batch = [];

    for (let j = 0; j < batchSize; j++) {
      const index = i + j;
      const message = generateMT103(index);
      const reqStart = Date.now();

      batch.push(
        sendMessage(message)
          .then((result) => {
            responseTimes.push(Date.now() - reqStart);
            if (result.statusCode !== 200) failed += 1;
          })
          .catch(() => {
            failed += 1;
          })
      );
    }

    await Promise.all(batch);
  }

  const totalMs = Date.now() - start;
  const success = NUM_MESSAGES - failed;
  responseTimes.sort((a, b) => a - b);
  const avg = responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
  const p95 = responseTimes.length ? responseTimes[Math.floor(responseTimes.length * 0.95)] : 0;
  const p99 = responseTimes.length ? responseTimes[Math.floor(responseTimes.length * 0.99)] : 0;

  console.log('=== QUIET 2000 SUMMARY ===');
  console.log(`Successful: ${success}/${NUM_MESSAGES}`);
  console.log(`Failed: ${failed}/${NUM_MESSAGES}`);
  console.log(`Total time: ${(totalMs / 1000).toFixed(2)}s`);
  console.log(`Throughput: ${(NUM_MESSAGES / (totalMs / 1000)).toFixed(2)} msg/s`);
  console.log(`Avg latency: ${avg.toFixed(2)}ms`);
  console.log(`P95 latency: ${p95}ms`);
  console.log(`P99 latency: ${p99}ms`);

  fs.writeFileSync(
    'load-test-2000-last.json',
    JSON.stringify({
      requested: NUM_MESSAGES,
      successful: success,
      failed,
      totalTimeSec: Number((totalMs / 1000).toFixed(2)),
      throughput: Number((NUM_MESSAGES / (totalMs / 1000)).toFixed(2)),
      avgLatencyMs: Number(avg.toFixed(2)),
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      generatedAt: new Date().toISOString()
    }, null, 2)
  );
}

run().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
