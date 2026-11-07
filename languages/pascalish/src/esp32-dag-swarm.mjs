import { randomUUID } from 'node:crypto';
import { executeExecutionDagSequential } from './execution-dag.mjs';

export const ESP32_DAG_WORKER_CAPABILITY = 'pascalish-dag-v1';
const DEFAULT_NODE_TTL_MS = 3 * 60 * 1000;
const MAX_DAG_NODES = 512;
const MAX_DAG_CONCURRENCY = 16;
const BINARY_OPERATORS = new Set(['+', '-', '*', '/', '=', '<>', '<', '<=', '>', '>=', 'and', 'or']);

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function validateExpression(expression, stateNames, reads, depth = 0, budget = { count: 0 }) {
  if (!expression || typeof expression !== 'object' || Array.isArray(expression)
    || depth > 16 || budget.count >= 64) {
    fail('DAG expression exceeds supported structure');
  }
  budget.count += 1;
  if (expression.type === 'NumberLiteral') {
    if (!Number.isInteger(expression.value) || expression.value < -2147483648 || expression.value > 2147483647) {
      fail('DAG integer literals must fit in a signed 32-bit integer');
    }
    return;
  }
  if (expression.type === 'BooleanLiteral') {
    if (typeof expression.value !== 'boolean') fail('Invalid Boolean literal');
    return;
  }
  if (expression.type === 'Identifier') {
    const name = String(expression.name || '').toLowerCase();
    if (!stateNames.has(name)) fail(`DAG expression reads undeclared variable "${expression.name}"`);
    reads.add(name);
    return;
  }
  if (expression.type === 'Unary') {
    if (!['-', 'not'].includes(String(expression.op).toLowerCase())) fail('Unsupported DAG unary operator');
    validateExpression(expression.expr, stateNames, reads, depth + 1, budget);
    return;
  }
  if (expression.type === 'Binary') {
    if (!BINARY_OPERATORS.has(expression.op)) fail('Unsupported DAG binary operator');
    validateExpression(expression.left, stateNames, reads, depth + 1, budget);
    validateExpression(expression.right, stateNames, reads, depth + 1, budget);
    return;
  }
  fail('Unsupported DAG expression type');
}

function normalizeState(dag, initialState) {
  if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
    fail('DAG initial state must be an object');
  }
  const state = Object.create(null);
  for (const [name, value] of Object.entries(dag.initialState || {})) {
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
      fail(`DAG default value "${name}" must be a signed 32-bit integer`);
    }
    state[name.toLowerCase()] = value;
  }
  for (const [name, value] of Object.entries(initialState)) {
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
      fail(`DAG state value "${name}" must be a signed 32-bit integer`);
    }
    state[name.toLowerCase()] = value;
  }
  return state;
}

function validateDag(dag, initialState) {
  if (!dag || dag.version !== 1 || !Array.isArray(dag.nodes) || !Array.isArray(dag.edges)
    || !dag.initialState || typeof dag.initialState !== 'object' || Array.isArray(dag.initialState)
    || dag.effectAnalysis?.version !== 1) {
    fail('Unsupported execution DAG');
  }
  if (dag.nodes.length > MAX_DAG_NODES || dag.edges.length > MAX_DAG_NODES * MAX_DAG_NODES) {
    fail('Execution DAG exceeds the supported size limit', 413);
  }
  const state = normalizeState(dag, initialState);
  const declaredNames = new Set(Object.keys(dag.initialState || {}).map(name => name.toLowerCase()));
  const nodeIndexes = new Map();
  const edges = new Set();
  const readsByNode = [];
  const writesByNode = [];

  for (let index = 0; index < dag.nodes.length; index += 1) {
    const node = dag.nodes[index];
    if (!node?.id || nodeIndexes.has(node.id) || node.index !== index) {
      fail('DAG nodes must have unique ids and source-order indexes');
    }
    if (!node.eligible || !node.parallelSafe || node.effect !== 'transactional'
      || node.expressionEffect !== 'pure' || !Array.isArray(node.reads)
      || !Array.isArray(node.writes) || node.writes.length !== 1
      || !Array.isArray(node.effects)) {
      fail(`DAG node ${node.id} is not eligible for pure swarm execution`, 422);
    }
    const write = String(node.writes[0]).toLowerCase();
    if (!declaredNames.has(write) || !node.effects.includes(`write:${write}`)) {
      fail(`DAG node ${node.id} has an invalid write target`);
    }
    const reads = new Set();
    validateExpression(node.expression, declaredNames, reads);
    const declaredReads = new Set(node.reads.map(name => String(name).toLowerCase()));
    if (reads.size !== declaredReads.size || [...reads].some(name => !declaredReads.has(name))) {
      fail(`DAG node ${node.id} has inconsistent read metadata`);
    }
    nodeIndexes.set(node.id, index);
    readsByNode.push(reads);
    writesByNode.push(write);
  }

  for (const edge of dag.edges) {
    const from = nodeIndexes.get(edge?.from);
    const to = nodeIndexes.get(edge?.to);
    if (from === undefined || to === undefined || from >= to) {
      fail('DAG edges must reference nodes in source order');
    }
    edges.add(`${from}:${to}`);
  }
  for (let to = 0; to < dag.nodes.length; to += 1) {
    for (let from = 0; from < to; from += 1) {
      if (writesByNode[from] === writesByNode[to]
        || readsByNode[to].has(writesByNode[from])
        || readsByNode[from].has(writesByNode[to])) {
        if (!edges.has(`${from}:${to}`)) {
          fail(`DAG is missing a dependency edge from ${dag.nodes[from].id} to ${dag.nodes[to].id}`);
        }
      }
    }
  }
  return { state, nodeIndexes, edges };
}

function capabilityName(value) {
  return typeof value === 'string'
    ? value
    : String(value?.name || value?.id || '');
}

function workerIdentity(node) {
  return String(node?.nodeId || node?.id || node?.nodeName || `${node?.ip || ''}:${node?.port || 80}`);
}

function isFreshBeacon(node, timestamp, maxNodeAgeMs) {
  const lastSeen = Number(node?.beacon?.seenAt ?? node?.lastSeen ?? 0);
  return Number.isFinite(lastSeen) && lastSeen > 0
    && timestamp - lastSeen >= 0
    && timestamp - lastSeen < maxNodeAgeMs;
}

function isEligibleWorker(node, now, maxNodeAgeMs, isFreshNode) {
  const capabilities = [
    ...(Array.isArray(node?.details?.capabilities) ? node.details.capabilities : []),
    ...(Array.isArray(node?.capabilities) ? node.capabilities : [])
  ];
  const capacity = Number(node?.details?.dagWorker?.maxConcurrentTasks
    ?? node?.dagWorker?.maxConcurrentTasks ?? 0);
  const status = String(node?.availability?.status || node?.status || '').toLowerCase();
  const seenAt = Number(node?.beacon?.seenAt ?? node?.lastSeen ?? 0);
  const beaconAge = now - seenAt;
  return Boolean(node?.ip)
    && Number.isInteger(Number(node?.port || 80))
    && Number(node?.port || 80) >= 1
    && Number(node?.port || 80) <= 65535
    && node?.availability?.available === true
    && node?.draining !== true
    && node?.availability?.draining === false
    && !['down', 'offline', 'unavailable', 'draining', 'quiesced', 'maintenance', 'busy'].includes(status)
    && Number.isFinite(seenAt)
    && beaconAge >= 0
    && beaconAge < maxNodeAgeMs
    && isFreshNode(node, now, maxNodeAgeMs)
    && Number.isInteger(capacity)
    && capacity >= 1
    && capabilities.some(value => capabilityName(value) === ESP32_DAG_WORKER_CAPABILITY);
}

function workerUrl(node) {
  const ip = String(node.ip).trim();
  const host = ip.includes(':') && !ip.startsWith('[') ? `[${ip}]` : ip;
  const protocol = node.protocol === 'https:' || node.protocol === 'https' ? 'https:' : 'http:';
  const port = protocol === 'https:'
    ? node.httpsPort || node.port || 443
    : node.httpPort || node.port || 80;
  return new URL('/pmachine/dag/execute', `${protocol}//${host}:${Number(port)}`);
}

async function dispatchTask(fetchImpl, node, task, state, timeoutMs) {
  const inputs = Object.fromEntries(task.reads.map(name => [name, state[String(name).toLowerCase()]]));
  const taskId = randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('ESP32 DAG worker timed out')), timeoutMs);
  try {
    const response = await fetchImpl(workerUrl(node), {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body: JSON.stringify({
        version: 1,
        taskId,
        effect: 'pure',
        effects: [],
        expression: task.expression,
        inputs
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`ESP32 DAG worker returned HTTP ${response.status}`);
    const result = await response.json();
    if (result?.taskId !== taskId || !Number.isInteger(result.value)
      || result.value < -2147483648 || result.value > 2147483647) {
      throw new Error('ESP32 DAG worker returned an invalid result');
    }
    return result.value;
  } finally {
    clearTimeout(timeout);
  }
}

export function createEsp32DagScheduler({
  getNodes,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  maxNodeAgeMs = DEFAULT_NODE_TTL_MS,
  isFreshNode = isFreshBeacon,
  timeoutMs = 8000,
  concurrency = 8
} = {}) {
  if (typeof getNodes !== 'function') throw new TypeError('getNodes must be a function');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (typeof isFreshNode !== 'function') throw new TypeError('isFreshNode must be a function');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_DAG_CONCURRENCY) {
    throw new RangeError(`DAG concurrency must be an integer from 1 to ${MAX_DAG_CONCURRENCY}`);
  }
  if (!Number.isInteger(maxNodeAgeMs) || maxNodeAgeMs < 1) throw new RangeError('maxNodeAgeMs must be positive');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new RangeError('timeoutMs must be positive');
  const leasedWorkers = new Set();

  async function execute(dag, initialState = {}) {
    const { state, nodeIndexes } = validateDag(dag, initialState);
    const localFallback = reason => ({
      mode: 'sequential-fallback',
      reason,
      result: executeExecutionDagSequential(dag, initialState)
    });
    if (dag.nodes.length === 0) return localFallback('Execution DAG has no tasks');

    const completed = new Set();
    const executionBatches = [];
    while (completed.size < dag.nodes.length) {
      const currentTime = now();
      const workers = Array.from(getNodes() || [])
        .filter(node => isEligibleWorker(node, currentTime, maxNodeAgeMs, isFreshNode)
          && !leasedWorkers.has(workerIdentity(node)))
        .sort((left, right) => {
          const seenAt = node => typeof node.lastSeen === 'number' ? node.lastSeen : Date.parse(node.lastSeen || '');
          return seenAt(right) - seenAt(left);
        });
      if (workers.length === 0) return localFallback('No fresh, available ESP32 DAG workers');

      const ready = dag.nodes.filter(node =>
        !completed.has(node.id)
        && dag.edges.every(edge => edge.to !== node.id || completed.has(edge.from))
      );
      if (ready.length === 0) fail('Execution DAG contains a cycle or unresolved dependency');
      const batch = ready.slice(0, Math.min(concurrency, workers.length));
      const assignments = batch.map((task, index) => {
        const worker = workers[index];
        const id = workerIdentity(worker);
        leasedWorkers.add(id);
        return { task, worker, id };
      });
      const results = await Promise.allSettled(assignments.map(async ({ task, worker, id }) => {
        try {
          return await dispatchTask(fetchImpl, worker, task, state, timeoutMs);
        } finally {
          leasedWorkers.delete(id);
        }
      }));
      const failed = results.find(result => result.status === 'rejected');
      if (failed) return localFallback(`ESP32 DAG dispatch failed: ${failed.reason?.message || failed.reason}`);

      for (let index = 0; index < assignments.length; index += 1) {
        const { task } = assignments[index];
        state[task.writes[0].toLowerCase()] = results[index].value;
        completed.add(task.id);
      }
      executionBatches.push(batch.map(node => node.id));
    }

    return {
      mode: 'swarm',
      reason: null,
      result: {
        state,
        completedNodes: [...completed].sort((left, right) => nodeIndexes.get(left) - nodeIndexes.get(right)),
        executionBatches,
        stoppedAtBarrier: null
      }
    };
  }

  return { execute };
}
