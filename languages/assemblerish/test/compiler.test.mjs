import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileAssemblerish, AssemblerishCompileError } from '../src/compiler.mjs';
import { compileAssemblerishToPcode } from '../src/compile-assemblerish-to-pcode.mjs';
import { simulateAssemblerish } from '../src/simulator.mjs';
import { deployAssemblerish } from '../deploy.mjs';
import { signPcodeText } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const examplesPath = path.resolve(here, '..', 'examples');
const opcodeMap = await loadOpcodeMap();

function mockHal({ inputs = {}, dhtSample } = {}) {
  const calls = [];
  const levels = new Map();
  const host = async (name, args) => {
    calls.push({ name, args });
    switch (name) {
      case 'device.hal_read': return inputs[args[0]] ?? 0;
      case 'device.hal_write': levels.set(args[0], args[1]); return 1;
      case 'device.hal_pwm': levels.set(args[0], args[1]); return 1;
      case 'device.hal_dht_read': return dhtSample.valid;
      case 'device.hal_temperature': return dhtSample.valid ? dhtSample.temperature : 0;
      case 'device.hal_humidity': return dhtSample.valid ? dhtSample.humidity : 0;
      case 'device.hal_event': return 1;
      default: throw new Error(`Unexpected external binding ${name}`);
    }
  };
  return { calls, levels, host };
}

async function runExample(file, halOptions) {
  const source = await fs.readFile(path.join(examplesPath, file), 'utf8');
  const artifact = compileAssemblerishToPcode(source, { fileName: file });
  const hal = mockHal(halOptions);
  const result = await executeProgram({
    instructions: parsePcode(artifact.pcodeText),
    opcodeMap,
    programMap: artifact.programMap,
    runtimeContext: { callHost: hal.host },
    debugLogger: () => {}
  });

  assert.ok(!result.error);
  const simulated = await simulateAssemblerish(artifact, {
    allowedPins: artifact.programMap.assemblerish.devices.map(device => device.pin),
    inputs: halOptions?.inputs,
    ...(halOptions?.dhtSample ? { dht: halOptions.dhtSample } : {})
  });
  assert.equal(simulated.events.length, 1);
  assert.deepEqual(simulated.events[0], {
    handler: artifact.programMap.runtimeUnit.id,
    event: hal.calls.at(-1).args[1],
    valid: hal.calls.at(-1).args[2],
    value: hal.calls.at(-1).args[3],
    auxiliary: hal.calls.at(-1).args[4]
  });
  assert.match(artifact.pcodeText, /CALL_EXT device\.hal_event 5\nSTORE_NAME __discard\nHALT\n$/);
  assert.equal(hal.calls.at(-1).name, 'device.hal_event');
  assert.deepEqual(Object.keys(artifact.programMap), [
    'version', 'sourceLanguage', 'targets', 'runtimeUnit', 'assemblerish', 'sourceMap'
  ]);
  assert.equal(artifact.programMap.sourceLanguage, 'assemblerish');
  assert.deepEqual(artifact.programMap.targets, ['js', 'esp32']);
  return { artifact, hal, result };
}

test('simulator requires explicit samples, clamps failed DHT events, and stops after delivery', async () => {
  const buttonSource = await fs.readFile(path.join(examplesPath, 'pushbutton-relay.asmish'), 'utf8');
  const button = compileAssemblerish(buttonSource);
  await assert.rejects(() => simulateAssemblerish(button, { allowedPins: [4, 16] }), /missing explicit input sample/);

  const dhtSource = await fs.readFile(path.join(examplesPath, 'dht11-report.asmish'), 'utf8');
  const dhtArtifact = compileAssemblerish(dhtSource);
  await assert.rejects(() => simulateAssemblerish(dhtArtifact, { allowedPins: [18] }), /explicit DHT sample/);
  await assert.rejects(() => simulateAssemblerish(dhtArtifact, {
    allowedPins: [18], dht: { valid: 1, temperature: 2300 }
  }), /explicit DHT sample/);

  const changedPayload = compileAssemblerish(dhtSource.replace(
    'DHT VALID TEMP_CENTI HUMIDITY_CENTI room_sensor',
    'DHT VALID TEMP_CENTI HUMIDITY_CENTI room_sensor\nSET TEMP_CENTI 42\nSET HUMIDITY_CENTI 99'
  ));
  const failedSample = await simulateAssemblerish(changedPayload, {
    allowedPins: [18],
    dht: { valid: 0, temperature: 321, humidity: 654 }
  });
  assert.deepEqual(failedSample.events[0], {
    handler: 'room_climate', event: 'climate', valid: 0, value: 0, auxiliary: 0
  });

  const callAfterEvent = {
    ...button,
    pcodeText: button.pcodeText.replace(
      'STORE_NAME __discard\nHALT\n',
      'STORE_NAME __discard\nPUSH_STR "lamp"\nCALL_EXT device.hal_temperature 0\nHALT\n'
    )
  };
  await assert.rejects(() => simulateAssemblerish(callAfterEvent, {
    allowedPins: [4, 16], inputs: { button: 0 }
  }), /occurred after device\.hal_event/);
});

test('executes each documented example on the existing JavaScript PMachine', async () => {
  const button = await runExample('pushbutton-relay.asmish', { inputs: { button: 0 } });
  assert.equal(button.hal.levels.get('lamp'), 1);
  assert.deepEqual(button.hal.calls.at(-1).args, ['/api/devices/button', 'button', 1, 1, 0]);

  const toggle = await runExample('toggle-switch.asmish', { inputs: { switch: 1 } });
  assert.equal(toggle.hal.levels.get('lamp'), 1);
  assert.deepEqual(toggle.hal.calls.at(-1).args, ['/api/devices/toggle', 'toggle', 1, 1, 0]);

  const dht = await runExample('dht11-report.asmish', {
    dhtSample: { valid: 1, temperature: 2345, humidity: 5678 }
  });
  assert.deepEqual(dht.hal.calls.at(-1).args, ['/api/devices/climate', 'climate', 1, 2345, 5678]);
  const failedDht = await runExample('dht11-report.asmish', {
    dhtSample: { valid: 0, temperature: 0, humidity: 0 }
  });
  assert.deepEqual(failedDht.hal.calls.at(-1).args, ['/api/devices/climate', 'climate', 0, 0, 0]);
  assert.equal(failedDht.hal.calls.filter(call => call.name === 'device.hal_dht_read').length, 1);

  const pwm = await runExample('pwm-level.asmish');
  assert.equal(pwm.hal.levels.get('led'), 512);
  assert.deepEqual(pwm.hal.calls.at(-1).args, ['/api/devices/status-led', 'led_level', 1, 512, 0]);
});

test('emits conventional per-instruction source map and handler metadata', async () => {
  const source = await fs.readFile(path.join(examplesPath, 'pushbutton-relay.asmish'), 'utf8');
  const artifact = compileAssemblerish(source, { fileName: 'button.asmish' });
  assert.deepEqual(artifact.programMap.runtimeUnit, { kind: 'program', id: 'button_relay' });
  assert.deepEqual(artifact.programMap.assemblerish, {
    version: 1,
    id: 'button_relay',
    target: '/api/devices/button',
    trigger: { kind: 'edge', device: 'button', edge: 'falling', debounceMs: 30 },
    devices: [
      { name: 'button', kind: 'input', pin: 4, pull: 'pullup' },
      { name: 'lamp', kind: 'relay', pin: 16, activeLow: false, initial: 0 }
    ]
  });
  const map = artifact.sourceMap;
  assert.equal(map, artifact.programMap.sourceMap);
  assert.equal(map[0].sourceFile, 'button.asmish');
  assert.equal(map[0].sourceLanguage, 'assemblerish');
  assert.equal(map[0].sourceLine, 8);
  assert.equal(map[Object.keys(map).length - 1]?.instruction, 'HALT');
  assert.equal(Object.keys(map).length, parsePcode(artifact.pcodeText).length);
});

test('rejects invalid grammar, control flow, and undeclared bindings with line context', () => {
  const cases = [
    ['SET V 1', /Missing HANDLER id/],
    [base.replace('HEADER HANDLER button_relay', 'HEADER HANDLER 7bad'), /Handler id/],
    [base.replace('TARGET "/api/devices/button"', 'TARGET "relative/path"'), /TARGET must start/],
    [base.replace('TRIGGER EDGE button FALLING DEBOUNCE 30', 'TRIGGER EDGE button FALLING DEBOUNCE 86400001'), /Debounce interval/],
    [base.replace('READ PRESSED button', 'READ PRESSED absent'), /declared INPUT/],
    [base.replace('READ PRESSED button', 'LOAD_NAME x'), /Unknown instruction/],
    [base.replace('READ PRESSED button', 'JMP somewhere'), /Unknown instruction/],
    [base.replace('READ PRESSED button', 'WRITE lamp NEVER_SET'), /used before it is initialized/],
    [base.replace('EVENT button 1 PRESSED 0', 'EVENT button 1 PRESSED 0\nEVENT duplicate 1 0 0'), /exactly one EVENT/],
    [base.replace('EVENT button 1 PRESSED 0', 'EVENT button 1 PRESSED 0\nSET LAST 1'), /EVENT must be the final/],
    [base.replace('NOT PRESSED\n', 'SET PRESSED 4\n'), /WRITE level must be statically known/]
  ];
  for (const [source, expected] of cases) {
    assert.throws(() => compileAssemblerish(source), error => {
      assert.ok(error instanceof AssemblerishCompileError);
      assert.match(error.message, expected);
      assert.ok(Number.isInteger(error.line) && error.line > 0);
      return true;
    });
  }
});

const base = `HEADER HANDLER button_relay
TARGET "/api/devices/button"
TRIGGER EDGE button FALLING DEBOUNCE 30
INPUT button PIN 4 PULLUP
RELAY lamp PIN 16 ACTIVE HIGH INITIAL 0
READ PRESSED button
NOT PRESSED
WRITE lamp PRESSED
EVENT button 1 PRESSED 0
END
`;

test('accepts HANDLER as the canonical spelling and HEADER HANDLER as an alias', () => {
  const canonical = compileAssemblerish(base.replace('HEADER HANDLER', 'HANDLER'));
  const alias = compileAssemblerish(base);
  assert.equal(canonical.programMap.assemblerish.id, 'button_relay');
  assert.equal(alias.programMap.assemblerish.id, 'button_relay');
  assert.equal(canonical.pcodeText, alias.pcodeText);
  assert.throws(() => compileAssemblerish(base.replace(
    'TARGET "/api/devices/button"',
    'HANDLER other\nTARGET "/api/devices/button"'
  )), /Duplicate HANDLER declaration/);
});

test('validates device pin, PWM, timer, DHT validity, and instruction limits', async () => {
  const duplicatePin = base.replace('PIN 16', 'PIN 4');
  assert.throws(() => compileAssemblerish(duplicatePin), /already assigned/);
  assert.throws(() => compileAssemblerish(base.replace('PIN 4 PULLUP', 'PIN 3 PULLUP')), /reserved on the ESP32-S3/);

  const badPwm = `HEADER HANDLER pwm
TARGET "/pwm"
TRIGGER TIMER 1000
PWMOUT led PIN 21 CHANNEL 0 HZ 1000 BITS 8 INITIAL 0
SET DUTY 256
PWM led DUTY
EVENT pwm 1 DUTY 0`;
  assert.throws(() => compileAssemblerish(badPwm), /PWM duty must be statically known/);

  const mismatchedPwmTimer = `HANDLER paired_pwm
TARGET "/paired"
TRIGGER TIMER 1000
PWMOUT first PIN 21 CHANNEL 0 HZ 1000 BITS 8 INITIAL 0
PWMOUT second PIN 22 CHANNEL 1 HZ 2000 BITS 8 INITIAL 0
SET DUTY 10
PWM first DUTY
EVENT paired 1 DUTY 0`;
  assert.throws(() => compileAssemblerish(mismatchedPwmTimer), /shares a timer.*hz and bits must match/);

  const badTimer = (await fs.readFile(path.join(examplesPath, 'dht11-report.asmish'), 'utf8'))
    .replace('TRIGGER TIMER 2000', 'TRIGGER TIMER 1000');
  assert.throws(() => compileAssemblerish(badTimer), /at least 2000 ms/);
  const wrongDhtValid = (await fs.readFile(path.join(examplesPath, 'dht11-report.asmish'), 'utf8'))
    .replace('EVENT climate VALID TEMP_CENTI HUMIDITY_CENTI', 'EVENT climate 1 TEMP_CENTI HUMIDITY_CENTI');
  assert.throws(() => compileAssemblerish(wrongDhtValid), /latest DHT status register/);

  const manySets = Array.from({ length: 125 }, (_, index) => `SET R${index} ${index}`).join('\n');
  assert.throws(() => compileAssemblerish(`HEADER HANDLER full
TARGET "/full"
TRIGGER TIMER 1000
${manySets}
EVENT full 1 0 0`), /exceeds 256 instructions/);
  assert.throws(() => compileAssemblerish(`${base}${' '.repeat(16 * 1024)}`), /exceeds 16384 bytes/);

  const timerWithoutDevices = compileAssemblerish(`HEADER HANDLER tick
TARGET "/tick"
TRIGGER TIMER 50
EVENT tick 1 1 0
END`);
  assert.deepEqual(timerWithoutDevices.programMap.assemblerish.devices, []);
  const tick = await simulateAssemblerish(timerWithoutDevices, { allowedPins: [] });
  assert.deepEqual(tick.events, [{
    handler: 'tick', event: 'tick', valid: 1, value: 1, auxiliary: 0
  }]);
});

test('installs a signed artifact only with explicit confirmation and complete pin grants', async () => {
  const sourceText = await fs.readFile(path.join(examplesPath, 'pushbutton-relay.asmish'), 'utf8');
  let request;
  const response = { ok: true, status: 200, text: async () => '{"installed":true}' };
  const result = await deployAssemblerish({
    action: 'install', baseUrl: 'http://localhost:8080', sourceText,
    allowedPins: [4, 16], confirmed: true,
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return response;
    }
  });
  assert.deepEqual(result, { installed: true });
  assert.equal(request.url, 'http://localhost:8080/pmachine/assemblerish');
  assert.equal(request.options.method, 'POST');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.allowedPins, [4, 16]);
  const signedMap = JSON.parse(body.programMapText);
  assert.equal(signedMap.signing.signature, signPcodeText(body.pcode));
  assert.equal(signedMap.signing.pcodeLength, String(body.pcode).length);
  assert.notEqual(signedMap.signing.signature, '');
  assert.equal(signedMap.sourceMap, undefined);
  await deployAssemblerish({
    action: 'install', baseUrl: 'http://localhost:8080',
    sourceText: 'HANDLER tick\nTARGET "/api/devices/tick"\nTRIGGER TIMER 50\nEVENT tick 1 1 0',
    allowedPins: 'none', confirmed: true,
    fetchImpl: async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body).allowedPins, []);
      return response;
    }
  });
  const verboseSource = sourceText.replace('NOT PRESSED', `NOT PRESSED #${'x'.repeat(15000)}`);
  await deployAssemblerish({
    action: 'install', baseUrl: 'http://localhost:8080', sourceText: verboseSource,
    allowedPins: [4, 16], confirmed: true,
    fetchImpl: async (_url, options) => {
      assert.ok(Buffer.byteLength(options.body, 'utf8') < 49152);
      assert.equal(JSON.parse(JSON.parse(options.body).programMapText).sourceMap, undefined);
      return response;
    }
  });
  await assert.rejects(() => deployAssemblerish({
    action: 'status', baseUrl: 'http://localhost:8080', timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => ({
      ok: true, status: 200,
      text: () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Body read aborted')), { once: true });
      })
    })
  }), /timed out/);

  await assert.rejects(() => deployAssemblerish({
    action: 'install', baseUrl: 'http://localhost:8080', sourceText,
    allowedPins: [4], confirmed: true, fetchImpl: async () => response
  }), /Missing allowed-pin grants/);
  await assert.rejects(() => deployAssemblerish({
    action: 'install', baseUrl: 'http://localhost:8080', sourceText,
    allowedPins: [4, 16], confirmed: false, fetchImpl: async () => response
  }), /explicit --confirm-install/);

  for (const [action, method, confirmed] of [
    ['status', 'GET', false],
    ['remove', 'DELETE', true]
  ]) {
    let receivedMethod;
    await deployAssemblerish({
      action, baseUrl: 'http://localhost:8080', confirmed,
      fetchImpl: async (_url, options) => {
        receivedMethod = options.method;
        return response;
      }
    });
    assert.equal(receivedMethod, method);
  }
  await assert.rejects(() => deployAssemblerish({
    action: 'remove', baseUrl: 'http://localhost:8080', confirmed: false,
    fetchImpl: async () => response
  }), /explicit --confirm-remove/);

  await assert.rejects(() => deployAssemblerish({
    action: 'status', baseUrl: 'http://localhost:8080', timeoutMs: 1,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })
  }), /timed out after 1 ms/);
  await assert.rejects(() => deployAssemblerish({
    action: 'status', baseUrl: 'http://localhost:8080',
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'ok' })
  }), /malformed JSON/);
  await assert.rejects(() => deployAssemblerish({
    action: 'status', baseUrl: 'http://localhost:8080',
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '' })
  }), /without a JSON response body/);
});

test('simulator enforces explicit GPIO grants and exposes delivery failures', async () => {
  const source = await fs.readFile(path.join(examplesPath, 'pushbutton-relay.asmish'), 'utf8');
  const artifact = compileAssemblerish(source);
  await assert.rejects(() => simulateAssemblerish(artifact, {
    allowedPins: [4],
    inputs: { button: 0 }
  }), /GPIO 16.*not granted/);

  const result = await simulateAssemblerish(artifact, {
    allowedPins: [4, 16],
    inputs: { button: 0 }
  });
  assert.equal(result.outputs.lamp, 1);
  assert.deepEqual(result.events, [{
    handler: 'button_relay', event: 'button', valid: 1, value: 1, auxiliary: 0
  }]);

  await assert.rejects(() => simulateAssemblerish(artifact, {
    allowedPins: [4, 16],
    inputs: { button: 0 },
    acceptEvents: false
  }), /hal_event delivery failed/);
  await assert.rejects(() => simulateAssemblerish(artifact, {
    inputs: { button: 0 }
  }), /explicit array/);
});
