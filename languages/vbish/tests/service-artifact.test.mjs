import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileVbishToPcode } from '../src/compile-vbish-to-pcode.mjs';
import { SERVICE_HOST_BINDINGS_VERSION } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { HOST_CAPABILITIES_VERSION } from '../../../virtualMachines/esp32/pmachines/shared/contracts/host-capabilities.mjs';

test('VBish service artifacts publish the hosted pmachine contract', () => {
  const artifact = compileVbishToPcode([
    'SERVICE telemetry',
    'SUB ReadTemperature',
    'END SUB',
    'ENDPOINT "GET" "/temperature" HANDLER "ReadTemperature"'
  ].join('\n'));
  assert.deepEqual(artifact.programMap.runtimeUnit, {
    kind: 'service',
    id: 'telemetry',
    refreshMs: null
  });
  assert.equal(artifact.programMap.serviceId, 'telemetry');
  assert.equal(artifact.programMap.hostBindingsVersion, SERVICE_HOST_BINDINGS_VERSION);
  assert.equal(artifact.programMap.hostCapabilitiesVersion, HOST_CAPABILITIES_VERSION);
  assert.deepEqual(artifact.programMap.targets, ['js', 'esp32']);
  assert.deepEqual(artifact.programMap.serviceEndpoints, [{
    verb: 'GET',
    path: '/temperature',
    handler: 'ReadTemperature'
  }]);
  assert.deepEqual(artifact.programMap.serviceLifecycle, { version: 1, requires: [] });
});

test('VBish rejects endpoints outside a service and invalid endpoint verbs', () => {
  assert.throws(() => compileVbishToPcode('PROGRAM worker\nENDPOINT "GET" "/status"'), /require a SERVICE runtime/);
  assert.throws(() => compileVbishToPcode('SERVICE worker\nENDPOINT "PUT" "/status"'), /require GET or POST/);
  assert.throws(() => compileVbishToPcode(
    'SERVICE worker\nENDPOINT "GET" "/status" HANDLER "Missing"',
  ), /handler not found/);
});
