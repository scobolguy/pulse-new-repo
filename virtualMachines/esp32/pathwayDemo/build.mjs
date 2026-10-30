import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compileCobolishToPcode } from '../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';
import { compileScreenCobol } from '../../../languages/screencobol/src/compiler.mjs';
import { compactServiceHostProgramMap } from '../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../pmachines/shared/contracts/hosted-image.mjs';
import { loadConfiguration } from './database.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
export async function compileStockService({ address, port }) {
  if (net.isIP(address) !== 4 || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Stock gateway requires an explicit IPv4 address and TCP port');
  }
  const source = (await fs.readFile(path.join(root, 'application', 'stock-service.pas'), 'utf8'))
    .replace('@GATEWAY_IP@', address).replace('@GATEWAY_PORT@', String(port));
  return compilePascalishProgramWithAntlr(source, { hostServices: true });
}
export async function buildArtifacts(config) {
  const artifacts = {
    'inventory-server': compileCobolishToPcode(await fs.readFile(path.join(root, 'application', 'inventory.cob'), 'utf8'),
      { hostServices: true, nativeTarget: true, inventoryGateway: config.inventoryGateway }),
    'inventory-native-server': compileCobolishToPcode(await fs.readFile(path.join(root, 'application', 'inventory.cob'), 'utf8'),
      { hostServices: true, nativeTarget: true, inventoryGateway: config.inventoryGateway }),
    'inventory-requester': compileScreenCobol(await fs.readFile(path.join(root, 'application', 'inventory.scob'), 'utf8')),
    'stock-service': await compileStockService(config.stockGateway),
    'stock-requester': compileScreenCobol(await fs.readFile(path.join(root, 'application', 'stock.scob'), 'utf8')),
    'maintenance-daemon': compilePascalishProgramWithAntlr(
      "daemon 'pathway-maintenance' every 60 seconds; begin host.table_expire('nodes') end.", { hostServices: true }),
  };
  const directory = path.join(root, 'artifacts');
  await fs.mkdir(directory, { recursive: true });
  const manifest = [];
  for (const [name, artifact] of Object.entries(artifacts)) {
    const hosted = artifact.programMap.hostBindingsVersion === 1;
    await fs.writeFile(path.join(directory, `${name}.pcode`), artifact.pcodeText);
    await fs.writeFile(path.join(directory, `${name}.map.json`), JSON.stringify(
      hosted ? compactServiceHostProgramMap(artifact.programMap) : artifact.programMap, null, 2));
    const native = hosted && artifact.programMap.targets.includes('esp32');
    const profile = name.startsWith('inventory-') && name.endsWith('server') ? 'extended' : 'bounded';
    if (native) await fs.writeFile(path.join(directory, `${name}.phi`), encodeHostedImage(artifact.pcodeText, { profile }));
    manifest.push({ name, targets: artifact.programMap.targets ?? ['js'], nativeImage: native, ...(native ? { profile } : {}) });
  }
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return artifacts;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const artifacts = await buildArtifacts(await loadConfiguration());
  console.log(`Built ${Object.keys(artifacts).length} Pathway artifacts`);
}
