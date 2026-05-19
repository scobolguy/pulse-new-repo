import fs from 'fs';

export function loadWorkerConfig(configPath = './data/worker-config.json') {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      console.log('[CONFIG] Worker configuration loaded from worker-config.json');
      return parsed;
    }

    console.warn('[CONFIG] worker-config.json not found, using hardcoded defaults');
    return {};
  } catch (e) {
    console.error(`[CONFIG] Failed to load worker configuration: ${e.message}`);
    return {};
  }
}

export function getWorkerDefaults(workerConfig = {}) {
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

export function validateWorkerConfigUpdate(workerConfig = {}, updates = {}) {
  const { intervalMs, batchSize, numWorkersPerQueue } = updates;
  const limits = workerConfig.workers?.router?.limits || {};
  const errors = [];

  if (intervalMs !== undefined) {
    if (intervalMs < (limits.minIntervalMs || 50) || intervalMs > (limits.maxIntervalMs || 5000)) {
      errors.push(`intervalMs must be between ${limits.minIntervalMs || 50} and ${limits.maxIntervalMs || 5000}`);
    }
  }

  if (batchSize !== undefined) {
    if (batchSize < (limits.minBatchSize || 1) || batchSize > (limits.maxBatchSize || 500)) {
      errors.push(`batchSize must be between ${limits.minBatchSize || 1} and ${limits.maxBatchSize || 500}`);
    }
  }

  if (numWorkersPerQueue !== undefined) {
    if (numWorkersPerQueue < (limits.minWorkers || 1) || numWorkersPerQueue > (limits.maxWorkers || 16)) {
      errors.push(`numWorkersPerQueue must be between ${limits.minWorkers || 1} and ${limits.maxWorkers || 16}`);
    }
  }

  return errors;
}

export function applyWorkerConfigUpdate(workerConfig = {}, updates = {}, updatedBy = 'unknown') {
  const { intervalMs, batchSize, numWorkersPerQueue } = updates;

  if (!workerConfig.workers) workerConfig.workers = {};
  if (!workerConfig.workers.router) workerConfig.workers.router = {};
  if (!workerConfig.workers.router.defaults) workerConfig.workers.router.defaults = {};

  if (intervalMs !== undefined) workerConfig.workers.router.defaults.intervalMs = intervalMs;
  if (batchSize !== undefined) workerConfig.workers.router.defaults.batchSize = batchSize;
  if (numWorkersPerQueue !== undefined) workerConfig.workers.router.defaults.numWorkersPerQueue = numWorkersPerQueue;

  workerConfig.updatedAt = new Date().toISOString();
  workerConfig.updatedBy = updatedBy;

  return workerConfig;
}

export function persistWorkerConfig(workerConfig = {}, configPath = './data/worker-config.json') {
  fs.writeFileSync(configPath, JSON.stringify(workerConfig, null, 2) + '\n', 'utf-8');
}
