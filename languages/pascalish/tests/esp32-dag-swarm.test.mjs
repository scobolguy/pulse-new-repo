import assert from 'node:assert/strict';
import test from 'node:test';
import { compilePascalishProgramWithAntlr } from '../src/compile-pascalish-program-antlr-to-pcode.mjs';
import {
  createEsp32DagScheduler,
  ESP32_DAG_WORKER_CAPABILITY
} from '../src/esp32-dag-swarm.mjs';
import { executeExecutionDagSequential } from '../src/execution-dag.mjs';

const source = `
program Esp32DagSwarm;
var x, y, a, b, total: integer;
begin
  x := 4;
  y := 7;
  a := x + 1;
  b := y + 2;
  total := a + b;
end.
`;

function evaluate(expression, inputs) {
  if (expression.type === 'NumberLiteral') return expression.value;
  if (expression.type === 'BooleanLiteral') return expression.value ? 1 : 0;
  if (expression.type === 'Identifier') return inputs[expression.name.toLowerCase()];
  if (expression.type === 'Unary') {
    const value = evaluate(expression.expr, inputs);
    return expression.op === '-' ? (0 - value) | 0 : value === 0 ? 1 : 0;
  }
  const left = evaluate(expression.left, inputs);
  const right = evaluate(expression.right, inputs);
  switch (expression.op) {
    case '+': return (left + right) | 0;
    case '-': return (left - right) | 0;
    case '*': return Math.imul(left, right);
    case '/': return right === 0 ? 0 : Math.trunc(left / right) | 0;
    case '=': return left === right ? 1 : 0;
    case '<>': return left !== right ? 1 : 0;
    case '<': return left < right ? 1 : 0;
    case '<=': return left <= right ? 1 : 0;
    case '>': return left > right ? 1 : 0;
    case '>=': return left >= right ? 1 : 0;
    case 'and': return left !== 0 && right !== 0 ? 1 : 0;
    case 'or': return left !== 0 || right !== 0 ? 1 : 0;
    default: throw new Error(`Unexpected test operator ${expression.op}`);
  }
}

function worker(nodeId, ip) {
  return {
    nodeId,
    ip,
    port: 80,
    lastSeen: 1000,
    beacon: { kind: 'nodeBeacon', seenAt: 1000 },
    status: 'here',
    available: true,
    draining: false,
    availability: { available: true, draining: false, status: 'here' },
    details: {
      capabilities: [ESP32_DAG_WORKER_CAPABILITY],
      dagWorker: { protocol: ESP32_DAG_WORKER_CAPABILITY, maxConcurrentTasks: 1 }
    }
  };
}

test('dispatches ready integer tasks to distinct ESP32 workers in dependency batches', async () => {
  const dag = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true }).executionDag;
  const nodes = [worker('esp32-a', '192.0.2.10'), worker('esp32-b', '192.0.2.11')];
  let active = 0;
  let maxActive = 0;
  const scheduler = createEsp32DagScheduler({
    getNodes: () => nodes,
    now: () => 1000,
    concurrency: 2,
    fetchImpl: async (url, options) => {
      assert.equal(url.pathname, '/pmachine/dag/execute');
      assert.equal(options.headers.connection, 'close');
      const request = JSON.parse(options.body);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      const value = evaluate(request.expression, request.inputs);
      active -= 1;
      return { ok: true, json: async () => ({ taskId: request.taskId, value }) };
    }
  });

  const result = await scheduler.execute(dag);
  const sequential = executeExecutionDagSequential(dag);
  assert.equal(result.mode, 'swarm');
  assert.deepEqual({ ...result.result.state }, sequential.state);
  assert.equal(result.result.state.total, 14);
  assert.deepEqual(result.result.executionBatches.map(batch => batch.length), [2, 2, 1]);
  assert.equal(maxActive, 2);
});

test('falls back sequentially when no fresh capable available worker exists', async () => {
  const dag = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true }).executionDag;
  const scheduler = createEsp32DagScheduler({
    getNodes: () => [worker('stale-node', '192.0.2.12')],
    now: () => 1000000,
    fetchImpl: async () => {
      throw new Error('must not dispatch to a stale node');
    }
  });

  const result = await scheduler.execute(dag);
  assert.equal(result.mode, 'sequential-fallback');
  assert.match(result.reason, /No fresh, available/);
  assert.equal(result.result.state.total, 14);
  assert.deepEqual(result.result, executeExecutionDagSequential(dag));
});

test('uses the HTTPS service port advertised by an ESP32 beacon', async () => {
  const dag = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true }).executionDag;
  const node = { ...worker('s3', '192.0.2.10'), protocol: 'https', httpPort: 80, httpsPort: 443 };
  const scheduler = createEsp32DagScheduler({
    getNodes: () => [node],
    now: () => 1000,
    fetchImpl: async (url, options) => {
      assert.equal(url.protocol, 'https:');
      assert.equal(url.port, '');
      const task = JSON.parse(options.body);
      return { ok: true, json: async () => ({
        taskId: task.taskId, value: evaluate(task.expression, task.inputs)
      }) };
    }
  });
  assert.equal((await scheduler.execute(dag)).mode, 'swarm');
});

test('does not dispatch to beacons marked unavailable, draining, quiesced, or at zero capacity', async () => {
  const dag = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true }).executionDag;
  const unavailable = worker('unavailable', '192.0.2.20');
  unavailable.availability = { available: false, draining: false, status: 'unavailable' };
  const draining = worker('draining', '192.0.2.21');
  draining.draining = true;
  draining.availability = { available: false, draining: true, status: 'draining' };
  const quiesced = worker('quiesced', '192.0.2.22');
  quiesced.availability.status = 'quiesced';
  const zeroCapacity = worker('zero-capacity', '192.0.2.23');
  zeroCapacity.details.dagWorker.maxConcurrentTasks = 0;
  let dispatches = 0;
  const scheduler = createEsp32DagScheduler({
    getNodes: () => [unavailable, draining, quiesced, zeroCapacity],
    now: () => 1000,
    fetchImpl: async () => {
      dispatches += 1;
      throw new Error('ineligible beacon must not be used');
    }
  });

  const result = await scheduler.execute(dag);
  assert.equal(result.mode, 'sequential-fallback');
  assert.equal(dispatches, 0);
});

test('falls back sequentially after a worker failure without committing partial results', async () => {
  const dag = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true }).executionDag;
  const scheduler = createEsp32DagScheduler({
    getNodes: () => [worker('esp32-a', '192.0.2.10'), worker('esp32-b', '192.0.2.11')],
    now: () => 1000,
    concurrency: 2,
    fetchImpl: async () => ({ ok: false, status: 503 })
  });

  const result = await scheduler.execute(dag);
  assert.equal(result.mode, 'sequential-fallback');
  assert.match(result.reason, /HTTP 503/);
  assert.equal(result.result.state.total, 14);
});

test('rejects barriers and DAGs with missing dependency edges before dispatch', async () => {
  const blockedDag = compilePascalishProgramWithAntlr(`
program Blocked;
var x: integer;
begin
  x := 1;
  writeln(x);
end.
`, { includeExecutionDag: true }).executionDag;
  let dispatches = 0;
  const scheduler = createEsp32DagScheduler({
    getNodes: () => [worker('esp32-a', '192.0.2.10')],
    now: () => 1000,
    fetchImpl: async () => {
      dispatches += 1;
      throw new Error('unsupported DAG must not dispatch');
    }
  });

  await assert.rejects(scheduler.execute(blockedDag), { status: 422 });
  assert.equal(dispatches, 0);

  const dag = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true }).executionDag;
  dag.edges = dag.edges.filter(edge => !(edge.from === 'statement-1' && edge.to === 'statement-3'));
  await assert.rejects(scheduler.execute(dag), /missing a dependency edge/);
  assert.equal(dispatches, 0);
});

test('competing jobs never share a leased worker and leases recover after completion', async () => {
  const dag = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true }).executionDag;
  const nodes = [worker('esp32-a', '192.0.2.10'), worker('esp32-b', '192.0.2.11')];
  const active = new Set();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const scheduler = createEsp32DagScheduler({
    getNodes: () => nodes,
    now: () => 1000,
    fetchImpl: async (url, options) => {
      assert.ok(!active.has(url.hostname), 'A worker must not serve two jobs concurrently');
      active.add(url.hostname);
      const task = JSON.parse(options.body);
      await gate;
      return { ok: true, json: async () => {
        active.delete(url.hostname);
        return { taskId: task.taskId, value: evaluate(task.expression, task.inputs) };
      } };
    }
  });
  const first = scheduler.execute(dag);
  assert.equal(active.size, 2);
  const competing = await scheduler.execute(dag);
  assert.equal(competing.mode, 'sequential-fallback');
  assert.deepEqual(competing.result, executeExecutionDagSequential(dag));
  release();
  assert.equal((await first).mode, 'swarm');
  assert.equal(active.size, 0);
  assert.equal((await scheduler.execute(dag)).mode, 'swarm');
});

test('timeout after a completed batch recomputes the whole DAG and releases leases', async () => {
  const dag = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true }).executionDag;
  let requests = 0;
  let aborts = 0;
  const scheduler = createEsp32DagScheduler({
    getNodes: () => [worker('esp32-a', '192.0.2.10'), worker('esp32-b', '192.0.2.11')],
    now: () => 1000,
    timeoutMs: 25,
    fetchImpl: async (url, options) => {
      requests += 1;
      if (requests === 3) {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            aborts += 1;
            reject(options.signal.reason);
          }, { once: true });
        });
      }
      const task = JSON.parse(options.body);
      return { ok: true, json: async () => ({
        taskId: task.taskId, value: evaluate(task.expression, task.inputs)
      }) };
    }
  });
  const failed = await scheduler.execute(dag);
  assert.equal(aborts, 1);
  assert.equal(requests, 4, 'Failure must occur after one successful dependency batch');
  assert.equal(failed.mode, 'sequential-fallback');
  assert.match(failed.reason, /timed out/);
  assert.deepEqual(failed.result, executeExecutionDagSequential(dag));
  assert.equal((await scheduler.execute(dag)).mode, 'swarm');
});

test('rejects mismatched task results and does not leak worker leases', async () => {
  const dag = compilePascalishProgramWithAntlr(source, { includeExecutionDag: true }).executionDag;
  let corrupt = true;
  const scheduler = createEsp32DagScheduler({
    getNodes: () => [worker('esp32-a', '192.0.2.10')],
    now: () => 1000,
    fetchImpl: async (url, options) => {
      const task = JSON.parse(options.body);
      return { ok: true, json: async () => ({
        taskId: corrupt ? 'another-job-task' : task.taskId,
        value: evaluate(task.expression, task.inputs)
      }) };
    }
  });
  const failed = await scheduler.execute(dag);
  assert.equal(failed.mode, 'sequential-fallback');
  assert.match(failed.reason, /invalid result/);
  assert.deepEqual(failed.result, executeExecutionDagSequential(dag));
  corrupt = false;
  assert.equal((await scheduler.execute(dag)).mode, 'swarm');
});
