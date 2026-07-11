import os from 'os';

export function registerOrchestrationRegistryRoutes(app, deps = {}) {
  const {
    HTTP_PORT,
    queueManagerRegistry,
    pendingManagerSync,
    remoteAgentRegistry,
    remoteQueueManagerProcesses,
    queueRoutes,
    queueManagers,
    MANAGER_ACTIVE_STATES,
    upsertRemoteQueueManager,
    upsertServiceInstance,
    normalizeSupervisorHeartbeatPayload,
    isSupervisorHeartbeatFresh,
    getSupervisorHeartbeatSnapshot,
    getSupervisorHeartbeatEntry,
    getDatabaseRegistrySnapshot,
    getLocalQueueManagerLaunchers,
    getRemoteAgentsPayload,
    normalizeRemoteAgentUrl,
    getRemoteAgentOrThrow,
    callRemoteAgent,
    getRemoteLaunchersPayload,
    pickSyncSourceManager,
    waitForManagerRegistration,
    syncManagerBeforeActivation,
    launchLocalQueueManager,
    stopLocalQueueManager,
    setNodeLifecycleState,
    getNodeDrainStatus,
    setQueueManagerStatus,
    supervisorHeartbeatRegistry
  } = deps;

  app.post('/api/registry/heartbeat', (req, res) => {
    try {
      const { managerId, name, ip, port, status, queues, persistence } = req.body || {};
      const effectiveIp = ip || req.ip?.replace('::ffff:', '') || '127.0.0.1';
      upsertRemoteQueueManager({ managerId, name, nodeId: effectiveIp, ip: effectiveIp, port, status, queues });
      if (managerId && queueManagerRegistry.has(managerId)) {
        const current = queueManagerRegistry.get(managerId);
        current.persistence = persistence || current.persistence || null;
        queueManagerRegistry.set(managerId, current);
      }
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/registry/service-instances/heartbeat', (req, res) => {
    try {
      const { serviceName, instanceId, nodeId, ip, port, status, metadata } = req.body || {};
      const effectiveIp = ip || req.ip?.replace('::ffff:', '') || '127.0.0.1';
      upsertServiceInstance({
        serviceName,
        instanceId,
        nodeId: nodeId || effectiveIp,
        ip: effectiveIp,
        port,
        status,
        metadata
      });
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/supervisor/heartbeat', (req, res) => {
    try {
      const fallbackIp = String(req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '').trim();
      const heartbeat = normalizeSupervisorHeartbeatPayload(req.body || {}, fallbackIp);
      supervisorHeartbeatRegistry.set(heartbeat.nodeId, heartbeat);

      res.json({
        status: 'ok',
        nodeId: heartbeat.nodeId,
        overallHealthy: heartbeat.overallHealthy,
        stale: !isSupervisorHeartbeatFresh(heartbeat),
        receivedAt: heartbeat.receivedAt
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/supervisor/status', (req, res) => {
    res.json(getSupervisorHeartbeatSnapshot());
  });

  app.get('/api/supervisor/green', (req, res) => {
    const requiredNodeId = String(req.query?.nodeId || '').trim();
    const snapshot = getSupervisorHeartbeatSnapshot();

    if (requiredNodeId) {
      const entry = getSupervisorHeartbeatEntry(requiredNodeId);
      const fresh = isSupervisorHeartbeatFresh(entry);
      const healthy = Boolean(entry?.overallHealthy) && fresh;
      return res.status(healthy ? 200 : 503).json({
        healthy,
        requiredNodeId,
        entry: entry ? { ...entry, stale: !fresh } : null,
        ttlMs: deps.SUPERVISOR_HEARTBEAT_TTL_MS
      });
    }

    const healthy = snapshot.anyHealthyFresh;
    return res.status(healthy ? 200 : 503).json({
      healthy,
      snapshot
    });
  });

  app.get('/api/registry/queue-managers', (req, res) => {
    const managers = Array.from(queueManagerRegistry.values()).sort((a, b) => a.managerId.localeCompare(b.managerId));
    res.json({ queueManagers: managers });
  });

  app.get('/api/registry/databases', (req, res) => {
    res.json({ databases: getDatabaseRegistrySnapshot() });
  });

  app.get('/api/replication/manager-sync-status', (req, res) => {
    const items = Array.from(queueManagerRegistry.values())
      .map(manager => {
        const pending = pendingManagerSync.get(manager.managerId) || null;
        return {
          managerId: manager.managerId,
          status: manager.status,
          syncState: manager.syncState || (MANAGER_ACTIVE_STATES.has(manager.status) ? 'ready' : 'unknown'),
          syncSourceManagerId: manager.syncSourceManagerId || null,
          lastSyncAt: manager.lastSyncAt || null,
          lastSyncVersion: Number(manager.lastSyncVersion || 0),
          lastSyncError: manager.lastSyncError || null,
          pendingSync: !!pending,
          pendingSince: pending ? new Date(pending.startedAt).toISOString() : null,
          pendingSourceManagerId: pending?.sourceManagerId || null,
        };
      })
      .sort((a, b) => a.managerId.localeCompare(b.managerId));

    res.json({ managers: items });
  });

  app.get('/api/replication/manager-sync-status/:managerId', (req, res) => {
    const manager = queueManagerRegistry.get(req.params.managerId);
    if (!manager) {
      return res.status(404).json({ error: 'Queue manager not found' });
    }

    const pending = pendingManagerSync.get(manager.managerId) || null;
    res.json({
      managerId: manager.managerId,
      status: manager.status,
      syncState: manager.syncState || (MANAGER_ACTIVE_STATES.has(manager.status) ? 'ready' : 'unknown'),
      syncSourceManagerId: manager.syncSourceManagerId || null,
      lastSyncAt: manager.lastSyncAt || null,
      lastSyncVersion: Number(manager.lastSyncVersion || 0),
      lastSyncError: manager.lastSyncError || null,
      pendingSync: !!pending,
      pendingSince: pending ? new Date(pending.startedAt).toISOString() : null,
      pendingSourceManagerId: pending?.sourceManagerId || null,
    });
  });

  app.get('/api/local-queue-managers', (req, res) => {
    res.json({ launchers: getLocalQueueManagerLaunchers() });
  });

  app.get('/api/remote-agents', (req, res) => {
    res.json({ agents: getRemoteAgentsPayload() });
  });

  app.post('/api/remote-agents/register', (req, res) => {
    try {
      const { agentId, baseUrl, token, allowedManagerPrefix } = req.body || {};
      const id = String(agentId || '').trim();
      const secret = String(token || '').trim();
      if (!id || !baseUrl || !secret) {
        return res.status(400).json({ error: 'agentId, baseUrl, and token are required' });
      }

      const entry = {
        agentId: id,
        baseUrl: normalizeRemoteAgentUrl(baseUrl),
        token: secret,
        allowedManagerPrefix: String(allowedManagerPrefix || 'qm-primary').trim() || 'qm-primary',
        createdAt: remoteAgentRegistry.get(id)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastPingAt: remoteAgentRegistry.get(id)?.lastPingAt || null,
        lastPingError: remoteAgentRegistry.get(id)?.lastPingError || null,
        lastKnownHealth: remoteAgentRegistry.get(id)?.lastKnownHealth || null,
      };

      remoteAgentRegistry.set(id, entry);
      res.json({ status: 'registered', agent: { ...entry, token: undefined, hasToken: true } });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/remote-agents/:agentId/ping', async (req, res) => {
    try {
      const agent = getRemoteAgentOrThrow(req.params.agentId);
      const health = await callRemoteAgent(agent, '/agent/health', 'GET');
      agent.lastPingAt = new Date().toISOString();
      agent.lastPingError = null;
      agent.lastKnownHealth = health;
      remoteAgentRegistry.set(agent.agentId, agent);
      res.json({ status: 'ok', agentId: agent.agentId, health });
    } catch (e) {
      const agent = remoteAgentRegistry.get(req.params.agentId);
      if (agent) {
        agent.lastPingAt = new Date().toISOString();
        agent.lastPingError = e.message;
        remoteAgentRegistry.set(agent.agentId, agent);
      }
      res.status(502).json({ error: e.message });
    }
  });

  app.get('/api/remote-queue-managers', (req, res) => {
    res.json({ launchers: getRemoteLaunchersPayload() });
  });

  app.post('/api/remote-queue-managers/start', async (req, res) => {
    try {
      const {
        agentId,
        managerId,
        nodeId,
        port,
        advertiseIp,
        aggregatorUrl,
      } = req.body || {};

      if (!agentId || !managerId || !port || !advertiseIp) {
        return res.status(400).json({ error: 'agentId, managerId, port, and advertiseIp are required' });
      }

      const agent = getRemoteAgentOrThrow(agentId);
      if (!String(managerId).startsWith(agent.allowedManagerPrefix)) {
        return res.status(400).json({
          error: `managerId must start with ${agent.allowedManagerPrefix} for agent ${agent.agentId}`
        });
      }

      const sourceManager = pickSyncSourceManager(managerId);
      if (sourceManager) {
        pendingManagerSync.set(managerId, {
          sourceManagerId: sourceManager.managerId,
          startedAt: Date.now(),
        });
      }

      upsertRemoteQueueManager({
        managerId,
        name: managerId,
        nodeId: nodeId || agent.agentId,
        ip: advertiseIp,
        port: Number(port),
        status: sourceManager ? 'syncing' : 'up',
        queues: []
      });

      if (sourceManager) {
        const pendingManager = queueManagerRegistry.get(managerId);
        if (pendingManager) {
          pendingManager.lastHeartbeat = 0;
          queueManagerRegistry.set(managerId, pendingManager);
        }
      }

      const remoteLaunch = await callRemoteAgent(agent, '/agent/qm/start', 'POST', {
        managerId,
        nodeId: nodeId || agent.agentId,
        port: Number(port),
        advertiseIp,
        aggregatorUrl: aggregatorUrl || `http://127.0.0.1:${HTTP_PORT}`,
      });

      remoteQueueManagerProcesses.set(managerId, {
        managerId,
        agentId: agent.agentId,
        nodeId: nodeId || agent.agentId,
        port: Number(port),
        advertiseIp,
        aggregatorUrl: aggregatorUrl || `http://127.0.0.1:${HTTP_PORT}`,
        status: 'running',
        startedAt: new Date().toISOString(),
        stoppedAt: null,
        lastError: null,
        remote: remoteLaunch || null,
      });

      if (!sourceManager) {
        const manager = queueManagerRegistry.get(managerId);
        if (manager) {
          manager.status = 'up';
          manager.syncState = 'ready';
          manager.lastSyncAt = new Date().toISOString();
          manager.lastSyncError = null;
          queueManagerRegistry.set(managerId, manager);
        }
        return res.json({
          status: 'started',
          remote: remoteLaunch,
          sync: { required: false }
        });
      }

      waitForManagerRegistration(managerId)
        .then(() => syncManagerBeforeActivation(managerId, sourceManager.managerId))
        .catch((error) => {
          const manager = queueManagerRegistry.get(managerId);
          if (manager) {
            manager.status = 'sync-failed';
            manager.syncState = 'failed';
            manager.lastSyncError = error.message;
            queueManagerRegistry.set(managerId, manager);
          }
          const launcher = remoteQueueManagerProcesses.get(managerId);
          if (launcher) {
            launcher.status = 'error';
            launcher.lastError = error.message;
            remoteQueueManagerProcesses.set(managerId, launcher);
          }
          pendingManagerSync.delete(managerId);
          console.error(`[SYNC] Failed initial remote sync for ${managerId}: ${error.message}`);
        });

      res.json({
        status: 'started',
        remote: remoteLaunch,
        sync: {
          required: true,
          state: 'syncing',
          sourceManagerId: sourceManager.managerId,
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/remote-queue-managers/:managerId/stop', async (req, res) => {
    try {
      const managerId = req.params.managerId;
      const launcher = remoteQueueManagerProcesses.get(managerId);
      if (!launcher) {
        return res.status(404).json({ error: 'Remote queue manager launcher not found' });
      }

      const bodyAgentId = String(req.body?.agentId || '').trim();
      const targetAgentId = bodyAgentId || launcher.agentId;
      const agent = getRemoteAgentOrThrow(targetAgentId);
      const remoteStop = await callRemoteAgent(agent, `/agent/qm/${encodeURIComponent(managerId)}/stop`, 'POST');

      launcher.status = 'stopping';
      launcher.stoppedAt = new Date().toISOString();
      launcher.remote = remoteStop || launcher.remote;
      remoteQueueManagerProcesses.set(managerId, launcher);

      const manager = queueManagerRegistry.get(managerId);
      if (manager) {
        manager.status = 'down';
        manager.updatedAt = new Date().toISOString();
        queueManagerRegistry.set(managerId, manager);
      }

      pendingManagerSync.delete(managerId);
      res.json({ status: 'stopping', managerId, remote: remoteStop || null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/remote-queue-managers/:managerId/status', async (req, res) => {
    try {
      const managerId = req.params.managerId;
      const launcher = remoteQueueManagerProcesses.get(managerId);
      if (!launcher) {
        return res.status(404).json({ error: 'Remote queue manager launcher not found' });
      }
      const agent = getRemoteAgentOrThrow(launcher.agentId);
      const remoteStatus = await callRemoteAgent(agent, `/agent/qm/${encodeURIComponent(managerId)}/status`, 'GET');
      res.json({ managerId, launcher, remoteStatus });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/local-queue-managers/start', (req, res) => {
    try {
      const defaultIp = req.ip?.replace('::ffff:', '') || '127.0.0.1';
      const {
        managerId,
        nodeId,
        port,
        advertiseIp,
        aggregatorUrl,
      } = req.body || {};

      if (!managerId || !port) {
        return res.status(400).json({ error: 'managerId and port are required' });
      }

      const sourceManager = pickSyncSourceManager(managerId);
      if (sourceManager) {
        pendingManagerSync.set(managerId, {
          sourceManagerId: sourceManager.managerId,
          startedAt: Date.now(),
        });
      }

      upsertRemoteQueueManager({
        managerId,
        name: managerId,
        nodeId: nodeId || os.hostname(),
        ip: advertiseIp || defaultIp,
        port: Number(port),
        status: sourceManager ? 'syncing' : 'up',
        queues: []
      });

      if (sourceManager) {
        const pendingManager = queueManagerRegistry.get(managerId);
        if (pendingManager) {
          pendingManager.lastHeartbeat = 0;
          queueManagerRegistry.set(managerId, pendingManager);
        }
      }

      const entry = launchLocalQueueManager({
        managerId,
        nodeId: nodeId || os.hostname(),
        port: Number(port),
        advertiseIp: advertiseIp || defaultIp,
        aggregatorUrl: aggregatorUrl || `http://127.0.0.1:${HTTP_PORT}`,
      });

      if (!sourceManager) {
        const manager = queueManagerRegistry.get(managerId);
        if (manager) {
          manager.status = 'up';
          manager.syncState = 'ready';
          manager.lastSyncAt = new Date().toISOString();
          manager.lastSyncError = null;
          queueManagerRegistry.set(managerId, manager);
        }
        return res.json({
          status: 'started',
          launcher: getLocalQueueManagerLaunchers().find(x => x.managerId === entry.managerId),
          sync: { required: false }
        });
      }

      waitForManagerRegistration(managerId)
        .then(() => syncManagerBeforeActivation(managerId, sourceManager.managerId))
        .catch((error) => {
          const manager = queueManagerRegistry.get(managerId);
          if (manager) {
            manager.status = 'sync-failed';
            manager.syncState = 'failed';
            manager.lastSyncError = error.message;
            queueManagerRegistry.set(managerId, manager);
          }
          pendingManagerSync.delete(managerId);
          console.error(`[SYNC] Failed initial sync for ${managerId}: ${error.message}`);
        });

      res.json({
        status: 'started',
        launcher: getLocalQueueManagerLaunchers().find(x => x.managerId === entry.managerId),
        sync: {
          required: true,
          state: 'syncing',
          sourceManagerId: sourceManager.managerId,
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/local-queue-managers/:managerId/stop', (req, res) => {
    const entry = stopLocalQueueManager(req.params.managerId);
    if (!entry) {
      return res.status(404).json({ error: 'Queue manager launcher not found' });
    }
    res.json({ status: 'stopping', managerId: req.params.managerId });
  });

  app.post('/api/registry/nodes/:nodeId/quiesce', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'quiesced');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'quiesced' });
  });

  app.post('/api/registry/nodes/:nodeId/drain', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'draining');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    const drain = getNodeDrainStatus(req.params.nodeId);
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'draining', drain });
  });

  app.get('/api/registry/nodes/:nodeId/drain-status', (req, res) => {
    const drain = getNodeDrainStatus(req.params.nodeId);
    if (drain.managerCount === 0) return res.status(404).json({ error: 'Node not found' });
    res.json(drain);
  });

  app.post('/api/registry/nodes/:nodeId/maintenance', (req, res) => {
    const force = req.query.force === 'true';
    const drain = getNodeDrainStatus(req.params.nodeId);
    if (drain.managerCount === 0) return res.status(404).json({ error: 'Node not found' });
    if (!drain.drainReady && !force) {
      return res.status(409).json({
        error: 'Node not drained',
        message: 'Use /drain-status and wait for pendingMessagesKnown=0, or pass ?force=true',
        drain
      });
    }
    const changed = setNodeLifecycleState(req.params.nodeId, 'maintenance');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'maintenance' });
  });

  app.post('/api/registry/nodes/:nodeId/return-service', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'up');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'up' });
  });

  app.post('/api/registry/queue-managers/:managerId/quiesce', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'quiesced');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.post('/api/registry/queue-managers/:managerId/maintenance', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'maintenance');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.post('/api/registry/queue-managers/:managerId/return-service', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'up');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.get('/api/registry/queues', (req, res) => {
    const queues = Array.from(queueRoutes.values()).map(route => {
      const manager = queueManagerRegistry.get(route.managerId);
      let queueLength = null;
      if (manager?.local) {
        queueLength = queueManagers[manager.localIndex].getQueueLength(route.queueName);
      }
      return {
        queueName: route.queueName,
        managerId: route.managerId,
        queueLength,
        assignedAt: route.assignedAt
      };
    });
    res.json({ queues });
  });
}
