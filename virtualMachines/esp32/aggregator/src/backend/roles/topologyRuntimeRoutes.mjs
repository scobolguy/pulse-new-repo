import fs from 'node:fs/promises';
import path from 'node:path';
import { allocateJob } from '../allocator/economicAllocator.mjs';

const NODE_RENAME_OVERRIDES_PATH = path.resolve(process.cwd(), 'data', 'node-rename-overrides.json');
const ALLOCATOR_DECISIONS_PATH = path.resolve(process.cwd(), 'data', 'allocator-decisions.jsonl');

function normalizeNodeRenameMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [String(key || '').trim().toLowerCase(), String(value || '').trim()])
      .filter(([key, value]) => Boolean(key) && Boolean(value))
  );
}

async function loadNodeRenameMap() {
  try {
    const raw = await fs.readFile(NODE_RENAME_OVERRIDES_PATH, 'utf8');
    return normalizeNodeRenameMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function saveNodeRenameMap(map) {
  const normalized = normalizeNodeRenameMap(map);
  await fs.mkdir(path.dirname(NODE_RENAME_OVERRIDES_PATH), { recursive: true });
  await fs.writeFile(NODE_RENAME_OVERRIDES_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

async function appendAllocatorDecisionLog(entry) {
  const line = `${JSON.stringify(entry)}\n`;
  await fs.mkdir(path.dirname(ALLOCATOR_DECISIONS_PATH), { recursive: true });
  await fs.appendFile(ALLOCATOR_DECISIONS_PATH, line, 'utf8');
}

function normalizeSlaClass(value) {
  return String(value || '').trim().toLowerCase();
}

function resolvePolicyIdFromSlaClass(value) {
  const key = normalizeSlaClass(value);
  if (key === 'latency-critical' || key === 'latency_critical' || key === 'interactive') return 'latency-first';
  if (key === 'reliability-critical' || key === 'reliability_critical' || key === 'critical') return 'reliability-first';
  if (key === 'batch' || key === 'background') return 'cost-min';
  return 'balanced';
}

export function registerTopologyRuntimeRoutes(app, deps) {
  const {
    discoveredNodes,
    getBrokerNodeDetails,
    getSystemPerformanceSnapshot,
    services,
    serviceInstanceRegistry,
    upsertServiceInstance,
    resolveServiceInstance,
    ffsDeploymentRegistry,
  } = deps;
  let nodeRenameMap = {};
  let nodeRenameMapLoaded = false;

  async function ensureNodeRenameMapLoaded() {
    if (nodeRenameMapLoaded) return;
    nodeRenameMap = await loadNodeRenameMap();
    nodeRenameMapLoaded = true;
  }

  function resolveNodeRename(node) {
    const candidateKeys = [
      node?.nodeId,
      node?.id,
      node?.ip,
      node?.nodeName,
      node?.details?.nodeName
    ]
      .map((value) => normalizeNodeId(value))
      .filter(Boolean);

    for (const key of candidateKeys) {
      const renamed = nodeRenameMap[key];
      if (renamed) return renamed;
    }
    return null;
  }

  function applyNodeRename(node) {
    const renamed = resolveNodeRename(node);
    if (!renamed) return node;
    return {
      ...node,
      nodeName: renamed,
      details: {
        ...(node?.details || {}),
        nodeName: renamed
      }
    };
  }

  function normalizeServiceName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeNodeId(value) {
    return String(value || '').trim().toLowerCase();
  }

  function chooseServiceInstanceByNode(serviceName, nodeId) {
    const normalizedName = normalizeServiceName(serviceName);
    const normalizedNodeId = normalizeNodeId(nodeId);
    if (!normalizedName || !normalizedNodeId) return null;

    let selected = null;
    for (const instance of serviceInstanceRegistry.values()) {
      if (normalizeServiceName(instance.serviceName) !== normalizedName) continue;
      if (!['up', 'degraded'].includes(String(instance.status || '').toLowerCase())) continue;
      if (normalizeNodeId(instance.nodeId || instance.ip) !== normalizedNodeId) continue;
      if (!selected || Number(instance.lastHeartbeat || 0) > Number(selected.lastHeartbeat || 0)) {
        selected = instance;
      }
    }
    return selected;
  }

  function listServiceDirectory() {
    const now = Date.now();
    const byService = new Map();

    for (const instance of serviceInstanceRegistry.values()) {
      const serviceName = String(instance.serviceName || '').trim();
      if (!serviceName) continue;
      const key = normalizeServiceName(serviceName);
      if (!byService.has(key)) {
        byService.set(key, {
          serviceName,
          instances: []
        });
      }

      const staleMs = Math.max(0, now - Number(instance.lastHeartbeat || 0));
      byService.get(key).instances.push({
        instanceId: instance.instanceId,
        serviceName: instance.serviceName,
        nodeId: instance.nodeId,
        ip: instance.ip,
        port: instance.port,
        status: instance.status,
        metadata: instance.metadata || {},
        lastHeartbeat: instance.lastHeartbeat,
        staleMs
      });
    }

    const servicesOut = Array.from(byService.values());
    servicesOut.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
    for (const svc of servicesOut) {
      svc.instances.sort((a, b) => Number(b.lastHeartbeat || 0) - Number(a.lastHeartbeat || 0));
    }
    return servicesOut;
  }

  function getDeploymentForService(serviceName, nodeId) {
    const normalizedService = normalizeServiceName(serviceName);
    const normalizedNodeId = normalizeNodeId(nodeId);
    if (!normalizedService) return null;

    const entries = Array.from(ffsDeploymentRegistry.values());
    let wildcard = null;
    for (const entry of entries) {
      if (normalizeServiceName(entry.serviceName) !== normalizedService) continue;
      const target = normalizeNodeId(entry.targetNodeId);
      if (target && normalizedNodeId && target === normalizedNodeId) return entry;
      if (!target) wildcard = entry;
    }
    return wildcard;
  }

  function toAllocatorCandidate(instance) {
    return {
      id: String(instance.instanceId || `${instance.serviceName}:${instance.nodeId || instance.ip || 'unknown'}`),
      nodeId: instance.nodeId || null,
      clusterId: instance.metadata?.clusterId || null,
      failureDomain: instance.metadata?.failureDomain || instance.nodeId || instance.ip || 'default',
      service: instance.serviceName || null,
      capabilities: Array.isArray(instance.metadata?.capabilities) ? instance.metadata.capabilities : [],
      executionMs: Number(instance.metadata?.p95LatencyMs || 50),
      queueDelayMs: Number(instance.metadata?.queueDelayMs || 0),
      dataMoveCost: Number(instance.metadata?.dataMoveCost || 0),
      failureRisk: Number(instance.metadata?.failureRisk || 0.01),
      congestionPrice: Number(instance.metadata?.congestionPrice || 0),
      specializationBenefit: Number(instance.metadata?.specializationBenefit || 0),
      diversityPenalty: Number(instance.metadata?.diversityPenalty || 0),
      successRate15m: Number(instance.metadata?.successRate15m || 0.99),
      estimatedFreeSlots: Number(instance.metadata?.estimatedFreeSlots || 1),
      status: instance.status
    };
  }

  function listActiveServiceInstances(serviceName) {
    const normalizedName = normalizeServiceName(serviceName);
    return Array.from(serviceInstanceRegistry.values()).filter((instance) => {
      if (normalizeServiceName(instance.serviceName) !== normalizedName) return false;
      return ['up', 'degraded'].includes(String(instance.status || '').toLowerCase());
    });
  }

  async function proxyServiceInvocation(instance, reqBody) {
    const body = reqBody && typeof reqBody === 'object' ? reqBody : {};
    const method = String(body.method || 'POST').trim().toUpperCase();
    const targetPath = String(body.path || instance?.metadata?.route || '/pmachine/service').trim();
    const timeoutMs = Number(body.timeoutMs || 5000);

    if (!instance?.ip || !instance?.port) {
      throw new Error('Selected service instance has no reachable ip/port');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(100, timeoutMs));
    try {
      const response = await fetch(`http://${instance.ip}:${instance.port}${targetPath.startsWith('/') ? targetPath : `/${targetPath}`}`, {
        method,
        headers: {
          'content-type': 'application/json'
        },
        body: method === 'GET' ? undefined : JSON.stringify(body.payload ?? body),
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') || '';
      let payload;
      if (contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        payload = await response.text();
      }

      return {
        ok: response.ok,
        status: response.status,
        contentType,
        payload
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  app.get('/api/discover-primary', async (req, res) => {
    const now = Date.now();
    const nodes = Array.from(discoveredNodes.values())
      .filter(n => n.details?.services?.some(s => s.name?.toLowerCase().includes('broker')) && now - n.lastSeen < 10 * 60 * 1000)
      .sort((a, b) => b.lastSeen - a.lastSeen);
    if (nodes.length > 0) {
      res.json({ url: `http://${nodes[0].ip}:4000`, ip: nodes[0].ip, node: nodes[0] });
    } else {
      res.status(404).json({ error: 'No primary broker found' });
    }
  });

  app.get('/status', (req, res) => {
    res.json(getBrokerNodeDetails());
  });

  app.get('/api/system/performance', (req, res) => {
    res.json({
      status: 'ok',
      performance: getSystemPerformanceSnapshot()
    });
  });

  app.get('/services/describe', (req, res) => {
    res.json({ services });
  });

  app.get('/api/nodes', async (req, res) => {
    await ensureNodeRenameMapLoaded();
    const now = Date.now();
    const backendNode = {
      ip: '127.0.0.1',
      nodeName: 'Aggregator Backend',
      lastSeen: now,
      details: {
        nodeName: 'Aggregator Backend',
        hardware: 'Server',
        services: [
          { name: 'Message Broker', status: 'online', api: '/api/broker' },
          { name: 'Router Service', status: 'online', api: '/api/router' },
          { name: 'Queue Manager', status: 'online', api: '/api/queue' },
          { name: 'File Server', status: 'online', api: '/api/fileserver' }
        ],
        status: 'ok',
        version: '1.0.0'
      }
    };
    const magicClusterNodes = [
      {
        kind: 'machineAvailability',
        serviceName: 'js-pmachine',
        nodeId: 'magic-js-pmachine-01',
        nodeName: 'magic-js-pmachine-01',
        ip: '127.0.10.101',
        port: 4101,
        status: 'available',
        available: true,
        draining: false,
        lastSeen: now,
        ts: now,
        details: {
          nodeName: 'magic-js-pmachine-01',
          hardware: 'PMachine JavaScript VM',
          runtime: 'js-pmachine',
          clusterName: 'Magic Cluster',
          services: ['PMachine Runtime', 'JavaScript VM']
        }
      },
      {
        kind: 'machineAvailability',
        serviceName: 'js-pmachine',
        nodeId: 'magic-js-pmachine-02',
        nodeName: 'magic-js-pmachine-02',
        ip: '127.0.10.102',
        port: 4102,
        status: 'available',
        available: true,
        draining: false,
        lastSeen: now,
        ts: now,
        details: {
          nodeName: 'magic-js-pmachine-02',
          hardware: 'PMachine JavaScript VM',
          runtime: 'js-pmachine',
          clusterName: 'Magic Cluster',
          services: ['PMachine Runtime', 'JavaScript VM']
        }
      },
      {
        kind: 'machineAvailability',
        serviceName: 'js-pmachine',
        nodeId: 'magic-js-pmachine-03',
        nodeName: 'magic-js-pmachine-03',
        ip: '127.0.10.103',
        port: 4103,
        status: 'available',
        available: true,
        draining: false,
        lastSeen: now,
        ts: now,
        details: {
          nodeName: 'magic-js-pmachine-03',
          hardware: 'PMachine JavaScript VM',
          runtime: 'js-pmachine',
          clusterName: 'Magic Cluster',
          services: ['PMachine Runtime', 'JavaScript VM']
        }
      }
    ];
    const nodes = [
      backendNode,
      ...magicClusterNodes,
      ...Array.from(discoveredNodes.values())
    ]
      .map((node) => applyNodeRename(node))
      .sort((a, b) => b.lastSeen - a.lastSeen);
    res.json(nodes);
  });

  app.post('/api/nodes/:nodeId/rename', async (req, res) => {
    try {
      await ensureNodeRenameMapLoaded();

      const requestedNodeId = String(req.params.nodeId || req.body?.nodeId || '').trim();
      const requestedIp = String(req.body?.ip || '').trim();
      const nextName = String(req.body?.nodeName || '').trim();

      if (!requestedNodeId && !requestedIp) {
        return res.status(400).json({ error: 'nodeId or ip is required' });
      }
      if (!nextName) {
        return res.status(400).json({ error: 'nodeName is required' });
      }

      const normalizedNodeId = normalizeNodeId(requestedNodeId);
      const normalizedIp = normalizeNodeId(requestedIp);

      if (normalizedNodeId) nodeRenameMap[normalizedNodeId] = nextName;
      if (normalizedIp) nodeRenameMap[normalizedIp] = nextName;

      for (const [key, existing] of discoveredNodes.entries()) {
        const matches = [
          normalizeNodeId(existing?.nodeId),
          normalizeNodeId(existing?.id),
          normalizeNodeId(existing?.ip),
          normalizeNodeId(key)
        ].filter(Boolean);
        if (
          (normalizedNodeId && matches.includes(normalizedNodeId))
          || (normalizedIp && matches.includes(normalizedIp))
        ) {
          discoveredNodes.set(key, {
            ...existing,
            nodeName: nextName,
            details: {
              ...(existing?.details || {}),
              nodeName: nextName
            }
          });
        }
      }

      await saveNodeRenameMap(nodeRenameMap);

      return res.json({
        status: 'ok',
        nodeId: requestedNodeId || requestedIp,
        nodeName: nextName
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to rename node' });
    }
  });

  app.post('/api/pmachine/announce', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const ip = String(body.ip || req.ip || '').replace('::ffff:', '').trim();
    const nodeId = String(body.nodeId || body.nodeName || ip || '').trim();
    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId (or nodeName/ip) is required' });
    }

    const now = Date.now();
    const key = ip || nodeId;
    const previous = discoveredNodes.get(key) || {};
    const servicesList = Array.isArray(body.services) ? body.services : [];
    const normalizedServices = servicesList
      .map((svc) => {
        if (!svc || typeof svc !== 'object') return null;
        const name = String(svc.name || svc.serviceName || '').trim();
        if (!name) return null;
        return {
          name,
          endpoint: String(svc.endpoint || '/pmachine/service').trim(),
          status: String(svc.status || 'up').trim().toLowerCase(),
          metadata: svc.metadata && typeof svc.metadata === 'object' ? svc.metadata : {}
        };
      })
      .filter(Boolean);

    const nextNode = {
      ...previous,
      id: String(body.id || previous.id || key).trim(),
      nodeId,
      nodeName: String(body.nodeName || previous.nodeName || nodeId).trim(),
      ip: ip || previous.ip || nodeId,
      port: Number(body.port || previous.port || 80),
      serviceName: 'pmachine',
      kind: 'machineAvailability',
      source: body.source || previous.source || 'pmachine-announce',
      status: String(body.status || previous.status || 'available').trim(),
      available: body.available !== false,
      draining: Boolean(body.draining),
      lastSeen: now,
      ts: now,
      availability: {
        available: body.available !== false,
        draining: Boolean(body.draining),
        status: String(body.status || 'available')
      },
      details: {
        ...(previous.details || {}),
        hardware: String(body.hardware || previous?.details?.hardware || 'ESP32').trim(),
        runtime: String(body.runtime || previous?.details?.runtime || 'pmachine').trim(),
        services: normalizedServices,
        capabilities: Array.isArray(body.capabilities) ? body.capabilities : (previous?.details?.capabilities || [])
      },
      raw: JSON.stringify(body)
    };
    discoveredNodes.set(key, nextNode);

    for (const svc of normalizedServices) {
      upsertServiceInstance({
        serviceName: svc.name,
        instanceId: `${svc.name}:${nodeId}:${nextNode.port}`,
        nodeId,
        ip: nextNode.ip,
        port: nextNode.port,
        status: svc.status || 'up',
        metadata: {
          ...(svc.metadata || {}),
          route: svc.endpoint,
          hardware: nextNode.details.hardware,
          runtime: nextNode.details.runtime
        }
      });
    }

    res.json({
      status: 'ok',
      node: {
        nodeId: nextNode.nodeId,
        ip: nextNode.ip,
        port: nextNode.port,
        services: normalizedServices.map((svc) => svc.name)
      }
    });
  });

  app.get('/api/pmachine/services', (req, res) => {
    res.json({
      updatedAt: new Date().toISOString(),
      services: listServiceDirectory()
    });
  });

  app.post('/api/pmachine/route/:serviceName', async (req, res) => {
    try {
      const serviceName = String(req.params.serviceName || '').trim();
      if (!serviceName) return res.status(400).json({ error: 'serviceName is required' });

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const preferredNodeId = String(body.nodeId || '').trim();
      const proxy = body.proxy === true;
      const allocatorMode = String(body.allocatorMode || 'shadow').trim().toLowerCase();
      const slaClass = String(body.slaClass || '').trim();
      const policyId = String(body.policyId || resolvePolicyIdFromSlaClass(slaClass)).trim();
      const requiredCapability = String(body.requiredCapability || '').trim();
      const requiredFailureDomain = String(body.requiredFailureDomain || '').trim();
      const requireDistinctFailureDomain = body?.placementPolicy?.requireDistinctFailureDomain === true;
      const forbiddenFailureDomains = new Set(
        (Array.isArray(body.forbiddenFailureDomains) ? body.forbiddenFailureDomains : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      );

      const activeInstances = listActiveServiceInstances(serviceName);
      const constrainedInstances = activeInstances.filter((instance) => {
        const domain = String(instance.metadata?.failureDomain || instance.nodeId || instance.ip || 'default');
        if (requiredFailureDomain && domain !== requiredFailureDomain) return false;
        if (forbiddenFailureDomains.size === 0) return true;
        return !forbiddenFailureDomains.has(domain);
      });

      const allocatorJob = {
        requiredService: serviceName,
        requiredCapability: requiredCapability || null,
        sla: {
          minSuccessProb: body?.sla?.minSuccessProb
        },
        placementPolicy: {
          minReplicas: Number(body?.placementPolicy?.minReplicas || 1)
        }
      };

      const allocatorResult = allocateJob(
        allocatorJob,
        constrainedInstances.map(toAllocatorCandidate),
        {
          policyId,
          weights: body.weights || null
        }
      );

      const allocatorTop = allocatorResult?.decision?.[0] || null;
      const acceptedCandidates = allocatorResult.scored.candidates.filter((entry) => entry.accepted);
      const acceptedDomains = new Set(acceptedCandidates.map((entry) => String(entry.failureDomain || 'default')));
      const requiredReplicas = Math.max(1, Number(body?.placementPolicy?.minReplicas || 1));
      const distinctDomainConstraintMet = !requireDistinctFailureDomain || acceptedDomains.size >= requiredReplicas;

      if (allocatorMode === 'enforce' && !distinctDomainConstraintMet) {
        return res.status(409).json({
          error: 'Distinct failure-domain constraint cannot be satisfied',
          requiredReplicas,
          availableDistinctDomains: acceptedDomains.size
        });
      }

      const allocatorSelectedInstance = allocatorTop
        ? constrainedInstances.find((instance) => String(instance.instanceId || `${instance.serviceName}:${instance.nodeId || instance.ip || 'unknown'}`) === allocatorTop.id)
        : null;

      let selected = preferredNodeId
        ? chooseServiceInstanceByNode(serviceName, preferredNodeId)
        : null;

      if (!selected) {
        if (allocatorMode === 'enforce' && allocatorSelectedInstance) {
          selected = allocatorSelectedInstance;
        } else {
          selected = resolveServiceInstance(serviceName);
        }
      }
      if (!selected) {
        return res.status(404).json({ error: `No active instance for service ${serviceName}` });
      }

      const fallbackReason = preferredNodeId
        ? 'preferred-node-id'
        : (allocatorMode === 'enforce'
            ? 'allocator-no-decision-fallback-resolver'
            : 'resolver-default');

      const effectiveMode = allocatorMode === 'enforce' ? 'enforce' : 'shadow';

      void appendAllocatorDecisionLog({
        ts: new Date().toISOString(),
        route: '/api/pmachine/route/:serviceName',
        serviceName,
        mode: effectiveMode,
        policyId,
        slaClass: slaClass || null,
        requiredCapability: requiredCapability || null,
        preferredNodeId: preferredNodeId || null,
        selected: {
          instanceId: selected.instanceId,
          nodeId: selected.nodeId,
          ip: selected.ip,
          source: preferredNodeId
            ? 'preferred-node'
            : (effectiveMode === 'enforce' && allocatorSelectedInstance ? 'allocator' : 'resolver')
        },
        fallbackReason,
        allocator: {
          acceptedCandidates: allocatorResult.scored.candidates.filter((entry) => entry.accepted).length,
          acceptedDistinctFailureDomains: acceptedDomains.size,
          requiredReplicas,
          requireDistinctFailureDomain,
          topDecision: allocatorTop
            ? {
                id: allocatorTop.id,
                score: allocatorTop.score,
                failureDomain: allocatorTop.failureDomain,
                successProb: allocatorTop.successProb
              }
            : null,
          topScored: allocatorResult.scored.candidates.slice(0, 5).map((entry) => ({
            id: entry.id,
            accepted: entry.accepted,
            score: entry.score,
            failureDomain: entry.failureDomain,
            reasons: entry.reasons
          }))
        }
      }).catch(() => {
        // Non-blocking decision log persistence.
      });

      const deployment = getDeploymentForService(serviceName, selected.nodeId);
      const responsePayload = {
        status: 'ok',
        selected: {
          instanceId: selected.instanceId,
          serviceName: selected.serviceName,
          nodeId: selected.nodeId,
          ip: selected.ip,
          port: selected.port,
          metadata: selected.metadata || {},
          lastHeartbeat: selected.lastHeartbeat
        },
        deployment: deployment || null,
        allocator: {
          mode: effectiveMode,
          policyId,
          slaClass: slaClass || null,
          recommended: allocatorTop
            ? {
                id: allocatorTop.id,
                score: allocatorTop.score,
                failureDomain: allocatorTop.failureDomain,
                successProb: allocatorTop.successProb
              }
            : null,
          acceptedCandidates: allocatorResult.scored.candidates.filter((entry) => entry.accepted).length,
          evaluatedCandidates: allocatorResult.scored.candidates.length,
          acceptedDistinctFailureDomains: acceptedDomains.size,
          requiredReplicas,
          requireDistinctFailureDomain,
          distinctDomainConstraintMet
        }
      };

      if (!proxy) {
        return res.json(responsePayload);
      }

      const invocation = await proxyServiceInvocation(selected, body);
      return res.status(invocation.ok ? 200 : 502).json({
        ...responsePayload,
        invocation
      });
    } catch (e) {
      res.status(500).json({ error: 'Service route failed', details: e.message || String(e) });
    }
  });

  app.get('/api/pmachine/deployments', (req, res) => {
    const deployments = Array.from(ffsDeploymentRegistry.values())
      .sort((a, b) => `${a.serviceName}:${a.targetNodeId || '*'}`.localeCompare(`${b.serviceName}:${b.targetNodeId || '*'}`));
    res.json({ deployments });
  });

  app.post('/api/pmachine/deployments', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const serviceName = String(body.serviceName || '').trim();
    const packageName = String(body.packageName || '').trim();
    const packageVersion = String(body.packageVersion || 'latest').trim();
    const targetNodeId = String(body.targetNodeId || '').trim() || null;

    if (!serviceName || !packageName) {
      return res.status(400).json({ error: 'serviceName and packageName are required' });
    }

    const key = `${normalizeServiceName(serviceName)}::${normalizeNodeId(targetNodeId || '*')}`;
    const next = {
      key,
      serviceName,
      packageName,
      packageVersion,
      targetNodeId,
      updatedAt: new Date().toISOString(),
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
    };
    ffsDeploymentRegistry.set(key, next);
    res.json({ status: 'ok', deployment: next });
  });

  app.get('/api/proxy/:ip', async (req, res) => {
    const { ip } = req.params;
    const path = req.query.path || '/';
    try {
      const url = `http://${ip}:80${path}`;
      const deviceRes = await fetch(url);
      const contentType = deviceRes.headers.get('content-type') || '';
      res.status(deviceRes.status);
      if (contentType.includes('application/json')) {
        const data = await deviceRes.json();
        res.json(data);
      } else {
        const text = await deviceRes.text();
        console.log(`[Proxy Debug] ${url} returned non-JSON content-type (${contentType}):\n${text.substring(0, 500)}`);
        res.type(contentType).send(text);
      }
    } catch (e) {
      res.status(502).json({ error: 'Proxy fetch failed', details: e.toString() });
    }
  });
}
