#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

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
const peers = config.kasaPeers;
if (!Array.isArray(peers) || peers.length < 1 || peers.length > 8 ||
    new Set(peers).size !== peers.length || peers.some(ip => net.isIP(ip) !== 4)) {
  throw new Error('Kasa configuration must contain 1..8 distinct literal IPv4 peers');
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
const installed = [];
try {
  const definitions = [];
  const kasaPath = sourcePath('kasa-collector-daemon.pas');
  let kasaSource = await fs.readFile(kasaPath, 'utf8');
  const selection = "address := '192.168.2.28';\n  if turn - (turn / 2) * 2 = 1 then address := '192.168.2.29';";
  if (!kasaSource.includes(selection)) throw new Error('Kasa daemon is missing peer selection template');
  kasaSource = kasaSource.replace(selection, [
    `address := '${peers[0]}';`,
    ...peers.slice(1).map((ip, index) =>
      `  if turn - (turn / ${peers.length}) * ${peers.length} = ${index + 1} then address := '${ip}';`)
  ].join('\n'));
  // Keep every peer fresh within the 180-second observation TTL, even with eight peers.
  kasaSource = kasaSource.replace('refresh 30000 ms', `refresh ${Math.min(30000, Math.floor(90000 / peers.length))} ms`);
  definitions.push({
    id: `kasa-js${collectorSuffix}`,
    port: httpPorts.kasa,
    networkPeers: JSON.stringify(peers.map(ip => ({ ip, port: 9999 }))),
    daemon: signed(await compileSource('kasa-collector-daemon.pas', kasaSource))
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
  for (const definition of definitions) {
    const daemonFiles = await upload(definition.id, definition.daemon);
    const daemon = {
      file: daemonFiles.file,
      map: daemonFiles.map,
      ...(definition.udpPort ? {
        udpPort: definition.udpPort,
        udpBindAddress: '0.0.0.0',
        ...(definition.udpShared ? { udpShared: true } : {}),
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
      serviceFile: serviceFiles.file,
      serviceMap: serviceFiles.map,
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
