import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { compileNativeLanDiscovery } from '../../pmachines/arduino/compile-lan-discovery.mjs';
import { encodeHostedImage, HOSTED_IMAGE_OPCODES } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { parsePcode } from '../../pmachines/javascript/src/runtime.mjs';
import { DEFAULT_PCODE_SIGNING_KEY } from '../../aggregator/scripts/pcode-signing.mjs';

test('shared LAN discovery compiles to authenticated extended pages with real native bindings', async () => {
  const { compiled, image, map } = await compileNativeLanDiscovery();
  assert.ok(compiled.programMap.targets.includes('esp32'));
  assert.equal(map.hostImageProfile, 'extended');
  assert.ok(compiled.pcodeText.length > 8192);
  const instructions = parsePcode(compiled.pcodeText);
  assert.ok(instructions.length > 512 && instructions.length <= 4096);
  assert.ok(image.length > 32768 && image.length <= 131072);
  assert.equal(Number.parseInt(image.slice(4, 12), 16), instructions.length);
  assert.equal(map.signing.signature,
    crypto.createHmac('sha256', DEFAULT_PCODE_SIGNING_KEY).update(image).digest('hex'));
  const constants = Buffer.from(image.slice(20 + instructions.length * 24), 'hex');
  assert.equal(constants.length, Number.parseInt(image.slice(12, 20), 16));
  const nativeHost = await fs.readFile(new URL('../../pmachines/arduino/src/service_host.cpp', import.meta.url), 'utf8');
  for (const [index, instruction] of instructions.entries()) {
    const record = Buffer.from(image.slice(20 + index * 24, 44 + index * 24), 'hex');
    assert.equal(record.readUInt8(), HOSTED_IMAGE_OPCODES[instruction.mnemonic]);
    const text = constants.subarray(record.readUInt32BE(6), record.readUInt32BE(6) + record.readUInt16BE(10)).toString();
    if (['JMP', 'JZ', 'CALL'].includes(instruction.mnemonic))
      assert.equal(record.readInt32BE(2), instruction.targetIndex);
    if (instruction.mnemonic === 'PUSH_INT') assert.equal(record.readInt32BE(2), instruction.operand);
    if (instruction.mnemonic === 'CALL_EXT') {
      assert.equal(text, instruction.operand.label);
      assert.equal(record.readUInt8(1), instruction.operand.argc);
      assert.ok(nativeHost.includes(`{"${text.slice(5)}",`), `Missing actual native primitive ${text}`);
    }
  }
  const header = await fs.readFile(new URL('../../pmachines/arduino/src/lan_discovery_image.h', import.meta.url), 'utf8');
  const storedImage = [...header.split('static const char LAN_DISCOVERY_MAP')[0].matchAll(/"([0-9a-fPHI]+)"/g)]
    .map(match => match[1]).join('');
  assert.equal(storedImage, image, 'Regenerate bootstrap after shared Pascalish policy changes');
});

test('extended images do not relax legacy text/image limits or bounded execution memory', async () => {
  assert.throws(() => encodeHostedImage('NOP\n'.repeat(513)), /instruction capacity/);
  assert.throws(() => encodeHostedImage('NOP\n'.repeat(4097), { profile: 'extended' }), /instruction capacity/);
  assert.throws(() => encodeHostedImage('HALT', { profile: 'unbounded' }), /Unknown/);
  assert.throws(() => encodeHostedImage('CALL_EXT host.infrastructure_probe 0\nHALT', { profile: 'extended' }), /Desktop-only/);
  assert.throws(() => encodeHostedImage(`PUSH_STR "${'x'.repeat(2049)}"\nHALT`, { profile: 'extended' }), /constant capacity/);
  const host = await fs.readFile(new URL('../../pmachines/arduino/src/service_host.cpp', import.meta.url), 'utf8');
  const image = await fs.readFile(new URL('../../pmachines/arduino/src/hosted_image.h', import.meta.url), 'utf8');
  assert.match(host, /pcode\.size\(\) > 8192/);
  assert.match(host, /out\.instructions->size\(\) > 512/);
  assert.match(image, /PAGE_BYTES = 512, CACHE_PAGES = 4, MAX_PAGES = 256/);
});

test('native transport wiring preserves explicit overrides and ingress affinity without owner election', async () => {
  const [host, discovery] = await Promise.all([
    fs.readFile(new URL('../../pmachines/arduino/src/service_host.cpp', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../pmachines/arduino/src/service_host_discovery.cpp', import.meta.url), 'utf8'),
  ]);
  assert.match(discovery, /auto targets = context\.lifecycle\.reportTargets/);
  assert.match(discovery, /target\.aggregatorId == learned\.aggregatorId/);
  assert.match(discovery, /if \(discoveryCall\("\/accept", request, response\)\) \{\s+if \(publishDiscoveryTargets\(response\["targets"\]\)\)/);
  assert.doesNotMatch(discovery, /response\["changed"\]|ownerAggregatorId\s*=|\.bindings\s*=/);
  assert.match(host, /item\.targets = host\.reportTargetsFor\(\*context\)/);
  assert.match(host, /const auto targets = reportTargetsFor\(\*current\)/);
  assert.match(host, /target\.aggregatorId == ingressAggregatorId/);
  assert.match(host, /target\.aggregatorId == item\.owner/);
  assert.match(host, /current->lifecycle\.bindings\.find\(serviceId\)/);
  assert.match(discovery, /timestamp % discoveryClockPeriodMs/);
  assert.doesNotMatch(discovery, /policyTime\s*[<>]=?\s*discoveryNextAt/);
});
