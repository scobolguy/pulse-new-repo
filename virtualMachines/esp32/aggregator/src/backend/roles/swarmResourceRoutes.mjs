import { SwarmResourceRegistry } from '../swarmResourceRegistry.mjs';

export function registerSwarmResourceRoutes(app, { resources, machineAuth, logger = console }) {
  if (!(resources instanceof SwarmResourceRegistry) || typeof machineAuth?.guard !== 'function')
    throw new Error('Resource routes require a registry and machine authentication');
  app.post('/api/swarm/resources/report', machineAuth.guard('resources'), (req, res) => {
    const allowed = new Set([
      'nodeId', 'serviceId', 'ownerAggregatorId', 'sequence', 'status', 'estimatedFreeSlots', 'freeMemoryBytes',
    ]);
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
          Object.keys(req.body).some(key => !allowed.has(key)))
        throw new Error('Resource report contains unsupported fields');
      // Only the guard supplies identity. Capability/bundle enrollment is never
      // inferred from a report or accepted as worker-supplied metadata.
      resources.report(req.runtimeMachineNodeId, req.body);
      return res.json({ status: 'ok', nodeId: req.runtimeMachineNodeId });
    } catch (error) {
      logger.error('[SWARM-RESOURCES] Report rejected:', error.message);
      return res.status(409).json({ error: error.message });
    }
  });
}
