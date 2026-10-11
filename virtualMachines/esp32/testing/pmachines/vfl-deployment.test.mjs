import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compileWorkflowDSL } from '../../aggregator/scripts/compile-workflow-dsl.mjs';
import { buildVflDeployments, planVflGraph } from '../../aggregator/scripts/build-vfl-deployment.mjs';
import { runSingleMessageForEvolution } from '../../pmachines/javascript/src/runtime.mjs';
import { executeDeploymentPlan } from '../../aggregator/scripts/interpret-workflow.mjs';
import { createJsPmachineDeploymentSupervisor } from '../../aggregator/src/backend/modules/jsPmachineDeploymentSupervisor.mjs';

const wfl = `DEFAULT ENVIRONMENT "dev";
QUEUE "in" -> "\${ENVIRONMENT}.payments.in";
QUEUE "out" -> "\${ENVIRONMENT}.payments.out";
DEPLOYMENT "payments" PROJECT "payments" TARGETS ("node-1") BEGIN
  FLOW "processing" FILE "graph.vfl" TARGETS ("node-1") STARTUP TRUE;
END;`;

function graph() {
  return {
    kind: 'visual-flow-language', schemaVersion: 1,
    nodes: [
      { id: 'input', kind: 'queue', queue: 'in' },
      { id: 'first', kind: 'service', execution: { sourceFile: 'worker.wfl' } },
      { id: 'second', kind: 'service', execution: { sourceFile: 'worker.wfl' } },
      { id: 'output', kind: 'queue', queue: 'out' }
    ],
    edges: [
      { from: 'input', to: 'first', type: 'message-broker-call' },
      { from: 'first', to: 'second', type: 'message-broker-call' },
      { from: 'second', to: 'output', type: 'message-broker-call' }
    ]
  };
}

test('WFL FLOW reference preserves Windows path escapes', () => {
  const fileName = '..\\tests\\new\\router\\graph.vfl';
  const compiled = compileWorkflowDSL(wfl.replace('"graph.vfl"', JSON.stringify(fileName)));
  assert.equal(compiled.deployments[0].resources[0].fileName, fileName);
});

async function fixture(t, flow = graph()) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-vfl-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'graph.vfl'), JSON.stringify(flow));
  await fs.writeFile(path.join(root, 'worker.wfl'), 'WORKFLOW "worker" BEGIN\nSTEP "forward" ROUTE QUEUE "flow.output";\nEND;');
  return root;
}

async function run(root, artifact, inputQueue, message) {
  return runSingleMessageForEvolution({
    pcode: path.join(root, artifact.fileName), programMap: path.join(root, artifact.programMapFile),
    inputQueue, message, messageFile: null, serviceId: '', organismId: '', generation: '0', fitnessOut: ''
  });
}

test('separate VFL builds real per-node pcode; queue handoff preserves the message', async t => {
  const root = await fixture(t);
  const compiled = compileWorkflowDSL(wfl, { environment: 'test' });
  assert.equal(compiled.deployments[0].resources[0].kind, 'flow');
  const preview = await buildVflDeployments(compiled, { artifactRoot: root });
  await assert.rejects(fs.access(path.join(root, '.pulse-build')), /ENOENT/);
  const built = await buildVflDeployments(compiled, { artifactRoot: root, write: true });
  assert.equal(built.artifacts.length, 2);
  assert.deepEqual(preview.compiled.deployments, built.compiled.deployments);
  const [first, second] = built.compiled.deployments[0].resources;
  assert.equal(first.inputQueue, 'test.payments.in');
  assert.equal(first.outputQueue, second.inputQueue);
  assert.equal(second.outputQueue, 'test.payments.out');
  const message = JSON.stringify({ payment: 123 });
  const a = await run(root, built.artifacts[0], first.inputQueue, message);
  const b = await run(root, built.artifacts[1], a.deliveries[0].queueName, a.deliveries[0].message);
  assert.deepEqual(b.deliveries, [{ queueName: 'test.payments.out', message }]);
  assert.equal(built.artifacts[0].programMap.sourceMap['0'].sourceLine, 2);
});

test('fan-out duplicates real delivery and keeps every instruction source-mapped', async t => {
  const flow = graph();
  flow.nodes.push({ id: 'audit', kind: 'queue', queue: 'audit.${ENVIRONMENT}' });
  flow.edges.push({ from: 'first', to: 'audit', type: 'message-broker-call' });
  const root = await fixture(t, flow);
  const built = await buildVflDeployments(compileWorkflowDSL(wfl), { artifactRoot: root, write: true });
  const result = await run(root, built.artifacts[0], 'dev.payments.in', 'hello');
  assert.equal(result.deliveries.length, 2);
  assert.equal(result.deliveries[1].queueName, 'audit.dev');
  assert.equal(built.artifacts[0].programMap.sourceMap['1'].sourceLine, 2);
  assert.equal(built.artifacts[0].programMap.sourceMap['2'].sourceLine, 3);
});

test('MAPL node transforms before publishing to the linked queue', async t => {
  const flow = graph();
  flow.nodes[1] = { id: 'first', kind: 'map', execution: { sourceFile: 'convert.mapl' } };
  const root = await fixture(t, flow);
  await fs.writeFile(path.join(root, 'convert.mapl'), 'map Convert from Customer to Account;\n target.name := source.name;\nend;');
  const built = await buildVflDeployments(compileWorkflowDSL(wfl), { artifactRoot: root, write: true });
  const result = await run(root, built.artifacts[0], 'dev.payments.in', '{"name":"Ada"}');
  assert.deepEqual(JSON.parse(result.deliveries[0].message), { name: 'Ada' });
});

test('Pascalish router binds its input guard and graph output', async t => {
  const flow = graph();
  flow.nodes[1].execution.sourceFile = 'router.pas';
  const root = await fixture(t, flow);
  await fs.writeFile(path.join(root, 'router.pas'), `PROGRAM "forward";
ROUTER "forward" INPUT "flow.input" ENABLED TRUE BEGIN
  OUTPUT "flow.output" WHEN "output := 1;" TRANSFORM "output := src;";
END;
BEGIN END.`);
  const built = await buildVflDeployments(compileWorkflowDSL(wfl), { artifactRoot: root, write: true });
  const result = await run(root, built.artifacts[0], 'dev.payments.in', 'payment');
  assert.equal(result.deliveries[0].message, 'payment');
  assert.equal(result.deliveries[0].queueName, built.compiled.deployments[0].resources[1].inputQueue);
});

test('native Pascalish service ABI fails explicitly instead of deploying an unreachable route', async t => {
  const flow = graph();
  flow.nodes[1].execution.sourceFile = 'echo.pas';
  const root = await fixture(t, flow);
  await fs.writeFile(path.join(root, 'echo.pas'), 'SERVICE "echo"; BEGIN RETURN src; END;\nBEGIN END.');
  await assert.rejects(buildVflDeployments(compileWorkflowDSL(wfl), { artifactRoot: root, write: true }), /native Pascalish SERVICE ABI/);
  await assert.rejects(fs.access(path.join(root, '.pulse-build')), /ENOENT/);
});

test('graph errors and unsupported semantics fail explicitly', async () => {
  const compiled = compileWorkflowDSL(wfl);
  const resource = compiled.deployments[0].resources[0];
  for (const [mutate, pattern] of [
    [flow => flow.nodes.push(flow.nodes[0]), /Duplicate VFL node/],
    [flow => flow.edges[0].to = 'missing', /unknown endpoint/],
    [flow => flow.edges[0].type = 'file-feed', /not implemented/],
    [flow => delete flow.nodes[1].execution, /sourceFile/],
    [flow => flow.nodes[1].kind = 'device', /not executable/],
    [flow => flow.nodes[0].queue = '${missing}', /unknown WFL variable/]
  ]) {
    const flow = graph();
    mutate(flow);
    assert.throws(() => planVflGraph(flow, resource, compiled, 'payments'), pattern);
  }
});

test('all source compiles before any artifact is written; missing emission fails', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'worker.wfl'), 'WORKFLOW "worker" BEGIN STEP "set" SET STATE "x" = "1"; END;');
  await assert.rejects(buildVflDeployments(compileWorkflowDSL(wfl), { artifactRoot: root, write: true }), /does not emit/);
  await assert.rejects(fs.access(path.join(root, '.pulse-build')), /ENOENT/);
});

test('deployment dry-run expands VFL without writing files or submitting deployments', async t => {
  const root = await fixture(t);
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /\/api\/nodes$/);
    return { ok: true, json: async () => ({ nodes: [{ nodeId: 'node-1' }] }) };
  });
  const result = await executeDeploymentPlan(compileWorkflowDSL(wfl), true, { artifactRoot: root });
  assert.equal(result.deployments.length, 2);
  assert.equal(result.deployments[0].request.workloadKind, 'service');
  await assert.rejects(fs.access(path.join(root, '.pulse-build')), /ENOENT/);
});

test('real deployment writes artifacts and submits one worker per node; STARTUP FALSE is preserved', async t => {
    const root = await fixture(t);
    const posted = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (!options) return { ok: true, json: async () => ({ nodes: [{ nodeId: 'node-1' }] }) };
      const request = JSON.parse(options.body);
      posted.push(request);
      await fs.access(request.metadata.pcodePath);
      await fs.access(request.metadata.programMapPath);
      return { ok: true, json: async () => ({ runtime: { state: request.autoStart ? 'running' : 'stopped' } }) };
    });
    await executeDeploymentPlan(compileWorkflowDSL(wfl), false, { artifactRoot: root });
    assert.equal(posted.length, 2);
    assert.equal(posted[0].metadata.outputQueue, posted[1].metadata.inputQueue);
    posted.length = 0;
    await executeDeploymentPlan(compileWorkflowDSL(wfl.replace('STARTUP TRUE', 'STARTUP FALSE')), false, { artifactRoot: root });
    assert.ok(posted.every(request => request.autoStart === false));
    const supervisor = createJsPmachineDeploymentSupervisor();
    const state = await supervisor.start({ serviceName: 'test', runtimeState: 'stopped' });
    assert.equal(state.state, 'stopped');
    assert.equal(state.pid, undefined);
});

test('unregistered target blocks deployment before artifacts or requests are written', async t => {
    const root = await fixture(t);
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(options, undefined);
      return { ok: true, json: async () => ({ nodes: [] }) };
    });
    await assert.rejects(executeDeploymentPlan(compileWorkflowDSL(wfl), false, { artifactRoot: root }), /not registered/);
    await assert.rejects(fs.access(path.join(root, '.pulse-build')), /ENOENT/);
});

test('supervisor respects stopped, paused and startup-disabled deployments before checking artifacts', async t => {
  const supervisor = createJsPmachineDeploymentSupervisor();
  t.after(() => supervisor.shutdown());
  for (const deployment of [
    { serviceName: 'stopped', runtimeState: 'stopped' },
    { serviceName: 'paused', runtimeState: 'paused' },
    { serviceName: 'startup-disabled', metadata: { startup: false } }
  ]) {
    const state = await supervisor.start(deployment);
    assert.equal(state.state, deployment.runtimeState || 'stopped');
    assert.equal(state.mode, 'not-started');
    assert.equal(state.pid, undefined);
  }
  const activated = await supervisor.start({
    serviceName: 'explicitly-activated', runtimeState: 'running', metadata: { startup: false }
  });
  assert.equal(activated.state, 'pending-artifacts', 'explicit activation overrides the startup preference');
});
