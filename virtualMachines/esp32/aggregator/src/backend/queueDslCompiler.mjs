function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`;
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function resolveNominalTypeId(typeValue, registry = {}) {
  if (typeValue == null) return '';
  if (typeof typeValue === 'string') {
    const key = String(typeValue).trim();
    if (!key) return '';
    const normalizedKey = key.toLowerCase();
    const match = registry[normalizedKey] || registry[key] || registry[`type:${normalizedKey}`] || registry[`type:${key}`];
    if (match) {
      const canonicalId = typeof match.canonicalId === 'string' && match.canonicalId.trim() ? String(match.canonicalId).trim() : '';
      if (canonicalId) return canonicalId.toLowerCase();
      const logicalId = typeof match.logicalId === 'string' && match.logicalId.trim() ? String(match.logicalId).trim() : '';
      if (logicalId) return logicalId.toLowerCase();
    }
    return key.toLowerCase();
  }

  if (Array.isArray(typeValue)) {
    const results = typeValue.map(item => resolveNominalTypeId(item, registry)).filter(Boolean);
    return results[0] || '';
  }

  if (isObject(typeValue)) {
    if (typeValue.type === 'TypeRef') {
      if (typeValue.kind === 'list' && typeValue.elementType) {
        return resolveNominalTypeId(typeValue.elementType, registry);
      }
      const key = String(typeValue.id || typeValue.name || '').trim();
      if (!key) return '';
      const normalizedKey = key.toLowerCase();
      const match = registry[normalizedKey] || registry[key] || registry[`type:${normalizedKey}`] || registry[`type:${key}`];
      if (match) {
        const canonicalId = typeof match.canonicalId === 'string' && match.canonicalId.trim() ? String(match.canonicalId).trim() : '';
        if (canonicalId) return canonicalId.toLowerCase();
        const logicalId = typeof match.logicalId === 'string' && match.logicalId.trim() ? String(match.logicalId).trim() : '';
        if (logicalId) return logicalId.toLowerCase();
      }
      return key.toLowerCase();
    }
    if (typeof typeValue.canonicalId === 'string' && typeValue.canonicalId.trim()) {
      return String(typeValue.canonicalId).trim().toLowerCase();
    }
    if (typeof typeValue.logicalId === 'string' && typeValue.logicalId.trim()) {
      return String(typeValue.logicalId).trim().toLowerCase();
    }
    if (typeof typeValue.name === 'string' && typeValue.name.trim()) {
      const key = typeValue.name.trim();
      const match = registry[key.toLowerCase()] || registry[key] || registry[`type:${key.toLowerCase()}`] || registry[`type:${key}`];
      if (match) {
        const canonicalId = typeof match.canonicalId === 'string' && match.canonicalId.trim() ? String(match.canonicalId).trim() : '';
        if (canonicalId) return canonicalId.toLowerCase();
        const logicalId = typeof match.logicalId === 'string' && match.logicalId.trim() ? String(match.logicalId).trim() : '';
        if (logicalId) return logicalId.toLowerCase();
      }
      return key.toLowerCase();
    }
  }

  return '';
}

export function resolveQueueTypeIds(candidate, registry = {}) {
  const values = Array.isArray(candidate) ? candidate : [candidate];
  const result = [];
  for (const item of values) {
    const resolved = resolveNominalTypeId(item, registry);
    if (resolved) result.push(resolved);
  }
  return Array.from(new Set(result));
}

function normalizeQueueConfig(config = {}) {
  const payload = isObject(config) ? { ...config } : {};
  const queueClass = String(payload.queueClass || payload.retentionClass || (payload.temporary === true ? 'temporary' : 'permanent')).trim().toLowerCase();
  payload.queueClass = queueClass === 'temporary' ? 'temporary' : 'permanent';

  const registry = payload.typeRegistry || payload.registry || {};

  if (Object.prototype.hasOwnProperty.call(payload, 'messageTypeId') && !Object.prototype.hasOwnProperty.call(payload, 'dataTypeId')) {
    payload.dataTypeId = payload.messageTypeId;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'dataTypeIds')) {
    const ids = Array.isArray(payload.dataTypeIds) ? payload.dataTypeIds : [payload.dataTypeIds];
    const normalizedIds = resolveQueueTypeIds(ids, registry);
    if (normalizedIds.length > 0) {
      payload.dataTypeIds = normalizedIds;
      payload.dataTypeId = payload.dataTypeIds[0];
    } else {
      delete payload.dataTypeIds;
      delete payload.dataTypeId;
    }
  } else if (Object.prototype.hasOwnProperty.call(payload, 'dataTypeId')) {
    const normalized = resolveQueueTypeIds([payload.dataTypeId], registry)[0] || '';
    if (normalized) {
      payload.dataTypeId = normalized;
      payload.dataTypeIds = [normalized];
    } else {
      delete payload.dataTypeId;
    }
  }

  return payload;
}

function normalizeQueueSpecEntry(entry) {
  if (typeof entry === 'string') {
    const queueName = String(entry).trim();
    return queueName ? { queueName, config: {} } : null;
  }
  if (!isObject(entry)) return null;

  const queueName = String(entry.queueName || entry.name || '').trim();
  if (!queueName) return null;

  const configSource = isObject(entry.config) ? entry.config : entry;
  return {
    queueName,
    config: normalizeQueueConfig(configSource),
    artifacts: isObject(entry.artifacts) ? entry.artifacts : {}
  };
}

export function queueConfigMapFromWorkflowSymbols(symbols = {}) {
  const queueMap = {};
  for (const queue of Array.isArray(symbols?.queues) ? symbols.queues : []) {
    const queueName = String(queue?.queueName || '').trim();
    if (!queueName) continue;
    queueMap[queueName] = normalizeQueueConfig({
      dataTypeIds: queue.dataTypeIds || queue.dataTypeId,
      systemId: queue.systemId || null,
      managerId: queue.managerId || null,
      visibility: queue.visibility || 'internal',
      sourceSymbol: queue.symbol || null
    });
  }
  return queueMap;
}

function normalizeManagerSpec(manager) {
  if (!isObject(manager)) return null;

  const managerId = String(manager.managerId || manager.id || '').trim();
  if (!managerId) return null;

  const queueEntries = [];

  if (Array.isArray(manager.queues)) {
    for (const queue of manager.queues) {
      const normalizedQueue = normalizeQueueSpecEntry(queue);
      if (normalizedQueue) queueEntries.push(normalizedQueue);
    }
  }

  if (isObject(manager.queueMap)) {
    for (const [queueName, queueConfig] of Object.entries(manager.queueMap)) {
      const normalizedName = String(queueName || '').trim();
      if (!normalizedName) continue;
      queueEntries.push({
        queueName: normalizedName,
        config: normalizeQueueConfig(queueConfig),
        artifacts: {}
      });
    }
  }

  const deduped = new Map();
  for (const queue of queueEntries) {
    deduped.set(queue.queueName, queue);
  }

  const queues = Array.from(deduped.values());
  const queueMap = Object.fromEntries(queues.map(queue => [queue.queueName, queue.config]));

  return {
    managerId,
    provider: String(manager.provider || 'queue-manager').trim() || 'queue-manager',
    queues,
    queueMap
  };
}

export function compileQueueDslSpec(spec) {
  const errors = [];
  let payload = spec;

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      errors.push('Queue DSL spec string must be valid JSON');
      return { valid: false, errors, metadata: null, managers: [] };
    }
  }

  if (!isObject(payload)) {
    errors.push('Queue DSL spec must be an object payload');
    return { valid: false, errors, metadata: null, managers: [] };
  }

  const managerSource = Array.isArray(payload.managers)
    ? payload.managers
    : isObject(payload.managers)
      ? Object.entries(payload.managers).map(([managerId, manager]) => ({ managerId, ...(isObject(manager) ? manager : {}) }))
      : [];

  if (managerSource.length === 0) {
    errors.push('Queue DSL spec must include at least one manager in managers[]');
    return { valid: false, errors, metadata: null, managers: [] };
  }

  const managers = [];
  for (const manager of managerSource) {
    const normalized = normalizeManagerSpec(manager);
    if (!normalized) {
      errors.push('Invalid manager entry: managerId is required');
      continue;
    }
    managers.push(normalized);
  }

  if (managers.length === 0) {
    errors.push('Queue DSL spec did not produce any valid manager definitions');
    return { valid: false, errors, metadata: null, managers: [] };
  }

  return {
    valid: true,
    errors: [],
    metadata: {
      version: String(payload.version || '1'),
      source: String(payload.source || 'queue-dsl'),
      managerCount: managers.length,
      queueCount: managers.reduce((sum, manager) => sum + manager.queues.length, 0),
      compiledAt: new Date().toISOString()
    },
    managers
  };
}

export function diffQueueConfigs(existingQueues = {}, desiredQueueMap = {}, options = {}) {
  const existing = isObject(existingQueues) ? existingQueues : {};
  const desired = isObject(desiredQueueMap) ? desiredQueueMap : {};
  const compareDeclaredFields = options?.compareDeclaredFields === true;

  const creates = [];
  const updates = [];
  const unchanged = [];

  for (const [queueName, desiredConfigRaw] of Object.entries(desired)) {
    const desiredConfig = normalizeQueueConfig(desiredConfigRaw);
    const currentConfig = normalizeQueueConfig(existing[queueName] || {});

    if (!Object.prototype.hasOwnProperty.call(existing, queueName)) {
      creates.push({ queueName, desiredConfig });
      continue;
    }

    const comparableCurrentConfig = compareDeclaredFields
      ? Object.fromEntries(Object.keys(desiredConfig).map(key => [key, currentConfig[key]]))
      : currentConfig;
    if (stableStringify(comparableCurrentConfig) !== stableStringify(desiredConfig)) {
      updates.push({ queueName, currentConfig, desiredConfig });
      continue;
    }

    unchanged.push(queueName);
  }

  return {
    creates,
    updates,
    unchanged
  };
}
