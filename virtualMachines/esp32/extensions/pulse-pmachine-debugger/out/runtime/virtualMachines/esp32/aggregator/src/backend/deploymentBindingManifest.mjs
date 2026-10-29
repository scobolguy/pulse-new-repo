function clean(value) {
  const result = String(value ?? '').trim();
  return result || null;
}

function binding(kind, symbol, physicalName, managerId, provider, extra = {}) {
  return {
    kind,
    symbol: clean(symbol),
    physicalName: clean(physicalName),
    managerId: clean(managerId),
    provider: clean(provider),
    ...extra
  };
}

export function buildDeploymentBindingManifest(symbols = {}) {
  const bindings = [];

  for (const queue of Array.isArray(symbols.queues) ? symbols.queues : []) {
    const symbol = queue.symbol || queue.queueName;
    const physicalName = queue.physicalName || queue.declaredName || queue.queueName;
    bindings.push(binding('queue', symbol, physicalName, queue.managerId, queue.provider || 'queue-manager', {
      dataTypeIds: queue.dataTypeIds || (queue.dataTypeId ? [queue.dataTypeId] : []),
      visibility: queue.visibility || 'internal',
      systemId: queue.systemId || null,
      deliveryMode: queue.deliveryMode || 'async'
    }));
  }

  for (const file of Array.isArray(symbols.files) ? symbols.files : []) {
    bindings.push(binding('file', file.symbol, file.path, file.managerId, file.provider || 'ffs'));
  }

  for (const database of Array.isArray(symbols.databases) ? symbols.databases : []) {
    bindings.push(binding('database', database.symbol, database.databaseName, database.managerId, database.provider || 'database', {
      typeName: database.typeName || null,
      recordType: database.recordType || null,
      connectionRef: database.connectionRef || null
    }));
  }

  const invalid = bindings.filter(item => !item.symbol || !item.physicalName);
  if (invalid.length > 0) {
    throw new Error(`Deployment bindings require symbol and physicalName (${invalid.length} invalid)`);
  }

  const map = Object.fromEntries(bindings.map(item => [item.symbol, {
    kind: item.kind,
    physicalName: item.physicalName,
    managerId: item.managerId,
    provider: item.provider,
    ...(item.connectionRef ? { connectionRef: item.connectionRef } : {})
  }]));

  return {
    version: 1,
    bindings,
    bySymbol: Object.fromEntries(bindings.map(item => [item.symbol, item])),
    map
  };
}

export function resolveDeploymentBinding(manifest, symbol, expectedKind = null) {
  const key = clean(symbol);
  const binding = key ? manifest?.bySymbol?.[key] : null;
  if (!binding) throw new Error(`No deployment binding exists for logical resource '${symbol}'`);
  if (expectedKind && binding.kind !== expectedKind) {
    throw new Error(`Logical resource '${symbol}' is a ${binding.kind}, expected ${expectedKind}`);
  }
  return binding;
}

export function translateDeploymentSymbol(manifest, symbol, expectedKind = null) {
  const binding = resolveDeploymentBinding(manifest, symbol, expectedKind);
  return {
    logicalSymbol: binding.symbol,
    physicalName: binding.physicalName,
    managerId: binding.managerId,
    provider: binding.provider,
    kind: binding.kind
  };
}