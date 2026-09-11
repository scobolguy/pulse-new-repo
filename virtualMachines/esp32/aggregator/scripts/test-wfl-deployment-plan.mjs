import assert from 'node:assert/strict';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { executeDeploymentPlan } from './interpret-workflow.mjs';

const source = [
  'DEPLOYMENT "payments" PROJECT "payments-project" TARGETS ("child1", "child2", "child3") BEGIN',
  'SERVICE "mt103-to-pacs008" FILE "mt103.pcode" QUEUE "swift.mt103.inbound" -> "pacs.008.outbound" TARGETS ("child1", "child2") STARTUP TRUE;',
  'DAEMON "reconciliation-daemon" FILE "reconcile.pcode" QUEUE "reconcile.in" -> "reconcile.out" TARGETS ("child3") STARTUP FALSE;',
  'END;'
].join('\n');

const compiled = compileWorkflowDSLWithAntlr(source);
assert.equal(compiled.deployments.length, 1);
assert.deepEqual(compiled.deployments[0].resources.map(resource => resource.kind), ['service', 'daemon']);
assert.deepEqual(compiled.deployments[0].resources[0].targets, ['child1', 'child2']);
assert.equal(compiled.deployments[0].resources[1].startup, false);

const result = await executeDeploymentPlan(compiled, true, { serviceBaseUrl: 'http://127.0.0.1:4000' });
assert.ok(Array.isArray(result.nodes));
assert.equal(result.dryRun, true);
assert.equal(result.deployments.length, 2);
assert.equal(result.deployments[0].request.workloadKind, 'service');
assert.equal(result.deployments[1].request.workloadKind, 'daemon');

console.log(JSON.stringify({
  nodes: result.nodes.map(node => ({
    id: node.nodeId || node.nodeName || node.id,
    ip: node.ip || node.address || null,
    status: node.status || node.state || null
  })),
  placements: result.deployments.map(item => ({
    workloadKind: item.request.workloadKind,
    serviceName: item.request.serviceName,
    targets: item.request.targetNodeIds,
    matchedNodes: item.matchedNodes.map(node => node.nodeId || node.nodeName || node.id)
  }))
}, null, 2));
console.log('[wfl-deployment-plan] PASS: service/daemon targets compile and nodes are listed');
