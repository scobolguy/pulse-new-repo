import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileWorkflowDSL } from './compile-workflow-dsl.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const flowDocument = require(path.resolve(__dirname, '..', '..', 'tools', 'catalog-studio-vscode', 'wflFlowDocument.js'));

const sample = `# Payments estate
QUEUE "swift.in" -> "swift.mt103.v1";

FLOW "payments" BEGIN
  @name "Payments flow";   // shown in the designer
  @mermaidPreview false;
  @owner 42;
  SEED "daemon.gateway.primary";
  NODE "gw" KIND "daemon" TYPE "gateway" LABEL "Gateway" CATALOG "daemon.gateway.primary" SOURCE "seeded" AT 36, 36;
  -- the edge device
  NODE "pi" KIND "device" TYPE "topology-target" LABEL "Pi" AT 250, 36
       TARGET "node-1" IP "10.0.0.5" SERVICES ("collector", "pmachine") VIA "service-call";
  LINK "gw" TO "pi" VIA "service-call" LABEL "deliver";
END;

WORKFLOW "w" BEGIN
  STEP "s" ROUTE QUEUE "swift.in";
END;
`;

function compiledFlow(text) {
  const result = compileWorkflowDSL(text);
  assert.equal(result.flows.length, 1, 'expected one FLOW');
  return result.flows[0];
}

function studioFlow(text) {
  const parsed = flowDocument.parseWflFlowDocument(text);
  assert.deepEqual(parsed.diagnostics, []);
  return parsed.flow;
}

function edit(text, mutate) {
  const flow = structuredClone(studioFlow(text));
  mutate(flow);
  const next = flowDocument.applyEdits(text, flowDocument.computeFlowEdits(text, flow));
  return { flow, next };
}

// The studio parser and the ANTLR compiler agree on the model.
const expected = compiledFlow(sample);
assert.deepEqual(studioFlow(sample), expected);
assert.equal(expected.metadata.name, 'Payments flow');
assert.equal(expected.metadata.owner, 42);
assert.equal(expected.animation.useMermaidPreview, false);
assert.deepEqual(expected.nodes[1].targetBinding, {
  bindingType: 'topology-target',
  preferredTransport: 'service-call',
  targetRef: 'node-1',
  serviceCandidates: ['collector', 'pmachine'],
});
assert.equal(expected.edges[0].label, 'deliver');
assert.equal(compileWorkflowDSL(sample).workflows.length, 1, 'workflow steps using flow keywords still compile');
assert.equal(flowDocument.parseWflFlowDocument(sample).otherItems.length, 2);

// Unchanged model produces no edits.
assert.deepEqual(flowDocument.computeFlowEdits(sample, structuredClone(expected)), []);

// Moving a node rewrites only its AT clause.
{
  const { flow, next } = edit(sample, (value) => {
    value.nodes[1].x = 300;
    value.nodes[1].y = 80;
  });
  assert.equal(next, sample.replace('AT 250, 36', 'AT 300, 80'));
  assert.deepEqual(compiledFlow(next), flow);
}

// Adding nodes, seeds and links inserts statements in their sections.
{
  const { flow, next } = edit(sample, (value) => {
    value.catalog.seedObjects.push('daemon.message-broker.primary');
    value.nodes.push({ id: 'broker', kind: 'daemon', type: 'message-broker', label: 'Broker "main"', x: 36, y: 160 });
    value.edges.push({ id: 'ignored', from: 'gw', to: 'broker', type: 'message-broker-call', label: 'message-broker-call' });
  });
  assert.match(next, /SEED "daemon\.gateway\.primary";\n  SEED "daemon\.message-broker\.primary";/);
  assert.match(next, /NODE "broker" KIND "daemon" TYPE "message-broker" LABEL "Broker \\"main\\"" AT 36, 160;/);
  assert.match(next, /LINK "gw" TO "broker" VIA "message-broker-call";\nEND;/);
  assert.ok(next.includes('// shown in the designer') && next.includes('-- the edge device'), 'comments survive');
  const compiled = compiledFlow(next);
  assert.deepEqual(compiled, studioFlow(next));
  assert.deepEqual(compiled.nodes.map((node) => node.id), flow.nodes.map((node) => node.id));
  assert.equal(compiled.nodes[2].label, 'Broker "main"');
  assert.equal(compiled.edges.length, 2);
}

// Deleting a node and its links removes whole lines and leaves everything else.
{
  const { next } = edit(sample, (value) => {
    value.nodes = value.nodes.filter((node) => node.id !== 'pi');
    value.edges = value.edges.filter((edge) => edge.from !== 'pi' && edge.to !== 'pi');
  });
  assert.ok(!next.includes('NODE "pi"') && !next.includes('LINK "gw"'));
  assert.ok(next.includes('-- the edge device'));
  assert.ok(next.startsWith('# Payments estate\nQUEUE "swift.in" -> "swift.mt103.v1";\n'));
  assert.ok(next.endsWith('WORKFLOW "w" BEGIN\n  STEP "s" ROUTE QUEUE "swift.in";\nEND;\n'));
  assert.equal(compiledFlow(next).nodes.length, 1);
}

// Binding a target re-renders the node; changing metadata rewrites only the directive.
{
  const { flow, next } = edit(sample, (value) => {
    value.metadata.name = 'Renamed';
    value.nodes[0].target = { nodeId: 'node-2', ip: '10.0.0.6', services: [] };
    value.nodes[0].targetBinding = { preferredTransport: 'message-broker-call' };
  });
  assert.match(next, /@name "Renamed";   \/\/ shown in the designer/);
  assert.match(next, /NODE "gw" .* TARGET "node-2" IP "10\.0\.0\.6" VIA "message-broker-call";/);
  assert.deepEqual(compiledFlow(next).nodes[0], flowDocument.parseWflFlowDocument(next).flow.nodes[0]);
  assert.equal(compiledFlow(next).nodes[0].targetBinding.targetRef, 'node-2');
  assert.equal(flow.metadata.name, compiledFlow(next).metadata.name);
}

// A document without a FLOW gets one appended; existing items are untouched.
{
  const plain = 'QUEUE "a" -> "b";\n';
  const parsed = flowDocument.parseWflFlowDocument(plain, { defaultFlowId: 'estate' });
  assert.equal(parsed.hasFlow, false);
  const flow = structuredClone(parsed.flow);
  flow.nodes.push({ id: 'n1', kind: 'service', label: 'N1', x: 10, y: 20 });
  const next = flowDocument.applyEdits(plain, flowDocument.computeFlowEdits(plain, flow, { parsed }));
  assert.ok(next.startsWith(plain));
  const compiled = compiledFlow(next);
  assert.equal(compiled.id, 'estate');
  assert.deepEqual(compiled.nodes, [{ id: 'n1', kind: 'service', label: 'N1', x: 10, y: 20 }]);
  assert.equal(compileWorkflowDSL(next).symbols.queues.length, 1);
}

// Canonical rendering round-trips through the compiler.
{
  const rendered = flowDocument.createDefaultWflText('fresh', {
    metadata: { name: 'Fresh', description: 'line 1\nline 2', createdBy: 'Pulse Studio' },
    catalog: { seedObjects: ['daemon.gateway.primary'] },
  });
  const compiled = compiledFlow(rendered);
  assert.equal(compiled.metadata.description, 'line 1\nline 2');
  assert.deepEqual(compiled, studioFlow(rendered));
  assert.deepEqual(compiledFlow(flowDocument.renderFlowBlock(expected)), expected);
}

// Both parsers reject links to unknown nodes.
{
  const bad = 'FLOW "x" BEGIN NODE "a"; LINK "a" TO "b" VIA "file-feed"; END;';
  assert.throws(() => compileWorkflowDSL(bad), /unknown NODE 'b'/);
  const parsed = flowDocument.parseWflFlowDocument(bad);
  assert.match(parsed.diagnostics[0].message, /unknown NODE 'b'/);
  assert.throws(() => flowDocument.computeFlowEdits(bad, parsed.flow || {}, { parsed }), /Fix the FLOW block/);
}

console.log('WFL FLOW tests passed');
