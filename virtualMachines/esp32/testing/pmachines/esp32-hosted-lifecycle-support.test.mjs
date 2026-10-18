import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';

test('native lifecycle metadata and logical POST binding survive compilation and bounded firmware filtering', async () => {
  const compiled = compilePascalishProgramWithAntlr(
    await fs.readFile(new URL('../../src/librarian/s3-readonly.pas', import.meta.url), 'utf8'),
    { hostServices: true, nativeTarget: true },
  );
  assert.deepEqual(compactServiceHostProgramMap(compiled.programMap).serviceLifecycle,
    { version: 1, requires: ['pulse-filesystem'] });
  assert.ok(compiled.programMap.targets.includes('esp32'));
  assert.ok(compiled.programMap.targets.includes('native'));
  assert.ok(!compiled.programMap.targets.includes('js'));
  assert.deepEqual(compiled.programMap.requiredHostCapabilities, ['service.transaction']);
  assert.equal(compiled.programMap.hostBindingsVersion, 1);
  const routes = await fs.readFile(new URL('../../pmachines/arduino/src/pmachine_routes.cpp', import.meta.url), 'utf8');
  assert.ok(routes.includes('filter["serviceLifecycle"] = true;'));
  assert.ok(routes.includes('reportTargets'));
  assert.ok(routes.includes('ownerAggregatorId'));
  assert.ok(routes.includes('x-pulse-transaction-id'));
  assert.ok(routes.includes('x-pulse-ingress-aggregator-id'));
  assert.ok(routes.includes('request->addInterestingHeader("x-pulse-transaction-id");'));
  assert.ok(routes.includes('request->addInterestingHeader("x-pulse-ingress-aggregator-id");'));
  assert.ok(routes.includes('target.aggregatorId = aggregatorId ? aggregatorId : ownerAggregatorId.c_str();'));
  const host = await fs.readFile(new URL('../../pmachines/arduino/src/service_host.cpp', import.meta.url), 'utf8');
  const installer = await fs.readFile(new URL('../../aggregator/scripts/run-pascal-on-esp32-node.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(host, /Native hosted service lifecycle is unsupported/);
  assert.ok(host.includes('{"service_submit", "sss", true}'));
  assert.ok(host.includes('x-pulse-parent-transaction-id'));
  assert.ok(host.includes('target.aggregatorId == item.owner'));
  assert.ok(host.includes('target.aggregatorId == ingressAggregatorId'));
  assert.ok(host.includes('ownerAggregatorId must match a configured report target'));
  assert.ok(installer.includes('new Set(targetIds).size === targetIds.length'));
  assert.ok(installer.includes('targetIds.includes(ownerAggregatorId)'));
  assert.ok(host.includes('void ServiceHost::reporter(void* opaque)'));
  assert.ok(host.includes('context->cachedReadiness'));
  assert.ok(host.includes('acknowledgement["readiness"]'));
  assert.ok(host.includes('item.endpoint + item.healthPath'));
  assert.ok(host.includes('request += "Authorization: Bearer " + bearerToken'));
  assert.match(host, /responseText,\s+aggregatorTarget->bearerToken\)/);
  assert.ok(host.includes('status, response, target.bearerToken)'));
  assert.ok(host.includes('Aggregator bearer token must be 32..256 base64url characters'));
  assert.ok(routes.includes('target.bearerToken = value["bearerToken"].as<const char*>();'));
  assert.ok(host.includes('route[0] != \'/\' || route[1] == \'/\''));
  assert.ok(host.includes('now() - current->cachedReadinessAt < 30000'));
  assert.ok(host.includes('current->cachedReadiness : "{\\"ready\\":false,\\"blockedBy\\":[]}";'));
  assert.doesNotMatch(host, /httpExchange\(binding\.readinessUrl/);
  assert.ok(host.includes('"/ready"'));
});

test('shared lifecycle Pascalish policy is honestly excluded from the bounded ESP32 ABI', async () => {
  const compiled = compilePascalishProgramWithAntlr(
    await fs.readFile(new URL('../../src/service-lifecycle/instance.pas', import.meta.url), 'utf8'),
    { hostServices: true },
  );
  assert.ok(!compiled.programMap.targets.includes('esp32'));
  assert.ok(Buffer.byteLength(compiled.pcodeText) > 8192);
  assert.ok(compiled.pcodeText.trim().split('\n').length > 512);
});

test('read-only Librarian deployment requires explicit aggregator and dependency bindings before traffic', async () => {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      fileURLToPath(new URL('../../aggregator/scripts/deploy-librarian-readonly-esp32.mjs', import.meta.url)),
    ], {
      env: {
        ...process.env, LIBRARIAN_FILESYSTEM_HOST: '127.0.0.1', FILESYSTEM_PORT: '1',
        ESP32_NODE_NAME: '127.0.0.1:1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => resolve({ code, output }));
  });
  assert.notEqual(result.code, 0);
  assert.match(result.output, /Explicit owner aggregator, report target URL and Filesystem service binding are required/);
  assert.doesNotMatch(result.output, /ECONNREFUSED|fetch failed/);
});
