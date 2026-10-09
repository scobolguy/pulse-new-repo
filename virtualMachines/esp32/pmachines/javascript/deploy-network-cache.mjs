#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createJsPmachineNodeServer } from './server.mjs';
import { installNetworkCollectors } from './install-network-collectors.mjs';
import { installPulseNodeCollector } from './install-pulse-node-collector.mjs';
import { loadFederationConfig, startFederatedDeviceCache } from './federated-device-cache.mjs';

export async function deployNetworkCache({ logger = console } = {}) {
  const config = await loadFederationConfig();
  const origin = 'http://127.0.0.1:4111';
  const server = createJsPmachineNodeServer({
    name: 'network-cache-js', port: 4111, host: '127.0.0.1', logger
  });
  let aggregation;
  let installed;
  let closing;
  async function close() {
    const errors = [];
    if (aggregation) {
      try { await aggregation.stop(); } catch (error) { errors.push(error); }
    }
    for (const collectorId of installed?.collectorIds || []) {
      try {
        const response = await fetch(`${origin}/pmachine/service_host/stop`, {
          method: 'POST', body: new URLSearchParams({ collectorId }),
          signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error(`Stopping ${collectorId}: HTTP ${response.status}`);
      } catch (error) { errors.push(error); }
    }
    if (server.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    if (errors.length) throw new AggregateError(errors, 'Network cache cleanup failed');
  }
  const stop = () => closing ??= close();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(4111, '127.0.0.1', resolve);
    });
    logger.log(`[DEPLOY] JS PMachine ${origin}; existing listeners are never replaced.`);
    installed = await installNetworkCollectors({ origin, config, logger });
    const pulse = await installPulseNodeCollector({ origin });
    installed.collectorIds.push(pulse.collectorId);
    logger.log(`[DEPLOY] ${pulse.collectorId}: shared UDP 4210, primary service on ${origin}`);
    aggregation = await startFederatedDeviceCache(config, logger, { collectors: false });
    const response = await fetch(`http://${config.httpHost}:${config.aggregationHttpPort}/api/devices`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`Cache readiness: HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page.records)) throw new Error('Invalid cache readiness response');
    logger.log(`[DEPLOY] Ready: ${installed.collectorIds.join(', ')} on JS PMachine; cache API http://${config.httpHost}:${config.aggregationHttpPort}/api/devices`);
    logger.log('[DEPLOY] Keep this task running. Stopping it removes its hosted collectors and closes the cache API. Source coverage is reported separately by the cache.');
    return { stop };
  } catch (error) {
    try { await stop(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Deployment and cleanup failed'); }
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const runtime = await deployNetworkCache();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      runtime.stop().catch(error => { console.error(error); process.exitCode = 1; });
    });
  }
}
