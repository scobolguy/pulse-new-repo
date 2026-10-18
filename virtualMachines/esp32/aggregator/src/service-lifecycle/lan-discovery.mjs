import dgram from 'node:dgram';
import { randomInt, randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { performance } from 'node:perf_hooks';
import { createDiscoveryPolicy } from './discovery-policy.mjs';

export function readDiscoveryPort(value = process.env.UDP_PORT || '4210') {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Discovery UDP port must be an integer between 1 and 65535');
  }
  return port;
}

export function ipv4InterfaceFacts() {
  return Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
    (entries || []).filter(entry => entry.family === 'IPv4').map(entry => {
      const address = Buffer.from(entry.address.split('.').map(Number)).readUInt32BE();
      const mask = Buffer.from(entry.netmask.split('.').map(Number)).readUInt32BE();
      const broadcast = Buffer.alloc(4);
      broadcast.writeUInt32BE((address | ~mask) >>> 0);
      return {
        name, address: entry.address, netmask: entry.netmask, internal: entry.internal,
        broadcast: [...broadcast].join('.'),
      };
    }));
}

export function boundHttpDiscoveryListeners(address, interfaces = ipv4InterfaceFacts()) {
  if (!address || typeof address !== 'object' || !Number.isInteger(address.port) || address.port < 1) {
    throw new Error('Aggregator HTTP listener is not bound');
  }
  const hosts = ['0.0.0.0', '::'].includes(address.address)
    ? interfaces.map(item => item.address) : [address.address];
  return [...new Set(hosts)].map(host => ({ protocol: 'http', host, port: address.port }));
}

function send(socket, packet, port, address, maxBytes) {
  const bytes = Buffer.from(JSON.stringify(packet));
  if (bytes.length > maxBytes) throw new Error('Discovery packet capacity exceeded');
  return new Promise((resolve, reject) => socket.send(bytes, port, address, error =>
    error ? reject(error) : resolve()));
}

export async function attachDiscoveryResponder({
  socket, aggregatorId, bootId = randomUUID(), getListeners, logger = console,
  policyFactory = createDiscoveryPolicy,
}) {
  const policy = await policyFactory({ logger });
  const settings = await policy.dispatch('/settings');
  let pending = Promise.resolve();
  let queued = 0;
  let stopped = false;
  const onMessage = (bytes, peer) => {
    if (stopped) return;
    // Non-discovery datagrams remain owned by existing collectors.
    if (!bytes.includes(Buffer.from('pulseDiscoveryRequest'))) return;
    if (bytes.length > settings.maxPacketBytes || queued >= settings.maxTargets) {
      logger.warn('[DISCOVERY] Request capacity exceeded');
      return;
    }
    queued++;
    pending = pending.then(async () => {
      const { packet } = await policy.dispatch('/respond', {
        packet: JSON.parse(bytes.toString('utf8')), peer: peer.address,
        aggregatorId, bootId, listeners: await getListeners(),
      });
      await send(socket, packet, peer.port, peer.address, settings.maxPacketBytes);
    }).catch(error => logger.warn(`[DISCOVERY] Request rejected: ${error.message}`))
      .finally(() => { queued--; });
  };
  socket.on('message', onMessage);
  return {
    async stop() {
      stopped = true;
      socket.removeListener('message', onMessage);
      await pending;
      await policy.stop();
    },
  };
}

export async function createLanDiscovery({
  nodeId, bootId, port = readDiscoveryPort(), logger = console,
  interfaces = ipv4InterfaceFacts, socketFactory = () => dgram.createSocket('udp4'),
  clock = () => Math.floor(performance.now()), policyFactory = createDiscoveryPolicy,
  onTargets = async () => {},
  metadata = {},
}) {
  readDiscoveryPort(port);
  const policy = await policyFactory({ logger });
  const settings = await policy.dispatch('/settings');
  const now = () => {
    const value = Math.floor(clock());
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid discovery monotonic clock');
    return value % settings.clockPeriodMs;
  };
  const sockets = new Map();
  let targets = [];
  let requestId = '';
  let nextAt = -1;
  let timer;
  let pending = Promise.resolve();
  let queued = 0;
  let stopped = false;
  const enqueue = operation => {
    if (stopped) return Promise.resolve();
    if (queued >= settings.maxTargets) {
      logger.warn('[DISCOVERY] Event capacity exceeded');
      return Promise.resolve();
    }
    queued++;
    const result = pending.then(operation);
    pending = result.catch(error => logger.warn(`[DISCOVERY] ${error.message}`))
      .finally(() => { queued--; });
    return pending;
  };
  async function openInterface(address) {
    const socket = socketFactory();
    try {
      await new Promise((resolve, reject) => {
        socket.once('error', reject);
        socket.bind(0, address, () => {
          socket.removeListener('error', reject);
          resolve();
        });
      });
      socket.setBroadcast(true);
      socket.unref();
    } catch (error) {
      socket.close();
      throw error;
    }
    socket.on('error', error => logger.warn(`[DISCOVERY] UDP ${address}: ${error.message}`));
    socket.on('message', (bytes, peer) => {
      if (!bytes.includes(Buffer.from('pulseDiscoveryReply'))) return;
      if (bytes.length > settings.maxPacketBytes) {
        logger.warn('[DISCOVERY] Reply capacity exceeded');
        return;
      }
      const correlation = requestId;
      void enqueue(async () => {
        const result = await policy.dispatch('/accept', {
          packet: JSON.parse(bytes.toString('utf8')), peer: peer.address, localAddress: address,
          requestId: correlation, targets, nowMs: now(),
        });
        targets = result.targets;
        await onTargets(structuredClone(targets));
      });
    });
    sockets.set(address, socket);
    return socket;
  }
  async function poll() {
    const nowMs = now();
    const result = await policy.dispatch('/targets', { targets, nowMs });
    targets = result.targets;
    if (result.changed) await onTargets(structuredClone(targets));
    const { send: shouldSend } = await policy.dispatch('/poll', { nowMs, nextAt });
    if (!shouldSend) return;
    const { interfaces: active } = await policy.dispatch('/interfaces', { interfaces: interfaces() });
    const addresses = new Set(active.map(item => item.address));
    for (const [address, socket] of sockets) {
      if (!addresses.has(address)) {
        socket.close();
        sockets.delete(address);
      }
    }
    requestId = randomUUID();
    const request = await policy.dispatch('/request', {
      nodeId, bootId, requestId, nowMs, jitterMs: randomInt(settings.jitterMs + 1),
    });
    nextAt = request.nextAt;
    if (!active.length) logger.warn('[DISCOVERY] No active IPv4 LAN interface');
    for (const item of active) {
      try {
        const socket = sockets.get(item.address) || await openInterface(item.address);
        await send(socket, request.packet, port, item.broadcast, settings.maxPacketBytes);
      } catch (error) {
        logger.warn(`[DISCOVERY] Broadcast on ${item.address} failed: ${error.message}`);
      }
    }
  }
  return {
    getTargets: () => structuredClone(targets),
    getSettings: () => ({ ...settings }),
    async getOwnerUrl(ownerAggregatorId) {
      const result = await policy.dispatch('/owner-target', { ownerAggregatorId, targets, nowMs: now() });
      return result.endpoint;
    },
    async advertise(listeners) {
      targets = (await policy.dispatch('/targets', { targets, nowMs: now() })).targets;
      for (const target of targets) {
        const advertisement = await policy.dispatch('/advertise', {
          nodeId, localAddress: target.localAddress, listeners, metadata,
        });
        const socket = sockets.get(target.localAddress);
        if (!socket) throw new Error('Discovery interface is no longer bound');
        await send(socket, advertisement.packet, port, target.peer, settings.maxPacketBytes);
      }
    },
    describeTarget: (target, listeners) => policy.dispatch('/advertise', {
      nodeId, localAddress: target.localAddress, listeners,
    }),
    async start() {
      if (stopped) throw new Error('Discovery has stopped');
      if (timer) return;
      await enqueue(poll);
      timer = setInterval(() => { void enqueue(poll); }, settings.pollMs);
      timer.unref();
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      await pending;
      for (const socket of sockets.values()) socket.close();
      sockets.clear();
      await policy.stop();
    },
  };
}
