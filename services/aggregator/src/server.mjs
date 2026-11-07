import dgram from 'node:dgram';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { LiveRegistry, DEFAULT_TTL_MS } from './registry.mjs';

const AGGREGATOR_ID = 'aggregator';

// A node must answer its own /status to be listed.
async function fetchStatus(node, fetchImpl, timeoutMs) {
  try {
    const response = await fetchImpl(`http://${node.ip}:${node.httpPort}/status`, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export function createAggregator({
  udpPort = 4210, httpPort = 4000, host = '0.0.0.0', ttlMs = DEFAULT_TTL_MS,
  probe = true, probeTimeoutMs = 1500, fetchImpl = fetch, clock = Date.now, log = console
} = {}) {
  const registry = new LiveRegistry({ ttlMs, clock });
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  let server = null;

  socket.on('error', error => log.error(`[aggregator] UDP: ${error.message}`));
  socket.on('message', (message, info) => {
    let data;
    try { data = JSON.parse(message.toString()); } catch { return; }
    const node = registry.observe(data, info.address);
    if (!node) return;
    const ack = Buffer.from(JSON.stringify({ kind: 'nodeBeaconAck', nodeId: AGGREGATOR_ID, ackedAt: clock() }));
    socket.send(ack, info.port, info.address, error => {
      if (error) log.warn(`[aggregator] ack to ${info.address}: ${error.message}`);
    });
  });

  async function activeNodes() {
    const nodes = registry.list();
    if (!probe) return nodes;
    const statuses = await Promise.all(nodes.map(node => fetchStatus(node, fetchImpl, probeTimeoutMs)));
    return nodes.filter((node, index) => {
      if (!statuses[index]) registry.remove(node.nodeId);
      return Boolean(statuses[index]);
    });
  }

  function send(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    if (url.pathname === '/api/nodes') return send(res, 200, await activeNodes());
    if (url.pathname === '/api/health') return send(res, 200, { status: 'ok', ttlMs, probe });
    return send(res, 404, { error: 'Not found' });
  }

  return {
    registry,
    async start() {
      await new Promise((resolve, reject) => {
        socket.once('error', reject);
        socket.bind(udpPort, host, () => { socket.off('error', reject); resolve(); });
      });
      server = http.createServer((req, res) => {
        handle(req, res).catch(error => send(res, 500, { error: error.message }));
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(httpPort, host, resolve);
      });
      return { udpPort: socket.address().port, httpPort: server.address().port };
    },
    async stop() {
      await new Promise(resolve => socket.close(resolve));
      if (server) await new Promise(resolve => server.close(resolve));
    }
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const env = process.env;
  const aggregator = createAggregator({
    udpPort: Number(env.UDP_PORT ?? 4210),
    httpPort: Number(env.HTTP_PORT ?? env.PORT ?? 4000),
    ttlMs: Number(env.BEACON_TTL_MS ?? DEFAULT_TTL_MS),
    probe: env.PROBE !== '0'
  });
  const ports = await aggregator.start();
  console.log(`[aggregator] beacons on UDP ${ports.udpPort}, API on http://localhost:${ports.httpPort}/api/nodes`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => aggregator.stop().then(() => process.exit(0)));
}
