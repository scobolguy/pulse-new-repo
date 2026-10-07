import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr as compile } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compileSensorNode, generateImage, imageUrl } from '../../sensor-node/compile.mjs';
import { executeProgram, parsePcode } from '../../pmachines/javascript/src/runtime.mjs';
import { loadOpcodeMap } from '../../pmachines/javascript/src/opcodes.mjs';

const compiled = await compileSensorNode();
const instructions = parsePcode(compiled.pcodeText);
const opcodeMap = await loadOpcodeMap();

function node() {
  const state = new Map();
  const output = [];
  const reads = [];
  let now = 0, pin = 1, valid = true;
  return {
    output, reads,
    async tick(time, level = 1, good = true) {
      now = time; pin = level; valid = good;
      const result = await executeProgram({
        instructions, opcodeMap, mappingsById: new Map(), inputQueue: '', sourceMessage: '',
        runtimeContext: {
          async callHost(operation, args) {
            if (operation === 'device.clock') return now & 0x7fffffff;
            if (operation === 'device.elapsed') return (now - args[0]) & 0x7fffffff;
            if (operation === 'device.state_get') return state.get(args[0]) ?? 0;
            if (operation === 'device.state_set') { state.set(args[0], args[1]); return args[1]; }
            if (operation === 'device.gpio_read') { assert.deepEqual(args, [14]); return pin; }
            if (operation === 'device.dht_read') { assert.deepEqual(args, [4]); reads.push(now); return valid ? 1 : 0; }
            if (operation === 'device.dht_temperature') { assert.ok(valid); return '23.0'; }
            if (operation === 'device.dht_humidity') { assert.ok(valid); return '45.0'; }
            throw new Error(`Unexpected binding ${operation}`);
          }
        }
      });
      assert.ok(result.stepCount < 2000);
      output.push(...result.stdout);
    }
  };
}

test('device bindings are opt-in, typed, and restricted to standalone programs', () => {
  const source = body => `program 'test'; begin ${body} end.`;
  assert.throws(() => compile(source('device.clock();')), /require deviceBindings/);
  assert.throws(() => compile(source("device.gpio_read('D5');"), { deviceBindings: true }), /requires integer/);
  assert.throws(() => compile(source('device.clock(1);'), { deviceBindings: true }), /requires 0 arguments/);
  assert.throws(() => compile(source('device.unknown();'), { deviceBindings: true }), /Unknown device binding/);
  assert.throws(() => compile("service 'test'; get '/'; begin return 'ok'; end end.", { deviceBindings: true }), /standalone program/);
  assert.equal(compiled.programMap.deviceBindingsVersion, 1);
});

test('flash image matches the compiled Pascalish source', async () => {
  assert.equal(await fs.readFile(imageUrl, 'utf8'), generateImage(compiled));
  assert.throws(() => generateImage({ pcodeText: 'JMP missing' }), /Unresolved/);
  assert.throws(() => generateImage({ pcodeText: 'PUSH_REAL 1.5' }), /Unsupported/);
});

test('prints once per debounced press, not while held or on release', async () => {
  const sensor = node();
  await sensor.tick(0);
  await sensor.tick(10, 0);
  await sensor.tick(59, 0);
  assert.deepEqual(sensor.output, ['DHT11 sensor node ready']);
  await sensor.tick(60, 0);
  await sensor.tick(200, 0);
  await sensor.tick(210, 1);
  await sensor.tick(260, 1);
  await sensor.tick(270, 0);
  await sensor.tick(320, 0);
  assert.deepEqual(sensor.output, ['DHT11 sensor node ready', 'Button pressed', 'Button pressed']);
});

test('bounce restarts the full 50 ms debounce interval', async () => {
  const sensor = node();
  await sensor.tick(0);
  await sensor.tick(10, 0);
  await sensor.tick(20, 1);
  await sensor.tick(30, 0);
  await sensor.tick(79, 0);
  assert.equal(sensor.output.length, 1);
  await sensor.tick(80, 0);
  assert.equal(sensor.output[1], 'Button pressed');
});

test('a button held during boot is not a synthetic press', async () => {
  const sensor = node();
  await sensor.tick(0, 0);
  await sensor.tick(100, 0);
  assert.deepEqual(sensor.output, ['DHT11 sensor node ready']);
});

test('DHT11 samples every five seconds, reports failures, and coalesces missed samples', async () => {
  const sensor = node();
  await sensor.tick(0);
  await sensor.tick(4999);
  assert.deepEqual(sensor.reads, []);
  await sensor.tick(5000);
  assert.equal(sensor.output[1], 'DHT11 temperature=23.0 C humidity=45.0 %');
  await sensor.tick(9999);
  await sensor.tick(10000, 1, false);
  assert.equal(sensor.output[2], 'DHT11 read failed');
  await sensor.tick(30000);
  assert.deepEqual(sensor.reads, [5000, 10000, 30000]);
  await sensor.tick(30001);
  assert.equal(sensor.reads.length, 3);
});

test('debouncing and sample scheduling survive the 31-bit device clock wrap', async () => {
  const sensor = node(), start = 0x7fffffff - 100;
  await sensor.tick(start);
  await sensor.tick(start + 90, 0);
  await sensor.tick(start + 139, 0);
  assert.equal(sensor.output.length, 1);
  await sensor.tick(start + 140, 0);
  assert.equal(sensor.output[1], 'Button pressed');
  await sensor.tick(start + 4999);
  assert.deepEqual(sensor.reads, []);
  await sensor.tick(start + 5000);
  assert.deepEqual(sensor.reads, [start + 5000]);
});
