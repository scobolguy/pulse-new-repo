import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { normalizeNodeAnnouncement, recordNodeAnnouncement } from '../../aggregator/src/backend/modules/discoveryCollector.mjs';
import { createPascalishServiceHost } from './src/service-host.mjs';

export function normalizeDiscoveryAnnouncement(json, peer) {
  let body;
  try { body = JSON.parse(json); } catch { throw Object.assign(new Error('Invalid announcement JSON'), { status: 400 }); }
  if (body?.kind != null && !['nodeBeacon', 'machineAvailability'].includes(body.kind)) {
    throw Object.assign(new Error('Unsupported announcement kind'), { status: 400 });
  }
  for (const key of ['nodeId', 'nodeName', 'ip']) {
    if (body?.[key] != null && (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 256)) {
      throw Object.assign(new Error(`Invalid announcement ${key}`), { status: 400 });
    }
  }
  const announcement = normalizeNodeAnnouncement(body, peer);
  const node = recordNodeAnnouncement(new Map(), announcement);
  const normalized = {
    nodeId: node.nodeId, nodeName: node.nodeName, ip: node.ip, port: node.port,
    available: node.available, draining: node.draining, status: node.status,
    availability: node.availability, details: node.details
  };
  if (body.kind === 'nodeBeacon' && !['hardware', 'runtime', 'services', 'capabilities'].some(key => Object.hasOwn(body, key))) {
    delete normalized.details;
  }
  return JSON.stringify(normalized);
}

export async function createPascalishDiscoveryCollector(options = {}) {
  return createDiscoveryCollector(options, 'discovery-maintenance-daemon', false);
}

export async function createPascalishPulseNodeCollector(options = {}) {
  return createDiscoveryCollector(options, 'pulse-node-collector-daemon', true);
}

async function createDiscoveryCollector(options, daemonName, daemonOwnsUdp) {
  const {
    observationTtlMs = 180000,
    announcementIntervalMs = 60000,
    ...hostOptions
  } = options;
  if (!Number.isSafeInteger(announcementIntervalMs) || announcementIntervalMs < 1
    || !Number.isSafeInteger(observationTtlMs) || observationTtlMs > 180000
    || observationTtlMs <= announcementIntervalMs) {
    throw new Error('Observation TTL must be longer than the announcement interval and at most 180000 ms');
  }
  const sourcePath = fileURLToPath(new URL('../../src/discovery-collector-service.pas', import.meta.url));
  const source = await fs.readFile(sourcePath, 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source, { fileName: sourcePath, hostServices: true });
  const tablesPath = new URL('../../src/discovery-collector-service.host-tables.json', import.meta.url);
  const tableConfiguration = JSON.parse(await fs.readFile(tablesPath, 'utf8'));
  if (!Array.isArray(tableConfiguration.tables)) throw new Error('Invalid discovery host table configuration');
  compiled.programMap.hostTables = tableConfiguration.tables;
  const daemonPath = fileURLToPath(new URL(`../../src/${daemonName}.pas`, import.meta.url));
  const daemon = compilePascalishProgramWithAntlr(await fs.readFile(daemonPath, 'utf8'), { fileName: daemonPath, hostServices: true });
  const { udpPort = 4210, ...otherHostOptions } = hostOptions;
  return createPascalishServiceHost({
    collectorId: daemonOwnsUdp ? 'pulse-node-collector' : 'pascalish-js-collector',
    ...otherHostOptions, compiled,
    udpPort: daemonOwnsUdp ? null : udpPort,
    daemons: daemonOwnsUdp
      ? [{ compiled: daemon, udpPort, udpBindAddress: options.host ?? '127.0.0.1' }]
      : [daemon],
    bindings: {
      'host.announcement': normalizeDiscoveryAnnouncement,
      'host.observation_ttl': () => observationTtlMs
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const service = await createPascalishDiscoveryCollector({
    collectorId: process.env.PULSE_DISCOVERY_COLLECTOR_ID || 'pascalish-js-collector',
    host: process.env.DISCOVERY_HOST || '0.0.0.0',
    httpPort: Number(process.env.DISCOVERY_HTTP_PORT || 4300),
    udpPort: Number(process.env.UDP_PORT || 4210)
  });
  await service.start();
  console.log('[SERVICE] Pascalish discovery collector listening', service.getStatus());
  const shutdown = () => service.stop().catch(error => { console.error(error); process.exitCode = 1; });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
