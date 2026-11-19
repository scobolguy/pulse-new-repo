import fs from 'node:fs/promises';
import { compileKotlinToPcode } from './compile-kotlin-to-pcode.mjs';

export async function compileSsdpCollector(target) {
  const compile = async (fileName, options) => {
    const source = await fs.readFile(new URL(`../examples/${fileName}`, import.meta.url), 'utf8');
    return compileKotlinToPcode(source, { fileName, target, ...options });
  };
  const [daemon, service] = await Promise.all([
    compile('ssdp-discovery-daemon.kt', { daemonId: 'ssdp-collector', daemonRefreshMs: 60000 }),
    compile('ssdp-device-service.kt', { serviceId: 'ssdp-device-service' })
  ]);
  return { daemon, service };
}
