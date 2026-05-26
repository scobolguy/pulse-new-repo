export function registerReplicationRoutes(app, deps) {
  const {
    queueManagerRegistry,
    queueManagers
  } = deps;

  app.post('/api/replication/create-replica', (req, res) => {
    try {
      const { primaryManagerId, replicaManagerId, replicaNodeId, replicaIp, replicaPort } = req.body || {};

      if (!primaryManagerId || !replicaManagerId) {
        return res.status(400).json({ error: 'primaryManagerId and replicaManagerId are required' });
      }

      const primary = queueManagerRegistry.get(primaryManagerId);
      if (!primary) {
        return res.status(404).json({ error: `Primary manager ${primaryManagerId} not found` });
      }

      const replica = {
        managerId: replicaManagerId,
        name: `${primary.name}-replica`,
        nodeId: replicaNodeId || primary.nodeId,
        ip: replicaIp || primary.ip,
        port: replicaPort || primary.port,
        status: 'up',
        local: false,
        lastHeartbeat: Date.now(),
        queues: [],
        replicaOf: primaryManagerId,
        replicas: [],
        operationVersion: 0,
        primarySyncVersion: 0
      };

      queueManagerRegistry.set(replicaManagerId, replica);

      if (!primary.replicas) primary.replicas = [];
      primary.replicas.push(replicaManagerId);
      queueManagerRegistry.set(primaryManagerId, primary);

      res.json({
        status: 'replica-created',
        primary: { managerId: primaryManagerId, replicas: primary.replicas },
        replica: { managerId: replicaManagerId, replicaOf: primaryManagerId }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/replication/operations/:managerId', (req, res) => {
    try {
      const { managerId } = req.params;
      const sinceVersion = Number(req.query.since || 0);

      const manager = queueManagerRegistry.get(managerId);
      if (!manager) {
        return res.status(404).json({ error: `Manager ${managerId} not found` });
      }

      if (manager.local) {
        const qm = queueManagers[manager.localIndex];
        const ops = qm.getOperationsSince(sinceVersion);
        return res.json({
          managerId,
          currentVersion: qm.getCurrentVersion(),
          operations: ops,
          operationCount: ops.length
        });
      }

      res.json({
        managerId,
        currentVersion: manager.operationVersion,
        operations: [],
        operationCount: 0,
        note: 'Remote manager operations not directly accessible - use replica sync endpoint'
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/replication/snapshot/:managerId', (req, res) => {
    try {
      const { managerId } = req.params;
      const manager = queueManagerRegistry.get(managerId);
      if (!manager) {
        return res.status(404).json({ error: `Manager ${managerId} not found` });
      }

      if (manager.local) {
        const qm = queueManagers[manager.localIndex];
        const snapshot = qm.getSnapshot();
        return res.json({ managerId, snapshot });
      }

      res.json({
        managerId,
        snapshot: null,
        note: 'Remote manager snapshot not directly accessible'
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/replication/apply-operations/:targetManagerId', (req, res) => {
    try {
      const { targetManagerId } = req.params;
      const { operations } = req.body || {};

      if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations array is required' });
      }

      const manager = queueManagerRegistry.get(targetManagerId);
      if (!manager) {
        return res.status(404).json({ error: `Target manager ${targetManagerId} not found` });
      }

      if (!manager.local) {
        return res.status(400).json({ error: 'Can only apply operations to local managers' });
      }

      const qm = queueManagers[manager.localIndex];
      let applied = 0;

      for (const op of operations) {
        try {
          qm.applyReplicatedOperation(op);
          applied++;
          manager.primarySyncVersion = op.version;
        } catch (e) {
          console.error('Failed to apply operation:', op, e);
        }
      }

      queueManagerRegistry.set(targetManagerId, manager);

      res.json({
        status: 'operations-applied',
        targetManagerId,
        applied,
        total: operations.length,
        newVersion: manager.primarySyncVersion
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/replication/status/:managerId', (req, res) => {
    try {
      const { managerId } = req.params;
      const manager = queueManagerRegistry.get(managerId);
      if (!manager) {
        return res.status(404).json({ error: `Manager ${managerId} not found` });
      }

      const status = {
        managerId,
        isReplica: !!manager.replicaOf,
        replicaOf: manager.replicaOf,
        replicas: manager.replicas || [],
        operationVersion: manager.operationVersion || 0,
        primarySyncVersion: manager.primarySyncVersion || 0,
        syncLag: (manager.operationVersion || 0) - (manager.primarySyncVersion || 0)
      };

      if (!manager.replicaOf && manager.replicas && manager.replicas.length > 0) {
        status.replicaStatuses = manager.replicas.map((replicaId) => {
          const replica = queueManagerRegistry.get(replicaId);
          return {
            replicaId,
            status: replica?.status || 'unknown',
            syncLag: (manager.operationVersion || 0) - (replica?.primarySyncVersion || 0),
            lastHeartbeat: replica?.lastHeartbeat
          };
        });
      }

      res.json(status);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
