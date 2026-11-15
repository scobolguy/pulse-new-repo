import fs from 'node:fs/promises';
import { compileKotlinToPcode } from './compile-kotlin-to-pcode.mjs';
import { applyCacheSchemas } from './cache-schema.mjs';

export async function compileKasaCollector(target = 'esp32') {
  const source = name => fs.readFile(new URL(`../examples/${name}`, import.meta.url), 'utf8');
  const daemon = compileKotlinToPcode(await source('kasa-discovery-daemon.kt'), {
    fileName: 'kasa-discovery-daemon.kt', target, daemonId: 'kasa-collector', daemonRefreshMs: 180000
  });
  const service = compileKotlinToPcode(await source('kasa-device-service.kt'), {
    fileName: 'kasa-device-service.kt', target, serviceId: 'kasa-service'
  });
  const schemas = [{ name: 'devices', capacity: 50, fields: ['name', 'protocol', 'address', 'deviceType']
    .map(name => ({ name, type: 'string' })) }];
  applyCacheSchemas(daemon, schemas);
  applyCacheSchemas(service, schemas);
  return { daemon, service };
}
