import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { compileKotlinToPcode } from '../../../../languages/kotlin/src/compile-kotlin-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../pmachines/javascript/index.mjs';
import { SERVICE_HOST_BINDINGS } from '../../pmachines/shared/contracts/service-host-bindings.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const pcodePath = path.join(root, 'virtualMachines', 'esp32', 'data', 'boot', 'pmachine-boot');
const sourcePath = path.join(root, 'virtualMachines', 'esp32', 'src', 'boot', 'boot-supervisor.kt');

const artifactPromise = (async () => {
  const [source, pcode] = await Promise.all([
    readFile(sourcePath, 'utf8'),
    readFile(pcodePath, 'utf8')
  ]);
  const freshlyCompiled = compileKotlinToPcode(source, {
    fileName: 'boot-supervisor.kt',
    target: 'esp32'
  });
  assert.equal(pcode, freshlyCompiled.pcodeText, 'shipped P-code must match current Kotlin source');
  const mappingsById = new Map();
  mappingsById.__globals = freshlyCompiled.programMap.globals;
  mappingsById.__proceduresByLabel = freshlyCompiled.programMap.procedures;
  return {
    instructions: parsePcode(pcode),
    opcodeMap: await loadOpcodeMap(),
    mappingsById
  };
})();

async function loadArtifact() {
  return artifactPromise;
}

function createHardware(options = {}) {
  const state = new Map();
  const calls = [];
  const logs = [];
  let mounted = false;
  let apActive = false;
  const ffsResults = [...(options.ffsResults || [])];
  const hardware = {
    now: options.now || 0,
    profileCount: options.profileCount ?? 0,
    connected: options.connected ?? false,
    remoteConfigured: options.remoteConfigured ?? false,
    remoteAvailable: options.remoteAvailable ?? false,
    profileResult: options.profileResult ?? 1,
    apStartResults: [...(options.apStartResults || [])],
    ffsResults,
    calls,
    logs,
    state,
    get apActive() { return apActive; },
    get mounted() { return mounted; },
    callHost(name, args) {
      switch (name) {
        case 'host.boot_millis': return hardware.now;
        case 'host.boot_state_get': return state.get(args[0]) ?? 0;
        case 'host.boot_state_set':
          state.set(args[0], args[1]);
          return 1;
        case 'host.boot_wifi_connected': return hardware.connected ? 1 : 0;
        case 'host.boot_profile_count': return hardware.profileCount;
        case 'host.boot_profile_start':
          calls.push({ name: 'profile', index: args[0] });
          return hardware.profileResult;
        case 'host.boot_ap_start': {
          calls.push({ name: 'ap-start' });
          const result = hardware.apStartResults.length ? hardware.apStartResults.shift() : 1;
          if (result === 1) apActive = true;
          return result;
        }
        case 'host.boot_ap_stop':
          calls.push({ name: 'ap-stop' });
          apActive = false;
          return 1;
        case 'host.boot_ap_active': return apActive ? 1 : 0;
        case 'host.boot_ffs_ready': return hardware.connected && mounted ? 1 : 0;
        case 'host.boot_ffs_start': {
          calls.push({ name: 'ffs-start', backend: args[0] });
          const result = ffsResults.length ? ffsResults.shift() : 1;
          if (result === 1) mounted = true;
          return result;
        }
        case 'host.boot_remote_configured': return hardware.remoteConfigured ? 1 : 0;
        case 'host.boot_remote_available': return hardware.remoteAvailable ? 1 : 0;
        case 'host.boot_log':
          logs.push(args[0]);
          return 1;
        case 'host.raise_error':
          throw new Error(args[0]);
        default:
          throw new Error(`Unexpected boot host call: ${name}`);
      }
    }
  };
  return hardware;
}

async function tick(artifact, hardware) {
  const result = await executeProgram({
    ...artifact,
    inputQueue: 'boot.supervisor',
    sourceMessage: '',
    runtimeContext: { callHost: hardware.callHost, maxSteps: 100000, maxCallDepth: 64 }
  });
  assert.equal(result.error ?? null, null);
  return result;
}

test('shipped boot image is a direct Kotlin compile with only boot host primitives', async () => {
  const artifact = await loadArtifact();
  const pcode = await readFile(pcodePath, 'utf8');
  const hostCalls = [...pcode.matchAll(/^CALL_EXT (host\.[^ ]+)/gm)].map(match => match[1]);
  assert.ok(hostCalls.length > 0);
  assert.ok(hostCalls.every(name => name.startsWith('host.boot_') || name === 'host.raise_error'));
  assert.doesNotMatch(pcode, /connectWiFi|autoProvision|pmachine_boot_fixed|pcode-library-linker/i);
  const bootBindings = [...new Set(hostCalls.filter(name => name.startsWith('host.boot_')))];
  assert.ok(bootBindings.length > 0);
  assert.ok(bootBindings.every(name => SERVICE_HOST_BINDINGS[name]?.capability === 'platform.boot'));
});

test('offline boot with no profiles starts provisioning without starting FFS', async () => {
  const artifact = await loadArtifact();
  const hardware = createHardware();
  await tick(artifact, hardware);
  assert.equal(hardware.apActive, true);
  assert.equal(hardware.state.get(31), 0);
  await tick(artifact, hardware);
  assert.equal(hardware.state.get(31), 1);
  assert.deepEqual(hardware.calls.map(call => call.name), ['ap-start']);
});

test('failed offline provisioning leaves boot health clear until AP start succeeds', async () => {
  const artifact = await loadArtifact();
  const hardware = createHardware({ apStartResults: [0, 1] });
  await tick(artifact, hardware);
  assert.equal(hardware.state.get(31), 0);
  hardware.now = 5000;
  await tick(artifact, hardware);
  assert.equal(hardware.state.get(31), 0);
  await tick(artifact, hardware);
  assert.equal(hardware.state.get(31), 1);
  assert.equal(hardware.apActive, true);
});

test('bad profile sweep reaches AP fallback and retries profiles while AP remains active', async () => {
  const artifact = await loadArtifact();
  const hardware = createHardware({ profileCount: 2 });
  await tick(artifact, hardware);
  assert.equal(hardware.state.get(31), 0);
  assert.deepEqual(hardware.calls.filter(call => call.name === 'profile').map(call => call.index), [0]);

  hardware.now = 15000;
  await tick(artifact, hardware);
  await tick(artifact, hardware);
  hardware.now = 30000;
  await tick(artifact, hardware);
  assert.equal(hardware.apActive, true);
  assert.equal(hardware.state.get(31), 0);
  await tick(artifact, hardware);
  assert.equal(hardware.state.get(31), 1);
  assert.equal(hardware.state.get(31), 1);
  assert.deepEqual(hardware.calls.filter(call => call.name === 'profile').map(call => call.index), [0, 1]);
  assert.equal(hardware.calls.filter(call => call.name === 'ap-start').length, 1);

  hardware.now = 35000;
  await tick(artifact, hardware);
  assert.deepEqual(hardware.calls.filter(call => call.name === 'profile').map(call => call.index), [0, 1, 0]);
  assert.equal(hardware.calls.filter(call => call.name === 'ap-start').length, 1);
});

test('connection starts LittleFS after SD failure and stops AP only after its reply grace', async () => {
  const artifact = await loadArtifact();
  const hardware = createHardware({ ffsResults: [0, 1] });
  await tick(artifact, hardware);
  hardware.now = 1000;
  hardware.connected = true;
  await tick(artifact, hardware);
  assert.deepEqual(hardware.calls.filter(call => call.name === 'ffs-start').map(call => call.backend), [0, 1]);
  assert.equal(hardware.apActive, true);

  hardware.now = 3999;
  await tick(artifact, hardware);
  assert.equal(hardware.apActive, true);
  hardware.now = 4000;
  await tick(artifact, hardware);
  assert.equal(hardware.apActive, false);
});

test('explicit remote FFS retries remotely without trying local backends', async () => {
  const artifact = await loadArtifact();
  const hardware = createHardware({ connected: true, remoteConfigured: true, ffsResults: [0, 0] });
  await tick(artifact, hardware);
  hardware.now = 1999;
  await tick(artifact, hardware);
  assert.deepEqual(hardware.calls.filter(call => call.name === 'ffs-start').map(call => call.backend), [2]);
  hardware.now = 2000;
  await tick(artifact, hardware);
  assert.deepEqual(hardware.calls.filter(call => call.name === 'ffs-start').map(call => call.backend), [2, 2]);
});

test('failed local FFS startup retries with backoff and may then use available remote', async () => {
  const artifact = await loadArtifact();
  const hardware = createHardware({
    connected: true,
    remoteAvailable: true,
    ffsResults: [0, 0, 0, 0, 1]
  });
  await tick(artifact, hardware);
  assert.deepEqual(hardware.calls.filter(call => call.name === 'ffs-start').map(call => call.backend), [0, 1, 2]);

  const retrying = createHardware({ connected: true, remoteAvailable: false, ffsResults: [0, 0, 0, 0] });
  await tick(artifact, retrying);
  retrying.now = 1999;
  await tick(artifact, retrying);
  assert.deepEqual(retrying.calls.filter(call => call.name === 'ffs-start').map(call => call.backend), [0, 1]);
  retrying.now = 2000;
  await tick(artifact, retrying);
  assert.deepEqual(retrying.calls.filter(call => call.name === 'ffs-start').map(call => call.backend), [0, 1, 0, 1]);
});

test('network loss keeps saved profiles, suspends FFS starts, and retries credentials', async () => {
  const artifact = await loadArtifact();
  const hardware = createHardware({ profileCount: 1, connected: true });
  await tick(artifact, hardware);
  assert.equal(hardware.calls.filter(call => call.name === 'ffs-start').length, 1);

  hardware.connected = false;
  hardware.now = 1000;
  await tick(artifact, hardware);
  assert.equal(hardware.profileCount, 1);
  assert.equal(hardware.calls.filter(call => call.name === 'ffs-start').length, 1);
  assert.equal(hardware.calls.filter(call => call.name === 'profile').length, 1);
  assert.equal(hardware.state.get(31), 1);
});

test('profile connection deadline remains correct across 31-bit millis rollover', async () => {
  const artifact = await loadArtifact();
  const hardware = createHardware({ now: 2147483600, profileCount: 1 });
  await tick(artifact, hardware);

  hardware.now = 52;
  await tick(artifact, hardware);
  assert.equal(hardware.state.get(2), 1);

  hardware.now = 14952;
  await tick(artifact, hardware);
  assert.equal(hardware.state.get(2), 0);
  assert.equal(hardware.state.get(4), 1);
});
