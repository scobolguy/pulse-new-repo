import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const nativeRoot = path.join(workspaceRoot, 'pmachines', 'native');
const scratchParent = path.join(workspaceRoot, 'testing', 'pmachines');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: workspaceRoot, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0,
    `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
}

function signMap(kind, id, pcode, fields = {}) {
  const { pcodeText: ignored, ...mapFields } = fields;
  return attachPcodeSignature({
    hostBindingsVersion: 1,
    targets: ['native'],
    requiredHostCapabilities: [],
    runtimeUnit: { kind, id, ...(kind === 'daemon' ? { refreshMs: 10 } : {}) },
    serviceEndpoints: [],
    ...mapFields,
  }, pcode);
}

async function writeMap(directory, pcode, map, name = 'program') {
  const entry = `${name}.pcode`;
  const mapName = `${name}.map.json`;
  await writeFile(path.join(directory, entry), pcode, 'utf8');
  await writeFile(path.join(directory, mapName), `${JSON.stringify(map)}\n`, 'utf8');
  return {
    entry,
    mapName,
    sha256: createHash('sha256').update(pcode, 'utf8').digest('hex'),
  };
}

async function writeBundle(ffsRoot, id, kind, pcode, programMap) {
  const storagePath = `/pmachine/programs/${id}/versions/v1`;
  const directory = path.join(ffsRoot, 'programs', id, 'versions', 'v1');
  await mkdir(directory, { recursive: true });
  const artifact = await writeMap(directory, pcode, programMap);
  const manifest = {
    type: kind,
    storagePath,
    entry: artifact.entry,
    programMap: artifact.mapName,
    sha256: artifact.sha256,
  };
  await writeFile(path.join(ffsRoot, 'programs', id, 'manifest.json'),
    `${JSON.stringify(manifest)}\n`, 'utf8');
  return `/pmachine/programs/${id}/manifest.json`;
}

async function launchNative(executable, pcodePath, mapPath, ffsRoot, signalRoot) {
  const child = spawn(executable, [
    '--pcode', pcodePath, '--program-map', mapPath, '--port', '0',
    '--ffs-root', ffsRoot, '--writable-storage-root', `mark=${signalRoot}`,
  ], {
    cwd: workspaceRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const match = /LISTENING[^\r\n]* port=(\d+)/.exec(stdout);
    if (match) return { child, origin: `http://127.0.0.1:${match[1]}`, exited };
    if (child.exitCode !== null) return { child, exited, startupError: `${stdout}\n${stderr}` };
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  child.kill();
  throw new Error(`Native host startup timed out:\n${stdout}\n${stderr}`);
}

async function stopNative(host) {
  if (!host?.child || host.child.exitCode !== null) return;
  host.child.kill();
  await Promise.race([host.exited, new Promise(resolve => setTimeout(resolve, 3000))]);
}

async function request(origin, route, method = 'GET', body) {
  const response = await fetch(`${origin}${route}`, {
    method,
    ...(body === undefined ? {} : {
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    signal: AbortSignal.timeout(5000),
  });
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) : null };
}

const basePcode = [
  'PUSH_STR "\\"base-ran\\""',
  'STORE_NAME response',
  'MAP_RETURN response',
  'HALT',
].join('\n');

const servicePcode = [
  'JMP MAIN',
  'SCHEDULED_HANDLER:',
  'PUSH_STR "\\"scheduled-service-ran\\""',
  'STORE_NAME response',
  'MAP_RETURN response',
  'HALT',
  'MAIN:',
  'JMP SCHEDULED_HANDLER',
].join('\n');

const transientPcode = [
  'PUSH_STR "mark"',
  'PUSH_STR "transient.txt"',
  'PUSH_STR "transient-ran"',
  'CALL_EXT host.fs_write_text 3',
  'STORE_NAME result',
  'HALT',
].join('\n');

const daemonPcode = [
  'CALL_EXT host.date_now 0',
  'STORE_NAME now',
  'PUSH_STR "mark"',
  'PUSH_STR "daemon.txt"',
  'LOAD_NAME now',
  'CALL_EXT host.fs_write_text 3',
  'STORE_NAME result',
  'HALT',
].join('\n');

test('native scheduler executes the embedded Kotlin policy and real bundle programs', async t => {
  const scratch = await mkdtemp(path.join(scratchParent, `.native-slot-scheduler-${process.pid}-`));
  let host;
  try {
    const buildRoot = path.join(scratch, 'build');
    run('cmake', ['-S', nativeRoot, '-B', buildRoot, '-G', 'Ninja']);
    run('cmake', ['--build', buildRoot, '--target', 'pulse_native_service_host']);
    const executable = path.join(buildRoot, process.platform === 'win32'
      ? 'pulse_native_service_host.exe' : 'pulse_native_service_host');
    const ffsRoot = path.join(scratch, 'pmachine');
    const signalRoot = path.join(scratch, 'signals');
    await mkdir(ffsRoot, { recursive: true });
    await mkdir(signalRoot, { recursive: true });
    const baseDir = path.join(scratch, 'base');
    await mkdir(baseDir);
    const baseMap = signMap('service', 'native-slot-test');
    const baseArtifacts = await writeMap(baseDir, basePcode, baseMap, 'base');
    const basePcodePath = path.join(baseDir, baseArtifacts.entry);
    const baseMapPath = path.join(baseDir, baseArtifacts.mapName);

    const nativeHost = async () => launchNative(
      executable, basePcodePath, baseMapPath, ffsRoot, signalRoot);
    host = await nativeHost();
    assert.equal(host.startupError, undefined, host.startupError);

    assert.equal((await request(host.origin, '/api/pmachine/scheduler')).status, 200);
    assert.equal((await request(host.origin, '/api/pmachine/scheduler/load', 'POST', {
      manifestPath: '/pmachine/programs/missing/manifest.json',
    })).status, 404);
    assert.equal((await request(host.origin, '/api/pmachine/scheduler/load', 'POST', {
      manifestPath: '/pmachine/programs/missing/manifest.json', slot: 0,
    })).status, 403);
    assert.equal((await request(host.origin, '/api/pmachine/scheduler/load', 'POST', '{bad-json')).status, 400);

    const serviceMap = signMap('service', 'scheduled-service', servicePcode, {
      serviceEndpoints: [{ verb: 'GET', path: '/scheduled', entryLabel: 'SCHEDULED_HANDLER' }],
    });
    const serviceManifest = await writeBundle(ffsRoot, 'scheduled-service', 'service', servicePcode, serviceMap);
    const loaded = await request(host.origin, '/api/pmachine/scheduler/load', 'POST', {
      manifestPath: serviceManifest,
    });
    assert.equal(loaded.status, 201, JSON.stringify(loaded.body));
    assert.equal(loaded.body.state, 'running');
    assert.equal((await request(host.origin, '/scheduled')).body, 'scheduled-service-ran');
    const statePath = path.join(ffsRoot, '.pmachine-scheduler', 'slots.json');
    const durable = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(durable.version, 1);
    assert.equal(durable.slots.length, 1);
    assert.equal(Object.hasOwn(durable.slots[0], 'state'), false);

    await stopNative(host);
    host = await nativeHost();
    assert.equal(host.startupError, undefined, host.startupError);
    const restored = await request(host.origin, '/api/pmachine/scheduler');
    assert.equal(restored.status, 200);
    assert.equal(restored.body.slots[1].state, 'running');
    assert.equal((await request(host.origin, '/scheduled')).body, 'scheduled-service-ran');

    const transientMap = signMap('program', 'scheduled-transient', transientPcode, {
      requiredHostCapabilities: ['filesystem.read', 'filesystem.write'],
    });
    const transientManifest = await writeBundle(
      ffsRoot, 'scheduled-transient', 'transient', transientPcode, transientMap);
    const transient = await request(host.origin, '/api/pmachine/scheduler/load', 'POST', {
      manifestPath: transientManifest,
    });
    assert.equal(transient.status, 201, JSON.stringify(transient.body));
    assert.equal(transient.body.state, 'completed');
    assert.equal(await readFile(path.join(signalRoot, 'transient.txt'), 'utf8'), 'transient-ran');
    assert.equal(JSON.parse(await readFile(statePath, 'utf8')).slots.length, 1);

    const daemonMap = signMap('daemon', 'scheduled-daemon', daemonPcode, {
      requiredHostCapabilities: ['filesystem.read', 'filesystem.write'],
    });
    const daemonManifest = await writeBundle(ffsRoot, 'scheduled-daemon', 'daemon', daemonPcode, daemonMap);
    const daemon = await request(host.origin, '/api/pmachine/scheduler/load', 'POST', {
      manifestPath: daemonManifest,
    });
    assert.equal(daemon.status, 201, JSON.stringify(daemon.body));
    const daemonPath = path.join(signalRoot, 'daemon.txt');
    const firstTick = await readFile(daemonPath, 'utf8');
    const deadline = Date.now() + 2000;
    let polled = firstTick;
    while (Date.now() < deadline && polled === firstTick) {
      await new Promise(resolve => setTimeout(resolve, 25));
      polled = await readFile(daemonPath, 'utf8');
    }
    assert.notEqual(polled, firstTick, 'native select loop should execute daemon polling');

    const status = await request(host.origin, '/api/pmachine/scheduler');
    assert.equal(status.body.slots[0].slot, 0);
    assert.equal(status.body.slots[0].protected, true);
    assert.equal(status.body.slots[1].state, 'running');
    const unload = await request(host.origin, '/api/pmachine/scheduler/unload', 'POST', { slot: 1 });
    assert.equal(unload.status, 200, JSON.stringify(unload.body));
    assert.equal((await request(host.origin, '/scheduled')).body, 'base-ran');

    await stopNative(host);
    await writeFile(statePath, '{invalid JSON', 'utf8');
    host = await nativeHost();
    assert.notEqual(host.startupError, undefined);
    assert.match(host.startupError, /restore failed/i);
    assert.equal(await readFile(statePath, 'utf8'), '{invalid JSON');
    t.diagnostic('Malformed durable state prevents LISTENING and is not reset as absent.');

    const isolatedDir = path.join(scratch, 'isolated');
    await mkdir(isolatedDir);
    const isolatedPcode = 'CALL_EXT host.scheduler_operation 0\nHALT';
    const isolatedMap = signMap('service', 'attempt-internal-scheduler-binding', isolatedPcode);
    const isolatedArtifact = await writeMap(isolatedDir, isolatedPcode, isolatedMap);
    const isolatedHost = await launchNative(executable,
      path.join(isolatedDir, isolatedArtifact.entry), path.join(isolatedDir, isolatedArtifact.mapName),
      ffsRoot, signalRoot);
    assert.notEqual(isolatedHost.startupError, undefined);
    assert.match(isolatedHost.startupError, /internal scheduler bindings/i);
    t.diagnostic('User service rejected during program-map validation.');
  } finally {
    await stopNative(host);
    await rm(scratch, { recursive: true, force: true });
  }
});
