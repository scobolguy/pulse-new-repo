import { performance } from 'node:perf_hooks';
import { DISCOVERY_NODE_MAX_AGE_MS, pruneDiscoveryNodes } from '../../discovery-topology.mjs';
import { DISCOVERY_PROTOCOL_VERSION, discoveryNodeIdentity, normalizeNodeAnnouncement } from './discoveryCollector.mjs';
import { createLocalDiscoveryRuntime } from './localDiscoveryRuntime.mjs';

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function readDiscoveryProviderConfig(env = process.env) {
  const mode = String(env.PULSE_DISCOVERY_MODE || 'local').trim().toLowerCase();
  if (!['local', 'remote'].includes(mode)) throw new Error('PULSE_DISCOVERY_MODE must be local or remote');
  const collectorUrls = [...new Set(String(env.PULSE_DISCOVERY_COLLECTOR_URLS || '').split(',')
    .map((value) => value.trim()).filter(Boolean).map((value) => {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        throw new Error('PULSE_DISCOVERY_COLLECTOR_URLS must contain HTTP(S) origins without credentials');
      }
      return url.origin;
    }))];
  if (mode === 'remote' && collectorUrls.length === 0) throw new Error('Remote discovery requires PULSE_DISCOVERY_COLLECTOR_URLS');
  return {
    mode, collectorUrls,
    pollIntervalMs: positiveInteger(env.PULSE_DISCOVERY_POLL_INTERVAL_MS, 5000, 'PULSE_DISCOVERY_POLL_INTERVAL_MS'),
    timeoutMs: positiveInteger(env.PULSE_DISCOVERY_TIMEOUT_MS, 3000, 'PULSE_DISCOVERY_TIMEOUT_MS')
  };
}

export function createDiscoveryProvider({
  config = readDiscoveryProviderConfig(),
  discoveredNodes,
  fetchImpl = fetch,
  now = () => performance.now(),
  wallNow = Date.now,
  logger = console,
  onNodesChanged = () => {},
  localOptions = {},
  createLocalRuntime = createLocalDiscoveryRuntime
}) {
  if (config.mode === 'local') {
    const runtime = createLocalRuntime({ ...localOptions, discoveredNodes, fetchImpl, logger });
    return {
      mode: 'local',
      start: () => runtime.start(),
      stop: () => runtime.stop(),
      announce: (payload) => runtime.announce(payload),
      getNodes: () => { pruneDiscoveryNodes(discoveredNodes); return [...discoveredNodes.values()]; },
      getStatus: () => ({ mode: 'local', ...runtime.getStatus() })
    };
  }
  if (config.mode !== 'remote' || !config.collectorUrls?.length) throw new Error('Invalid discovery provider configuration');

  const collectors = config.collectorUrls.map((url) => ({
    url, collectorId: null, bootId: null, sequence: -1, retiredBootIds: new Set(),
    observations: new Map(), reachable: false, lastSuccessAt: null, error: null
  }));
  const ownedKeys = new Set();
  const activeRequests = new Set();
  let running = false;
  let pollTimer;
  let expiryTimer;
  let refreshPromise;
  let stopped = false;
  let projectionSignature = '';

  function reconcile() {
    const timestamp = now();
    const merged = new Map();
    for (const collector of collectors) {
      for (const [id, observation] of collector.observations) {
        if (observation.deadline <= timestamp) {
          collector.observations.delete(id);
          continue;
        }
        if (!merged.has(id) || merged.get(id).deadline < observation.deadline) merged.set(id, observation);
      }
    }
    for (const key of ownedKeys) discoveredNodes.delete(key);
    ownedKeys.clear();
    const nodes = [];
    for (const [id, observation] of merged) {
      const remaining = observation.deadline - timestamp;
      const node = {
        ...observation.node,
        lastSeen: wallNow() - (DISCOVERY_NODE_MAX_AGE_MS - remaining),
        beacon: undefined,
        discovery: { provider: 'remote', collectorId: observation.collectorId, remainingTtlMs: remaining }
      };
      const key = `collector:${id}`;
      discoveredNodes.set(key, node);
      ownedKeys.add(key);
      nodes.push(node);
    }
    const signature = [...merged].map(([id, observation]) => `${id}:${observation.collectorId}:${observation.deadline}`).sort().join('|');
    if (signature !== projectionSignature) {
      projectionSignature = signature;
      onNodesChanged(nodes);
    }
    return nodes;
  }

  async function request(url, options = {}) {
    const controller = new AbortController();
    activeRequests.add(controller);
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(url, { cache: 'no-store', ...options, signal: controller.signal });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${await response.text()}`);
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
      activeRequests.delete(controller);
    }
  }

  function validateSnapshot(payload, collector, startedAt) {
    if (!payload || payload.protocolVersion !== DISCOVERY_PROTOCOL_VERSION
      || typeof payload.collectorId !== 'string' || !payload.collectorId.trim()
      || typeof payload.bootId !== 'string' || !payload.bootId.trim()
      || !Number.isSafeInteger(payload.sequence) || payload.sequence < 0 || !Array.isArray(payload.nodes)) {
      throw new Error('Invalid discovery snapshot v1');
    }
    if (collector.collectorId && payload.collectorId !== collector.collectorId) throw new Error('Collector identity changed');
    if (collectors.some((other) => other !== collector && other.collectorId === payload.collectorId)) {
      throw new Error('Collector IDs must be unique');
    }
    if (collector.retiredBootIds.has(payload.bootId)
      || (payload.bootId === collector.bootId && payload.sequence <= collector.sequence)) {
      throw new Error('Replayed or out-of-order discovery snapshot');
    }
    const observations = new Map();
    for (const node of payload.nodes) {
      const id = discoveryNodeIdentity(node);
      const ttl = node?.remainingTtlMs;
      const port = Number(node?.port ?? node?.httpPort ?? 80);
      const details = node?.details;
      if (!node || typeof node !== 'object' || Array.isArray(node) || !id || !String(node.ip || '').trim()
        || !Number.isInteger(port) || port < 1 || port > 65535
        || !Number.isFinite(ttl) || ttl < 0 || ttl > DISCOVERY_NODE_MAX_AGE_MS || observations.has(id)
        || (details !== undefined && (!details || typeof details !== 'object' || Array.isArray(details)))
        || (details?.services !== undefined && (!Array.isArray(details.services) || details.services.some((service) =>
          !String(typeof service === 'string' ? service : service?.name || service?.serviceName || '').trim())))) {
        throw new Error('Invalid or duplicate node observation');
      }
      observations.set(id, {
        node: { ...node, nodeId: id, port }, collectorId: payload.collectorId,
        deadline: startedAt + ttl
      });
    }
    return observations;
  }

  async function poll(collector) {
    const startedAt = now();
    try {
      let cursor = '';
      let payload;
      let previousSequence = -1;
      const cursors = new Set();
      const nodes = [];
      for (let pageNumber = 0; pageNumber < 52; pageNumber += 1) {
        const url = new URL(`${collector.url}/api/discovery/snapshot`);
        if (cursor) url.searchParams.set('cursor', cursor);
        let page;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            page = await request(url);
            break;
          } catch (error) {
            const retryable = error.status === 503 || error instanceof TypeError || error.name === 'AbortError';
            if (!retryable || attempt === 3 || stopped) throw error;
            await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
          }
        }
        if (!page || typeof page !== 'object' || Array.isArray(page)
          || !Array.isArray(page.nodes)) throw new Error('Invalid discovery snapshot page');
        if (payload && (page.protocolVersion !== payload.protocolVersion
          || page.collectorId !== payload.collectorId || page.bootId !== payload.bootId)) {
          throw new Error('Discovery snapshot page metadata changed');
        }
        if (!Number.isSafeInteger(page.sequence) || page.sequence < previousSequence) {
          throw new Error('Invalid discovery snapshot page sequence');
        }
        previousSequence = page.sequence;
        payload = page;
        if (page.continuation === undefined) {
          if (pageNumber > 0) throw new Error('Missing discovery snapshot continuation');
          nodes.push(...page.nodes);
          break;
        }
        if (!['continue', 'end'].includes(page.continuation) || page.nodes.length > 5) {
          throw new Error('Invalid discovery snapshot continuation');
        }
        nodes.push(...page.nodes);
        if (nodes.length > 255) throw new Error('Discovery snapshot exceeds collector capacity');
        if (page.continuation === 'end') break;
        if (typeof page.nextCursor !== 'string' || !page.nextCursor || cursors.has(page.nextCursor)) {
          throw new Error('Invalid discovery snapshot cursor');
        }
        cursors.add(page.nextCursor);
        cursor = page.nextCursor;
        if (pageNumber === 51) throw new Error('Discovery snapshot has too many pages');
      }
      if (!payload || payload.continuation === 'continue') {
        throw new Error('Discovery snapshot did not terminate');
      }
      payload = { ...payload, nodes };
      if (stopped) return;
      const observations = validateSnapshot(payload, collector, startedAt);
      if (collector.bootId && collector.bootId !== payload.bootId) collector.retiredBootIds.add(collector.bootId);
      collector.collectorId = payload.collectorId;
      collector.bootId = payload.bootId;
      collector.sequence = payload.sequence;
      collector.observations = observations;
      collector.reachable = true;
      collector.lastSuccessAt = wallNow();
      collector.error = null;
    } catch (error) {
      if (stopped) return;
      collector.reachable = false;
      collector.error = error.message;
      logger.warn(`[DISCOVERY] Collector ${collector.url}: ${error.message}`);
    }
  }

  function refresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = Promise.all(collectors.map(poll)).then(() => reconcile()).finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  return {
    mode: 'remote',
    async start() {
      if (running) return;
      stopped = false;
      running = true;
      await refresh();
      if (!running) return;
      pollTimer = setInterval(refresh, config.pollIntervalMs);
      expiryTimer = setInterval(reconcile, 1000);
      pollTimer.unref();
      expiryTimer.unref();
    },
    async stop() {
      stopped = true;
      running = false;
      clearInterval(pollTimer);
      clearInterval(expiryTimer);
      for (const controller of activeRequests) controller.abort();
      if (refreshPromise) await refreshPromise;
      for (const collector of collectors) collector.observations.clear();
      reconcile();
    },
    refresh,
    getNodes() { reconcile(); return [...discoveredNodes.values()]; },
    getStatus() {
      reconcile();
      const healthy = collectors.filter((collector) => collector.reachable).length;
      return {
        mode: 'remote', running, status: healthy === collectors.length ? 'healthy' : healthy ? 'degraded' : 'unavailable',
        collectors: collectors.map(({ url, collectorId, bootId, sequence, reachable, lastSuccessAt, error, observations }) => ({
          url, collectorId, bootId, sequence, reachable, lastSuccessAt, error, nodes: observations.size
        }))
      };
    },
    async announce(body) {
      const announcement = normalizeNodeAnnouncement(body);
      const results = await Promise.all(collectors.map(async (collector) => {
        try {
          await request(`${collector.url}/api/pmachine/announce`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(announcement)
          });
          return { url: collector.url, delivered: true };
        } catch (error) {
          logger.warn(`[DISCOVERY] Announcement to ${collector.url}: ${error.message}`);
          return { url: collector.url, delivered: false, error: error.message };
        }
      }));
      if (!results.some((result) => result.delivered)) throw Object.assign(new Error('No discovery collector accepted the announcement'), { status: 503 });
      return { degraded: results.some((result) => !result.delivered), collectors: results };
    }
  };
}
