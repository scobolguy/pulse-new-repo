import dgram from 'node:dgram';
import { bindNodeDiscoverySocket, enrichDiscoveredNode } from './nodeDiscovery.mjs';
import { pruneDiscoveryNodes } from '../../discovery-topology.mjs';

export function createLocalDiscoveryRuntime({
  discoveredNodes,
  udpPort = 4210,
  httpPort = 4000,
  nodeId,
  getAnnouncement = () => ({}),
  getDetails = () => ({}),
  onAcknowledged = () => {},
  onNode = () => {},
  upsertRemoteQueueManager = () => {},
  upsertServiceInstance = () => {},
  probeEnabled = true,
  probeNodes = [],
  probeIntervalMs = 15000,
  probeTimeoutMs = 1500,
  fetchImpl = fetch,
  logger = console,
  createSocket = () => dgram.createSocket({ type: 'udp4', reuseAddr: true })
}) {
  const enrichmentAttempts = new Map();
  let socket;
  // Port 4210 is shared with collector daemons, so unicast replies to it may land elsewhere.
  // Outgoing traffic uses a private ephemeral socket whose replies only this runtime receives.
  let replySocket;
  let probeTimer;
  let cleanupTimer;
  let running = false;
  let probing = false;

  function send(host, port, payload) {
    if (!replySocket || !running) throw new Error('Local discovery is not running');
    const message = Buffer.from(JSON.stringify(payload));
    return new Promise((resolve, reject) => replySocket.send(message, port, host, (error) => error ? reject(error) : resolve()));
  }

  function enrich(key) {
    const now = Date.now();
    if (now - (enrichmentAttempts.get(key) || 0) < 5000) return;
    enrichmentAttempts.set(key, now);
    void enrichDiscoveredNode({ ip: key, discoveredNodes, fetchImpl, timeoutMs: 5000, logger });
  }

  function notify(node) {
    Promise.resolve().then(() => onNode(node)).catch((error) => logger.warn(`[DISCOVERY] Registry update: ${error.message}`));
  }

  function onMessage(message, info) {
    const ip = info.address;
    const raw = message.toString();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { nodeName: raw.slice(0, 32) };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      logger.warn(`[DISCOVERY] Invalid announcement from ${ip}`);
      return;
    }
    if (data.kind === 'nodeBeaconAck' && String(data.nodeId || '') === nodeId) {
      onAcknowledged();
      return;
    }
    const reply = (payload) => void send(ip, info.port, payload).catch((error) => logger.warn(`[DISCOVERY] UDP reply: ${error.message}`));
    if (data.kind === 'nodeDetailsRequest') {
      reply({ ...getDetails(), kind: 'nodeDetails', requestedAt: data.requestedAt || null });
      return;
    }
    const previous = discoveredNodes.get(ip) || {};
    const now = Date.now();
    const beacon = data.kind === 'nodeBeacon' || data.kind === 'machineAvailability';
    const capabilitiesChanged = Boolean(data.capabilitiesChanged)
      || (data.capabilityHash && previous.details?.capabilityHash !== data.capabilityHash);
    const node = {
      ...previous, ...data, ip, raw, lastSeen: now,
      details: {
        ...previous.details,
        ...(data.kind === 'nodeDetails' ? data : {}),
        ...(beacon ? { capabilityHash: data.capabilityHash, needsDetails: Boolean(data.needsDetails) } : {})
      }
    };
    if (beacon) {
      node.availability = { available: Boolean(data.available), draining: Boolean(data.draining), status: data.status || (data.available ? 'available' : 'unavailable') };
      node.beacon = { kind: data.kind, seenAt: now, capabilityHash: data.capabilityHash, capabilitiesChanged, needsDetails: Boolean(data.needsDetails), ackRequired: Boolean(data.ackRequired) };
      reply({ kind: 'nodeBeaconAck', nodeId, capabilityHash: getAnnouncement().capabilityHash, requestDetails: Boolean(capabilitiesChanged || data.needsDetails), ackedAt: now });
      if (capabilitiesChanged || data.needsDetails) {
        reply({ kind: 'nodeDetailsRequest', nodeId, requestedFields: ['status', 'services', 'topology'], requestedAt: now });
      }
    }
    discoveredNodes.set(ip, node);
    if (data.kind === 'queueManagerHeartbeat' || data.service === 'queue-manager') {
      upsertRemoteQueueManager({
        managerId: data.managerId || `${ip}:${data.port || httpPort}:${data.name || 'qm'}`,
        name: data.name || data.managerName, nodeId: data.nodeId || ip, ip,
        port: data.port || data.httpPort || httpPort, status: data.status || 'up', queues: data.queues
      });
    }
    if (data.serviceName) {
      upsertServiceInstance({ serviceName: data.serviceName, instanceId: data.instanceId, nodeId: data.nodeId || ip, ip, port: data.port || data.httpPort || httpPort, status: data.status || 'up', metadata: data.metadata });
    }
    if (data.kind !== 'nodeDetails') enrich(ip);
    if (beacon) notify(node);
  }

  async function probe(node, visited) {
    const host = String(node.host || '').trim();
    if (!host || visited.has(host)) return;
    visited.add(host);
    try {
      const response = await fetchImpl(`http://${host}:${Number(node.port || 80)}/status`, { signal: AbortSignal.timeout(probeTimeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const status = await response.json();
      if (String(status.hardware || '').toUpperCase() !== 'ESP32' || !running) return;
      const previous = discoveredNodes.get(host) || {};
      discoveredNodes.set(host, { ...previous, ip: host, nodeName: status.nodeName || previous.nodeName || host, lastSeen: Date.now(), raw: previous.raw || 'active-probe', details: { ...previous.details, ...status } });
      for (const peer of Array.isArray(status.discoveredNodes) ? status.discoveredNodes : []) {
        if (peer.ip && !peer.ip.startsWith('127.') && peer.ip !== '::1') await probe({ host: peer.ip, port: 80 }, visited);
      }
    } catch (error) {
      logger.warn(`[DISCOVERY] Probe ${host}: ${error.message}`);
    }
  }

  async function runProbes() {
    if (!running || probing || !probeEnabled) return;
    probing = true;
    try {
      const visited = new Set();
      for (const node of probeNodes) await probe(node, visited);
    } finally {
      probing = false;
    }
  }

  async function openSocket(port) {
    const created = createSocket();
    created.on('message', onMessage);
    created.on('error', (error) => logger.error(`[DISCOVERY] UDP ${port}: ${error.message}`));
    try {
      await bindNodeDiscoverySocket(created, port);
      return created;
    } catch (error) {
      await closeSocket(created);
      throw error;
    }
  }

  async function closeSocket(target) {
    if (!target) return;
    target.removeListener('message', onMessage);
    await new Promise((resolve) => {
      try { target.close(resolve); } catch (error) {
        if (error.code !== 'ERR_SOCKET_DGRAM_NOT_RUNNING') logger.warn(`[DISCOVERY] Socket cleanup: ${error.message}`);
        resolve();
      }
    });
  }

  return {
    async start() {
      if (running) return;
      socket = await openSocket(udpPort);
      try {
        replySocket = await openSocket(0);
      } catch (error) {
        await closeSocket(socket);
        socket = undefined;
        throw error;
      }
      running = true;
      logger.log(`[DISCOVERY] Shared UDP listener on ${socket.address().port}, replies from ${replySocket.address().port}`);
      cleanupTimer = setInterval(() => {
        pruneDiscoveryNodes(discoveredNodes);
        for (const key of enrichmentAttempts.keys()) if (!discoveredNodes.has(key)) enrichmentAttempts.delete(key);
      }, 1000);
      cleanupTimer.unref();
      if (probeEnabled && probeNodes.length) {
        void runProbes();
        probeTimer = setInterval(runProbes, probeIntervalMs);
        probeTimer.unref();
      }
    },
    async stop() {
      running = false;
      clearInterval(probeTimer);
      clearInterval(cleanupTimer);
      await Promise.all([closeSocket(socket), closeSocket(replySocket)]);
      socket = undefined;
      replySocket = undefined;
    },
    announce(payload) { return send('255.255.255.255', socket && running ? socket.address().port : udpPort, payload); },
    getStatus() {
      return {
        running, status: running ? 'healthy' : 'unavailable', shared: true,
        udpPort: socket && running ? socket.address().port : udpPort,
        replyPort: replySocket && running ? replySocket.address().port : null
      };
    }
  };
}
