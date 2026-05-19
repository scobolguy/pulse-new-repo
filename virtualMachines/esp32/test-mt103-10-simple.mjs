#!/usr/bin/env node

import http from 'http';

const BASE_URL = 'http://localhost:4000';
const QUEUE_NAME = 'swift.mt103.inbound';
const NUM_MESSAGES = 10;

// Generate a realistic MT103 SWIFT message
function generateMT103(index) {
  const referenceId = `REF${Date.now()}${String(index).padStart(4, '0')}`;
  const senderBank = `BANK${String((index % 5) + 1).padStart(2, '0')}USNY`;
  const receiverBank = `BANK${String((index % 5) + 2).padStart(2, '0')}GBLO`;
  const amount = (100000 + (index * 50000)).toFixed(2);
  const transDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  // SWIFT MT103 message format
  const msg = `MT103
:20:${referenceId}
:23B:CRED
:32A:${transDate}USD${amount}
:50K:/ACCT${String((index * 111) % 1000).padStart(4, '0')}
COMPANY ${(index % 50) + 1}
:52A:${senderBank}
:53A:${receiverBank}
:57A:INTBANK
:59:/ACCT${String(((index + 500) * 111) % 1000).padStart(4, '0')}
BENEFICIARY ${(index % 75) + 1}
:70:Test MT103 Transaction ${index + 1}
:71A:SHA
:72:INSTRUCTION ${referenceId}`;
  
  return { msg, referenceId };
}

// Make HTTP request
function sendMessage(message, messageId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: message,
      sourceService: 'load-test-10',
      messageId: messageId,
      messageEnvelope: {
        timestamp: new Date().toISOString(),
        correlationId: messageId,
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
          responseTime: new Date().toISOString(),
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

// Get queue details
function getQueueDetails(queueName) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: `/api/queue/${queueName}?detailed=true`,
      method: 'GET',
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
          resolve({
            statusCode: res.statusCode,
            data: res.statusCode === 200 ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: null,
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n' + '═'.repeat(90));
  console.log('🚀 MT103 TRANSACTION TEST - ENQUEUE & QUEUE STATUS TRACKING');
  console.log('═'.repeat(90));
  console.log(`📤 Queue: ${QUEUE_NAME}`);
  console.log(`📊 Transactions: ${NUM_MESSAGES}`);
  console.log(`⏱️  Start Time: ${new Date().toISOString()}`);
  console.log('═'.repeat(90) + '\n');

  const transactions = [];

  // Phase 1: Enqueue all transactions
  console.log('📨 PHASE 1: ENQUEUEING 10 MT103 TRANSACTIONS\n');
  
  for (let i = 0; i < NUM_MESSAGES; i++) {
    const { msg, referenceId } = generateMT103(i);
    const enqueueTime = new Date().toISOString();
    
    try {
      const result = await sendMessage(msg, referenceId);
      transactions.push({
        index: i + 1,
        referenceId,
        enqueuedAt: enqueueTime,
        enqueueStatus: result.statusCode,
      });
      
      const status = result.statusCode === 200 ? '✅ ENQUEUED' : `❌ FAILED (${result.statusCode})`;
      console.log(`[${String(i + 1).padStart(2)}] Reference: ${referenceId}`);
      console.log(`     Time: ${enqueueTime} | ${status}\n`);
      
      await delay(100);
    } catch (error) {
      console.log(`[${String(i + 1).padStart(2)}] ERROR: ${error.message}\n`);
    }
  }

  console.log('═'.repeat(90));
  console.log('⏳ PHASE 2: PROCESSING & LOGGING (20 second wait)');
  console.log('═'.repeat(90));
  console.log('\n⏱️  Waiting for transactions to be processed through the system...\n');
  
  // Wait for transactions to be processed
  for (let i = 0; i < 20; i++) {
    process.stdout.write('.');
    await delay(1000);
  }
  console.log('\n');

  // Phase 2: Get queue status
  console.log('\n' + '═'.repeat(90));
  console.log('📊 PHASE 3: QUEUE & TRANSACTION STATUS');
  console.log('═'.repeat(90) + '\n');
  
  try {
    const queueStatus = await getQueueDetails(QUEUE_NAME);
    
    if (queueStatus.statusCode === 200 && queueStatus.data) {
      const qdata = queueStatus.data;
      
      console.log(`📍 QUEUE STATUS: ${QUEUE_NAME}`);
      console.log(`   Current Depth: ${qdata.currentDepth || 0} messages`);
      console.log(`   Max Depth: ${qdata.maxDepth || 'N/A'}`);
      console.log(`   Message Count: ${qdata.messageCount || 0}`);
      console.log(`   Created: ${qdata.createdAt || 'N/A'}`);
      console.log(`   Last Modified: ${qdata.lastModifiedAt || 'N/A'}\n`);
      
      if (qdata.messages && qdata.messages.length > 0) {
        console.log(`📋 MESSAGES IN QUEUE (${qdata.messages.length} total):\n`);
        qdata.messages.forEach((msg, idx) => {
          console.log(`   Message ${idx + 1}:`);
          console.log(`   ├─ ID: ${msg.id || 'N/A'}`);
          console.log(`   ├─ Enqueued: ${msg.enqueuedAt || 'N/A'}`);
          console.log(`   ├─ Type: ${msg.type || 'N/A'}`);
          console.log(`   └─ Status: ${msg.status || 'PENDING'}\n`);
        });
      }
    }
  } catch (error) {
    console.log(`❌ Error retrieving queue details: ${error.message}`);
  }

  // Phase 3: Summary
  console.log('\n' + '═'.repeat(90));
  console.log('📊 SUMMARY REPORT');
  console.log('═'.repeat(90) + '\n');
  
  const successCount = transactions.filter(t => t.enqueueStatus === 200).length;
  
  console.log(`✅ Total Transactions Sent: ${NUM_MESSAGES}`);
  console.log(`✅ Successfully Enqueued: ${successCount}/${NUM_MESSAGES}`);
  console.log(`❌ Failed: ${NUM_MESSAGES - successCount}/${NUM_MESSAGES}`);
  console.log(`⏱️  End Time: ${new Date().toISOString()}`);
  console.log(`\n📌 TRANSACTION REFERENCES:\n`);
  
  transactions.forEach(tx => {
    const status = tx.enqueueStatus === 200 ? '✓' : '✗';
    console.log(`   ${status} TX ${String(tx.index).padStart(2)}: ${tx.referenceId} (${tx.enqueuedAt})`);
  });
  
  console.log('\n' + '═'.repeat(90));
  console.log('✨ TEST COMPLETE - All transactions logged with timestamps');
  console.log('═'.repeat(90) + '\n');
}

// Run the test
runTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
