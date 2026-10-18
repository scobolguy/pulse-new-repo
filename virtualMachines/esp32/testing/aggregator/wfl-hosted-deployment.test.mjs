import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { compileWorkflowDSLWithAntlr } from '../../aggregator/scripts/workflow-antlr-compiler.mjs';
import { executeDeploymentPlan } from '../../aggregator/scripts/interpret-workflow.mjs';

const artifactRoot = path.resolve('.');
const source = requirements => compileWorkflowDSLWithAntlr(`
DEPLOYMENT "core-services" PROJECT "core-services" TARGETS ("node-a") BEGIN
  HOSTED SERVICE "pulse-librarian-s3-readonly"
    FILE "testing/fixtures/wfl-hosted-service/s3-readonly.pcode"
    TARGETS ("node-a") STARTUP TRUE
    OWNER "aggregator-west"
    REPORT TO "https://aggregator.example/services/report"
    ${requirements || ';'}
END;
`);

function mockFetch(calls) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/api/nodes')) {
      return { ok: true, json: async () => [{ nodeId: 'node-a' }] };
    }
    if (String(url).endsWith('/api/pmachine/deployments') && options.method === 'POST') {
      return { ok: true, json: async () => ({ status: 'ok', deployment: JSON.parse(options.body) }) };
    }
    throw new Error(`Unexpected request ${options.method || 'GET'} ${url}`);
  };
}

test('hosted WFL deployment persists explicit owned lifecycle intent', async () => {
  const calls = [];
  const result = await executeDeploymentPlan(source(`
    REQUIRES ("pulse-filesystem")
    BINDINGS ("pulse-filesystem" INSTANCE "filesystem-a"
      ENDPOINT "https://filesystem.example/api"
      READINESS "https://filesystem.example/health");`), false, {
    artifactRoot,
    serviceBaseUrl: 'https://aggregator.example',
    ownerAggregatorId: 'aggregator-west',
    fetchImpl: mockFetch(calls)
  });

  const post = calls.find(call => call.options.method === 'POST');
  assert.ok(post);
  const persistedRequest = JSON.parse(post.options.body);
  assert.equal(persistedRequest.workloadKind, 'hosted-service');
  assert.deepEqual(persistedRequest.metadata.serviceLifecycle, {
    version: 1,
    requires: ['pulse-filesystem'],
    bindings: {
      'pulse-filesystem': {
        instanceId: 'filesystem-a',
        endpoint: 'https://filesystem.example/api',
        readinessUrl: 'https://filesystem.example/health'
      }
    },
    compiledRequires: ['pulse-filesystem']
  });
  assert.equal(persistedRequest.metadata.ownerAggregatorId, 'aggregator-west');
  assert.deepEqual(persistedRequest.metadata.reportTarget, {
    endpoint: 'https://aggregator.example/services/report'
  });
});

test('hosted deployment refuses omitted intrinsic requirements before POST', async () => {
  const calls = [];
  await assert.rejects(
    executeDeploymentPlan(source(''), false, {
      artifactRoot,
      serviceBaseUrl: 'https://aggregator.example',
      ownerAggregatorId: 'aggregator-west',
      fetchImpl: mockFetch(calls)
    }),
    /omits compiled service requirements: pulse-filesystem/
  );
  assert.equal(calls.some(call => call.options.method === 'POST'), false);
});

test('hosted install action is routed only by its explicit owner', async () => {
  const calls = [];
  const compiled = source(`
    REQUIRES ("pulse-filesystem")
    BINDINGS ("pulse-filesystem" INSTANCE "filesystem-a"
      ENDPOINT "https://filesystem.example/api"
      READINESS "https://filesystem.example/health");`);
  await assert.rejects(
    executeDeploymentPlan(compiled, false, {
      artifactRoot,
      serviceBaseUrl: 'https://aggregator.example',
      ownerAggregatorId: 'aggregator-east',
      fetchImpl: mockFetch(calls)
    }),
    /requires its explicitly configured owner aggregator/
  );
  assert.equal(calls.some(call => call.options.method === 'POST'), false);

  await assert.rejects(
    executeDeploymentPlan(compiled, false, {
      artifactRoot,
      serviceBaseUrl: 'https://aggregator.example',
      fetchImpl: mockFetch(calls)
    }),
    /requires its explicitly configured owner aggregator/
  );
  assert.equal(calls.some(call => call.options.method === 'POST'), false);
});
