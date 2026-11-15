import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';

const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');

test('hosted images have no fixed instruction-count cap', async () => {
  assert.equal(Number.parseInt(encodeHostedImage('NOP\n'.repeat(513)).slice(4, 12), 16), 513);
  const largeImage = encodeHostedImage('NOP\n'.repeat(6000));
  assert.equal(Number.parseInt(largeImage.slice(4, 12), 16), 6000);
  assert.ok(largeImage.length > 131072);
  assert.throws(() => encodeHostedImage('HALT', { profile: 'unknown' }), /Unknown/);
  assert.throws(() => encodeHostedImage('CALL_EXT host.infrastructure_probe 0\nHALT'), /Desktop-only/);
  assert.throws(() => encodeHostedImage(`PUSH_STR "${'x'.repeat(2049)}"\nHALT`), /constant capacity/);
  const host = await read('../../pmachines/arduino/src/service_host.cpp');
  const image = await read('../../pmachines/arduino/src/hosted_image.h');
  const routes = await read('../../pmachines/arduino/src/pmachine_routes.cpp');
  const uploads = await read('../../src/ffs/FederatedFileSystemRoutes.cpp');
  assert.doesNotMatch(host, /instructions->size\(\) > 512/);
  assert.doesNotMatch(routes, /pcode\.length\(\) > 8192/);
  assert.doesNotMatch(uploads, /total > 131072/);
  assert.match(image, /PAGE_BYTES = 512, CACHE_PAGES = 4/);
  assert.doesNotMatch(image, /MAX_PAGES/);
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