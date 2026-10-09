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
  fetchImpl = fetch, logger = console
} = {}) {
config ??= JSON.parse(await fs.readFile(new URL('config/federated-device-cache.json', root), 'utf8'));
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('JS PMachine URL must be an HTTP(S) origin');
}
const peers = config.kasaPeers;
if (!Array.isArray(peers) || peers.length !== 2 || peers.some(ip => net.isIP(ip) !== 4)) {
  throw new Error('Kasa configuration must contain two literal IPv4 peers');
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
  for (const [ip, placeholder] of peers.map((ip, index) => [ip, `192.168.2.${28 + index}`])) {
    const marker = `'${placeholder}'`;
    if (!kasaSource.includes(marker)) throw new Error(`Kasa daemon is missing peer placeholder ${placeholder}`);
    kasaSource = kasaSource.replaceAll(marker, `'${ip}'`);
  }
  definitions.push({
    id: 'kasa-js',
    port: httpPorts.kasa,
    networkPeers: JSON.stringify(peers.map(ip => ({ ip, port: 9999 }))),
    daemon: signed(await compileSource('kasa-collector-daemon.pas', kasaSource))
  });
  for (const protocol of ['tuya', 'ssdp']) {
    definitions.push({
      id: `${protocol}-js`,
      port: httpPorts[protocol],
      daemon: signed(await compileSource(`${protocol}-collector-daemon.pas`)),
      udpPort: udpPorts[protocol],
      ...(protocol === 'ssdp' ? {
        udpShared: true,
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
        ...(definition.udpShared ? { udpShared: true } : {}),
        ...(definition.multicastGroup ? { multicastGroup: definition.multicastGroup } : {}),
        ...(definition.multicastInterface ? { multicastInterface: definition.multicastInterface } : {})
      } : {})
    };
    const status = JSON.parse(await request('/pmachine/service_host/install', {
      serviceFile: serviceFiles.file,
      serviceMap: serviceFiles.map,
      collectorId: definition.id,
      additional: 'true',
      httpPort: String(definition.port),
      udpPort: '0',
      observationTtlMs: '180000',
      daemons: JSON.stringify([daemon]),
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
