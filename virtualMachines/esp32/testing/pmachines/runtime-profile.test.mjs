import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkPmachineRuntimeCompatibility,
  createPmachineRuntimeProfile
} from '../../pmachines/shared/contracts/runtime-profile.mjs';
import { requiredHostCapabilities } from '../../pmachines/shared/contracts/host-capabilities.mjs';

test('runtime profiles share contract versions and expose target-specific XML support', () => {
  const js = createPmachineRuntimeProfile('js');
  const native = createPmachineRuntimeProfile('native');
  const esp32 = createPmachineRuntimeProfile('esp32');

  assert.deepEqual(js.contractVersions, native.contractVersions);
  assert.deepEqual(native.contractVersions, esp32.contractVersions);
  assert.ok(js.supportedHostCapabilities.includes('xml.stream'));
  assert.ok(js.supportedHostCapabilities.includes('xml.dom'));
  assert.ok(native.supportedHostCapabilities.includes('xml.stream'));
  assert.ok(!native.supportedHostCapabilities.includes('xml.dom'));
  assert.ok(!esp32.supportedHostCapabilities.includes('xml.stream'));
  assert.equal(esp32.execution.model, 'single-worker');
});

test('XML stream bindings become explicit placement requirements', () => {
  const instructions = [{
    mnemonic: 'CALL_EXT',
    operand: { label: 'host.xml_stream_open' }
  }];
  const requirements = requiredHostCapabilities(instructions);
  assert.deepEqual(requirements, ['xml.stream']);

  const native = createPmachineRuntimeProfile('native');
  const esp32 = createPmachineRuntimeProfile('esp32');
  assert.equal(checkPmachineRuntimeCompatibility(native, {
    target: 'native',
    requiredHostCapabilities: requirements
  }).compatible, true);
  const esp32Result = checkPmachineRuntimeCompatibility(esp32, {
    target: 'esp32',
    requiredHostCapabilities: requirements
  });
  assert.equal(esp32Result.compatible, false);
  assert.deepEqual(esp32Result.errors, ['host capability unavailable: xml.stream']);
});

test('runtime compatibility fails closed for stale contracts and malformed advertisements', () => {
  const profile = createPmachineRuntimeProfile('native');
  assert.equal(checkPmachineRuntimeCompatibility(profile, {
    target: 'native', hostBindingsVersion: 2
  }).compatible, false);
  assert.equal(checkPmachineRuntimeCompatibility(profile, {
    target: 'native', hostBindingsVersion: null
  }).compatible, false);
  assert.equal(checkPmachineRuntimeCompatibility(profile, {
    target: 'native', hostCapabilitiesVersion: null
  }).compatible, false);
  assert.equal(checkPmachineRuntimeCompatibility({
    ...profile,
    supportedHostCapabilities: null
  }, { target: 'native' }).compatible, false);
});
