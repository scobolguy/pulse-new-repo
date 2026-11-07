import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { compileCsharpToPcode } from '../../../../languages/csharp/src/compile-csharp-to-pcode.mjs';
import { compileVb11ToPcode } from '../../../../languages/vbish/src/compile-vb11.mjs';
import { createDeviceLibrary } from '../../../../languages/dotnet/device-library.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';
import { enrichDiscoveredNode } from '../../aggregator/src/backend/modules/nodeDiscovery.mjs';

const library = createDeviceLibrary({ id: 'BoardLed', name: 'BoardLed', type: 'ws2812', pin: 48 });
const options = { target: 'esp32', libraries: [library] };
const exampleFile = fileURLToPath(new URL('../../../../languages/csharp/examples/board-led.cs', import.meta.url));
const source = await readFile(exampleFile, 'utf8');

test('C# GPIO48 example links the shared device ABI with an honest ESP32 target', async () => {
  const artifact = compileCsharpToPcode(source, { ...options, fileName: exampleFile });
  assert.equal(artifact.programMap.target, 'esp32');
  assert.deepEqual(artifact.programMap.targets, ['esp32']);
  assert.match(artifact.pcodeText, /FSM OPEN device "BoardLed" "ws2812" 48/);
  assert.match(artifact.pcodeText, /FSM SET power/);
  assert.match(artifact.pcodeText, /FSM OBSERVE power/);
  for (const state of ['color', 'intensity']) {
    assert.match(artifact.pcodeText, new RegExp(`FSM SET ${state}`));
    assert.match(artifact.pcodeText, new RegExp(`FSM OBSERVE ${state}`));
  }
  assert.match(artifact.pcodeText, /FSM CLOSE/);
  assert.match(artifact.pcodeText, /DELAY_MS/);
  assert.match(artifact.pcodeText, /PUSH_INT 3000/);
  assert.equal(Object.keys(artifact.programMap.sourceMap).length,
    artifact.pcodeText.split(/\r?\n/).filter(line => line && !line.endsWith(':')).length);
  const librarySource = await readFile(Object.values(library.programMap.sourceMap)[0].sourceFile, 'utf8');
  for (const location of Object.values(library.programMap.sourceMap)) {
    assert.equal(librarySource.split(/\r?\n/)[location.sourceLine - 1], location.sourceText);
  }
});

test('C#/VB share device signatures and reject wrong arguments or unsupported targets', () => {
  const vb = `Module Program
Sub Main()
Dim led As Integer = boardled.OPEN()
Dim ok As Boolean = BoardLed.SetPower(led, True)
ok = BoardLed.SetColor(led, "#123aBc")
ok = BoardLed.SetIntensity(led, 128)
System.Console.WriteLine(BoardLed.ReadColor(led))
System.Console.WriteLine(BoardLed.ReadIntensity(led))
System.Console.WriteLine(BoardLed.ReadPower(led))
ok = BoardLed.Close(led)
End Sub
End Module`;
  assert.deepEqual(compileVb11ToPcode(vb, options).programMap.targets, ['esp32']);
  assert.throws(() => compileCsharpToPcode(source, { libraries: [library] }), /cannot run on target js/);
  assert.throws(() => compileVb11ToPcode(vb, { libraries: [library] }), /cannot run on target js/);
  for (const compile of [compileCsharpToPcode, compileVb11ToPcode]) {
    assert.throws(() => compile('', { target: 'unknown' }), /Unsupported scalar target/);
  }
  assert.throws(() => compileCsharpToPcode(
    'class Program { static void Main() { BoardLed.SetPower(1, 1); } }', options));
  assert.throws(() => compileCsharpToPcode(
    'class Program { static void Main() { BoardLed.Open(48); } }', options));
  assert.throws(() => compileCsharpToPcode(
    'class Program { static void Main() { BoardLed.SetColor(1, 123); } }', options));
  assert.throws(() => compileCsharpToPcode(
    'class Program { static void Main() { BoardLed.SetIntensity(1, "32"); } }', options));
});

test('device library validates configuration before producing P-code', () => {
  for (const bad of [{ pin: -1 }, { pin: 256 }, { pin: 48.5 }, { name: 'bad"name' }, { type: 'bad\ntype' }]) {
    assert.throws(() => createDeviceLibrary({ name: 'BoardLed', type: 'ws2812', pin: 48, ...bad }),
      /Device library requires/);
  }
});

const target = process.env.PULSE_LED_TEST_NODE;
test('physical ESP32-S3 blinks GPIO48 from C# with three-second on/off intervals', {
  skip: !target, timeout: 180000,
}, async () => {
  const origin = new URL(target);
  for (const path of ['/pmachine/status', '/pmachine/service_host/status']) {
    const response = await requestEsp32(new URL(path, origin), { timeoutMs: 15000 });
    assert.equal(response.status, 200);
    assert.equal(JSON.parse(await response.text()).running, false, 'Do not interrupt an active runtime');
  }
  const artifact = compileCsharpToPcode(source, { ...options, fileName: exampleFile });
  const signedMap = attachPcodeSignature(artifact.programMap, artifact.pcodeText);
  const rejected = await requestEsp32(new URL('/pmachine/execute_json', origin), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 15000,
    body: JSON.stringify({ pcode: artifact.pcodeText,
      programMap: { ...signedMap, signing: { ...signedMap.signing, signature: '0'.repeat(64) } } }),
  });
  const rejectedText = await rejected.text();
  assert.equal(rejected.status, 403, rejectedText);
  assert.match(rejectedText, /Pcode signature verification failed/);
  const start = Date.now();
  const response = await requestEsp32(new URL('/pmachine/execute_json', origin), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 45000,
    body: JSON.stringify({ pcode: artifact.pcodeText,
      programMap: signedMap,
      inputQueue: '', message: '', stdin: '' }),
  });
  const text = await response.text();
  assert.equal(response.status, 200, text);
  const result = JSON.parse(text);
  assert.equal(result.ok, true, text);
  assert.equal(result.runtimeError, undefined, text);
  assert.equal(result.stepLimitHit, false, text);
  assert.deepEqual(result.stdout, [
    '32', '#FF0000', 'on', 'off', '#00FF00', 'on', 'off', '#0000FF', 'on', 'off', 'LED blink complete',
  ], text);
  assert.ok(Date.now() - start >= 18000, 'Six three-second delays must execute on the board');
  const after = await requestEsp32(new URL('/pmachine/status', origin), { timeoutMs: 15000 });
  assert.equal(after.status, 200);
  assert.equal(JSON.parse(await after.text()).running, false);

  const describeResponse = await requestEsp32(new URL('/services/describe', origin), { timeoutMs: 15000 });
  assert.equal(describeResponse.status, 200);
  const description = JSON.parse(await describeResponse.text());
  const device = description.devices.find(item => item.name === 'BoardLed');
  assert.ok(device, 'The onboard LED must be discoverable');
  assert.equal(device.visibility, 'public');
  assert.equal(device.driver, 'ws2812');
  assert.equal(device.pin, 48);
  assert.equal(device.endpoint, '/api/device/BoardLed');
  assert.deepEqual(device.states, ['power', 'color', 'intensity']);
  assert.deepEqual(device.capabilities, { colorFormat: '#RRGGBB', intensityMin: 0, intensityMax: 255 });
  assert.equal(description.devices.some(item => ['LEDPIN', 'RELAY'].includes(item.name)), false);
  const discoveredNodes = new Map([[origin.hostname, { ip: origin.hostname, httpPort: Number(origin.port || 80) }]]);
  const discoveryWarnings = [];
  await enrichDiscoveredNode({
    ip: origin.hostname, discoveredNodes, timeoutMs: 15000,
    logger: { warn: message => discoveryWarnings.push(message) },
    fetchImpl: async (url, { signal }) => {
      const response = await requestEsp32(url, { signal, timeoutMs: 15000 });
      return { ok: response.ok, status: response.status, json: async () => JSON.parse(await response.text()) };
    },
  });
  assert.deepEqual(discoveryWarnings, []);
  assert.deepEqual(discoveredNodes.get(origin.hostname).details.devices.find(item => item.name === 'BoardLed'), device,
    'Aggregator discovery must retain the real LED advertisement and capabilities');

  const write = async (state, value, status = 200) => {
    const response = await requestEsp32(new URL('/api/device/BoardLed', origin), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, value }), timeoutMs: 15000,
    });
    const text = await response.text();
    assert.equal(response.status, status, text);
    const result = JSON.parse(text);
    assert.equal(result.ok, status === 200, text);
    return result.value;
  };
  const read = async state => {
    const response = await requestEsp32(new URL(`/api/device/BoardLed?state=${state}`, origin), { timeoutMs: 15000 });
    const text = await response.text();
    assert.equal(response.status, 200, text);
    const result = JSON.parse(text);
    assert.equal(result.ok, true, text);
    return result.value;
  };
  try {
    assert.equal(await read('power'), 'off');
    assert.equal(await read('color'), '#0000FF', 'C# color survives close and network reopen');
    assert.equal(await read('intensity'), '32');
    assert.equal(await write('color', '#123aBc'), '#123ABC');
    assert.equal(await write('intensity', 128), '128');
    assert.equal(await read('color'), '#123ABC');
    assert.equal(await read('intensity'), '128');
    assert.equal(await write('power', true), 'on');
    assert.equal(await write('intensity', 0), '0', 'Zero intensity is not a power alias');
    assert.equal(await read('power'), 'on');
    assert.equal(await read('intensity'), '0');
    await write('intensity', 256, 422);
    await write('intensity', -1, 422);
    await write('color', '#GG0000', 422);
    await write('color', { red: 255 }, 400);
    assert.equal(await read('color'), '#123ABC');
    assert.equal(await read('intensity'), '0');
    const unsafeGet = await requestEsp32(new URL('/api/device/BoardLed?action=turnOff', origin), { timeoutMs: 15000 });
    assert.equal(unsafeGet.status, 400, await unsafeGet.text());
    assert.equal(await read('power'), 'on', 'GET must never mutate the LED');
  } finally {
    assert.equal(await write('power', 'off'), 'off');
  }
  assert.equal(await read('power'), 'off');

  const vbArtifact = compileVb11ToPcode(`Module Program
Sub Main()
Dim led As Integer = BoardLed.Open()
Dim ok As Boolean = BoardLed.SetColor(led, "#FF8000")
ok = BoardLed.SetIntensity(led, 64)
ok = BoardLed.SetPower(led, True)
System.Console.WriteLine(BoardLed.ReadColor(led))
System.Console.WriteLine(BoardLed.ReadIntensity(led))
System.Console.WriteLine(BoardLed.ReadPower(led))
ok = BoardLed.SetPower(led, False)
System.Console.WriteLine(BoardLed.ReadPower(led))
ok = BoardLed.Close(led)
End Sub
End Module`, options);
  const vbResponse = await requestEsp32(new URL('/pmachine/execute_json', origin), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 15000,
    body: JSON.stringify({ pcode: vbArtifact.pcodeText,
      programMap: attachPcodeSignature(vbArtifact.programMap, vbArtifact.pcodeText),
      inputQueue: '', message: '', stdin: '' }),
  });
  const vbText = await vbResponse.text();
  assert.equal(vbResponse.status, 200, vbText);
  const vbResult = JSON.parse(vbText);
  assert.equal(vbResult.ok, true, vbText);
  assert.equal(vbResult.runtimeError, undefined, vbText);
  assert.equal(vbResult.stepLimitHit, false, vbText);
  assert.deepEqual(vbResult.stdout, ['#FF8000', '64', 'on', 'off'], vbText);
  assert.equal(await read('color'), '#FF8000', 'VB and network clients use the same persistent device');
  assert.equal(await read('intensity'), '64');
  assert.equal(await read('power'), 'off');

  if (process.env.PULSE_LED_TEST_AGGREGATOR) {
    let advertised;
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await requestEsp32(new URL('/api/nodes', process.env.PULSE_LED_TEST_AGGREGATOR), {
        timeoutMs: 10000,
      });
      const text = await response.text();
      assert.equal(response.status, 200, text);
      const nodes = JSON.parse(text);
      assert.ok(Array.isArray(nodes), 'Aggregator must return a node array');
      const node = nodes.find(item => item.ip === origin.hostname);
      advertised = node?.details?.devices?.find(item => item.name === 'BoardLed');
      if (advertised) break;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(advertised, 'Live Aggregator must discover BoardLed within one minute');
    assert.equal(advertised.visibility, 'public');
    assert.equal(advertised.driver, 'ws2812');
    assert.equal(advertised.pin, 48);
    assert.equal(advertised.endpoint, '/api/device/BoardLed');
    assert.deepEqual(advertised.states, device.states);
    assert.deepEqual(advertised.capabilities, device.capabilities);
  }
});
