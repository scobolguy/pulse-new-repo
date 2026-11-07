const PURE_EXPRESSION_TYPES = new Set([
  'Identifier',
  'NumberLiteral',
  'BooleanLiteral',
  'Unary',
  'Binary'
]);

const PURE_BINARY_OPERATORS = new Set([
  '+', '-', '*', '/', '=', '<>', '<', '<=', '>', '>=', 'and', 'or'
]);

function analyzeExpression(expression, integerVariables) {
  if (!expression || typeof expression !== 'object') {
    return { supported: false, reads: new Set(), effects: ['unknown-expression'] };
  }
  if (expression.type === 'CallExpr') {
    return { supported: false, reads: new Set(), effects: ['unknown-call'] };
  }
  if (!PURE_EXPRESSION_TYPES.has(expression.type)) {
    return { supported: false, reads: new Set(), effects: ['unknown-expression'] };
  }
  if (expression.type === 'Identifier') {
    const name = expression.name.toLowerCase();
    return integerVariables.has(name)
      ? { supported: true, reads: new Set([name]), effects: [] }
      : { supported: false, reads: new Set(), effects: ['unknown-read'] };
  }
  if (expression.type === 'Unary') {
    const operand = analyzeExpression(expression.expr, integerVariables);
    const supported = ['-', 'not'].includes(String(expression.op).toLowerCase())
      && operand.supported;
    return {
      supported,
      reads: operand.reads,
      effects: supported ? [] : [...operand.effects, 'unsupported-operator']
    };
  }
  if (expression.type === 'Binary') {
    const left = analyzeExpression(expression.left, integerVariables);
    const right = analyzeExpression(expression.right, integerVariables);
    const supported = PURE_BINARY_OPERATORS.has(expression.op)
      && left.supported
      && right.supported;
    return {
      supported,
      reads: new Set([...left.reads, ...right.reads]),
      effects: supported ? [] : [...left.effects, ...right.effects, 'unsupported-operator']
    };
  }
  return { supported: true, reads: new Set(), effects: [] };
}

function analyzeStatement(statement, index, integerVariables) {
  const node = {
    id: `statement-${index + 1}`,
    index,
    kind: statement?.type || 'Unknown',
    reads: [],
    writes: [],
    eligible: false,
    reason: 'Unsupported statements are ordering barriers',
    effect: 'unknown',
    expressionEffect: 'unknown',
    effects: ['unknown'],
    parallelSafe: false,
    sourceLocation: statement?.sourceLocation || null
  };

  if (statement?.type === 'Call') {
    const name = String(statement.name || '').toLowerCase();
    if (name === 'write' || name === 'writeln') {
      node.effect = 'impure';
      node.effects = ['io'];
      node.reason = 'I/O calls are ordering barriers';
    } else {
      node.effects = ['unknown-call'];
      node.reason = 'Call effects are not declared or inferred';
    }
    return node;
  }

  if (statement?.type !== 'Assign' || typeof statement.target !== 'string'
    || !/^[a-z_]\w*$/i.test(statement.target)) {
    return node;
  }

  const target = statement.target.toLowerCase();
  node.writes = [target];
  if (!integerVariables.has(target)) {
    node.effects = [`write:${target}`, 'unsupported-write-target'];
    node.reason = 'Assignment target is not a declared integer or Boolean scalar';
    return node;
  }

  const expression = analyzeExpression(statement.expr, integerVariables);
  node.reads = [...expression.reads].sort();
  node.expressionEffect = expression.supported ? 'pure' : 'unknown';
  if (!expression.supported) {
    node.effects = [...new Set([...expression.effects, `write:${target}`])].sort();
    node.reason = 'Assignment expression is not proven pure';
    return node;
  }

  node.expression = statement.expr;
  node.eligible = true;
  node.reason = null;
  node.effect = 'transactional';
  node.effects = [`write:${target}`];
  node.parallelSafe = true;
  return node;
}

function intersects(left, right) {
  return left.some(value => right.includes(value));
}

export function buildExecutionDag(block, declarations = []) {
  const statements = block?.type === 'Block' ? block.statements || [] : [];
  const integerVariables = new Set(declarations
    .filter(declaration => {
      const type = declaration?.dataType;
      return type?.type === 'TypeRef'
        && type.kind === 'simple'
        && ['integer', 'boolean'].includes(String(type.id).toLowerCase());
    })
    .map(declaration => String(declaration.name).toLowerCase()));
  const nodes = statements.map((statement, index) =>
    analyzeStatement(statement, index, integerVariables)
  );
  const edges = [];

  for (let to = 0; to < nodes.length; to += 1) {
    const current = nodes[to];
    for (let from = 0; from < to; from += 1) {
      const previous = nodes[from];
      if (!previous.eligible || !current.eligible) {
        edges.push({
          from: previous.id,
          to: current.id,
          reason: 'ordering-barrier'
        });
        continue;
      }

      const readAfterWrite = intersects(previous.writes, current.reads);
      const writeAfterRead = intersects(previous.reads, current.writes);
      const writeAfterWrite = intersects(previous.writes, current.writes);
      if (readAfterWrite || writeAfterRead || writeAfterWrite) {
        edges.push({
          from: previous.id,
          to: current.id,
          reason: [
            readAfterWrite && 'read-after-write',
            writeAfterRead && 'write-after-read',
            writeAfterWrite && 'write-after-write'
          ].filter(Boolean).join(',')
        });
      }
    }
  }

  return {
    version: 1,
    scope: 'main-block',
    scheduling: 'dependency-graph',
    effectAnalysis: {
      version: 1,
      mode: 'conservative',
      unknownCallsAreBarriers: true,
      inferredRoutineEffects: false
    },
    initialState: Object.fromEntries([...integerVariables].map(name => [name, 0])),
    nodes,
    edges
  };
}

const workerSource = `
const { parentPort } = require('node:worker_threads');

function evaluate(expression, state) {
  if (!expression || typeof expression !== 'object') {
    throw new Error('Invalid expression node');
  }
  if (expression.type === 'NumberLiteral') return Number(expression.value);
  if (expression.type === 'BooleanLiteral') return expression.value ? 1 : 0;
  if (expression.type === 'Identifier') {
    const key = String(expression.name).toLowerCase();
    if (!Object.hasOwn(state, key)) throw new Error('Missing input value: ' + expression.name);
    const value = state[key];
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error('Only integer values are supported by local DAG execution: ' + expression.name);
    }
    return value;
  }
  if (expression.type === 'Unary') {
    const value = evaluate(expression.expr, state);
    if (expression.op === '-') return (0 - value) | 0;
    if (String(expression.op).toLowerCase() === 'not') return value === 0 ? 1 : 0;
    throw new Error('Unsupported unary operator: ' + expression.op);
  }
  if (expression.type === 'Binary') {
    const left = evaluate(expression.left, state);
    const right = evaluate(expression.right, state);
    switch (expression.op) {
      case '+': return (left + right) | 0;
      case '-': return (left - right) | 0;
      case '*': return Math.imul(left, right);
      case '/': return right === 0 ? 0 : (Math.trunc(left / right) | 0);
      case '=': return left === right ? 1 : 0;
      case '<>': return left !== right ? 1 : 0;
      case '<': return left < right ? 1 : 0;
      case '<=': return left <= right ? 1 : 0;
      case '>': return left > right ? 1 : 0;
      case '>=': return left >= right ? 1 : 0;
      case 'and': return left !== 0 && right !== 0 ? 1 : 0;
      case 'or': return left !== 0 || right !== 0 ? 1 : 0;
      default: throw new Error('Unsupported binary operator: ' + expression.op);
    }
  }
  throw new Error('Unsupported expression type: ' + expression.type);
}

parentPort.on('message', ({ id, expression, state }) => {
  try {
    parentPort.postMessage({ id, value: evaluate(expression, state) });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});
`;

const MAX_WORKER_CONCURRENCY = 16;

function validateConcurrency(concurrency) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_WORKER_CONCURRENCY) {
    throw new RangeError(`DAG concurrency must be an integer from 1 to ${MAX_WORKER_CONCURRENCY}`);
  }
}

function evaluateIntegerExpression(expression, state, depth = 0, budget = { count: 0 }) {
  if (!expression || typeof expression !== 'object' || depth > 16 || budget.count >= 64) {
    throw new Error('DAG expression exceeds supported structure');
  }
  budget.count += 1;
  if (expression.type === 'NumberLiteral') {
    if (!Number.isInteger(expression.value) || expression.value < -2147483648 || expression.value > 2147483647) {
      throw new Error('DAG integer literals must fit in a signed 32-bit integer');
    }
    return expression.value;
  }
  if (expression.type === 'BooleanLiteral') {
    if (typeof expression.value !== 'boolean') throw new Error('Invalid Boolean literal');
    return expression.value ? 1 : 0;
  }
  if (expression.type === 'Identifier') {
    const key = String(expression.name || '').toLowerCase();
    if (!Object.hasOwn(state, key)) throw new Error(`Missing DAG input value: ${expression.name}`);
    return state[key];
  }
  if (expression.type === 'Unary') {
    const value = evaluateIntegerExpression(expression.expr, state, depth + 1, budget);
    if (expression.op === '-') return (0 - value) | 0;
    if (String(expression.op).toLowerCase() === 'not') return value === 0 ? 1 : 0;
    throw new Error(`Unsupported DAG unary operator: ${expression.op}`);
  }
  if (expression.type === 'Binary') {
    const left = evaluateIntegerExpression(expression.left, state, depth + 1, budget);
    const right = evaluateIntegerExpression(expression.right, state, depth + 1, budget);
    switch (expression.op) {
      case '+': return (left + right) | 0;
      case '-': return (left - right) | 0;
      case '*': return Math.imul(left, right);
      case '/': return right === 0 ? 0 : (Math.trunc(left / right) | 0);
      case '=': return left === right ? 1 : 0;
      case '<>': return left !== right ? 1 : 0;
      case '<': return left < right ? 1 : 0;
      case '<=': return left <= right ? 1 : 0;
      case '>': return left > right ? 1 : 0;
      case '>=': return left >= right ? 1 : 0;
      case 'and': return left !== 0 && right !== 0 ? 1 : 0;
      case 'or': return left !== 0 || right !== 0 ? 1 : 0;
      default: throw new Error(`Unsupported DAG binary operator: ${expression.op}`);
    }
  }
  throw new Error(`Unsupported DAG expression type: ${expression.type}`);
}

export function executeExecutionDagSequential(dag, initialState = {}) {
  if (!dag || dag.version !== 1 || !Array.isArray(dag.nodes) || !Array.isArray(dag.edges)
    || dag.effectAnalysis?.version !== 1) {
    throw new TypeError('Unsupported execution DAG');
  }
  if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
    throw new TypeError('DAG initial state must be an object');
  }

  const state = {};
  for (const [name, value] of Object.entries(dag.initialState || {})) {
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
      throw new TypeError(`DAG default value "${name}" must be a signed 32-bit integer`);
    }
    state[name.toLowerCase()] = value;
  }
  for (const [name, value] of Object.entries(initialState)) {
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
      throw new TypeError(`DAG state value "${name}" must be a signed 32-bit integer`);
    }
    state[name.toLowerCase()] = value;
  }

  const indexes = new Map();
  for (let index = 0; index < dag.nodes.length; index += 1) {
    const node = dag.nodes[index];
    if (!node?.id || indexes.has(node.id) || node.index !== index) {
      throw new Error('DAG nodes must have unique ids and source-order indexes');
    }
    if (!node.eligible || !node.parallelSafe || node.effect !== 'transactional'
      || node.expressionEffect !== 'pure' || !Array.isArray(node.writes)
      || node.writes.length !== 1 || !Array.isArray(node.effects)) {
      throw new Error(`DAG node ${node.id} is not eligible for pure sequential DAG execution`);
    }
    const write = String(node.writes[0]).toLowerCase();
    if (!Object.hasOwn(state, write) || !node.effects.includes(`write:${write}`)) {
      throw new Error(`DAG node ${node.id} has an invalid write target`);
    }
    indexes.set(node.id, index);
  }
  for (const edge of dag.edges) {
    if (!indexes.has(edge.from) || !indexes.has(edge.to)
      || indexes.get(edge.from) >= indexes.get(edge.to)) {
      throw new Error('DAG edges must reference nodes in source order');
    }
  }

  const executionBatches = [];
  for (const node of dag.nodes) {
    state[node.writes[0].toLowerCase()] = evaluateIntegerExpression(node.expression, state);
    executionBatches.push([node.id]);
  }
  return {
    state,
    completedNodes: dag.nodes.map(node => node.id),
    executionBatches,
    stoppedAtBarrier: null
  };
}

class ExecutionDagWorkerPool {
  constructor(Worker, concurrency) {
    this.concurrency = concurrency;
    this.workers = [];
    this.queue = [];
    this.nextJobId = 1;
    this.closed = false;
    this.failure = null;

    try {
      for (let index = 0; index < concurrency; index += 1) {
        const worker = new Worker(workerSource, { eval: true });
        const slot = { worker, job: null, failed: false };
        worker.on('message', message => this.completeJob(slot, message));
        worker.on('error', error => this.failWorker(slot, error));
        worker.on('exit', code => {
          if (!this.closed && !slot.failed) {
            this.failWorker(slot, new Error(`DAG worker exited unexpectedly with code ${code}`));
          }
        });
        this.workers.push(slot);
      }
    } catch (error) {
      for (const slot of this.workers) slot.worker.terminate().catch(() => {});
      throw error;
    }
  }

  get workerCount() {
    return this.workers.filter(slot => !slot.failed).length;
  }

  run(expression, state) {
    if (this.closed) return Promise.reject(new Error('DAG worker pool is closed'));
    if (this.workerCount === 0) {
      return Promise.reject(this.failure || new Error('DAG worker pool has no available workers'));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextJobId++, expression, state, resolve, reject });
      this.dispatch();
    });
  }

  completeJob(slot, message) {
    const job = slot.job;
    if (!job || message.id !== job.id) {
      this.failWorker(slot, new Error('DAG worker returned an unexpected job id'));
      return;
    }
    slot.job = null;
    if (message.error !== undefined) job.reject(new Error(message.error));
    else job.resolve(message.value);
    this.dispatch();
  }

  failWorker(slot, error) {
    if (slot.failed) return;
    slot.failed = true;
    this.failure ||= error;
    if (slot.job) {
      slot.job.reject(error);
      slot.job = null;
    }
    this.dispatch();
  }

  dispatch() {
    if (this.closed) return;
    const idle = this.workers.filter(slot => !slot.failed && !slot.job);
    while (idle.length > 0 && this.queue.length > 0) {
      const slot = idle.shift();
      const job = this.queue.shift();
      slot.job = job;
      try {
        slot.worker.postMessage({
          id: job.id,
          expression: job.expression,
          state: job.state
        });
      } catch (error) {
        this.failWorker(slot, error);
      }
    }
    if (this.workerCount === 0) {
      while (this.queue.length > 0) this.queue.shift().reject(this.failure);
    }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    const error = new Error('DAG worker pool closed before the job completed');
    for (const job of this.queue.splice(0)) job.reject(error);
    for (const slot of this.workers) {
      if (slot.job) {
        slot.job.reject(error);
        slot.job = null;
      }
    }
    await Promise.all(this.workers.map(slot => slot.worker.terminate()));
  }
}

export async function createExecutionDagWorkerPool({ concurrency = 4 } = {}) {
  validateConcurrency(concurrency);
  const { Worker } = await import('node:worker_threads');
  return new ExecutionDagWorkerPool(Worker, concurrency);
}

export async function executeExecutionDag(dag, initialState = {}, {
  concurrency = 4,
  workerPool = null
} = {}) {
  validateConcurrency(concurrency);
  if (!dag || dag.version !== 1 || !Array.isArray(dag.nodes) || !Array.isArray(dag.edges)) {
    throw new TypeError('Unsupported execution DAG');
  }
  if (dag.effectAnalysis?.version !== 1) {
    throw new TypeError('Execution DAG is missing supported effect-analysis metadata');
  }
  if (workerPool && !(workerPool instanceof ExecutionDagWorkerPool)) {
    throw new TypeError('workerPool must be created with createExecutionDagWorkerPool');
  }
  if (workerPool && workerPool.concurrency < concurrency) {
    throw new RangeError('DAG concurrency cannot exceed the worker pool size');
  }
  if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
    throw new TypeError('DAG initial state must be an object');
  }

  const state = {};
  for (const [name, value] of Object.entries(dag.initialState || {})) {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new TypeError(`DAG default value "${name}" must be a finite integer`);
    }
    state[name.toLowerCase()] = value;
  }
  for (const [name, value] of Object.entries(initialState)) {
    const key = name.toLowerCase();
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new TypeError(`DAG state value "${name}" must be a finite integer`);
    }
    state[key] = value;
  }

  const nodesById = new Map();
  for (const node of dag.nodes) {
    if (!node?.id || nodesById.has(node.id)) throw new Error('DAG node ids must be unique and non-empty');
    nodesById.set(node.id, node);
  }
  const parents = new Map([...nodesById.keys()].map(id => [id, new Set()]));
  for (const edge of dag.edges) {
    if (!parents.has(edge.from) || !parents.has(edge.to) || edge.from === edge.to) {
      throw new Error('DAG edge references an invalid node');
    }
    parents.get(edge.to).add(edge.from);
  }

  for (const node of dag.nodes.filter(item => item.eligible)) {
    const write = node.writes?.[0]?.toLowerCase();
    if (!node.parallelSafe || node.effect !== 'transactional'
      || node.expressionEffect !== 'pure'
      || !Array.isArray(node.writes)
      || node.writes.length !== 1
      || !Array.isArray(node.effects)
      || !Object.hasOwn(dag.initialState || {}, write)
      || !node.effects.includes(`write:${write}`)) {
      throw new Error(`DAG node ${node.id} does not satisfy the supported effect-safety contract`);
    }
  }

  const barrierIndex = dag.nodes.findIndex(node => !node.eligible);
  const executableNodes = barrierIndex < 0 ? dag.nodes : dag.nodes.slice(0, barrierIndex);
  const executableIds = new Set(executableNodes.map(node => node.id));
  const completed = new Set();
  const executionBatches = [];
  const activeWorkerPool = executableNodes.length === 0
    ? null
    : workerPool || await createExecutionDagWorkerPool({ concurrency });

  try {
    while (completed.size < executableNodes.length) {
      const ready = executableNodes.filter(node =>
        !completed.has(node.id)
        && [...parents.get(node.id)].every(parent => !executableIds.has(parent) || completed.has(parent))
      );
      if (ready.length === 0) throw new Error('Execution DAG contains a cycle or unresolved dependency');

      const batch = ready.slice(0, concurrency);
      const results = await Promise.all(batch.map(node =>
        activeWorkerPool.run(node.expression, state)
      ));
      for (let index = 0; index < batch.length; index += 1) {
        const node = batch[index];
        state[node.writes[0].toLowerCase()] = results[index];
        completed.add(node.id);
      }
      executionBatches.push(batch.map(node => node.id));
    }
  } finally {
    if (!workerPool && activeWorkerPool) await activeWorkerPool.close();
  }

  return {
    state,
    completedNodes: [...completed],
    executionBatches,
    stoppedAtBarrier: barrierIndex < 0 ? null : dag.nodes[barrierIndex].id
  };
}

export async function executeExecutionDagOrFallback(dag, initialState, {
  executeSequential,
  ...options
} = {}) {
  if (typeof executeSequential !== 'function') {
    throw new TypeError('executeSequential must be a function for full-program fallback');
  }
  if (!dag || dag.version !== 1 || !Array.isArray(dag.nodes)) {
    return {
      mode: 'sequential',
      reason: 'Execution DAG is unavailable or unsupported',
      result: await executeSequential()
    };
  }
  const firstBarrier = dag.nodes.find(node => !node.eligible);
  if (firstBarrier) {
    return {
      mode: 'sequential',
      reason: firstBarrier.reason || `Unsupported statement at ${firstBarrier.id}`,
      result: await executeSequential()
    };
  }

  const result = await executeExecutionDag(dag, initialState, options);
  return { mode: 'dag', reason: null, result };
}
