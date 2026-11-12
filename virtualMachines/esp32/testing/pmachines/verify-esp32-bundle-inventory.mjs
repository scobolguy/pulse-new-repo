import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { requestEsp32 } from './esp32-http.mjs';

const [origin, ...args] = process.argv.slice(2);
if (!origin || (args.length && (args.length !== 2 || args[0] !== '--cycle'
    || !/^[A-Za-z0-9_.-]{1,80}$/.test(args[1]) || args[1] === '.' || args[1] === '..'))) {
  throw new Error('Usage: node verify-esp32-bundle-inventory.mjs <origin> [--cycle <bundle-name>]');
}
async function request(path, options = {}) {
  const response = await requestEsp32(new URL(path, origin), { ...options, timeoutMs: 30000 });
  return { status: response.status, text: await response.text() };
}
async function inventory() {
  for (let attempt = 0; attempt < 20; ++attempt) {
    const result = await request('/api/pmachine/programs');
    if (result.status === 503 && result.text === 'Service host busy') {
      await sleep(250);
      continue;
    }
    assert.equal(result.status, 200, result.text);
    const value = JSON.parse(result.text);
    assert.ok(Array.isArray(value.programs));
    for (const program of value.programs) {
      assert.equal(typeof program.name, 'string');
      assert.equal(typeof program.running, 'boolean');
    }
    assert.equal(new Set(value.programs.map(item => item.name)).size, value.programs.length);
    return value.programs;
  }
  throw new Error('Service host remained busy');
}
const programs = await inventory();
for (const program of programs) {
  const result = await request(`/api/pmachine/programs/${encodeURIComponent(program.name)}`);
  assert.equal(result.status, 200, result.text);
  const manifest = JSON.parse(result.text);
  assert.equal(manifest.name, program.name);
  assert.equal(manifest.version, program.version);
}
const missing = await request(`/api/pmachine/programs/missing-${randomBytes(8).toString('hex')}`);
assert.equal(missing.status, 404, missing.text);
const slotsResponse = await request('/pmachine/process-slots');
assert.equal(slotsResponse.status, 200, slotsResponse.text);
const slots = JSON.parse(slotsResponse.text).slots;
const hostResponse = await request('/pmachine/service_host/status');
assert.equal(hostResponse.status, 200, hostResponse.text);
const host = JSON.parse(hostResponse.text);
if (host.busy) throw new Error('Service host busy while checking live services');
for (const service of host.services ?? []) {
  if (!service.collectorId.startsWith('bundle-')) continue;
  const name = service.collectorId.slice('bundle-'.length);
  assert.equal(programs.find(item => item.name === name)?.running, true, `${name} must be running`);
  assert.ok(slots.some(slot => slot.key === service.collectorId), `${name} has no assigned slot`);
}
console.log(`PASS: ${programs.length} installed manifests, individual lookups, and live hosted services`);

if (args.length) {
  const name = args[1];
  assert.equal(programs.find(item => item.name === name)?.running, true, `${name} is not running`);
  assert.ok((host.services ?? []).some(item => item.collectorId === `bundle-${name}`),
    `${name} is not a hosted service`);
  const stopped = await request(`/pmachine/service_host/stop?collectorId=${encodeURIComponent(`bundle-${name}`)}`,
    { method: 'POST' });
  assert.equal(stopped.status, 200, stopped.text);
  let probeError;
  try {
    assert.equal((await inventory()).find(item => item.name === name)?.running, false);
  } catch (error) {
    probeError = error;
  }
  let restart;
  let restartError;
  for (let attempt = 0; attempt < 20; ++attempt) {
    try {
      restart = await request(`/api/pmachine/programs/${encodeURIComponent(name)}/start`, { method: 'POST' });
      if (restart.status === 201 || !/busy/i.test(restart.text)) break;
    } catch (error) {
      restartError = error;
    }
    await sleep(250);
  }
  if (restart?.status !== 201) {
    throw new AggregateError([probeError, restartError].filter(Boolean),
      `Failed to restart ${name}: ${restart?.status ?? 'request failed'} ${restart?.text ?? ''}`);
  }
  if (probeError) throw probeError;
  assert.equal((await inventory()).find(item => item.name === name)?.running, true);
  console.log(`PASS: ${name} reports stopped and running across restart`);
}
