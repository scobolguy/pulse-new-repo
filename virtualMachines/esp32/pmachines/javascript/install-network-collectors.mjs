#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compileKasaCollector } from '../../../../languages/kotlin/src/kasa-artifacts.mjs';

const root = new URL('../../', import.meta.url);
export async function installNetworkCollectors({
  origin: target = 'http://127.0.0.1:4111',
  config,
  collectorSuffix = '',
  fetchImpl = fetch, logger = console
} = {}) {
if (!/^[a-zA-Z0-9_-]{0,24}$/.test(collectorSuffix)) throw new Error('Invalid collector suffix');
config ??= JSON.parse(await fs.readFile(new URL('config/federated-device-cache.json', root), 'utf8'));
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('JS PMachine URL must be an HTTP(S) origin');
}
const interfaces = Object.values(os.networkInterfaces()).flat().filter(item => item.family === 'IPv4' && !item.internal);
const esp32 = new URL(config.esp32Origin);
const matchingInterfaces = interfaces.filter(item =>
  item.address.split('.').slice(0, 3).join('.') === esp32.hostname.split('.').slice(0, 3).join('.'));
const lanInterface = process.env.PULSE_LAN_INTERFACE || config.lanInterface
  || (matchingInterfaces.length === 1 ? matchingInterfaces[0].address : '');
if (net.isIP(lanInterface) !== 4 || !interfaces.some(item => item.address === lanInterface)) {
  throw new Error('Configure one active IPv4 lanInterface or PULSE_LAN_INTERFACE for SSDP multicast');
}
const lan = interfaces.find(item => item.address === lanInterface);
if (net.isIP(lan.netmask) !== 4) throw new Error('Selected LAN interface has no IPv4 netmask');
const ipParts = lan.address.split('.').map(Number), maskParts = lan.netmask.split('.').map(Number);
const broadcast = ipParts.map((part, index) => (part & maskParts[index]) | (255 ^ maskParts[index])).join('.');
if (broadcast === lan.address) throw new Error('Selected LAN interface has no usable broadcast address');
const httpPorts = {
  kasa: Number(process.env.PULSE_KASA_HTTP_PORT || config.kasaHttpPort || 4309),
  tuya: config.tuyaHttpPort,
  ssdp: config.ssdpHttpPort
};
const udpPorts = { tuya: config.tuyaUdpPort, ssdp: config.ssdpUdpPort };
const tuyaLegacyUdpPort = config.tuyaLegacyUdpPort ?? 6666;
if (!Number.isInteger(tuyaLegacyUdpPort) || tuyaLegacyUdpPort < 1 || tuyaLegacyUdpPort > 65535 ||
    Object.values(udpPorts).includes(tuyaLegacyUdpPort)) throw new Error('Invalid or duplicate legacy Tuya UDP port');
for (const [protocol, port] of Object.entries(httpPorts)) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid ${protocol} HTTP port`);
}
if (new Set(Object.values(httpPorts)).size !== 3) throw new Error('Kasa, Tuya and SSDP HTTP ports must be distinct');
for (const [protocol, port] of Object.entries(udpPorts)) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid ${protocol} UDP port`);
}
if (udpPorts.tuya === udpPorts.ssdp) throw new Error('Tuya and SSDP UDP ports must be distinct');

async function request(path, values) {
  const response = await fetchImpl(new URL(path, origin), {
    ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}),
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text;
}

const sourcePath = name => fileURLToPath(new URL(`src/${name}`, root));
async function compileSource(name, source) {
  const fileName = sourcePath(name);
  return compilePascalishProgramWithAntlr(source ?? await fs.readFile(fileName, 'utf8'), { fileName, hostServices: true });
}
function signed(unit) {
  return { pcodeText: unit.pcodeText, programMap: attachPcodeSignature(unit.programMap, unit.pcodeText) };
}
async function upload(id, unit) {
  const file = `/network-collectors/${id}.pcode`;
  const map = `${file}.map.json`;
  await request('/ffs/upload', { file, body: unit.pcodeText });
  await request('/ffs/upload', { file: map, body: JSON.stringify(unit.programMap) });
  return { file, map };
}

const service = signed(await compileSource('device-cache-service.pas'));
const kasa = await compileKasaCollector('js');
const kasaService = signed(kasa.service);
const installed = [];
try {
  const definitions = [];
  definitions.push({
    id: `kasa-js${collectorSuffix}`,
    port: httpPorts.kasa,
    networkPeers: JSON.stringify([{ ip: broadcast, port: 9999 }]),
    daemon: signed(kasa.daemon), udpPort: 9999, udpBindAddress: lanInterface, udpShared: true, udpQueueLimit: 50
  });
  for (const protocol of ['tuya', 'ssdp']) {
    definitions.push({
      id: `${protocol}-js${collectorSuffix}`,
      port: httpPorts[protocol],
      daemon: signed(await compileSource(`${protocol}-collector-daemon.pas`)),
      udpPort: udpPorts[protocol],
      udpShared: true,
      ...(protocol === 'ssdp' ? {
        multicastGroup: '239.255.255.250',
        multicastInterface: lanInterface
      } : {})
    });
  }

  for (const definition of definitions) {
    const current = await fetchImpl(new URL(`/pmachine/service_host/status?collectorId=${encodeURIComponent(definition.id)}`, origin), {
      signal: AbortSignal.timeout(5000)
    });
    if (current.ok) throw new Error(`Collector ${definition.id} is already installed on this JS PMachine`);
    if (current.status !== 404) throw new Error(`Unable to inspect ${definition.id}: HTTP ${current.status}: ${await current.text()}`);
  }

  const serviceFiles = await upload('device-cache-service', service);
  const kasaServiceFiles = await upload('kasa-device-service', kasaService);
  for (const definition of definitions) {
    const daemonFiles = await upload(definition.id, definition.daemon);
    const daemon = {
      file: daemonFiles.file,
      map: daemonFiles.map,
      ...(definition.udpPort ? {
        udpPort: definition.udpPort,
        udpBindAddress: definition.udpBindAddress || '0.0.0.0',
        ...(definition.udpShared ? { udpShared: true } : {}),
        ...(definition.udpQueueLimit ? { udpQueueLimit: definition.udpQueueLimit } : {}),
        ...(definition.multicastGroup ? { multicastGroup: definition.multicastGroup } : {}),
        ...(definition.multicastInterface ? { multicastInterface: definition.multicastInterface } : {})
      } : {})
    };
    const daemons = [daemon];
    if (definition.id === `tuya-js${collectorSuffix}`) {
      const legacySource = (await fs.readFile(sourcePath('tuya-collector-daemon.pas'), 'utf8'))
        .replace("daemon 'tuya-collector'", "daemon 'tuya-legacy-collector'");
      const legacy = await upload('tuya-legacy-js', signed(await compileSource('tuya-collector-daemon.pas', legacySource)));
      daemons.push({ file: legacy.file, map: legacy.map, udpPort: tuyaLegacyUdpPort,
        udpBindAddress: '0.0.0.0', udpShared: true });
    }
    const status = JSON.parse(await request('/pmachine/service_host/install', {
      serviceFile: (definition.id === `kasa-js${collectorSuffix}` ? kasaServiceFiles : serviceFiles).file,
      serviceMap: (definition.id === `kasa-js${collectorSuffix}` ? kasaServiceFiles : serviceFiles).map,
      collectorId: definition.id,
      additional: 'true',
      httpPort: String(definition.port),
      udpPort: '0',
      observationTtlMs: '180000',
      daemons: JSON.stringify(daemons),
      ...(definition.networkPeers ? { networkPeers: definition.networkPeers } : {})
    }));
    if (status.collectorId !== definition.id || status.running !== true) {
      throw new Error(`Collector ${definition.id} did not start correctly`);
    }
    installed.push(definition.id);
    logger.log(`[${definition.id}] HTTP http://127.0.0.1:${status.httpPort}; UDP ${status.daemonDiagnostics[0].udpPort ?? 'not used'}`);
  }
} catch (error) {
  const cleanupErrors = [];
  for (const id of installed.reverse()) {
    try {
      await request(`/pmachine/service_host/stop?collectorId=${encodeURIComponent(id)}`, {});
    } catch (cleanupError) {
      cleanupErrors.push(`${id}: ${cleanupError.message}`);
    }
  }
  if (cleanupErrors.length) throw new Error(`${error.message}; cleanup failed: ${cleanupErrors.join('; ')}`, { cause: error });
  throw error;
}
return { origin: origin.href, collectorIds: installed };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await installNetworkCollectors({
    origin: process.argv[2] || process.env.JS_PMACHINE_URL || 'http://127.0.0.1:4111'
  });
}
