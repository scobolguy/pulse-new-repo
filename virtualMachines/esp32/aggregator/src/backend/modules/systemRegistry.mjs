function normalizeId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error('systemId is required');
  return normalized;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createSystemRegistry({ queueManagerInstances = new Map(), queueManagerRegistry = new Map() } = {}) {
  const systems = new Map();

  function getQueueManager(managerId) {
    return queueManagerInstances.get(managerId) || queueManagerRegistry.get(managerId) || null;
  }

  function getOrCreate(systemId, details = {}) {
    const id = normalizeId(systemId);
    const current = systems.get(id) || {
      systemId: id,
      name: id,
      typeName: null,
      parentSystemId: null,
      status: 'running',
      queues: [],
      services: [],
      updatedAt: null
    };
    const next = {
      ...current,
      ...details,
      systemId: id,
      queues: Array.isArray(details.queues) ? details.queues : current.queues,
      services: Array.isArray(details.services) ? details.services : current.services,
      updatedAt: Date.now()
    };
    systems.set(id, next);
    return next;
  }

  function registerWorkflowSymbols(managerId, symbols = {}) {
    const concreteSystems = (Array.isArray(symbols.systems) ? symbols.systems : [])
      .filter(system => system && system.abstract !== true);
    const queues = Array.isArray(symbols.queues) ? symbols.queues : [];
    const services = Array.isArray(symbols.services) ? symbols.services : [];
    const registered = [];

    for (const system of concreteSystems) {
      const systemId = normalizeId(system.systemId || system.name);
      const ownedQueues = queues
        .filter(queue => {
          const owner = String(queue?.systemId || '').trim();
          return owner === systemId || owner.startsWith(`${systemId}.`);
        })
        .map(queue => ({
          managerId: queue.managerId || managerId,
          queueName: String(queue.queueName || '').trim(),
          visibility: queue.visibility || 'internal'
        }))
        .filter(queue => queue.queueName);
      const ownedServices = services
        .filter(service => {
          const owner = String(service?.systemId || '').trim();
          return owner === systemId || owner.startsWith(`${systemId}.`);
        })
        .map(service => ({
          serviceId: service.serviceId || service.name || null,
          visibility: service.visibility || 'internal'
        }))
        .filter(service => service.serviceId);

      registered.push(getOrCreate(systemId, {
        name: system.name || systemId,
        typeName: system.typeName || null,
        parentSystemId: system.parentSystemId || null,
        queues: ownedQueues,
        services: ownedServices,
        status: systems.get(systemId)?.status || 'running'
      }));
    }

    return registered.map(clone);
  }

  function getStatus(systemId) {
    const system = systems.get(normalizeId(systemId));
    return system ? clone(system) : null;
  }

  function listStatuses() {
    return Array.from(systems.values(), clone);
  }

  function transition(systemId, action) {
    const id = normalizeId(systemId);
    const system = systems.get(id);
    if (!system) throw new Error(`System ${id} not found`);
    if (!['start', 'stop', 'quiesce'].includes(action)) {
      throw new Error(`Unsupported system lifecycle action: ${action}`);
    }

    const frozen = action !== 'start';
    const queueResults = [];
    for (const queue of system.queues) {
      const manager = getQueueManager(queue.managerId);
      if (!manager) {
        queueResults.push({ ...queue, status: 'manager-unavailable' });
        continue;
      }
      if (typeof manager.freezeQueue !== 'function' || typeof manager.thawQueue !== 'function') {
        queueResults.push({ ...queue, status: 'manager-unsupported' });
        continue;
      }
      if (frozen) manager.freezeQueue(queue.queueName);
      else manager.thawQueue(queue.queueName);
      queueResults.push({
        ...queue,
        status: 'applied',
        frozen: manager.getStatus(queue.queueName).frozen === true
      });
    }

    system.status = action === 'start' ? 'running' : action === 'stop' ? 'stopped' : 'quiesced';
    system.updatedAt = Date.now();
    return {
      ...clone(system),
      action,
      queueResults
    };
  }

  return {
    registerWorkflowSymbols,
    getStatus,
    listStatuses,
    transition
  };
}
