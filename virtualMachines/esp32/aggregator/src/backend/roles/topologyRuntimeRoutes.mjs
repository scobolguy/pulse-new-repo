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

  app.get('/api/nodes', (req, res) => {
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
    ].sort((a, b) => b.lastSeen - a.lastSeen);
    res.json(nodes);
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

      let selected = preferredNodeId
        ? chooseServiceInstanceByNode(serviceName, preferredNodeId)
        : null;
      if (!selected) {
        selected = resolveServiceInstance(serviceName);
      }
      if (!selected) {
        return res.status(404).json({ error: `No active instance for service ${serviceName}` });
      }

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
        deployment: deployment || null
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
