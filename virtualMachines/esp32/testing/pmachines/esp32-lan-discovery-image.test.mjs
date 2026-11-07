import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';

const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');

test('extended images do not relax legacy text/image limits or bounded execution memory', async () => {
  assert.throws(() => encodeHostedImage('NOP\n'.repeat(513)), /instruction capacity/);
  assert.throws(() => encodeHostedImage('NOP\n'.repeat(4097), { profile: 'extended' }), /instruction capacity/);
  assert.throws(() => encodeHostedImage('HALT', { profile: 'unbounded' }), /Unknown/);
  assert.throws(() => encodeHostedImage('CALL_EXT host.infrastructure_probe 0\nHALT', { profile: 'extended' }), /Desktop-only/);
  assert.throws(() => encodeHostedImage(`PUSH_STR "${'x'.repeat(2049)}"\nHALT`, { profile: 'extended' }), /constant capacity/);
  const host = await read('../../pmachines/arduino/src/service_host.cpp');
  const image = await read('../../pmachines/arduino/src/hosted_image.h');
  assert.match(host, /pcode\.size\(\) > 8192/);
  assert.match(host, /out\.instructions->size\(\) > 512/);
  assert.match(image, /PAGE_BYTES = 512, CACHE_PAGES = 4, MAX_PAGES = 256/);
});

test('node learns its report aggregator from beacon acks and runs no discovery of its own', async () => {
  const [host, discovery, udp, main, aggregatorAck] = await Promise.all([
    read('../../pmachines/arduino/src/service_host.cpp'),
    read('../../pmachines/arduino/src/service_host_discovery.cpp'),
    read('../../src/udp_runtime.cpp'),
    read('../../src/main.cpp'),
    read('../../aggregator/src/backend/modules/localDiscoveryRuntime.mjs'),
  ]);
  assert.match(discovery, /auto targets = context\.lifecycle\.reportTargets/);
  assert.match(discovery, /target\.aggregatorId == learned\.id/);
  assert.match(discovery, /portENTER_CRITICAL\(&learnedLock\)/);
  assert.match(discovery, /\/api\/runtime\/instances\/report/);
  assert.doesNotMatch(discovery, /pulseDiscoveryRequest|beginPacket|ownerAggregatorId\s*=|\.bindings\s*=/);
  assert.doesNotMatch(host, /discoveryTurn|startDiscovery/);
  assert.match(host, /item\.targets = host\.reportTargetsFor\(\*context\)/);
  assert.match(host, /const auto targets = reportTargetsFor\(\*current\)/);
  assert.match(host, /target\.aggregatorId == ingressAggregatorId/);
  assert.match(host, /target\.aggregatorId == item\.owner/);
  assert.match(host, /current->lifecycle\.bindings\.find\(serviceId\)/);
  assert.match(udp, /context\.onAggregatorAck\(/);
  assert.doesNotMatch(udp, /upsertDiscoveredNode/);
  assert.match(main, /pmachineLearnAggregator\(aggregatorId, address, httpPort\)/);
  assert.doesNotMatch(main, /startPMachineLanDiscovery/);
  assert.match(aggregatorAck, /kind: 'nodeBeaconAck', nodeId, httpPort/);
});

test('DAG workers advertise capabilities and beacon regardless of generalist role', async () => {
  const [main, announcement] = await Promise.all([
    read('../../src/main.cpp'),
    read('../../src/udp_announcement.cpp'),
  ]);
  assert.match(main, /#if defined\(ESP32\) && defined\(ENABLE_PMACHINE\) && !defined\(DISABLE_PMACHINE_ROUTES\)\s+announcePresence\(\);/);
  assert.match(announcement, /announceDoc\["available"\] = true/);
  assert.match(announcement, /announceDoc\["draining"\] = false/);
  assert.match(announcement, /capabilities\.add\("pascalish-dag-v1"\)/);
  assert.match(announcement, /dagWorker\["maxConcurrentTasks"\] = 1/);
});

test('TLS bootstrap rotation is physical-serial-only and refuses active or completed enrollment', async () => {
  const [commands, tls] = await Promise.all([
    read('../../src/control_plane_commands.cpp'),
    read('../../src/https_service.cpp'),
  ]);
  assert.match(commands, /line == "TLS_BOOTSTRAP_ROTATE"[\s\S]*?if \(&io != &Serial\)/);
  assert.match(tls, /gTlsState\.enrollmentState != "bootstrap" \|\| hasPersistentTlsPair\(\)/);
  assert.match(tls, /LittleFS\.rename\(temporaryPath, kTlsBootstrapTokenPath\)/);
  assert.match(tls, /request->onDisconnect\(\[\] \{ gTlsRestartRequested\.store\(true\); \}\)/);
  assert.match(tls, /request->send\(202, "application\/json", response\)/);
});

test('HTTPS proxy preserves enrollment and bounded DAG error statuses', async () => {
  const proxy = await read('../../src/https_core.cpp');
  for (const code of [202, 413, 422, 429]) {
    assert.match(proxy, new RegExp(`case ${code}: return "${code} `));
  }
});

test('topology persists on a fresh filesystem and saved UDP ports are applied at boot', async () => {
  const [config, main] = await Promise.all([
    read('../../src/NodeConfig.cpp'),
    read('../../src/main.cpp'),
  ]);
  assert.match(config, /!LittleFS\.exists\("\/ffs"\) && !LittleFS\.mkdir\("\/ffs"\)/);
  assert.match(config, /written != expected/);
  assert.match(main, /if \(!saveNodeConfig\(nodeConfig\)\) \{\s+request->send\(500, "application\/json", "\{\\"error\\":\\"failed_to_persist_topology/);
  assert.match(main, /if \(nodeConfigLoaded\) \{\s+runtimeUdpParentPort = nodeConfig\.parentPort;\s+runtimeUdpSiblingPort = nodeConfig\.siblingPort;/);
});