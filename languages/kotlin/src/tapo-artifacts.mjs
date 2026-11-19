import fs from 'node:fs/promises';
import { compileKotlinToPcode } from './compile-kotlin-to-pcode.mjs';
import { applyCacheSchemas } from './cache-schema.mjs';

export async function compileTapoCollector(target) {
  const compile = async (fileName, options) => {
    const source = await fs.readFile(new URL(`../examples/${fileName}`, import.meta.url), 'utf8');
    const unit = compileKotlinToPcode(source, { fileName, target, ...options });
    applyCacheSchemas(unit, [{
      name: 'cameras', capacity: 50,
      fields: ['name', 'protocol', 'address', 'port', 'serviceUrl', 'deviceType'].map(name => ({ name, type: 'string' }))
    }]);
    return unit;
  };
  const [daemon, service] = await Promise.all([
    compile('tapo-camera-discovery-daemon.kt', { daemonId: 'tapo-camera-collector', daemonRefreshMs: 180000 }),
    compile('tapo-camera-service.kt', { serviceId: 'tapo-camera-service' })
  ]);
  return { daemon, service };
}
