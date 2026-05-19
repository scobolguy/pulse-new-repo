import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadWorkerConfig,
  getWorkerDefaults,
  validateWorkerConfigUpdate,
  applyWorkerConfigUpdate,
  persistWorkerConfig
} from '../src/worker-config.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function main() {
  const configPath = './data/worker-config.json';
  const original = loadWorkerConfig(configPath);

  assert(original && typeof original === 'object', 'config must load as object');

  const defaults = getWorkerDefaults(original);
  assert(defaults.intervalMs > 0, 'intervalMs should be positive');
  assert(defaults.batchSize > 0, 'batchSize should be positive');
  assert(defaults.numWorkers > 0, 'numWorkers should be positive');
  assert(Array.isArray(defaults.priorityQueues), 'priorityQueues should be array');

  const bad = validateWorkerConfigUpdate(original, {
    intervalMs: 1,
    batchSize: 100000,
    numWorkersPerQueue: 100
  });
  assert(bad.length >= 1, 'invalid update should produce validation errors');

  const goodUpdate = {
    intervalMs: 300,
    batchSize: 80,
    numWorkersPerQueue: 7
  };

  const validationErrors = validateWorkerConfigUpdate(original, goodUpdate);
  assert(validationErrors.length === 0, 'valid update should produce no validation errors');

  const copy = JSON.parse(JSON.stringify(original));
  const updated = applyWorkerConfigUpdate(copy, goodUpdate, 'test-runner');

  assert(updated.workers.router.defaults.intervalMs === 300, 'interval update should be applied');
  assert(updated.workers.router.defaults.batchSize === 80, 'batch update should be applied');
  assert(updated.workers.router.defaults.numWorkersPerQueue === 7, 'worker count update should be applied');
  assert(updated.updatedBy === 'test-runner', 'updatedBy should be set');
  assert(typeof updated.updatedAt === 'string' && updated.updatedAt.length > 0, 'updatedAt should be set');

  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const tempPath = path.join(thisDir, '..', 'data', 'worker-config.test.tmp.json');
  persistWorkerConfig(updated, tempPath);
  assert(fs.existsSync(tempPath), 'temp config file should be written');

  const reloaded = loadWorkerConfig(tempPath);
  assert(reloaded.workers.router.defaults.intervalMs === 300, 'reloaded interval should match persisted');

  fs.unlinkSync(tempPath);

  console.log('PASS: worker-config refactor smoke test succeeded');
}

try {
  main();
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
