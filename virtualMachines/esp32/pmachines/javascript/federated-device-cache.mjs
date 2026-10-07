import fs from 'node:fs/promises';
import os from 'node:os';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from './src/service-host.mjs';
import { createDeviceFederation, serveDeviceFederation } from './src/device-federation.mjs';
import { createSsdpNames } from './src/ssdp-names.mjs';

export async function loadFederationConfig(path = new URL('../../config/federated-device-cache.json', import.meta.url)) {
  const config = JSON.parse(await fs.readFile(path, 'utf8'));
  config.kasaHttpPort ??= 4309;
  const origin = new URL(config.esp32Origin);
  const interfaces = Object.values(os.networkInterfaces()).flat().filter(item => item.family === 'IPv4' && !item.internal);
  const candidates = interfaces.filter(item => item.address.split('.').slice(0, 3).join('.') === origin.hostname.split('.').slice(0, 3).join('.'));
  const selected = config.lanInterface ? interfaces.find(item => item.address === config.lanInterface) : candidates.length === 1 ? candidates[0] : null;
  if (!selected) throw new Error('Configure lanInterface: no unique active IPv4 interface on the ESP32 subnet');
  if (config.httpHost !== '127.0.0.1') throw new Error('Collector HTTP and aggregation are restricted to loopback on this trusted PC');
  for (const name of ['tuyaHttpPort', 'ssdpHttpPort', 'aggregationHttpPort', 'tuyaUdpPort', 'ssdpUdpPort']) {
    if (!Number.isInteger(config[name]) || config[name] < 1 || config[name] > 65535) throw new Error(`Invalid ${name}`);
  }
  if (new Set([config.tuyaHttpPort, config.ssdpHttpPort, config.aggregationHttpPort]).size !== 3 ||
      config.tuyaUdpPort === config.ssdpUdpPort || config.observationTtlMs !== 180000 ||
      !Number.isInteger(config.refreshMs) || config.refreshMs < 10000 || config.refreshMs > 60000 ||
      !Array.isArray(config.kasaPeers) || config.kasaPeers.length !== 2 || config.kasaPeers.some(ip => net.isIP(ip) !== 4)) {
    throw new Error('Invalid bounded federation configuration');
  }
  if (config.ssdpDescriptionPorts !== undefined && (!Array.isArray(config.ssdpDescriptionPorts) ||
      config.ssdpDescriptionPorts.length < 1 || config.ssdpDescriptionPorts.length > 16 ||
      config.ssdpDescriptionPorts.some(port => !Number.isInteger(port) || port < 1 || port > 65535))) {
    throw new Error('Invalid ssdpDescriptionPorts allowlist');
  }
  return { ...config, lanInterface: selected.address };
}

export async function startFederatedDeviceCache(config, logger = console, { collectors = true } = {}) {
  const compile = async name => compilePascalishProgramWithAntlr(await fs.readFile(new URL(`../../src/${name}`, import.meta.url), 'utf8'), { hostServices: true });
  const service = collectors ? await compile('device-cache-service.pas') : null;
  const hosts = [];
  const ssdpNames = createSsdpNames({ logger, allowedPorts: config.ssdpDescriptionPorts ?? [80, 8200] });
  let aggregation;
  try {
    for (const protocol of collectors ? ['tuya', 'ssdp'] : []) {
      const daemon = await compile(`${protocol}-collector-daemon.pas`);
      const host = await createPascalishServiceHost({
        compiled: service, collectorId: `${protocol}-js`, host: config.httpHost, httpPort: config[`${protocol}HttpPort`], udpPort: null,
        daemons: [{ compiled: daemon, udpPort: config[`${protocol}UdpPort`], udpBindAddress: '0.0.0.0',
          ...(protocol === 'ssdp' ? { udpShared: true } : {}),
          ...(protocol === 'ssdp' ? { multicastGroup: '239.255.255.250', multicastInterface: config.lanInterface } : {}) }],
        bindings: { 'host.observation_ttl': () => config.observationTtlMs },
        maxEvents: 4, maxBodyBytes: 1024, maxResponseBytes: 4096, maxStorageBytes: 16384, logger,
        ...(protocol === 'ssdp' ? { onDaemonEvent: ssdpNames.observe } : {})
      });
      hosts.push(host);
      await host.start();
      logger.log(`[DEVICE-FEDERATION] ${protocol}-js: separate p-machine/cache/boot, HTTP ${config.httpHost}:${config[`${protocol}HttpPort`]}, passive UDP ${config[`${protocol}UdpPort`]}`);
    }
    const federation = createDeviceFederation({ logger, resolveName: ssdpNames.resolve, sources: config.sources ?? [
      collectors
        ? { protocol: 'kasa', collectorId: config.kasaCollectorId, origin: config.esp32Origin }
        : { protocol: 'kasa', collectorId: 'kasa-js', origin: `http://${config.httpHost}:${config.kasaHttpPort}` },
      { protocol: 'pulse', collectorId: 'pulse-node-collector', origin: config.pulseCollectorUrl ?? 'http://127.0.0.1:4111' },
      { protocol: 'tuya', collectorId: 'tuya-js', origin: `http://${config.httpHost}:${config.tuyaHttpPort}` },
      { protocol: 'ssdp', collectorId: 'ssdp-js', origin: `http://${config.httpHost}:${config.ssdpHttpPort}` }
    ] });
    aggregation = await serveDeviceFederation(federation, { host: config.httpHost, port: config.aggregationHttpPort, intervalMs: config.refreshMs });
    logger.log(`[DEVICE-FEDERATION] Native JS materialized aggregation, ${federation.metadata().sources.length} configured pull sources, capacity 150; LAN interface ${config.lanInterface}. PC logical collectors do not prove physical failure independence. API http://${config.httpHost}:${config.aggregationHttpPort}/api/devices/names`);
    // Serving starts before the initial bounded pull: unavailable sources remain explicit.
    federation.refresh().catch(error => logger.error(error));
    return { federation, hosts, aggregation, stop: async () => { ssdpNames.stop(); await aggregation.stop(); for (const host of hosts) await host.stop(); } };
  } catch (error) {
    ssdpNames.stop();
    if (aggregation) await aggregation.stop();
    for (const host of hosts) await host.stop();
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const configPath = process.argv.slice(2).find(argument => !argument.startsWith('--'));
  const runtime = await startFederatedDeviceCache(await loadFederationConfig(configPath), console, {
    collectors: !process.argv.includes('--aggregation-only')
  });
  const stop = () => runtime.stop().catch(error => { console.error(error); process.exitCode = 1; });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
