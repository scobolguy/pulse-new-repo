const SUPPORTED_PROVIDERS = new Set(['legacy', 'memory', 'msmq', 'rabbitmq', 'kafka', 'ibm', 'apache']);

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const v = String(raw || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function validateQueueDslSpec(spec) {
  const errors = [];

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['spec must be an object'] };
  }

  const version = Number(spec.version || 0);
  if (version !== 1) {
    errors.push('version must be 1');
  }

  if (!Array.isArray(spec.managers) || spec.managers.length === 0) {
    errors.push('managers must be a non-empty array');
    return { valid: false, errors };
  }

  for (const [idx, manager] of spec.managers.entries()) {
    if (!manager || typeof manager !== 'object') {
      errors.push(`managers[${idx}] must be an object`);
      continue;
    }

    const managerId = String(manager.managerId || '').trim();
    if (!managerId) {
      errors.push(`managers[${idx}].managerId is required`);
    }

    const provider = String(manager.provider || spec.defaultProvider || 'legacy').trim().toLowerCase();
    if (!SUPPORTED_PROVIDERS.has(provider)) {
      errors.push(`managers[${idx}].provider '${provider}' is unsupported`);
    }

    if (!Array.isArray(manager.queues)) {
      errors.push(`managers[${idx}].queues must be an array`);
      continue;
    }

    for (const [qIdx, queue] of manager.queues.entries()) {
      if (!queue || typeof queue !== 'object') {
        errors.push(`managers[${idx}].queues[${qIdx}] must be an object`);
        continue;
      }
      const queueName = String(queue.queueName || queue.name || '').trim();
      if (!queueName) {
        errors.push(`managers[${idx}].queues[${qIdx}].queueName is required`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function compileQueueForProvider(queue, provider, managerId) {
  const queueName = String(queue.queueName || queue.name).trim();
  const dataTypeIds = uniqueStrings(asArray(queue.dataTypeIds?.length ? queue.dataTypeIds : (queue.dataTypeId || 'text-string')));

  const canonicalConfig = {
    name: queueName,
    dataTypeId: dataTypeIds[0] || 'text-string',
    dataTypeIds: dataTypeIds.length ? dataTypeIds : ['text-string'],
    createdByUser: queue.createdByUser === true,
    retentionMs: Number(queue.retentionMs || 0) || undefined,
    deadLetterQueue: queue.deadLetterQueue ? String(queue.deadLetterQueue) : undefined,
    maxLength: Number(queue.maxLength || 0) || undefined,
    frozen: queue.frozen === true
  };

  const providerArtifacts = {
    provider,
    managerId,
    queueName,
    physicalName: queueName,
    exchange: null,
    topic: null,
    baseQueuePath: null
  };

  if (provider === 'msmq') {
    const basePath = String(queue.baseQueuePath || '.\\private$').trim();
    const prefix = String(queue.msmqQueuePrefix || '').trim();
    const physical = prefix ? `${prefix}.${queueName}` : queueName;
    providerArtifacts.baseQueuePath = basePath;
    providerArtifacts.physicalName = `${basePath}\\${physical}`;
  }

  if (provider === 'rabbitmq') {
    const exchangeName = String(queue.exchangeName || 'pulse-broker').trim();
    providerArtifacts.exchange = exchangeName;
    providerArtifacts.physicalName = queueName;
  }

  if (provider === 'kafka') {
    const topicPrefix = String(queue.topicPrefix || 'pulse').trim();
    providerArtifacts.topic = topicPrefix ? `${topicPrefix}.${queueName}` : queueName;
    providerArtifacts.physicalName = providerArtifacts.topic;
  }

  return {
    queueName,
    config: Object.fromEntries(Object.entries(canonicalConfig).filter(([, value]) => value !== undefined)),
    artifacts: providerArtifacts
  };
}

export function compileQueueDslSpec(spec) {
  const validation = validateQueueDslSpec(spec);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, managers: [] };
  }

  const managers = (spec.managers || []).map((manager) => {
    const managerId = String(manager.managerId).trim();
    const provider = String(manager.provider || spec.defaultProvider || 'legacy').trim().toLowerCase();
    const queues = (manager.queues || []).map((queue) => compileQueueForProvider(queue, provider, managerId));

    return {
      managerId,
      provider,
      queues,
      queueMap: Object.fromEntries(queues.map((q) => [q.queueName, q.config]))
    };
  });

  return {
    valid: true,
    errors: [],
    managers,
    metadata: {
      version: 1,
      generatedAt: new Date().toISOString(),
      managerCount: managers.length,
      queueCount: managers.reduce((sum, m) => sum + m.queues.length, 0)
    }
  };
}

export function diffQueueConfigs(existing = {}, desired = {}) {
  const creates = [];
  const updates = [];
  const unchanged = [];

  for (const [queueName, desiredConfig] of Object.entries(desired)) {
    const current = existing[queueName];
    if (!current) {
      creates.push({ queueName, desiredConfig });
      continue;
    }

    const currentNorm = JSON.stringify(current);
    const desiredNorm = JSON.stringify({ ...current, ...desiredConfig });
    if (currentNorm === desiredNorm) {
      unchanged.push(queueName);
    } else {
      updates.push({ queueName, currentConfig: current, desiredConfig });
    }
  }

  return { creates, updates, unchanged };
}
