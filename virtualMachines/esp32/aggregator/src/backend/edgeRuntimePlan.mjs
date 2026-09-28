const ESP32_TRANSPORTS = new Set(['queue-api', 'service-api', 'database-api', 'ffs']);

function requireBinding(manifest, symbol, kind) {
  const binding = manifest?.bySymbol?.[symbol];
  if (!binding) throw new Error(`Missing ${kind} binding for '${symbol}'`);
  if (binding.kind !== kind) throw new Error(`Binding '${symbol}' is ${binding.kind}, expected ${kind}`);
  return binding;
}

export function buildMt103Pacs008RuntimePlan({ manifest, target = 'js-pmachine', inputQueue = 'incoming_mt103', database = 'message_store', conversionService = 'MT103_to_PACS008', outputQueue = 'outgoing_message' } = {}) {
  const input = requireBinding(manifest, inputQueue, 'queue');
  const store = requireBinding(manifest, database, 'database');
  const service = requireBinding(manifest, conversionService, 'service');
  const output = requireBinding(manifest, outputQueue, 'queue');
  const normalizedTarget = String(target || 'js-pmachine').trim().toLowerCase();
  const operations = [
    { op: 'queue.claim', symbol: inputQueue, managerId: input.managerId, transport: 'queue-api' },
    { op: 'database.insert', symbol: database, managerId: store.managerId, transport: 'database-api', table: 'incoming_messages' },
    { op: 'service.call', symbol: conversionService, managerId: service.managerId, transport: 'service-api' },
    { op: 'database.insert', symbol: database, managerId: store.managerId, transport: 'database-api', table: 'outgoing_messages' },
    { op: 'queue.publish', symbol: outputQueue, managerId: output.managerId, transport: 'queue-api' }
  ];

  if (normalizedTarget.startsWith('esp32')) {
    const unsupported = operations.filter(operation => !ESP32_TRANSPORTS.has(operation.transport));
    if (unsupported.length) throw new Error(`ESP32 runtime plan contains unsupported transports: ${unsupported.map(item => item.transport).join(', ')}`);
  }

  return {
    version: 1,
    target: normalizedTarget,
    boundedPayload: true,
    idempotency: 'correlation-id',
    operations
  };
}
