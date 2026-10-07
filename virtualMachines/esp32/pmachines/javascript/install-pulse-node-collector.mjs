#!/usr/bin/env node
// Installs the Pascalish pulse-node collector (service + UDP daemon) on a running
// JavaScript p-machine. The daemon binds UDP 4210 shared, so it can run beside a
// Network backend that also listens there.
// Usage: node install-pulse-node-collector.mjs [origin=http://127.0.0.1:4111] [udpPort=4210]
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:4111');
const udpPort = Number(process.argv[3] || 4210);
const source = (name) => fileURLToPath(new URL(`../../src/${name}`, import.meta.url));

async function request(path, values) {
  const response = await fetch(new URL(path, origin), values
    ? { method: 'POST', body: new URLSearchParams(values) }
    : undefined);
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

const { tables } = JSON.parse(await fs.readFile(source('discovery-collector-service.host-tables.json'), 'utf8'));
if (!Array.isArray(tables)) throw new Error('Invalid discovery host table configuration');
const service = await compile('discovery-collector-service', (map) => ({ ...map, hostTables: tables }));
const daemon = await compile('pulse-node-collector-daemon');

await request('/pmachine/service_host/stop', {});
const status = await request('/pmachine/service_host/install', {
  serviceFile: service.file,
  serviceMap: service.map,
  daemons: JSON.stringify([{ ...daemon, udpPort, udpShared: true }]),
  collectorId: 'pulse-node-collector',
  observationTtlMs: '180000'
});
console.log(status);
