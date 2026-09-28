import { resolveQueueTypeIds } from './queueDslCompiler.mjs';

export function buildQueueTypeRegistry(types = []) {
  const registry = {};
  for (const item of Array.isArray(types) ? types : []) {
    const logicalId = String(item?.logicalId || item?.id || '').trim();
    const canonicalId = String(item?.canonicalId || '').trim().toLowerCase();
    if (!logicalId || !canonicalId) continue;
    const entry = { logicalId, canonicalId };
    for (const alias of [logicalId, item.id, item.canonicalId, ...(Array.isArray(item.aliases) ? item.aliases : [])]) {
      const normalized = String(alias || '').trim().toLowerCase();
      if (normalized) registry[normalized] = entry;
    }
  }
  return registry;
}

export async function migratePersistedQueueTypeIds(queueManagerInstances, types) {
  const registry = buildQueueTypeRegistry(types);
  let migrated = 0;

  for (const qm of queueManagerInstances.values()) {
    if (typeof qm.getAllQueueConfigs !== 'function' || typeof qm.updateQueueConfig !== 'function') continue;
    const snapshot = qm.getAllQueueConfigs();
    for (const [queueName, config] of Object.entries(snapshot?.queues || {})) {
      const rawIds = Array.isArray(config.dataTypeIds)
        ? config.dataTypeIds
        : config.dataTypeId ? [config.dataTypeId] : [];
      if (rawIds.length === 0) continue;
      const dataTypeIds = resolveQueueTypeIds(rawIds, registry);
      if (dataTypeIds.length === 0 || JSON.stringify(dataTypeIds) === JSON.stringify(rawIds)) continue;
      await qm.updateQueueConfig(queueName, {
        dataTypeId: dataTypeIds[0],
        dataTypeIds
      });
      migrated += 1;
    }
  }

  return migrated;
}
