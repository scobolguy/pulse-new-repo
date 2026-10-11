#!/usr/bin/env node
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../shared/contracts/service-host-bindings.mjs';

export async function installBluetoothCollector({
  origin: target = 'http://127.0.0.1:4113', collectorId = 'pc-bluetooth-collector', fetchImpl = fetch
} = {}) {
  const origin = new URL(target);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' ||
      origin.search || origin.hash || !/^[a-zA-Z0-9_.:-]{1,64}$/.test(collectorId)) throw new Error('Invalid Bluetooth deployment origin or identity');
  async function request(route, values) {
    const response = await fetchImpl(new URL(route, origin), {
      ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}),
      signal: AbortSignal.timeout(30000)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${route}: HTTP ${response.status}: ${text}`);
    return text;
  }
  const current = JSON.parse(await request('/pmachine/service_host/status'));
  if (current.running !== false) throw new Error('Primary hosted context is occupied; no existing service was replaced');
  async function compile(name, tables) {
    const fileName = new URL(`../../src/${name}.pas`, import.meta.url);
    const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), { hostServices: true });
    const map = attachPcodeSignature(compactServiceHostProgramMap({
      ...compiled.programMap, ...(tables ? { hostTables: tables } : {})
    }), compiled.pcodeText);
    const file = `/bluetooth/${name}.pcode`;
    await request('/ffs/upload', { file, body: compiled.pcodeText });
    await request('/ffs/upload', { file: `${file}.map.json`, body: JSON.stringify(map) });
    return { file, map: `${file}.map.json` };
  }
  const service = await compile('bluetooth-collector-service', [
    { name: 'bluetooth-devices', capacity: 255 }, { name: 'bluetooth-endpoints', capacity: 255 }
  ]);
  const daemon = await compile('bluetooth-collector-daemon');
  const status = JSON.parse(await request('/pmachine/service_host/install', {
    collectorId, serviceFile: service.file, serviceMap: service.map,
    daemonFile: daemon.file, daemonMap: daemon.map, udpPort: '0'
  }));
  if (!status.running || status.collectorId !== collectorId || status.daemonDiagnostics?.[0]?.failures !== 0) {
    throw new Error(`Bluetooth collector did not start cleanly: ${JSON.stringify(status)}`);
  }
  return status;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(await installBluetoothCollector({ origin: process.argv[2] || 'http://127.0.0.1:4113' }));
}
