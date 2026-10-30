import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { compileAssemblerishToPcode } from '../../../../languages/assemblerish/src/compile-assemblerish-to-pcode.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';

const origin = process.env.PULSE_ESP32_TEST_URL;
if (!origin) throw new Error('Set PULSE_ESP32_TEST_URL; this test temporarily installs a pin-free handler and hosted service');

async function request(path, { method = 'GET', json, form, status = 200 } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(new URL(path, origin), {
      method,
      ...(json ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(json) } : {}),
      ...(form ? { body: new URLSearchParams(form) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    if (method === 'GET' && status === 200 && response.status === 503 && /busy/i.test(text) && attempt < 3) {
      await delay(25 * (attempt + 1));
      continue;
    }
    assert.equal(response.status, status, `${method} ${path}: ${text}`);
    return text;
  }
  throw new Error(`${method} ${path}: ingress remained busy`);
}

assert.equal(JSON.parse(await request('/pmachine/service_host/status')).running, false,
  'Stop existing hosted services explicitly before this test');
assert.equal(JSON.parse(await request('/pmachine/assemblerish')).installed, false,
  'Remove an existing assemblerish handler explicitly before this test');

const prefix = `/asm${Date.now().toString(36)}`;
const files = [];
let hosted = false, installed = false;
const path = '/api/assemblerish-test/event';
const service = compilePascalishProgramWithAntlr(`service 'assemblerish-events';
post '${path}'; begin
  host.table_put('nodes', 'hal', host.event_body(), 10000);
  return '{}'
end
get '/api/assemblerish-test/last'; begin return host.table_get('nodes', 'hal') end
end.`, { hostServices: true });
service.programMap.hostTables = [{ name: 'nodes', capacity: 1 }];
const daemon = compilePascalishProgramWithAntlr(
  "daemon 'assemblerish-maintenance' every 1 second; begin host.table_expire('nodes') end.",
  { hostServices: true });
const handler = compileAssemblerishToPcode(`HEADER HANDLER hardware_smoke
TARGET "${path}"
TRIGGER TIMER 100
SET value 0
NOT value
EVENT tick 1 value 9
END`);
assert.deepEqual(handler.programMap.assemblerish.devices, []);
const body = artifact => ({
  pcode: artifact.pcodeText,
  programMapText: JSON.stringify(attachPcodeSignature(artifact.programMap, artifact.pcodeText)),
  allowedPins: [],
});

try {
  for (const [name, artifact] of [['service', service], ['daemon', daemon]]) {
    for (const [suffix, content] of [
      ['pcode', artifact.pcodeText],
      ['map.json', JSON.stringify(attachPcodeSignature(compactServiceHostProgramMap(artifact.programMap), artifact.pcodeText))],
    ]) {
      const file = `${prefix}-${name}.${suffix}`;
      await request('/ffs/upload', { method: 'POST', form: { file, body: content } });
      files.push(file);
    }
  }
  await request('/pmachine/service_host/install', { method: 'POST', form: {
    serviceFile: `${prefix}-service.pcode`, serviceMap: `${prefix}-service.map.json`,
    daemons: JSON.stringify([{ file: `${prefix}-daemon.pcode`, map: `${prefix}-daemon.map.json`, udpPort: 0 }]),
    collectorId: 'assemblerish-hardware-smoke',
  } });
  hosted = true;
  const unsigned = { ...body(handler), programMapText: JSON.stringify(handler.programMap) };
  await request('/pmachine/assemblerish', { method: 'POST', json: unsigned, status: 403 });
  await request('/pmachine/assemblerish', {
    method: 'POST', json: body({ ...handler, pcodeText: `HALT\n${handler.pcodeText}` }), status: 409,
  });
  const missingGrant = {
    ...handler,
    programMap: { ...handler.programMap, assemblerish: {
      ...handler.programMap.assemblerish,
      devices: [{ name: 'input', kind: 'input', pin: 4, pull: 'pullup' }],
    } },
  };
  await request('/pmachine/assemblerish', { method: 'POST', json: body(missingGrant), status: 409 });
  await request('/pmachine/assemblerish', { method: 'POST', json: body(handler), status: 201 });
  installed = true;
  const deadline = Date.now() + 10000;
  let state;
  while (Date.now() < deadline) {
    state = JSON.parse(await request('/pmachine/assemblerish'));
    assert.equal(state.failures, 0, JSON.stringify(state));
    if (state.delivered >= 20) break;
    await delay(100);
  }
  assert.ok(state.delivered >= 20, `Expected repeated delivery beyond ingress queue capacity: ${JSON.stringify(state)}`);
  await request('/pmachine/assemblerish', { method: 'DELETE' });
  installed = false;
  const event = JSON.parse(await request('/api/assemblerish-test/last'));
  assert.deepEqual(event, { handler: 'hardware_smoke', event: 'tick', valid: 1, value: 1, auxiliary: 9 });
  console.log(JSON.stringify({ ok: true, physicalPinsUsed: [], state, event }));
} finally {
  if (installed) await request('/pmachine/assemblerish', { method: 'DELETE' });
  if (hosted) await request('/pmachine/service_host/stop', { method: 'POST', form: {} });
  for (const file of files) await request('/ffs/delete', { method: 'POST', form: { file } });
}
