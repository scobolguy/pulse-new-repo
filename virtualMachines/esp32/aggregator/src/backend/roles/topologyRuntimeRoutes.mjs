export function registerTopologyRuntimeRoutes(app, deps) {
  const {
    discoveredNodes,
    getBrokerNodeDetails,
    getSystemPerformanceSnapshot,
    services,
  } = deps;

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
