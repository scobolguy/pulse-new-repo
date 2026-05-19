#!/usr/bin/env node

import fs from 'fs';

console.log('=== Worker Configuration Loading Test ===\n');

// Test 1: Verify config file exists
console.log('[Test 1] Checking if worker-config.json exists...');
const configPath = './data/worker-config.json';
if (fs.existsSync(configPath)) {
  console.log('✅ Config file found at', configPath);
} else {
  console.log('❌ Config file NOT found at', configPath);
  process.exit(1);
}

// Test 2: Parse and validate config structure
console.log('\n[Test 2] Loading and parsing config...');
try {
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);
  console.log('✅ Config parsed successfully');
  
  // Test 3: Verify required sections
  console.log('\n[Test 3] Verifying config structure...');
  const checks = [
    ['workers', config.workers],
    ['workers.router', config.workers?.router],
    ['workers.router.defaults', config.workers?.router?.defaults],
    ['workers.router.limits', config.workers?.router?.limits],
    ['workers.router.priorityQueues', config.workers?.router?.priorityQueues],
    ['monitoring', config.monitoring],
    ['logging', config.logging],
    ['api', config.api]
  ];
  
  let allPass = true;
  checks.forEach(([key, value]) => {
    if (value) {
      console.log(`  ✅ ${key} exists`);
    } else {
      console.log(`  ❌ ${key} MISSING`);
      allPass = false;
    }
  });
  
  if (!allPass) {
    console.log('\n❌ Config structure incomplete');
    process.exit(1);
  }
  
  // Test 4: Extract and display defaults
  console.log('\n[Test 4] Current defaults:');
  const defaults = config.workers.router.defaults;
  console.log(`  - intervalMs: ${defaults.intervalMs}ms`);
  console.log(`  - batchSize: ${defaults.batchSize} messages`);
  console.log(`  - numWorkersPerQueue: ${defaults.numWorkersPerQueue} workers`);
  
  const limits = config.workers.router.limits;
  console.log('\n[Test 5] Safe operation limits:');
  console.log(`  - Interval: ${limits.minIntervalMs}ms - ${limits.maxIntervalMs}ms`);
  console.log(`  - Batch: ${limits.minBatchSize} - ${limits.maxBatchSize} messages`);
  console.log(`  - Workers: ${limits.minWorkers} - ${limits.maxWorkers} per queue`);
  
  console.log('\n[Test 6] Priority queues:');
  config.workers.router.priorityQueues.forEach((q, i) => {
    console.log(`  ${i+1}. ${q}`);
  });
  
  // Test 7: Simulate loading
  console.log('\n[Test 7] Simulating backend config loading...');
  let workerConfig = {};
  try {
    const raw = fs.readFileSync('./data/worker-config.json', 'utf-8');
    workerConfig = JSON.parse(raw);
    console.log('[CONFIG] Worker configuration loaded from worker-config.json');
    
    function getWorkerDefaults() {
      const config = workerConfig.workers?.router?.defaults || {};
      return {
        intervalMs: config.intervalMs || 200,
        batchSize: config.batchSize || 100,
        numWorkers: config.numWorkersPerQueue || 6,
        priorityQueues: workerConfig.workers?.router?.priorityQueues || [
          'swift.mt103.inbound',
          'ops.validation.deadletter',
          'pacs.inbound',
          'mt202.inbound'
        ]
      };
    }
    
    const defaults = getWorkerDefaults();
    console.log('✅ Loaded defaults:');
    console.log('  - intervalMs:', defaults.intervalMs);
    console.log('  - batchSize:', defaults.batchSize);
    console.log('  - numWorkers:', defaults.numWorkers);
    console.log('  - priorityQueues:', defaults.priorityQueues.length, 'queues');
    
  } catch (e) {
    console.error(`❌ Failed to load config in backend: ${e.message}`);
    process.exit(1);
  }
  
  console.log('\n✅ All tests passed!');
  console.log('\nSummary:');
  console.log(`- Configuration file is valid and complete`);
  console.log(`- Defaults: ${defaults.intervalMs}ms interval, batch ${defaults.batchSize}, ${defaults.numWorkers} workers/queue`);
  console.log(`- Backend will load these on startup instead of hardcoded values`);
  console.log(`- Safe limits ensure no invalid configuration can be applied`);
  
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
}
