import http from 'http';

async function testSingleMessage() {
  const msg = `MT103
:20:TEST001
:23B:CRED
:32A:260515USD100000.00
:50K:/TESTACCT
TEST COMPANY
:52A:TESTBANKUS
:53A:TESTBANKGB
:57A:INTBANK
:59:/TESTACC2
TEST BENEFICIARY
:70:TEST INVOICE
:71A:SHA
:72:TEST INSTRUCTION`;

  const postData = JSON.stringify({
    message: msg,
    sourceService: 'diagnostic-test',
    messageEnvelope: {
      timestamp: new Date().toISOString(),
      correlationId: 'test-001',
    }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/queue/swift.mt103.inbound/enqueue',
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
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('\n📤 Testing single MT103 message enqueue:\n');
  
  try {
    const response = await testSingleMessage();
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`\nResponse Body:`);
    console.log(response.body);
    
    console.log('\n\n✅ Analysis:');
    if (response.statusCode === 200) {
      console.log('- Message enqueue returned 200 OK');
      const parsed = JSON.parse(response.body);
      console.log('- Response:', JSON.stringify(parsed, null, 2));
      console.log('- This means the API thinks it was successful');
      console.log('- But downstream validation may still fail!');
    } else {
      console.log(`- Got error status ${response.statusCode}`);
      console.log('- Validation failed at enqueue time');
    }
    
  } catch (e) {
    console.error('Error:', e);
  }

  // Now check diagnostics
  console.log('\n\n📊 Checking system diagnostics...\n');
  
  const diagRes = await new Promise((resolve) => {
    http.get({
      hostname: 'localhost',
      port: 4000,
      path: '/api/queue/dlq/events?limit=3',
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
    });
  });

  if (diagRes && diagRes.items && diagRes.items.length > 0) {
    console.log('Latest DLQ event:');
    const latestEvt = diagRes.items[0];
    console.log(JSON.stringify(latestEvt, null, 2));
  }
}

run().catch(console.error);
