import { resolveDeploymentBinding } from './deploymentBindingManifest.mjs';

function parseDatabaseDelivery(delivery) {
  const queueName = String(delivery?.queueName || '');
  if (!queueName.startsWith('db.') || !queueName.endsWith('.dml')) return null;
  const payload = typeof delivery.message === 'string' ? JSON.parse(delivery.message) : delivery.message;
  if (!payload || !['insert', 'update', 'delete'].includes(payload.operation)) throw new Error(`Unsupported database delivery operation: ${payload?.operation || 'unknown'}`);
  return { operation: payload.operation, database: payload.database, table: payload.table, row: payload.row || {}, where: payload.where || null };
}

export async function applySolutionDeliveries({ deliveries = [], bindingManifest, databaseManagers = new Map(), queueManagers = new Map(), databaseSchemas = {} } = {}) {
  if (!bindingManifest) throw new Error('bindingManifest is required');
  const applied = [];
  const asynchronousWrites = [];
  for (const delivery of deliveries) {
    const databaseDelivery = parseDatabaseDelivery(delivery);
    if (databaseDelivery) {
      const binding = resolveDeploymentBinding(bindingManifest, databaseDelivery.database, 'database');
      const manager = databaseManagers.get(binding.managerId);
      if (!manager || typeof manager[databaseDelivery.operation] !== 'function') throw new Error(`Database manager not found or cannot ${databaseDelivery.operation}: ${binding.managerId}`);
      const schema = databaseSchemas[databaseDelivery.database] || { table: binding.physicalName, columns: Object.fromEntries(Object.keys(databaseDelivery.row).map(name => [name, 'nvarchar(max)'])) };
      if (databaseDelivery.operation === 'insert') await manager.insert(schema, databaseDelivery.row);
      else if (databaseDelivery.operation === 'update') await manager.update(schema, databaseDelivery.row, databaseDelivery.where);
      else await manager.delete(schema, databaseDelivery.where);
      applied.push({ kind: 'database', operation: databaseDelivery.operation, logicalSymbol: databaseDelivery.database, physicalName: binding.physicalName, managerId: binding.managerId });
      continue;
    }

    const binding = resolveDeploymentBinding(bindingManifest, delivery.queueName, 'queue');
    const manager = queueManagers.get(binding.managerId);
    if (!manager || typeof manager.enqueue !== 'function') throw new Error(`Queue manager not found or cannot enqueue: ${binding.managerId}`);
    const deliveryMode = delivery.deliveryMode || binding.deliveryMode || 'async';
    const write = Promise.resolve(manager.enqueue(binding.physicalName, delivery.message, 'solution-runtime'));
    if (deliveryMode === 'sync') await write;
    else asynchronousWrites.push(write);
    applied.push({ kind: 'queue', deliveryMode, logicalSymbol: delivery.queueName, physicalName: binding.physicalName, managerId: binding.managerId });
  }
  await Promise.all(asynchronousWrites);
  return applied;
}