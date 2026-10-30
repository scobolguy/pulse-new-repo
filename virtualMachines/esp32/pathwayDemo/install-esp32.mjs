import { fileURLToPath } from 'node:url';
import { buildArtifacts } from './build.mjs';
import { loadConfiguration } from './database.mjs';
import { compactServiceHostProgramMap } from '../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../aggregator/scripts/pcode-signing.mjs';
import { uploadFfsFile } from '../aggregator/scripts/esp32-runtime-artifacts.mjs';
import { nodeRequest } from '../pathway/src/node-adapter.mjs';

export async function installStockService(config, { inventory = false } = {}) {
  const { origin } = config.esp32;
  const collectorId = inventory ? config.esp32.inventoryCollectorId : config.esp32.collectorId;
  if (!/^https?:\/\/[^/]+$/.test(origin) || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(collectorId)) {
    throw new Error('Invalid ESP32 origin or collector ID');
  }
  const status = JSON.parse(await nodeRequest(origin, '/pmachine/service_host/status', { timeoutMs: 10000 }));
  if (status.busy) throw new Error('ESP32 hosted worker is busy; no changes made');
  if (status.hostImageResident !== true || status.hostProcedureLocals !== true) {
    throw new Error('Pathway services require firmware with resident images and procedure-local metadata support; no changes made');
  }
  if (inventory && status.hostCobolText !== true) {
    throw new Error('COBOLish inventory requires firmware with bounded COBOL text bindings; no changes made');
  }
  const services = status.services ?? (status.collectorId ? [status] : []);
  if (services.some(service => service.collectorId === collectorId)) {
    throw new Error('Stock service is already installed; stop only its named context explicitly before replacing it');
  }
  if (services.length >= (status.serviceCapacity ?? 1)) {
    throw new Error('ESP32 has no free hosted-service slot; existing services were not changed');
  }
  const artifacts = await buildArtifacts(config);
  const uploads = [];
  for (const [label, artifact] of [['service', artifacts[inventory ? 'inventory-native-server' : 'stock-service']], ['daemon', artifacts['maintenance-daemon']]]) {
    const profile = inventory && label === 'service' ? 'extended' : 'bounded';
    const image = encodeHostedImage(artifact.pcodeText, { profile });
    const map = attachPcodeSignature({ ...compactServiceHostProgramMap(artifact.programMap),
      hostImageFormat: 'PHI1', hostImageProfile: profile, hostImageResident: true }, image);
    const file = `/pw-${collectorId}-${label}.phi`;
    const mapFile = `/pw-${collectorId}-${label}.json`;
    await uploadFfsFile(origin, file, image);
    await uploadFfsFile(origin, mapFile, JSON.stringify(map));
    console.log(`Uploaded ${collectorId} ${label} (${profile})`);
    uploads.push({ file, map: mapFile });
  }
  await nodeRequest(origin, '/pmachine/service_host/install', {
    values: {
      collectorId, serviceFile: uploads[0].file, serviceMap: uploads[0].map,
      daemons: JSON.stringify([{ ...uploads[1], udpPort: 0 }]),
      networkPeers: JSON.stringify([{ ip: (inventory ? config.inventoryGateway : config.stockGateway).address,
        port: (inventory ? config.inventoryGateway : config.stockGateway).port }]),
    }, timeoutMs: 60000,
  });
  let installed;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      installed = JSON.parse(await nodeRequest(origin,
        `/pmachine/service_host/status?collectorId=${encodeURIComponent(collectorId)}`, { timeoutMs: 10000 }));
      break;
    } catch (error) {
      if (error.status !== 503 || attempt === 9) throw error;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  if (installed.collectorId !== collectorId || !installed.running) throw new Error('ESP32 did not confirm the stock service');
  console.log(`Installed ${collectorId}; existing hosted services were retained`);
  return installed;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await installStockService(await loadConfiguration(), { inventory: process.argv.includes('--inventory') });
}
