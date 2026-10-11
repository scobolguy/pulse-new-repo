#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createJsPmachineNodeServer } from './server.mjs';
import { installBluetoothCollector } from './install-bluetooth-collector.mjs';

export async function deployBluetoothCollector({ port = 4113, logger = console, bluetoothSourceFactory } = {}) {
  const collectorId = 'pc-bluetooth-collector';
  const server = createJsPmachineNodeServer({
    name: 'pc-bluetooth-js', logger, bluetoothGrants: [collectorId], bluetoothSourceFactory
  });
  let origin, closing;
  const stop = () => closing ??= (async () => {
    try {
      if (origin && server.listening) {
        const response = await fetch(`${origin}/pmachine/service_host/stop`, {
          method: 'POST', signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`Bluetooth stop failed: HTTP ${response.status}`);
      }
    } finally {
      if (server.listening) {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }
    }
  })();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    const status = await installBluetoothCollector({ origin });
    logger.log(`[BLUETOOTH] Pascalish collector ready: ${origin}/api/bluetooth/devices`);
    return { origin, status, stop };
  } catch (error) {
    try { await stop(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Bluetooth deployment and cleanup failed'); }
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const runtime = await deployBluetoothCollector();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    runtime.stop().catch(error => { console.error(error); process.exitCode = 1; });
  });
}
