import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCobolishToPcode } from '../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';
import { compileScreenCobol } from '../../../languages/screencobol/src/compiler.mjs';
import { PathwayController } from './src/controller.mjs';
import { createPathwayHttpServer } from './src/http-server.mjs';
import { createJsPmachineNodeServer } from '../pmachines/javascript/server.mjs';
import { randomBytes } from 'node:crypto';
import { createStockGateway } from './src/stock-gateway.mjs';
import { createNodeAdapter, nodeRequest, isDefinitiveRejection } from './src/node-adapter.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const inventory = process.argv.includes('--inventory');
const configuration = inventory ? await (await import('../pathwayDemo/database.mjs')).loadConfiguration() : null;
let inventoryToken;
const adapter = createNodeAdapter({ timeoutMs: 6000 });
const controllerAdapter = {
  ...adapter,
  async send(node, definition, record, options = {}) {
    if (inventory && definition.name === 'inventory-service') {
      return JSON.parse(await nodeRequest(node.origin, definition.path, {
        text: JSON.stringify({ data: record, requestId: options.requestId, inventoryToken }), timeoutMs: 6000,
      }));
    }
    return adapter.send(node, definition, record, options);
  },
};
const example = inventory ? 'inventory' : 'echo';
const stateFile = process.env.PATHWAY_STATE_FILE || (configuration ?
  path.resolve(root, '..', 'pathwayDemo', configuration.controller.stateFile) :
  path.join(root, '.state', inventory ? 'inventory-controller.json' : 'controller.json'));
const controller = new PathwayController({
  stateFile,
  allowedHosts: process.env.PATHWAY_ALLOWED_HOSTS ? process.env.PATHWAY_ALLOWED_HOSTS.split(',') :
    configuration?.controller.allowedHosts ?? ['127.0.0.1'],
  beaconTtlMs: 10000, reconcileMs: 1000,
  adapter: controllerAdapter,
});
const nodes = [];
let web;
let stockWeb;
let stockGateway;
let inventoryStore;
let inventoryGateway;
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  if (web) await new Promise(resolve => web.close(resolve));
  if (stockWeb) await new Promise(resolve => stockWeb.close(resolve));
  await controller.close();
  for (const node of nodes) await new Promise(resolve => node.close(resolve));
  if (inventoryGateway) await inventoryGateway.close();
  if (stockGateway) await stockGateway.close();
  if (inventoryStore) await inventoryStore.close();
}
try {
  if (inventory && process.argv.includes('--external-nodes')) {
    throw new Error('Inventory demo currently provisions local JS nodes with explicit authority grants; external nodes need operator-supplied grants');
  }
  await controller.open();
  const udp = await controller.listen({ udpPort: Number(process.env.PATHWAY_UDP_PORT || configuration?.controller.udpPort || (inventory ? 4323 : 4321)) });
  if (inventory) {
    inventoryStore = await (await import('../pathwayDemo/database.mjs')).openDatabase(configuration);
    stockGateway = await createStockGateway({ store: inventoryStore, ...configuration.stockGateway });
    inventoryToken = randomBytes(32).toString('hex');
    inventoryGateway = await createStockGateway({ store: inventoryStore, ...configuration.inventoryGateway,
      transactionToken: inventoryToken });
  }
  if (!process.argv.includes('--external-nodes')) {
    for (let i = 1; i <= (inventory ? 6 : 3); i++) {
      const nodeName = inventory ? `pathway-inventory-js-${i}` : `pathway-js-${i}`;
      const node = createJsPmachineNodeServer({
        name: nodeName, advertiseHost: '127.0.0.1', port: 0,
        udpAnnounceHost: '127.0.0.1', udpAnnouncePort: udp.port, announceIntervalMs: 1000,
      });
      await new Promise(resolve => node.listen(0, '127.0.0.1', resolve));
      nodes.push(node);
      console.log(`[PATHWAY] ${i > (inventory ? 4 : 2) ? 'spare' : 'server'} node ${nodeName}: http://127.0.0.1:${node.address().port}`);
    }
  }
  const artifacts = inventory ? await (await import('../pathwayDemo/build.mjs')).buildArtifacts(configuration) : null;
  const artifact = artifacts?.['inventory-server'] ?? compileCobolishToPcode(
    await fs.readFile(path.join(root, 'examples', `${example}.cob`), 'utf8'), { hostServices: true });
  const requester = artifacts?.['inventory-requester'] ?? compileScreenCobol(
    await fs.readFile(path.join(root, 'examples', `${example}.scob`), 'utf8'));
  await controller.define({ name: inventory ? 'inventory-service' : 'echo', replicas: configuration?.controller.replicas ?? 2,
    idempotent: true, artifact,
    ...(inventory ? { networkPeers: [{ ip: configuration.inventoryGateway.address, port: inventoryGateway.port }] } : {}) });
  const inventoryController = Object.create(controller);
  inventoryController.send = async (name, record, options = {}) => {
    if (inventory && configuration.esp32?.preferForInventory && name === 'inventory-service') {
      if (typeof options.requestId !== 'string' || !/^[A-Za-z0-9_-]{16,96}$/.test(options.requestId)) {
        throw Object.assign(new Error('Inventory transactions require a stable requester request ID'), { status: 400 });
      }
      if (typeof record !== 'string' || !/^[\x20-\x7e]{1,64}$/.test(record)) {
        throw Object.assign(new Error('Inventory command must fit its 64-character record'), { status: 400 });
      }
      try {
        const reply = JSON.parse(await nodeRequest(configuration.esp32.origin, '/api/pathway/inventory-service', {
          text: JSON.stringify({ data: record, requestId: options.requestId, inventoryToken }),
          timeoutMs: 6000,
        }));
        if (reply.code !== 0 || typeof reply.data !== 'string' || reply.data.length > 512) {
          throw new Error('Invalid native inventory reply');
        }
        return { ...reply, nodeId: configuration.esp32.inventoryCollectorId };
      } catch (error) {
        if (isDefinitiveRejection(error) && error.status !== 404) throw Object.assign(error, { uncertain: false });
        controller.report(`Native inventory request failed; recovering same ID on JS replicas: ${error.message}`);
      }
    }
    return controller.send(name, record, options);
  };
  inventoryController.report = message => controller.report(message);
  inventoryController.snapshot = () => ({ ...controller.snapshot(),
    ...(inventory ? { inventoryPrimary: configuration.esp32?.preferForInventory ? configuration.esp32.origin : 'js' } : {}) });
  web = await createPathwayHttpServer(inventoryController, requester, {
    host: configuration?.requester.host ?? '127.0.0.1',
    port: Number(process.env.PATHWAY_HTTP_PORT || configuration?.requester.port || (inventory ? 4322 : 4320)),
  });
  if (inventory) {
    await controller.define({ name: 'inventory-stock', replicas: configuration.controller.replicas,
      idempotent: true, artifact: artifacts['stock-service'],
      networkPeers: [{ ip: configuration.stockGateway.address, port: stockGateway.port }] });
    const stockController = Object.create(controller);
    stockController.send = async (name, record, options) => {
      if (name !== 'inventory-stock') throw new Error('Stock requester can only call inventory-stock');
      if (configuration.esp32?.preferForStock) {
        try {
          const native = { origin: configuration.esp32.origin, runtime: 'esp32' };
          const status = JSON.parse(await nodeRequest(native.origin,
            `/pmachine/service_host/status?collectorId=${encodeURIComponent(configuration.esp32.collectorId)}`));
          if (!status.running || status.collectorId !== configuration.esp32.collectorId) {
            throw new Error('Native stock service is not running');
          }
          const reply = await createNodeAdapter().send(native, { path: '/api/pathway/inventory-stock' }, record, options);
          if (reply.code !== 0 || typeof reply.data !== 'string') throw new Error('Invalid native stock reply');
          const counts = JSON.parse(reply.data);
          if (!Number.isInteger(counts.inStock) || !Number.isInteger(counts.committed) ||
              counts.inStock < 0 || counts.committed < 0 || counts.committed > counts.inStock) {
            throw new Error('Invalid native stock counts');
          }
          return { ...reply, nodeId: configuration.esp32.collectorId };
        } catch (error) {
          if (isDefinitiveRejection(error)) throw Object.assign(error, { uncertain: false });
          controller.report(`Native stock query failed; trying JS replicas: ${error.message}`);
        }
      }
      return controller.send(name, record, options);
    };
    stockController.snapshot = () => ({ ...controller.snapshot(),
      stockPrimary: configuration.esp32?.preferForStock ? configuration.esp32.origin : 'js' });
    stockController.report = message => controller.report(message);
    stockWeb = await createPathwayHttpServer(stockController, artifacts['stock-requester'], {
      host: configuration.requester.host, port: configuration.requester.stockPort,
    });
    console.log(`[PATHWAY] Stock requester http://127.0.0.1:${stockWeb.address().port}`);
  }
  console.log(`[PATHWAY] Requester http://127.0.0.1:${web.address().port}; state ${stateFile}`);
  console.log('[PATHWAY] Ctrl+C stops the demo; definitions survive restart. External hosted services are not removed.');
  process.once('SIGINT', () => shutdown().catch(error => { console.error(error); process.exitCode = 1; }));
  process.once('SIGTERM', () => shutdown().catch(error => { console.error(error); process.exitCode = 1; }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  await shutdown();
}
