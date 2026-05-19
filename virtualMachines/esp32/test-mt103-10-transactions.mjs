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
  
  // SWIFT MT103 message format (raw SWIFT string)
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

// Get transaction state
function getTransactionState(referenceId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: `/api/transactions/${encodeURIComponent(referenceId)}/state`,
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
  console.log('\n' + '═'.repeat(80));
  console.log('🚀 MT103 TRANSACTION STATE TRACKING TEST');
  console.log('═'.repeat(80));
  console.log(`📤 Queue: ${QUEUE_NAME}`);
  console.log(`📊 Transactions: ${NUM_MESSAGES}`);
  console.log(`⏱️  Start Time: ${new Date().toISOString()}`);
  console.log('═'.repeat(80) + '\n');

  const transactions = [];
  const enqueueTimes = [];

  // Phase 1: Enqueue all transactions
  console.log('📨 PHASE 1: ENQUEUEING TRANSACTIONS\n');
  
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
        states: []
      });
      enqueueTimes.push({ index: i + 1, time: enqueueTime });
      
      console.log(`✅ Transaction ${i + 1}/10`);
      console.log(`   Reference ID: ${referenceId}`);
      console.log(`   Enqueued at: ${enqueueTime}`);
      console.log(`   Status: ${result.statusCode === 200 ? '✓ Success' : '✗ Failed (' + result.statusCode + ')'}`);
      if (result.statusCode !== 200) {
        console.log(`   Response: ${result.body.substring(0, 200)}`);
      }
      console.log();
      
      // Small delay between requests
      await delay(100);
    } catch (error) {
      console.log(`❌ Transaction ${i + 1}/10 - Error: ${error.message}\n`);
    }
  }

  console.log('═'.repeat(80));
  console.log('⏳ PHASE 2: WAITING FOR STATE TRANSITIONS (15 seconds)');
  console.log('═'.repeat(80) + '\n');
  
  // Wait for transactions to be processed
  await delay(15000);

  // Phase 2: Query state for each transaction
  console.log('\n📋 PHASE 3: RETRIEVING TRANSACTION STATES\n');
  
  for (const tx of transactions) {
    try {
      const result = await getTransactionState(tx.referenceId);
      
      if (result.statusCode === 200 && result.data) {
        const { current, history } = result.data;
        
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`📌 TRANSACTION ${tx.index}`);
        console.log(`   Reference ID: ${tx.referenceId}`);
        console.log(`   Enqueued: ${tx.enqueuedAt}`);
        console.log(`${'─'.repeat(80)}`);
        
        if (current) {
          console.log(`\n   CURRENT STATE:`);
          console.log(`   ├─ State ID: ${current.state_id}`);
          console.log(`   ├─ State Label: ${current.state_label}`);
          console.log(`   ├─ Queue: ${current.queue_name || 'N/A'}`);
          console.log(`   ├─ Last Event: ${current.last_event_id || 'N/A'}`);
          console.log(`   ├─ Is Terminal: ${current.is_terminal ? 'Yes ✓' : 'No'}`);
          console.log(`   └─ Updated: ${current.updated_at}`);
        }
        
        if (history && history.length > 0) {
          console.log(`\n   STATE TRANSITION HISTORY (${history.length} transitions):`);
          
          // Sort history by id ascending to show chronological order
          const sortedHistory = [...history].sort((a, b) => a.id - b.id);
          
          for (let idx = 0; idx < sortedHistory.length; idx++) {
            const h = sortedHistory[idx];
            const isLast = idx === sortedHistory.length - 1;
            const prefix = isLast ? '   └─' : '   ├─';
            
            console.log(`\n   ${prefix} Transition ${idx + 1}:`);
            console.log(`      ├─ From State: ${h.from_state || 'START'}`);
            console.log(`      ├─ To State: ${h.to_state}`);
            console.log(`      ├─ Label: ${h.to_state_label || 'N/A'}`);
            console.log(`      ├─ Event: ${h.event_name || 'N/A'}`);
            console.log(`      ├─ Queue: ${h.queue_name || 'N/A'}`);
            console.log(`      ├─ Timestamp: ${h.updated_at}`);
            console.log(`      └─ Terminal: ${h.is_terminal ? 'Yes ✓' : 'No'}`);
          }
        } else {
          console.log(`\n   ⚠️  No state transitions recorded yet`);
        }
      } else {
        console.log(`\n❌ Transaction ${tx.index}: State not found`);
      }
      
      await delay(200);
    } catch (error) {
      console.log(`❌ Transaction ${tx.index}: Error retrieving state - ${error.message}`);
    }
  }

  // Phase 3: Summary report
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 SUMMARY REPORT');
  console.log('═'.repeat(80) + '\n');
  
  const successCount = transactions.filter(t => t.enqueueStatus === 200).length;
  const stateCount = transactions.filter(t => t.states && t.states.length > 0).length;
  
  console.log(`✅ Total Transactions: ${NUM_MESSAGES}`);
  console.log(`✅ Successfully Enqueued: ${successCount}/${NUM_MESSAGES}`);
  console.log(`✅ Transactions with States: ${stateCount}/${NUM_MESSAGES}`);
  console.log(`⏱️  End Time: ${new Date().toISOString()}`);
  console.log('\n' + '═'.repeat(80));
  console.log('✨ TEST COMPLETE');
  console.log('═'.repeat(80) + '\n');
}

// Run the test
runTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
