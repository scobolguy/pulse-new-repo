import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';

const logger = { warn() {}, error() {}, log() {} };
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const compileService = () => compilePascalishProgramWithAntlr(
  `service 'slot-test'; get '/run'; begin return '{"ok":true}' end end.`,
  { hostServices: true },
);
const compileDaemon = () => compilePascalishProgramWithAntlr(
  `daemon 'slot-tick' every 10 ms; begin end.`,
  { hostServices: true },
);

async function serverFor(t, options = {}) {
  const { expectRecoveryFailure = false, ...serverOptions } = options;
  const server = createJsPmachineNodeServer({
    name: 'slot-test-node',
    port: 0,
    udpAnnouncePort: 0,
    logger,
    ...serverOptions,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => {
    if (!server.listening) return resolve();
    server.close(resolve);
  }));
  const target = `http://127.0.0.1:${server.address().port}`;
  const ready = await fetch(`${target}/api/pmachine/scheduler`);
  assert.equal(ready.status, expectRecoveryFailure ? 503 : 200, await ready.text());
  return { server, target };
}

async function upload(target, file, body) {
  const response = await fetch(`${target}/ffs/upload`, {
    method: 'POST',
    body: new URLSearchParams({ file, body }),
  });
  assert.equal(response.status, 200, await response.text());
}

async function serviceBundle(target, name, options = {}) {
  const compiled = options.compiled || compileService();
  const pcode = compiled.pcodeText;
  const map = attachPcodeSignature(compiled.programMap, pcode);
  return uploadBundle(target, name, {
    kind: options.kind || 'service',
    entry: options.entry || 'service.pcode',
    programMap: options.programMap || 'service.map.json',
    pcode,
    map,
    sha256: options.sha256,
    extra: options.extra,
  });
}

async function uploadBundle(target, name, {
  kind, entry, programMap, pcode, map, sha256, extra = {},
}) {
  const storagePath = `/pmachine/programs/${name}/versions/v1`;
  const manifestPath = `/pmachine/programs/${name}/manifest.json`;
  await upload(target, `${storagePath}/${entry}`, pcode);
  await upload(target, `${storagePath}/${programMap}`, JSON.stringify(map));
  const manifest = {
    type: kind,
    storagePath,
    entry,
    programMap,
    sha256: sha256 ?? createHash('sha256').update(pcode, 'utf8').digest('hex'),
    ...extra,
  };
  await upload(target, manifestPath, JSON.stringify(manifest));
  return manifestPath;
}

async function load(target, manifestPath, slot) {
  return fetch(`${target}/api/pmachine/scheduler/load`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ manifestPath, ...(slot === undefined ? {} : { slot }) }),
  });
}

async function unload(target, slot) {
  return fetch(`${target}/api/pmachine/scheduler/unload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slot }),
  });
}

async function temporaryRoot(t) {
  const root = await fs.mkdtemp(path.join(testDirectory, 'javascript-slot-ffs-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('HTTP scheduler runs signed service artifacts in slot 16 and protects managed ownership', async t => {
  const { target } = await serverFor(t);
  const manifestPath = await serviceBundle(target, 'slot-service');
  const response = await load(target, manifestPath, 16);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    version: 1, slot: 16, manifestPath, kind: 'service', state: 'running',
  });

  const routed = await fetch(`${target}/run`);
  assert.equal(routed.status, 200);
  assert.deepEqual(await routed.json(), { ok: true });
  const status = await fetch(`${target}/pmachine/service_host/status?collectorId=pmachine-slot-16`);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).running, true);

  assert.equal((await load(target, manifestPath, 1)).status, 409);
  assert.equal((await load(target, manifestPath, 16)).status, 409);
  assert.equal((await load(target, manifestPath, 0)).status, 403);
  assert.equal((await unload(target, 0)).status, 403);
  const bypass = await fetch(`${target}/pmachine/service_host/stop`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ collectorId: 'pmachine-slot-16' }),
  });
  assert.equal(bypass.status, 403);
  assert.equal((await unload(target, 16)).status, 200);
});

test('daemon bundle starts timed P-code, transient execution releases its slot', async t => {
  const { target } = await serverFor(t);
  const daemonPath = await serviceBundle(target, 'slot-daemon', {
    kind: 'daemon', entry: 'daemon.pcode', programMap: 'daemon.map.json', compiled: compileDaemon(),
  });
  const loaded = await load(target, daemonPath, 7);
  assert.equal(loaded.status, 201);
  let diagnostics;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${target}/pmachine/service_host/status?collectorId=pmachine-slot-7`);
    diagnostics = (await response.json()).daemonDiagnostics?.[0];
    if (diagnostics?.timerRuns >= 2) break;
    await delay(20);
  }
  assert.ok(diagnostics?.timerRuns >= 2, JSON.stringify(diagnostics));
  assert.equal((await unload(target, 7)).status, 200);

  const pcode = 'HALT\n';
  const programMap = attachPcodeSignature({}, pcode);
  const transientPath = await uploadBundle(target, 'slot-transient', {
    kind: 'transient', entry: 'once.pcode', programMap: 'once.map.json', pcode, map: programMap,
  });
  const transient = await load(target, transientPath, 7);
  assert.equal(transient.status, 201);
  assert.equal((await transient.json()).state, 'completed');
  const status = await (await fetch(`${target}/api/pmachine/scheduler`)).json();
  assert.equal(status.slots.find(slot => slot.slot === 7).state, 'empty');
});

test('durable FFS restores a running service after node restart', async t => {
  const root = await temporaryRoot(t);
  const first = await serverFor(t, { ffsRoot: root });
  const manifestPath = await serviceBundle(first.target, 'durable-service');
  assert.equal((await load(first.target, manifestPath, 4)).status, 201);
  const saved = JSON.parse(await fs.readFile(path.join(root, '.pmachine-scheduler', 'slots.json'), 'utf8'));
  assert.equal(saved.slots[0].slot, 4);
  assert.equal(Object.hasOwn(saved.slots[0], 'state'), false);

  await new Promise(resolve => first.server.close(resolve));
  const rebooted = await serverFor(t, { ffsRoot: root });
  const status = await (await fetch(`${rebooted.target}/api/pmachine/scheduler`)).json();
  assert.equal(status.slots.find(slot => slot.slot === 4).state, 'running');
  const response = await fetch(`${rebooted.target}/run`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('invalid hashes, signatures and bundle traversal are rejected before activation', async t => {
  const { target } = await serverFor(t);
  const compiled = compileService();
  const signedMap = attachPcodeSignature(compiled.programMap, compiled.pcodeText);
  const badHash = await serviceBundle(target, 'bad-hash', { sha256: '0'.repeat(64) });
  assert.equal((await load(target, badHash, 1)).status, 400);

  const badSignatureMap = { ...signedMap, signing: { ...signedMap.signing, signature: '0'.repeat(64) } };
  const badSignature = await uploadBundle(target, 'bad-signature', {
    kind: 'service', entry: 'service.pcode', programMap: 'service.map.json',
    pcode: compiled.pcodeText, map: badSignatureMap,
  });
  assert.equal((await load(target, badSignature, 2)).status, 400);

  const traversal = await uploadBundle(target, 'traversal', {
    kind: 'service', entry: 'service.pcode', programMap: 'service.map.json',
    pcode: compiled.pcodeText, map: signedMap,
  });
  await upload(target, traversal, JSON.stringify({
    type: 'service',
    storagePath: '/pmachine/programs/traversal/versions/v1',
    entry: '../service.pcode',
    programMap: 'service.map.json',
    sha256: createHash('sha256').update(compiled.pcodeText, 'utf8').digest('hex'),
  }));
  assert.equal((await load(target, traversal, 3)).status, 400);
  const status = await (await fetch(`${target}/api/pmachine/scheduler`)).json();
  assert.ok(status.slots.slice(1).every(slot => slot.state === 'empty'));
});

test('scheduler request and manifest errors retain HTTP 400 and 404 semantics', async t => {
  const { target } = await serverFor(t);
  const malformed = await fetch(`${target}/api/pmachine/scheduler/load`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"manifestPath":',
  });
  assert.equal(malformed.status, 400);
  const invalidSlot = await load(target, '/pmachine/programs/missing/manifest.json', '2');
  assert.equal(invalidSlot.status, 400);
  const missing = await load(target, '/pmachine/programs/missing/manifest.json', 2);
  assert.equal(missing.status, 404);
});

test('malformed durable scheduler state blocks APIs and persistence failure rolls back staging', async t => {
  const invalidRoot = await temporaryRoot(t);
  await fs.mkdir(path.join(invalidRoot, '.pmachine-scheduler'));
  await fs.writeFile(path.join(invalidRoot, '.pmachine-scheduler', 'slots.json'), '{"version":2,"slots":[]}');
  const invalid = await serverFor(t, { ffsRoot: invalidRoot, expectRecoveryFailure: true });
  const unavailable = await fetch(`${invalid.target}/api/pmachine/scheduler`);
  assert.equal(unavailable.status, 503);
  assert.match((await unavailable.json()).error, /recovery failed/i);

  const root = await temporaryRoot(t);
  const { target } = await serverFor(t, { ffsRoot: root });
  const manifestPath = await serviceBundle(target, 'persistence-failure');
  await fs.writeFile(path.join(root, '.pmachine-scheduler'), 'not a directory');
  const failed = await load(target, manifestPath, 5);
  assert.equal(failed.status, 503, await failed.text());
  const status = await (await fetch(`${target}/api/pmachine/scheduler`)).json();
  assert.equal(status.slots.find(slot => slot.slot === 5).state, 'empty');
});
