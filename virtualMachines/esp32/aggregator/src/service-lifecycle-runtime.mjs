import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createServiceInstancePolicy } from './service-lifecycle/instance-policy.mjs';
import { createLogicalServiceTransport } from './service-lifecycle/transaction-transport.mjs';

function httpUrl(value, label) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`Invalid ${label}: absolute HTTP(S) URL required without credentials`);
  }
  return url.href.replace(/\/$/, '');
}

export function readServiceLifecycleConfig({
  serviceId, requires = [], intrinsicBindings = {}, env = process.env,
  metadata = null, endpoint = '', token = env.PULSE_RUNTIME_REPORT_TOKEN || '', external = false,
} = {}) {
  const reportUrls = JSON.parse(env.PULSE_AGGREGATOR_URLS ?? JSON.stringify(
    metadata?.reportUrls ?? (metadata?.reportTarget ? [metadata.reportTarget.endpoint] : []),
  ));
  if (!Array.isArray(reportUrls) || reportUrls.length > 16) throw new Error('PULSE_AGGREGATOR_URLS must be an array with at most 16 entries');
  const managed = env.PULSE_SERVICE_BINDINGS !== undefined || metadata !== null || reportUrls.length > 0;
  const bindings = JSON.parse(env.PULSE_SERVICE_BINDINGS ?? JSON.stringify(metadata?.bindings ?? (managed ? {} : intrinsicBindings)));
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings) || Object.keys(bindings).length > 32) {
    throw new Error('PULSE_SERVICE_BINDINGS must be an object with at most 32 entries');
  }
  for (const [id, binding] of Object.entries(bindings)) {
    if (!binding || typeof binding !== 'object' || typeof binding.instanceId !== 'string' || !binding.instanceId) {
      throw new Error(`Invalid service binding: ${id}`);
    }
    binding.endpoint = httpUrl(binding.endpoint, `${id} endpoint`);
    binding.readinessUrl = httpUrl(binding.readinessUrl, `${id} readinessUrl`);
  }
  const required = metadata?.requires ?? (managed ? requires : Object.keys(intrinsicBindings));
  if (!Array.isArray(required) || required.length > 32 || required.some(id => typeof id !== 'string' || !id)) {
    throw new Error('Service requirements must be an array of at most 32 logical service IDs');
  }
  const config = {
    version: metadata?.version ?? 1, serviceId,
    external,
    managed,
    requires: [...required], bindings,
    reportUrls: reportUrls.map(url => httpUrl(url, 'aggregator URL')),
    instanceId: env.PULSE_SERVICE_INSTANCE_ID || `${serviceId}:${randomUUID()}`,
    nodeId: env.PULSE_NODE_ID || hostname(),
    ownerAggregatorId: env.PULSE_OWNER_AGGREGATOR_ID || metadata?.ownerAggregatorId || '',
    bootId: randomUUID(), endpoint: env.PULSE_SERVICE_ENDPOINT || endpoint, token,
    discoveryPort: Number(env.UDP_PORT || '4210'),
    autoDiscovery: reportUrls.length === 0,
    advertisedHost: env.PULSE_SERVICE_ADVERTISE_HOST || env.PULSE_ADVERTISED_HOST || env.PULSE_NODE_IP ||
      (env.PULSE_SERVICE_ENDPOINT ? new URL(env.PULSE_SERVICE_ENDPOINT).hostname.replace(/^\[|\]$/g, '') : ''),
  };
  if (config.autoDiscovery &&
      (!Number.isInteger(config.discoveryPort) || config.discoveryPort < 1 || config.discoveryPort > 65535)) {
    throw new Error('Discovery UDP port must be an integer between 1 and 65535');
  }
  Object.freeze(config.requires);
  for (const binding of Object.values(config.bindings)) Object.freeze(binding);
  Object.freeze(config.bindings);
  Object.freeze(config.reportUrls);
  return Object.freeze(config);
}

export function describeBoundHttpListener(address, config) {
  if (!address || typeof address !== 'object' || !Number.isInteger(address.port) || address.port < 1) {
    throw new Error('HTTP listener is not bound');
  }
  let host = config.advertisedHost || address.address;
  if (host === '0.0.0.0' || host === '::') {
    if (config.reportUrls.some(url => !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname))) {
      throw new Error('Wildcard listeners require configured PULSE_SERVICE_ADVERTISE_HOST for remote aggregators');
    }
    if (!config.autoDiscovery) host = '127.0.0.1';
  }
  if (!host || ((!config.autoDiscovery) && (host === '0.0.0.0' || host === '::')) || /[/@\s]/.test(host)) {
    throw new Error('Invalid service advertised host');
  }
  const endpoint = `http://${net.isIP(host) === 6 ? `[${host}]` : host}:${address.port}`;
  httpUrl(endpoint, 'bound service endpoint');
  return { protocol: 'http', host, port: address.port, endpoint };
}

export async function createServiceLifecycleRuntime({
  config, logger = console, fetchImpl = fetch, intrinsicProbe = null,
  usefulOperations = {}, policyFactory = createServiceInstancePolicy,
  discoveryFactory = async options => {
    const { createLanDiscovery } = await import('./service-lifecycle/lan-discovery.mjs');
    return createLanDiscovery(options);
  },
} = {}) {
  const policy = await policyFactory({ logger });
  const transport = await policy.dispatch('/transport-policy', {});
  const abort = new AbortController();
  let readiness = { ready: false, blockedBy: [] };
  let endpoint = config.endpoint;
  let listeners = [];
  let sequence = 0;
  let probeTimer;
  let reportTimer;
  let probing;
  let reporting;
  let stopped = false;
  let started = false;
  let discovery;

  function getReportUrls() {
    if (config.reportUrls.length) return [...config.reportUrls];
    return (discovery?.getTargets() || []).map(target => target.endpoint);
  }
  async function getTransactionUrls() {
    if (config.reportUrls.length) return [...config.reportUrls];
    if (!discovery) throw new Error('Aggregator discovery is not running');
    return [await discovery.getOwnerUrl(config.ownerAggregatorId)];
  }

  async function request(url, { method = 'GET', body, authenticated = false } = {}) {
    const response = await fetchImpl(url, {
      method, redirect: 'error',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(authenticated && config.token ? { authorization: `Bearer ${config.token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(transport.timeoutMs)]),
    });
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body ?? []) {
      bytes += chunk.length;
      if (bytes > transport.maxResponseBytes) {
        throw new Error('Lifecycle response exceeds transport byte limit');
      }
      chunks.push(Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function probeBindings() {
    const observations = Object.fromEntries(await Promise.all(config.requires.map(async serviceId => {
      const binding = config.bindings[serviceId];
      if (!binding) return [serviceId, { reason: 'missing-binding' }];
      try {
        const result = await request(binding.readinessUrl);
        const observation = { ...result, instanceId: result.body?.instanceId, reason: result.body?.reason || '' };
        const useful = usefulOperations[serviceId];
        if (useful) {
          const response = config.managed
            ? await createLogicalServiceTransport({
              aggregatorUrls: await getTransactionUrls(), serviceId, policy, fetchImpl, token: config.token,
              maxResponseBytes: transport.maxResponseBytes,
            }).request(useful, { signal: abort.signal })
            : await request(`${binding.endpoint}${useful.path}`, useful);
          observation.usefulStatus = response.status;
        }
        return [serviceId, observation];
      } catch (error) {
        if (!stopped) logger.warn(`[Lifecycle:${config.serviceId}] Probe ${serviceId} failed: ${error.message}`);
        return [serviceId, { status: 0, body: null, reason: 'probe-failed' }];
      }
    })));
    let localObservation;
    if (intrinsicProbe) {
      const probeAbort = new AbortController();
      try {
        localObservation = await Promise.race([
          intrinsicProbe(),
          delay(transport.timeoutMs, null, { signal: AbortSignal.any([abort.signal, probeAbort.signal]) })
            .then(() => { throw new Error('Intrinsic probe timed out'); }),
        ]);
      } catch (error) {
        if (!stopped) logger.warn(`[Lifecycle:${config.serviceId}] Local probe failed: ${error.message}`);
        localObservation = { status: 0, body: null };
      } finally { probeAbort.abort(); }
    }
    const result = await policy.dispatch('/evaluate', {
      version: config.version, serviceId: config.serviceId, instanceId: config.instanceId,
      requires: config.requires, bindings: config.bindings, observations,
      ...(localObservation !== undefined ? { localObservation } : {}),
    });
    readiness = result.readiness;
    return readiness;
  }

  function refresh() {
    if (stopped) return Promise.resolve(readiness);
    if (!probing) {
      probing = probeBindings().catch(error => {
        logger.error(`[Lifecycle:${config.serviceId}] Evaluation failed: ${error.message}`);
        throw error;
      }).finally(() => { probing = null; });
    }
    return probing;
  }

  async function sendReports() {
    if (discovery) await discovery.advertise(listeners);
    const targets = config.reportUrls.length
      ? config.reportUrls.map(url => ({ endpoint: url }))
      : discovery?.getTargets() || [];
    if (!targets.length) return;
    if (!config.ownerAggregatorId) {
      throw new Error('Node discovered, but lifecycle reporting requires an explicit deployment owner');
    }
    const reportSequence = ++sequence;
    await Promise.all(targets.map(async target => {
      const advertised = discovery ? await discovery.describeTarget(target, listeners) : { endpoint, listeners };
      const { report } = await policy.dispatch('/report', {
        version: config.version, serviceId: config.serviceId, instanceId: config.instanceId,
        nodeId: config.nodeId, bootId: config.bootId, sequence: reportSequence,
        ownerAggregatorId: config.ownerAggregatorId,
        endpoint: config.external ? `${advertised.endpoint}/ready` : advertised.endpoint,
        readiness, dependencies: config.bindings, ttlMs: 30000,
        listeners: config.external ? [] : advertised.listeners,
      });
      const url = target.endpoint;
      for (let attempt = 0; attempt < transport.reportAttempts && !stopped; attempt += 1) {
        try {
          const result = await request(`${url}/api/runtime/instances/report`, { method: 'POST', body: report, authenticated: true });
          if (result.status < 200 || result.status >= 300) throw new Error(`HTTP ${result.status}`);
          return;
        } catch (error) {
          if (stopped) return;
          logger.warn(`[Lifecycle:${config.serviceId}] Report to ${url} failed (${attempt + 1}/${transport.reportAttempts}): ${error.message}`);
          if (attempt + 1 < transport.reportAttempts) await delay(transport.retryDelayMs, null, { signal: abort.signal });
        }
      }
    }));
  }

  function reportNow() {
    if (stopped) return Promise.resolve();
    if (!reporting) reporting = sendReports().catch(error => {
      if (!stopped) logger.error(`[Lifecycle:${config.serviceId}] Reporting failed: ${error.message}`);
    }).finally(() => { reporting = null; });
    return reporting;
  }

  return {
    config,
    getReadiness: () => ({ ...structuredClone(readiness), instanceId: config.instanceId }),
    refresh,
    reportNow,
    getReportUrls,
    getTransactionUrls,
    getDiscoveryTargets: () => discovery?.getTargets() || [],
    async gate(path) {
      return policy.dispatch('/gate', { path, readiness });
    },
    async start(actualEndpoint, boundListeners) {
      if (stopped) throw new Error('Lifecycle runtime has stopped');
      if (started) return;
      endpoint = httpUrl(actualEndpoint, 'service endpoint');
      if (!Array.isArray(boundListeners) || !boundListeners.length) {
        throw new Error('Lifecycle reporting requires actual bound listeners');
      }
      listeners = structuredClone(boundListeners);
      if (config.autoDiscovery) {
        discovery = await discoveryFactory({
          nodeId: config.nodeId, bootId: config.bootId, port: config.discoveryPort, logger,
        });
        await discovery.start();
      }
      started = true;
      // Reporting has its own task and timer, never waiting for a readiness probe.
      void reportNow();
      probeTimer = setInterval(() => { void refresh().catch(() => {}); }, transport.probeIntervalMs);
      reportTimer = setInterval(() => { void reportNow(); }, transport.reportIntervalMs);
      probeTimer.unref();
      reportTimer.unref();
      await refresh();
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(probeTimer);
      clearInterval(reportTimer);
      abort.abort(new Error('Lifecycle runtime stopped'));
      await Promise.allSettled([probing, reporting]);
      if (discovery) await discovery.stop();
      await policy.stop();
    },
  };
}

export function installServiceLifecycleMiddleware(app, runtime) {
  app.use(async (req, res, next) => {
    try {
      const activeRuntime = await runtime;
      const path = new URL(req.originalUrl, 'http://localhost').pathname;
      if (req.method === 'GET' && path === '/ready') {
        const readiness = activeRuntime.getReadiness();
        return res.status(readiness.ready ? 200 : 503).json(readiness);
      }
      const decision = await activeRuntime.gate(path);
      if (!decision.allowed) return res.status(decision.status).json({ error: 'Service dependencies are not ready', ...activeRuntime.getReadiness() });
      return next();
    } catch (error) {
      return res.status(503).json({ error: error.message });
    }
  });
}
