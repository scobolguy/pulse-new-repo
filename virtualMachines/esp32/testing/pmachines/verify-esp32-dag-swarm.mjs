import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from '../../../../languages/pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';
import { executeExecutionDagSequential } from '../../../../languages/pascalish/src/execution-dag.mjs';
import { createEsp32DagScheduler } from '../../../../languages/pascalish/src/esp32-dag-swarm.mjs';

// Explicit opt-in: sends bounded pure computations to a real device, without installing programs.
function originFromEnvironment(name) {
  if (!process.env[name]) throw new Error(`Set ${name} to an HTTP(S) origin`);
  const url = new URL(process.env[name]);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/'
    || url.search || url.hash || url.username || url.password) {
    throw new Error(`${name} must be an HTTP(S) origin`);
  }
  return url;
}

const device = originFromEnvironment('PULSE_ESP32_TEST_URL');
const aggregator = originFromEnvironment('PULSE_AGGREGATOR_TEST_URL');
const executionMode = process.env.PULSE_DAG_TEST_MODE || 'direct';
if (!['direct', 'api'].includes(executionMode)) {
  throw new Error('PULSE_DAG_TEST_MODE must be direct or api');
}
if (executionMode === 'api' && device.protocol !== 'https:') {
  throw new Error('Full API validation requires a trusted HTTPS device origin');
}
let node;
const discoveryDeadline = Date.now() + 75000;
while (Date.now() < discoveryDeadline) {
  const response = await fetch(new URL('/api/nodes', aggregator), { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, 'Aggregator node lookup failed');
  const nodes = await response.json();
  assert.ok(Array.isArray(nodes), 'Aggregator must return a node array');
  node = nodes.find(value => value.ip === device.hostname && value.beacon?.kind === 'nodeBeacon');
  if (node) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(node, 'Target must have a real beacon-derived Aggregator record');
assert.equal(node.availability?.available, true, 'Target beacon must advertise availability');
assert.equal(node.availability?.draining, false, 'Target must not be draining');

const compiled = compilePascalishProgramWithAntlr(`
program HardwareDag;
var x, y, a, b, total: integer;
begin
  x := 4;
  y := 7;
  a := x + 1;
  b := y + 2;
  total := a + b;
end.
`, { includeExecutionDag: true });
let dispatches = 0;
const scheduler = createEsp32DagScheduler({
  getNodes: () => [node],
  fetchImpl: async (url, options) => {
    assert.equal(url.hostname, device.hostname, 'Dispatch must target the discovered board');
    dispatches += 1;
    // Use the explicitly selected test origin; production retains the advertised TLS transport.
    return fetch(new URL(url.pathname, device), options);
  }
});
let execution;
if (executionMode === 'api') {
  const result = await fetch(new URL('/api/pmachine/dag/execute', aggregator), {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close' },
    body: JSON.stringify({ dag: compiled.executionDag, initialState: {} }),
    signal: AbortSignal.timeout(60000)
  });
  assert.equal(result.status, 200, await result.clone().text());
  execution = await result.json();
} else {
  execution = await scheduler.execute(compiled.executionDag);
}
assert.equal(execution.mode, 'swarm', execution.reason);
if (executionMode === 'direct') assert.equal(dispatches, compiled.executionDag.nodes.length);
assert.equal(execution.result.completedNodes.length, compiled.executionDag.nodes.length);
assert.deepEqual({ ...execution.result.state }, executeExecutionDagSequential(compiled.executionDag).state);
assert.equal(execution.result.state.total, 14);

async function checkExpression(expression, expectedValue, expectedStatus = 200) {
  const taskId = 'hardware-dag-check';
  const result = await fetch(new URL('/pmachine/dag/execute', device), {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close' },
    body: JSON.stringify({ version: 1, taskId, effect: 'pure', effects: [], expression, inputs: {} }),
    signal: AbortSignal.timeout(10000)
  });
  const body = await result.json();
  assert.equal(result.status, expectedStatus, JSON.stringify(body));
  if (expectedStatus === 200) {
    assert.equal(body.taskId, taskId);
    assert.equal(body.value, expectedValue);
  } else {
    assert.ok(body.error, 'Rejected tasks must return an explicit error');
  }
}

const literal = value => ({ type: 'NumberLiteral', value });
const binary = (op, left, right) => ({ type: 'Binary', op, left: literal(left), right: literal(right) });
await checkExpression(binary('+', 2147483647, 1), -2147483648);
await checkExpression(binary('*', 2147483647, 2), -2);
await checkExpression(binary('/', -7, 2), -3);
await checkExpression(binary('/', 7, 0), 0);
await checkExpression({ type: 'Unary', op: 'not', expr: { type: 'BooleanLiteral', value: false } }, 1);
await checkExpression({ type: 'CallExpr', name: 'writeln', args: [] }, undefined, 422);
await checkExpression({ type: 'Identifier', name: 'missing' }, undefined, 422);
console.log(`Live ESP32 DAG verification passed (${executionMode}): ${node.nodeId}, ${execution.result.completedNodes.length} completed tasks, total=14; overflow, Boolean and rejection checks passed`);
