export function registerQueueConfigRoutes(app, deps) {
  const {
    requirePermission,
    queueManagerInstances,
    queueManagerRegistry,
    inferQueueDataTypeIds,
    compileQueueDslSpec,
    diffQueueConfigs,
    resolveLibrarianOrigin,
    IS_PRODUCTION_ENV,
    ALLOW_TEMP_QUEUES_IN_PRODUCTION
  } = deps;

  async function getAllowedDataTypeIds() {
    try {
      const response = await fetch(`${resolveLibrarianOrigin()}/api/librarian/data-types`, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Librarian returned ${response.status}`);
      }
      const payload = await response.json();
      const ids = new Set((payload.types || []).map(item => String(item.id || '').trim().toLowerCase()).filter(Boolean));
      ids.add('text-string');
      return ids;
    } catch {
      return new Set(['text-string']);
    }
  }

  async function normalizeAndValidateDataTypeId(candidate) {
    const normalized = String(candidate || '').trim().toLowerCase();
    if (!normalized) {
      throw new Error('Queue data type is required');
    }
    const allowed = await getAllowedDataTypeIds();
    if (!allowed.has(normalized)) {
      throw new Error(`Invalid queue data type: ${normalized}`);
    }
    return normalized;
  }

  async function normalizeAndValidateDataTypeIds(candidate) {
    const rawValues = Array.isArray(candidate)
      ? candidate
      : (candidate === undefined || candidate === null || candidate === '')
        ? ['text-string']
        : [candidate];

    const normalizedUnique = [];
    const seen = new Set();
    for (const value of rawValues) {
      const normalized = await normalizeAndValidateDataTypeId(value);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        normalizedUnique.push(normalized);
      }
    }

    if (normalizedUnique.length === 0) {
      normalizedUnique.push('text-string');
    }

    return normalizedUnique;
  }

  function normalizeQueueClass(candidate, fallback = 'permanent') {
    const normalized = String(candidate || fallback || 'permanent').trim().toLowerCase();
    if (normalized !== 'permanent' && normalized !== 'temporary') {
      throw new Error(`Invalid queueClass: ${normalized}. Expected permanent or temporary`);
    }
    if (normalized === 'temporary' && IS_PRODUCTION_ENV && !ALLOW_TEMP_QUEUES_IN_PRODUCTION) {
      throw new Error(
        'Temporary queues are blocked in production. Set ALLOW_TEMP_QUEUES_IN_PRODUCTION=true to override explicitly.'
      );
    }
    return normalized;
  }

  function normalizeTemporaryExpiry(value) {
    if (value == null || value === '') return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      throw new Error(`Invalid expiresAt value: ${value}`);
    }
    return date.toISOString();
  }

  function normalizeQueueDurabilityForCreate(config = {}) {
    const queueClass = normalizeQueueClass(
      config.queueClass ?? config.retentionClass ?? (config.temporary === true ? 'temporary' : 'permanent'),
      'permanent'
    );
    const expiresAt = normalizeTemporaryExpiry(config.expiresAt ?? null);
    const temporaryReason = String(config.temporaryReason || '').trim() || null;

    if (queueClass === 'temporary' && !expiresAt) {
      throw new Error('Temporary queues require expiresAt for auditability');
    }

    return {
      queueClass,
      expiresAt: queueClass === 'temporary' ? expiresAt : null,
      temporaryReason: queueClass === 'temporary' ? temporaryReason : null
    };
  }

  function normalizeQueueDurabilityForUpdate(updates = {}) {
    const hasQueueClass = Object.prototype.hasOwnProperty.call(updates, 'queueClass')
      || Object.prototype.hasOwnProperty.call(updates, 'retentionClass')
      || Object.prototype.hasOwnProperty.call(updates, 'temporary');
    const hasExpiry = Object.prototype.hasOwnProperty.call(updates, 'expiresAt');
    const hasReason = Object.prototype.hasOwnProperty.call(updates, 'temporaryReason');

    if (!hasQueueClass && !hasExpiry && !hasReason) {
      return {};
    }

    const normalized = {};
    if (hasQueueClass) {
      normalized.queueClass = normalizeQueueClass(
        updates.queueClass ?? updates.retentionClass ?? (updates.temporary === true ? 'temporary' : 'permanent'),
        'permanent'
      );
    }
    if (hasExpiry) {
      normalized.expiresAt = normalizeTemporaryExpiry(updates.expiresAt);
    }
    if (hasReason) {
      normalized.temporaryReason = String(updates.temporaryReason || '').trim() || null;
    }

    if (normalized.queueClass === 'temporary' && !Object.prototype.hasOwnProperty.call(normalized, 'expiresAt')) {
      throw new Error('Updating queueClass to temporary requires expiresAt for auditability');
    }

    return normalized;
  }

  async function applyQueueConfigOperation(managerId, operation) {
    const qm = queueManagerInstances.get(managerId);
    if (qm) {
      const { type, queueName, config, updates } = operation;
      if (type === 'createQueue') {
        return { mode: 'local', result: qm.createQueue(queueName, config || {}) };
      }
      if (type === 'deleteQueue') {
        qm.deleteQueue(queueName);
        return { mode: 'local', result: { deleted: true } };
      }
      if (type === 'updateQueueConfig') {
        return { mode: 'local', result: qm.updateQueueConfig(queueName, updates || {}) };
      }
      throw new Error(`Unsupported operation type: ${type}`);
    }

    const manager = queueManagerRegistry.get(managerId);
    if (!manager || !manager.ip || !manager.port) {
      throw new Error(`Queue manager ${managerId} not found`);
    }

    const remoteOperation = {
      type: operation.type,
      queueName: operation.queueName,
      config: operation.config || operation.updates,
      configVersion: operation.configVersion,
    };

    const response = await fetch(`http://${manager.ip}:${manager.port}/apply-config-change`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(remoteOperation),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Remote apply failed (${response.status}) for ${managerId}: ${text.slice(0, 200)}`);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = { status: 'applied' };
    }

    return { mode: 'remote', result: payload };
  }

  async function getQueueConfigSnapshot(managerId) {
    const qm = queueManagerInstances.get(managerId);
    if (qm) {
      const snapshot = qm.getAllQueueConfigs();
      const queueLengths = {};
      for (const queueName of Object.keys(snapshot.queues || {})) {
        queueLengths[queueName] = qm.getQueueLength(queueName);
      }
      return { mode: 'local', config: { ...snapshot, queueLengths } };
    }

    const manager = queueManagerRegistry.get(managerId);
    if (!manager || !manager.ip || !manager.port) {
      throw new Error(`Queue manager ${managerId} not found`);
    }

    const response = await fetch(`http://${manager.ip}:${manager.port}/config`, { method: 'GET' });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Remote config fetch failed (${response.status}) for ${managerId}: ${text.slice(0, 200)}`);
    }

    const payload = await response.json();
    let queueLengths = {};
    try {
      const queuesResponse = await fetch(`http://${manager.ip}:${manager.port}/queues`, { method: 'GET' });
      if (queuesResponse.ok) {
        const queuesPayload = await queuesResponse.json();
        queueLengths = Object.fromEntries(
          (queuesPayload.queues || []).map(item => [item.queueName, item.length])
        );
      }
    } catch {
      queueLengths = {};
    }

    return { mode: 'remote', config: { ...payload, queueLengths } };
  }

  app.post('/api/queues/:managerId/create', async (req, res) => {
    try {
      const { managerId } = req.params;
      const { queueName, config } = req.body;
      if (!queueName || !String(queueName).trim()) {
        throw new Error('queueName is required');
      }
      const selectedTypes = config?.dataTypeIds ?? config?.dataTypeId ?? config?.messageTypeId ?? inferQueueDataTypeIds(queueName);
      const dataTypeIds = await normalizeAndValidateDataTypeIds(selectedTypes);
      const normalizedConfig = {
        ...(config || {}),
        dataTypeId: dataTypeIds[0],
        dataTypeIds,
        ...normalizeQueueDurabilityForCreate(config || {}),
        createdByUser: config?.createdByUser === true,
      };

      const applied = await applyQueueConfigOperation(managerId, {
        type: 'createQueue',
        queueName,
        config: normalizedConfig,
      });

      res.json({ success: true, queueName, mode: applied.mode, config: applied.result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/queues/:managerId/delete', async (req, res) => {
    try {
      const { managerId } = req.params;
      const { queueName } = req.body;

      const applied = await applyQueueConfigOperation(managerId, {
        type: 'deleteQueue',
        queueName,
      });

      res.json({ success: true, queueName, mode: applied.mode, deleted: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/queues/:managerId/update', async (req, res) => {
    try {
      const { managerId } = req.params;
      const { queueName, updates } = req.body;
      if (!queueName || !String(queueName).trim()) {
        throw new Error('queueName is required');
      }

      const normalizedUpdates = { ...(updates || {}) };

      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'messageTypeId') && !Object.prototype.hasOwnProperty.call(normalizedUpdates, 'dataTypeId') && !Object.prototype.hasOwnProperty.call(normalizedUpdates, 'dataTypeIds')) {
        normalizedUpdates.dataTypeId = normalizedUpdates.messageTypeId;
      }

      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'dataTypeIds') || Object.prototype.hasOwnProperty.call(normalizedUpdates, 'dataTypeId')) {
        const normalizedIds = await normalizeAndValidateDataTypeIds(
          Object.prototype.hasOwnProperty.call(normalizedUpdates, 'dataTypeIds')
            ? normalizedUpdates.dataTypeIds
            : normalizedUpdates.dataTypeId
        );
        normalizedUpdates.dataTypeIds = normalizedIds;
        normalizedUpdates.dataTypeId = normalizedIds[0];
      }

      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'createdByUser')) {
        normalizedUpdates.createdByUser = normalizedUpdates.createdByUser === true;
      }

      Object.assign(normalizedUpdates, normalizeQueueDurabilityForUpdate(normalizedUpdates));

      const applied = await applyQueueConfigOperation(managerId, {
        type: 'updateQueueConfig',
        queueName,
        updates: normalizedUpdates,
      });

      res.json({ success: true, queueName, mode: applied.mode, config: applied.result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/queues/:managerId/config', async (req, res) => {
    try {
      const { managerId } = req.params;

      const snapshot = await getQueueConfigSnapshot(managerId);
      res.json(snapshot.config);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/queues/audit/temporary', requirePermission('queue.view'), async (req, res) => {
    try {
      const now = Date.now();
      const warningWindowHoursRaw = Number(req.query.warningHours || 24);
      const warningWindowHours = Number.isFinite(warningWindowHoursRaw) && warningWindowHoursRaw > 0
        ? warningWindowHoursRaw
        : 24;
      const warningWindowMs = warningWindowHours * 60 * 60 * 1000;

      const managers = Array.from(queueManagerRegistry.values());
      const results = [];

      for (const manager of managers) {
        try {
          const snapshot = await getQueueConfigSnapshot(manager.managerId);
          const queues = snapshot?.config?.queues || {};
          const queueLengths = snapshot?.config?.queueLengths || {};
          for (const [queueName, queueConfig] of Object.entries(queues)) {
            const queueClass = String(queueConfig?.queueClass || 'permanent').toLowerCase();
            if (queueClass !== 'temporary') continue;

            const expiresAt = queueConfig?.expiresAt || null;
            const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
            const hasValidExpiry = Number.isFinite(expiresAtMs);
            const expired = hasValidExpiry ? expiresAtMs <= now : false;
            const expiresSoon = hasValidExpiry ? (expiresAtMs > now && expiresAtMs - now <= warningWindowMs) : false;

            results.push({
              managerId: manager.managerId,
              queueName,
              queueLength: Number(queueLengths?.[queueName] || 0),
              queueClass,
              temporaryReason: queueConfig?.temporaryReason || null,
              expiresAt,
              hasValidExpiry,
              expired,
              expiresSoon,
              auditRisk: !hasValidExpiry ? 'missing-expiry' : (expired ? 'expired' : (expiresSoon ? 'expiring-soon' : 'ok'))
            });
          }
        } catch {
          // Ignore manager-level errors so one bad node doesn't hide others.
        }
      }

      res.json({
        status: 'ok',
        timestamp: Date.now(),
        warningWindowHours,
        temporaryQueues: results,
        summary: {
          totalTemporary: results.length,
          missingExpiry: results.filter(item => item.auditRisk === 'missing-expiry').length,
          expired: results.filter(item => item.auditRisk === 'expired').length,
          expiringSoon: results.filter(item => item.auditRisk === 'expiring-soon').length
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/queue-dsl/dry-run', requirePermission('queue.view'), async (req, res) => {
    try {
      const spec = req.body?.spec;
      const compiled = compileQueueDslSpec(spec);
      if (!compiled.valid) {
        return res.status(400).json({ valid: false, errors: compiled.errors });
      }

      const managerResults = [];
      for (const manager of compiled.managers) {
        const snapshot = await getQueueConfigSnapshot(manager.managerId);
        const existingQueues = snapshot?.config?.queues || {};
        const diff = diffQueueConfigs(existingQueues, manager.queueMap || {});
        managerResults.push({
          managerId: manager.managerId,
          provider: manager.provider,
          creates: diff.creates,
          updates: diff.updates,
          unchanged: diff.unchanged,
          artifacts: (manager.queues || []).map(item => item.artifacts)
        });
      }

      res.json({
        valid: true,
        metadata: compiled.metadata,
        managers: managerResults,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/queue-dsl/apply', requirePermission('queue.configure'), async (req, res) => {
    try {
      const spec = req.body?.spec;
      const dryRun = req.body?.dryRun === true;
      const compiled = compileQueueDslSpec(spec);
      if (!compiled.valid) {
        return res.status(400).json({ valid: false, errors: compiled.errors });
      }

      const managerResults = [];
      for (const manager of compiled.managers) {
        const snapshot = await getQueueConfigSnapshot(manager.managerId);
        const existingQueues = snapshot?.config?.queues || {};
        const diff = diffQueueConfigs(existingQueues, manager.queueMap || {});

        const applied = { created: [], updated: [], skipped: [] };
        if (!dryRun) {
          for (const createItem of diff.creates) {
            await applyQueueConfigOperation(manager.managerId, {
              type: 'createQueue',
              queueName: createItem.queueName,
              config: createItem.desiredConfig,
            });
            applied.created.push(createItem.queueName);
          }

          for (const updateItem of diff.updates) {
            await applyQueueConfigOperation(manager.managerId, {
              type: 'updateQueueConfig',
              queueName: updateItem.queueName,
              updates: updateItem.desiredConfig,
            });
            applied.updated.push(updateItem.queueName);
          }
        } else {
          applied.created = diff.creates.map(item => item.queueName);
          applied.updated = diff.updates.map(item => item.queueName);
        }

        applied.skipped = diff.unchanged;
        managerResults.push({
          managerId: manager.managerId,
          provider: manager.provider,
          dryRun,
          applied,
          artifacts: (manager.queues || []).map(item => item.artifacts),
        });
      }

      res.json({
        valid: true,
        metadata: compiled.metadata,
        dryRun,
        managers: managerResults,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/queues/:managerId/apply-config-change', (req, res) => {
    try {
      const { managerId } = req.params;
      const operation = req.body;

      const qm = queueManagerInstances.get(managerId);
      if (!qm) {
        return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      }

      qm.applyConfigChange(operation);
      res.json({
        success: true,
        appliedOperation: operation.type,
        queueName: operation.queueName,
        newConfigVersion: qm.configVersion
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}
