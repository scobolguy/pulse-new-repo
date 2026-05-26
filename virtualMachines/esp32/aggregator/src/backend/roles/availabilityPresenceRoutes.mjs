export function registerAvailabilityPresenceRoutes(app, deps) {
  const {
    machineWorkloadState,
    getMachineAvailabilityPayload,
    setMachineAvailable,
    drainMachineAndSetUnavailable,
    machineDrainDefaultTimeoutMs,
    getBrowserPresence,
    normalizePresenceIp,
    upsertBrowserPresenceNode,
    setBrowserPresenceUnavailable
  } = deps;

  app.get('/api/availability/status', (req, res) => {
    res.json({
      ...getMachineAvailabilityPayload(),
      workload: {
        inFlight: machineWorkloadState.inFlight,
        updatedAt: machineWorkloadState.updatedAt
      }
    });
  });

  app.post('/api/availability/available', (req, res) => {
    const next = setMachineAvailable();
    res.json({ status: 'ok', availability: next });
  });

  app.post('/api/availability/unavailable', async (req, res) => {
    const requestedTimeoutMs = Number(req.body?.timeoutMs || req.body?.drainMs || machineDrainDefaultTimeoutMs);
    const result = await drainMachineAndSetUnavailable({ timeoutMs: requestedTimeoutMs });
    res.json({ status: 'ok', ...result });
  });

  app.get('/api/presence/client/status', (req, res) => {
    const clientId = String(req.query?.clientId || '').trim();
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const presence = getBrowserPresence(clientId);
    return res.json({
      clientId,
      available: Boolean(presence?.availability?.available),
      status: presence?.availability?.status || 'unavailable',
      node: presence,
      lastSeen: presence?.lastSeen || null
    });
  });

  app.post('/api/presence/client/available', (req, res) => {
    const clientId = String(req.body?.clientId || '').trim();
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const nodeName = String(req.body?.nodeName || req.body?.hostname || 'Web Client').trim();
    const ip = normalizePresenceIp(req.ip || req.socket?.remoteAddress);
    const userAgent = String(req.get('user-agent') || '').trim();
    const node = upsertBrowserPresenceNode({ clientId, nodeName, ip, userAgent, available: true });
    return res.json({ status: 'ok', clientId, available: true, node });
  });

  app.post('/api/presence/client/heartbeat', (req, res) => {
    const clientId = String(req.body?.clientId || '').trim();
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const existing = getBrowserPresence(clientId);
    if (!existing) {
      return res.status(404).json({ error: 'presence not found', clientId });
    }
    const node = upsertBrowserPresenceNode({
      clientId,
      nodeName: existing.nodeName,
      ip: normalizePresenceIp(req.ip || req.socket?.remoteAddress),
      userAgent: String(req.get('user-agent') || existing.userAgent || '').trim(),
      available: true
    });
    return res.json({ status: 'ok', clientId, available: true, node });
  });

  app.post('/api/presence/client/unavailable', (req, res) => {
    const clientId = String(req.body?.clientId || '').trim();
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const node = setBrowserPresenceUnavailable(clientId);
    return res.json({ status: 'ok', clientId, available: false, node });
  });
}
