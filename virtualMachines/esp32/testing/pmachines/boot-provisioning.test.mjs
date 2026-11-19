import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compileKotlinToPcode } from '../../../../languages/kotlin/src/compile-kotlin-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../pmachines/javascript/index.mjs';
import { createJsonObjectBindings } from '../../pmachines/javascript/src/json-object-bindings.mjs';

const source = await readFile(new URL('../../src/boot/boot-provisioning.kt', import.meta.url), 'utf8');
const compiled = compileKotlinToPcode(source, {
  fileName: 'boot-provisioning.kt',
  target: 'esp32'
});
const packagedPcode = await readFile(new URL('../../data/boot/pmachine-provisioning', import.meta.url), 'utf8');
assert.equal(packagedPcode, compiled.pcodeText, 'BootFS provisioning P-code must match its Kotlin source');
const artifact = {
  instructions: parsePcode(compiled.pcodeText),
  opcodeMap: await loadOpcodeMap(),
  mappingsById: new Map()
};
artifact.mappingsById.__globals = compiled.programMap.globals;
artifact.mappingsById.__proceduresByLabel = compiled.programMap.procedures;

const jsonBindings = createJsonObjectBindings();

function createHost({ method, path, params = {}, profiles = [], networks = [], scanCount = null,
  saveResult = 1, clearResult = 1, nodeName = 'ESP32-Device', nodeNameResult = null } = {}) {
  const calls = [];
  let response = null;
  const host = {
    calls,
    get response() { return response; },
    get profiles() { return profiles; },
    async run() {
      const result = await executeProgram({
        ...artifact,
        inputQueue: 'boot.provisioning',
        sourceMessage: '',
        runtimeContext: {
          maxSteps: 100000,
          maxCallDepth: 64,
          callHost(name, args) {
            if (name.startsWith('host.json_')) return jsonBindings[name](...args);
            switch (name) {
              case 'host.boot_text_trim': return args[0].trim();
              case 'host.boot_text_lower': return args[0].toLowerCase();
              case 'host.boot_provision_method': return method;
              case 'host.boot_provision_path': return path;
              case 'host.boot_provision_param': return params[args[0]] ?? '';
              case 'host.boot_provision_respond':
                response = { status: args[0], body: args[1], reboot: args[2] };
                return 1;
              case 'host.boot_wifi_scan_count':
                return scanCount ?? networks.length;
              case 'host.boot_wifi_scan_ssid': return networks[args[0]]?.ssid ?? '';
              case 'host.boot_wifi_scan_rssi': return networks[args[0]]?.rssi ?? 0;
              case 'host.boot_wifi_scan_channel': return networks[args[0]]?.channel ?? 0;
              case 'host.boot_wifi_scan_secure': return networks[args[0]]?.secure ? 1 : 0;
              case 'host.boot_profile_count': return profiles.length;
              case 'host.boot_wifi_profile_field': {
                const profile = profiles[args[0]];
                if (!profile) throw new Error('test profile index out of range');
                return String(profile[args[1]] ?? '');
              }
              case 'host.boot_wifi_profile_has_password': {
                const profile = profiles[args[0]];
                return args[1] === 0 ? Number(Boolean(profile.password))
                  : Number(Boolean(profile.enterprisePassword || profile.password));
              }
              case 'host.boot_save_wifi_profile': {
                calls.push({ name, args });
                if (saveResult !== 1) return saveResult;
                const profile = {
                  ssid: args[0], password: args[1], authMode: args[2], eapMethod: args[3],
                  identity: args[4], username: args[5], enterprisePassword: args[6],
                  hostname: args[7], dhcp: args[8] === 1, staticIP: args[9],
                  gateway: args[10], subnet: args[11], dns1: args[12], dns2: args[13]
                };
                profiles = [profile, ...profiles.filter(item => item.ssid !== profile.ssid)].slice(0, 5);
                return 1;
              }
              case 'host.boot_current_node_name': return nodeName;
              case 'host.boot_save_node_name': {
                const normalized = args[0].trim().replace(/[^A-Za-z0-9._-]/g, '').slice(0, 32);
                calls.push({ name, requested: args[0] });
                return nodeNameResult ?? normalized;
              }
              case 'host.boot_clear_wifi_profiles':
                if (clearResult === 1) profiles = [];
                return clearResult;
              default: throw new Error(`Unexpected boot host call: ${name}`);
            }
          }
        }
      });
      assert.equal(result.error ?? null, null);
      return response;
    }
  };
  return host;
}

test('scan response includes nonempty networks, channel, signal, and security', async () => {
  const host = createHost({
    method: 'GET',
    path: '/api/wifi/scan',
    networks: [
      { ssid: 'Lab "A"', rssi: -48, channel: 6, secure: true },
      { ssid: '', rssi: -80, channel: 1, secure: false }
    ]
  });
  const response = await host.run();
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    ok: true,
    method: 'wifi_scanner',
    networks: [{ ssid: 'Lab "A"', rssi: -48, channel: 6, secure: true }],
    count: 1
  });
});

test('scan failure returns the existing scanner error shape', async () => {
  const response = await createHost({
    method: 'GET', path: '/api/wifi/scan', scanCount: -1
  }).run();
  assert.equal(response.status, 500);
  assert.deepEqual(JSON.parse(response.body), {
    ok: false, method: 'wifi_scanner', networks: [], count: 0
  });
});

test('profiles response masks both stored secrets and normalizes auth mode', async () => {
  const response = await createHost({
    method: 'GET',
    path: '/api/wifi/profiles',
    profiles: [{
      ssid: 'corp', hostname: 'edge', authMode: 'enterprise', eapMethod: 'PEAP',
      identity: 'device', username: 'operator', dhcp: true, staticIP: '',
      password: 'secret-one', enterprisePassword: 'secret-two'
    }]
  }).run();
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    ok: true, count: 1, profiles: [{
      ssid: 'corp', hostname: 'edge', authMode: 'wpa2-enterprise', eapMethod: 'PEAP',
      identity: 'device', username: 'operator', dhcp: true, hasPassword: true,
      hasEnterprisePassword: true, staticIP: ''
    }]
  });
  assert.doesNotMatch(response.body, /secret-one|secret-two/);
});

test('provision rejects missing SSID without touching credential storage', async () => {
  const host = createHost({ method: 'POST', path: '/api/wifi/provision' });
  const response = await host.run();
  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'ssid is required' });
  assert.equal(host.calls.length, 0);
});

test('provision saves enterprise credentials, defaults DHCP, masks secrets, and honors reboot', async () => {
  const host = createHost({
    method: 'POST',
    path: '/api/wifi/provision',
    params: {
      ssid: 'corp', password: 'top-secret', authMode: 'ENTERPRISE',
      eapMethod: 'PEAP', identity: 'device', username: 'operator',
      hostname: '', nodeName: 'edge node', staticIP: '192.0.2.4', reboot: ' YES '
    }
  });
  const response = await host.run();
  assert.equal(response.status, 200);
  assert.equal(response.reboot, 1);
  assert.deepEqual(JSON.parse(response.body), {
    ok: true, ssid: 'corp', authMode: 'wpa2-enterprise', eapMethod: 'PEAP',
    identity: 'device', username: 'operator', hostname: 'edgenode', nodeName: 'edgenode',
    saved: true, profilesStored: 1, rebooting: true
  });
  assert.doesNotMatch(response.body, /top-secret/);
  const stored = host.calls.find(call => call.name === 'host.boot_save_wifi_profile').args;
  assert.equal(stored[6], 'top-secret');
  assert.equal(stored[8], 1);
  assert.deepEqual(stored.slice(9), ['', '', '', '', '']);
});

test('provision preserves static network settings when DHCP is disabled', async () => {
  const host = createHost({
    method: 'POST',
    path: '/api/wifi/provision',
    params: {
      ssid: 'static', dhcp: 'false', staticIP: '192.0.2.10', gateway: '192.0.2.1',
      subnet: '255.255.255.0', dns1: '192.0.2.2', dns2: '192.0.2.3'
    }
  });
  const response = await host.run();
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).hostname, '');
  assert.deepEqual(host.calls[0].args.slice(9), [
    '192.0.2.10', '192.0.2.1', '255.255.255.0', '192.0.2.2', '192.0.2.3'
  ]);
});

test('provision keeps the five most recent profiles and unsupported routes return 405', async () => {
  const host = createHost({
    method: 'POST',
    path: '/api/wifi/provision',
    params: { ssid: 'newest' },
    profiles: ['one', 'two', 'three', 'four', 'five'].map(ssid => ({ ssid }))
  });
  const response = await host.run();
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).profilesStored, 5);
  assert.deepEqual(host.profiles.map(profile => profile.ssid), ['newest', 'one', 'two', 'three', 'four']);

  const unsupported = await createHost({
    method: 'PUT', path: '/api/wifi/profiles'
  }).run();
  assert.equal(unsupported.status, 405);
  assert.deepEqual(JSON.parse(unsupported.body), { error: 'method not allowed' });
});

test('provision reports invalid node names and storage failures', async () => {
  const invalid = await createHost({
    method: 'POST', path: '/api/wifi/provision',
    params: { ssid: 'test', nodeName: '***' }
  }).run();
  assert.equal(invalid.status, 400);
  assert.deepEqual(JSON.parse(invalid.body), { error: 'invalid nodeName' });

  const failed = await createHost({
    method: 'POST', path: '/api/wifi/provision',
    params: { ssid: 'test' }, saveResult: 0
  }).run();
  assert.equal(failed.status, 500);
  assert.deepEqual(JSON.parse(failed.body), { error: 'failed to save WiFi credentials' });
});

test('profile deletion reports success and failure with the current response shape', async () => {
  const success = await createHost({
    method: 'DELETE', path: '/api/wifi/profiles', profiles: [{ ssid: 'saved' }]
  }).run();
  assert.equal(success.status, 200);
  assert.deepEqual(JSON.parse(success.body), {
    ok: true, cleared: true, status: 'wifi_profiles_cleared'
  });

  const failure = await createHost({
    method: 'DELETE', path: '/api/wifi/profiles', clearResult: 0
  }).run();
  assert.equal(failure.status, 500);
  assert.deepEqual(JSON.parse(failure.body), {
    ok: false, cleared: false, status: 'clear_failed'
  });
});
