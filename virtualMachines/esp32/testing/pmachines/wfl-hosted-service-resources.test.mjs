import assert from 'node:assert/strict';
import test from 'node:test';
import { compileWorkflowDSLWithAntlr } from '../../aggregator/scripts/workflow-antlr-compiler.mjs';

const compile = item => compileWorkflowDSLWithAntlr(`
DEPLOYMENT "lifecycle" PROJECT "core-services" TARGETS ("node-a") BEGIN
  ${item}
END;
`);

test('WFL hosted resources carry explicit requirement bindings and reporting targets', () => {
  const [hosted] = compile(`HOSTED SERVICE "pulse-librarian-s3-readonly"
    FILE "s3-readonly.pcode" TARGETS ("node-a") STARTUP TRUE
    OWNER "aggregator-west" REPORT TO "https://aggregator.example/services/report"
    REQUIRES ("pulse-filesystem")
    BINDINGS ("pulse-filesystem" INSTANCE "filesystem-a"
      ENDPOINT "https://filesystem.example/api" READINESS "https://filesystem.example/health");`)
    .deployments[0].resources;

  assert.deepEqual(hosted, {
    kind: 'hosted-service',
    id: 'pulse-librarian-s3-readonly',
    fileName: 's3-readonly.pcode',
    targets: ['node-a'],
    startup: true,
    ownerAggregatorId: 'aggregator-west',
    reportTarget: { endpoint: 'https://aggregator.example/services/report' },
    serviceLifecycle: {
      version: 1,
      requires: ['pulse-filesystem'],
      bindings: {
        'pulse-filesystem': {
          instanceId: 'filesystem-a',
          endpoint: 'https://filesystem.example/api',
          readinessUrl: 'https://filesystem.example/health'
        }
      }
    }
  });
});

test('WFL retains legacy queue deployments unchanged', () => {
  const [service] = compile(`SERVICE "legacy" FILE "legacy.pcode"
    QUEUE "in" -> "out" TARGETS ("node-a") STARTUP TRUE;`).deployments[0].resources;

  assert.equal(service.kind, 'service');
  assert.equal(service.inputQueue, 'in');
  assert.equal(service.outputQueue, 'out');
  assert.equal(service.startup, true);
  assert.equal(service.serviceLifecycle, undefined);
});

test('WFL requires one explicit binding per hosted service requirement', () => {
  assert.throws(() => compile(`HOSTED SERVICE "filesystem" FILE "filesystem.pcode"
    TARGETS ("node-a") STARTUP TRUE OWNER "aggregator-a"
    REPORT TO "https://aggregator.example/report";`),
  /invalid canonical service id/);
  assert.throws(() => compile(`HOSTED SERVICE "alpha" FILE "alpha.pcode"
    TARGETS ("node-a") STARTUP TRUE OWNER "aggregator-a"
    REPORT TO "https://aggregator.example/report" REQUIRES ("pulse-filesystem");`),
  /missing explicit bindings for pulse-filesystem/);
  assert.throws(() => compile(`HOSTED SERVICE "alpha" FILE "alpha.pcode"
    TARGETS ("node-a") STARTUP TRUE OWNER "aggregator-a"
    REPORT TO "http://localhost:4000/report" REQUIRES ("pulse-filesystem")
    BINDINGS ("pulse-filesystem" INSTANCE "fs-a"
      ENDPOINT "not-a-url" READINESS "https://filesystem.example/health");`),
  /explicit absolute HTTP\(S\) endpoint/);
  assert.throws(() => compile(`HOSTED SERVICE "alpha" FILE "alpha.pcode"
    TARGETS ("node-a") STARTUP TRUE OWNER "aggregator-a"
    REPORT TO "https://aggregator.example/report" REQUIRES ("filesystem");`),
  /invalid required service id/);
});
