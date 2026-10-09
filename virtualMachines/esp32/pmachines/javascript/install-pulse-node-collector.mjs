#!/usr/bin/env node
// Installs the Pascalish pulse-node collector (service + UDP daemon) on a running
// JavaScript p-machine. The daemon binds UDP 4210 shared, so it can run beside a
// Network backend that also listens there.
// Usage: node install-pulse-node-collector.mjs [origin=http://127.0.0.1:4111] [udpPort=4210]
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

export async function installPulseNodeCollector({
  origin: target = 'http://127.0.0.1:4111', udpPort = 4210, fetchImpl = fetch
} = {}) {
const origin = new URL(target);
if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('JS PMachine URL must be an HTTP(S) origin');
}
if (!Number.isInteger(udpPort) || udpPort < 1 || udpPort > 65535) throw new Error('Invalid Pulse collector UDP port');
const source = (name) => fileURLToPath(new URL(`../../src/${name}`, import.meta.url));

async function request(path, values) {
  const response = await fetchImpl(new URL(path, origin), {
    ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}),
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text;
}

async function compile(name, extend = (map) => map) {
  const fileName = source(`${name}.pas`);
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), { fileName, hostServices: true });
  const map = attachPcodeSignature(extend(compiled.programMap), compiled.pcodeText);
  const file = `/pulse-node-collector/${name}.pcode`;
  await request('/ffs/upload', { file, body: compiled.pcodeText });
  await request('/ffs/upload', { file: `${file}.map.json`, body: JSON.stringify(map) });
  return { file, map: `${file}.map.json` };
}

const current = JSON.parse(await request('/pmachine/service_host/status'));
if (current.running !== false) throw new Error('Primary hosted context is occupied or its status is unknown; no context was replaced');
const { tables } = JSON.parse(await fs.readFile(source('discovery-collector-service.host-tables.json'), 'utf8'));
if (!Array.isArray(tables)) throw new Error('Invalid discovery host table configuration');
const service = await compile('discovery-collector-service', (map) => ({ ...map, hostTables: tables }));
const daemon = await compile('pulse-node-collector-daemon');

const status = JSON.parse(await request('/pmachine/service_host/install', {
  serviceFile: service.file,
  serviceMap: service.map,
  daemons: JSON.stringify([{ ...daemon, udpPort, udpShared: true }]),
  collectorId: 'pulse-node-collector',
  observationTtlMs: '180000',
  udpPort: '0'
}));
if (status.collectorId !== 'pulse-node-collector' || status.running !== true) {
  throw new Error('Pulse node collector did not start correctly');
}
return status;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(await installPulseNodeCollector({
    origin: process.argv[2] || 'http://127.0.0.1:4111', udpPort: Number(process.argv[3] || 4210)
  }));
}
