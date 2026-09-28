import assert from 'node:assert/strict';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';

const source = `
DEPLOYMENT "conversion-deploy" PROJECT "payments" TARGETS ("js-node-01") BEGIN
  SERVICE "conversion" FILE "services/conversion.pas" QUEUE "service.in" -> "service.out" TARGETS ("js-node-01") STARTUP TRUE PERSISTENT TRUE MIN_INSTANCES 1 MAX_INSTANCES 4 IDLE_TIMEOUT 5 M;
END;
`;

const compiled = compileWorkflowDSLWithAntlr(source);
const resource = compiled.deployments[0].resources[0];
assert.equal(resource.kind, 'service');
assert.deepEqual(resource.lifecycle, {
  persistent: true,
  minInstances: 1,
  maxInstances: 4,
  idleTimeout: 5,
  idleTimeoutUnit: 'm'
});

console.log('[persistent-service-wfl] PASS: service lifecycle policy compiles');
