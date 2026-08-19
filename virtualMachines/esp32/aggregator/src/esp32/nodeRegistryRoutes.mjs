/**
 * ESP32 Node Registry API Routes
 *
 * Provides REST API endpoints for Power Apps integration:
 * - GET /api/nodes - List all nodes
 * - GET /api/nodes/:nodeId - Get specific node
 * - GET /api/nodes/:nodeId/services - Get node services
 * - POST /api/register - Register/update a node
 * - POST /api/nodes/:nodeId/services/:serviceId - Invoke service
 *
 * Capability Manifest Registry:
 * - POST /registry/update - Push manifest from a node (push model)
 * - GET  /registry/nodes  - List all registry entries with manifest summaries
 * - GET  /registry/node/:nodeId/manifest - Full manifest for a node
 * - POST /registry/pull/:nodeId - Aggregator pulls manifest from node via GET /api/manifest
 *
 * Derived control proxy (from manifest control map):
 * - POST /nodes/:nodeId/control/:deviceType/:deviceId/:cmd
 * - GET  /nodes/:nodeId/control/:deviceType/:deviceId/:cmd
 */

import { Router } from 'express';
import axios from 'axios';

export function createNodeRegistryRoutes(nodeRegistry) {
  const router = Router();

  /**
   * GET /api/nodes
   * List all registered ESP32 nodes
   */
  router.get('/nodes', async (req, res) => {
    try {
      const { type, capability } = req.query;
      
      let nodes;
      if (type) {
        nodes = nodeRegistry.getNodesByType(type);
      } else if (capability) {
        nodes = nodeRegistry.getNodesByCapability(capability);
      } else {
        nodes = nodeRegistry.getAllNodes();
      }

      res.json({
        status: 'ok',
        count: nodes.length,
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type,
          name: node.name,
          ip: node.ip,
          port: node.port,
          lastSeen: node.lastSeen,
          registeredAt: node.registeredAt
        }))
      });
    } catch (err) {
      console.error('[NodeRegistry API] Error listing nodes:', err);
      res.status(500).json({
        status: 'error',
        error: err.message
      });
    }
  });

  /**
   * GET /api/nodes/:nodeId
   * Get detailed information about a specific node
   */
  router.get('/nodes/:nodeId', async (req, res) => {
    try {
      const { nodeId } = req.params;
      const node = nodeRegistry.getNode(nodeId);

      if (!node) {
        return res.status(404).json({
          status: 'error',
          error: 'Node not found'
        });
      }

      res.json({
        status: 'ok',
        node
      });
    } catch (err) {
      console.error('[NodeRegistry API] Error getting node:', err);
      res.status(500).json({
        status: 'error',
        error: err.message
      });
    }
  });

  /**
   * GET /api/nodes/:nodeId/services
   * Get available services/capabilities for a node
   */
  router.get('/nodes/:nodeId/services', async (req, res) => {
    try {
      const { nodeId } = req.params;
      const node = nodeRegistry.getNode(nodeId);

      if (!node) {
        return res.status(404).json({
          status: 'error',
          error: 'Node not found'
        });
      }

      // Transform capabilities into service list
      const services = Object.entries(node.capabilities || {}).map(([id, path]) => ({
        id,
        path,
        description: node.metadata?.serviceDescriptions?.[id] || `Service: ${id}`
      }));

      res.json({
        status: 'ok',
        nodeId: node.id,
        nodeName: node.name,
        services
      });
    } catch (err) {
      console.error('[NodeRegistry API] Error getting services:', err);
      res.status(500).json({
        status: 'error',
        error: err.message
      });
    }
  });

  /**
   * POST /api/register
   * Register or update an ESP32 node
   * 
   * Body:
   * {
   *   "id": "esp32-01",
   *   "type": "bt-light-node",
   *   "name": "Living Room Node",
   *   "ip": "192.168.1.100",
   *   "port": 80,
   *   "capabilities": {
   *     "bt.light.on": "/bluetooth/control",
   *     "bt.light.off": "/bluetooth/control"
   *   }
   * }
   */
  router.post('/register', async (req, res) => {
    try {
      const nodeData = req.body;

      if (!nodeData.id) {
        return res.status(400).json({
          status: 'error',
          error: 'Node ID is required'
        });
      }

      if (!nodeData.ip) {
        return res.status(400).json({
          status: 'error',
          error: 'Node IP address is required'
        });
      }

      const node = await nodeRegistry.registerNode(nodeData);

      res.json({
        status: 'ok',
        message: 'Node registered successfully',
        node: {
          id: node.id,
          name: node.name,
          type: node.type
        }
      });
    } catch (err) {
      console.error('[NodeRegistry API] Error registering node:', err);
      res.status(500).json({
        status: 'error',
        error: err.message
      });
    }
  });

  /**
   * POST /api/nodes/:nodeId/services/:serviceId
   * Invoke a service on an ESP32 node
   * 
   * Body:
   * {
   *   "args": {
   *     "action": "on",
   *     "brightness": 100
   *   }
   * }
   */
  router.post('/nodes/:nodeId/services/:serviceId', async (req, res) => {
    try {
      const { nodeId, serviceId } = req.params;
      const { args = {} } = req.body;

      const node = nodeRegistry.getNode(nodeId);

      if (!node) {
        return res.status(404).json({
          status: 'error',
          error: 'Node not found'
        });
      }

      const servicePath = node.capabilities[serviceId];

      if (!servicePath) {
        return res.status(404).json({
          status: 'error',
          error: `Service '${serviceId}' not found on node '${nodeId}'`
        });
      }

      // Construct URL to ESP32 node
      const url = `http://${node.ip}:${node.port}${servicePath}`;

      console.log(`[NodeRegistry API] Invoking service: ${serviceId} on ${nodeId} -> ${url}`);

      // Forward request to ESP32 node
      const response = await axios.post(url, args, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Update last seen
      await nodeRegistry.updateLastSeen(nodeId);

      // Return normalized response
      res.json({
        status: 'ok',
        nodeId,
        serviceId,
        result: response.data
      });

    } catch (err) {
      console.error('[NodeRegistry API] Error invoking service:', err);
      
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        return res.status(503).json({
          status: 'error',
          error: 'Node unreachable',
          details: err.message
        });
      }

      res.status(500).json({
        status: 'error',
        error: err.message
      });
    }
  });

  /**
   * DELETE /api/nodes/:nodeId
   * Remove a node from registry
   */
  router.delete('/nodes/:nodeId', async (req, res) => {
    try {
      const { nodeId } = req.params;
      const deleted = await nodeRegistry.removeNode(nodeId);

      if (!deleted) {
        return res.status(404).json({
          status: 'error',
          error: 'Node not found'
        });
      }

      res.json({
        status: 'ok',
        message: 'Node removed successfully'
      });
    } catch (err) {
      console.error('[NodeRegistry API] Error removing node:', err);
      res.status(500).json({
        status: 'error',
        error: err.message
      });
    }
  });

  /**
   * GET /api/nodes/stats
   * Get registry statistics
   */
  router.get('/nodes/stats', async (req, res) => {
    try {
      const stats = nodeRegistry.getStats();
      res.json({
        status: 'ok',
        stats
      });
    } catch (err) {
      console.error('[NodeRegistry API] Error getting stats:', err);
      res.status(500).json({
        status: 'error',
        error: err.message
      });
    }
  });

  // ─── Capability Manifest Registry ────────────────────────────────────────────

  /**
   * POST /registry/update
   * Node pushes its full capability manifest to the aggregator.
   * Body: the manifest JSON (must include nodeId).
   * The source IP is captured from req.socket so the manifest doesn't need an "ip" field.
   */
  router.post('/registry/update', async (req, res) => {
    try {
      const manifest = req.body;
      if (!manifest || !manifest.nodeId) {
        return res.status(400).json({ status: 'error', error: 'manifest.nodeId is required' });
      }

      // Capture source IP if not already in manifest
      if (!manifest.ip) {
        const srcIp = req.socket?.remoteAddress || req.ip || null;
        if (srcIp) {
          // Strip IPv6 prefix from IPv4-mapped addresses
          manifest.ip = srcIp.replace(/^::ffff:/, '');
        }
      }

      const stored = await nodeRegistry.storeManifest(manifest);
      console.log(`[NodeRegistry] Manifest received from ${manifest.nodeId} (${manifest.ip || 'unknown IP'})`);

      res.json({
        status: 'ok',
        message: 'Manifest stored',
        nodeId: manifest.nodeId,
        receivedAt: stored._receivedAt
      });
    } catch (err) {
      console.error('[NodeRegistry] Error storing manifest:', err);
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  /**
   * GET /registry/nodes
   * List all nodes with a brief manifest summary for discovery.
   */
  router.get('/registry/nodes', (req, res) => {
    try {
      const nodes = nodeRegistry.getAllNodes();
      const result = nodes.map(node => {
        const manifest = nodeRegistry.getManifest(node.id);
        return {
          nodeId: node.id,
          name: node.name,
          role: node.type,
          ip: node.ip,
          port: node.port,
          lastSeen: node.lastSeen,
          registeredAt: node.registeredAt,
          hasManifest: !!manifest,
          manifestVersion: manifest?.version || null,
          deviceCount: manifest?.devices?.length ?? null,
          serviceCount: manifest?.services?.length ?? null,
          receivedAt: manifest?._receivedAt || null
        };
      });

      res.json({ status: 'ok', count: result.length, nodes: result });
    } catch (err) {
      console.error('[NodeRegistry] Error listing registry nodes:', err);
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  /**
   * GET /registry/node/:nodeId/manifest
   * Return the full capability manifest for a specific node.
   */
  router.get('/registry/node/:nodeId/manifest', (req, res) => {
    const { nodeId } = req.params;
    const manifest = nodeRegistry.getManifest(nodeId);
    if (!manifest) {
      return res.status(404).json({ status: 'error', error: `No manifest for node '${nodeId}'` });
    }
    res.json({ status: 'ok', nodeId, manifest });
  });

  /**
   * POST /registry/pull/:nodeId
   * Aggregator fetches (pulls) the manifest from the node via GET http://<node-ip>/api/manifest
   * and stores it in the registry.
   */
  router.post('/registry/pull/:nodeId', async (req, res) => {
    try {
      const { nodeId } = req.params;
      const node = nodeRegistry.getNode(nodeId);
      if (!node) {
        return res.status(404).json({ status: 'error', error: `Node '${nodeId}' not found in registry` });
      }
      if (!node.ip) {
        return res.status(400).json({ status: 'error', error: `Node '${nodeId}' has no IP address` });
      }

      const url = `http://${node.ip}:${node.port || 80}/api/manifest`;
      console.log(`[NodeRegistry] Pulling manifest from ${nodeId} at ${url}`);

      const response = await axios.get(url, { timeout: 10000 });
      const manifest = response.data;

      if (!manifest || typeof manifest !== 'object') {
        return res.status(502).json({ status: 'error', error: 'Node returned invalid manifest' });
      }

      // Ensure nodeId is set; use node.id as fallback
      if (!manifest.nodeId) {
        manifest.nodeId = nodeId;
      }
      manifest.ip = node.ip;
      manifest.port = node.port || 80;

      const stored = await nodeRegistry.storeManifest(manifest);
      console.log(`[NodeRegistry] Pulled manifest from ${nodeId}`);

      res.json({ status: 'ok', nodeId, receivedAt: stored._receivedAt, manifest: stored });
    } catch (err) {
      console.error('[NodeRegistry] Error pulling manifest:', err);
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        return res.status(503).json({ status: 'error', error: 'Node unreachable', details: err.message });
      }
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // ─── Manifest-derived Control Proxy ──────────────────────────────────────────

  /**
   * POST|GET /nodes/:nodeId/control/:deviceType/:deviceId/:cmd
   *
   * Proxies a command to the appropriate node endpoint as described in the
   * node's manifest control map.
   *
   * Example:
   *   POST /nodes/esp32-kitchen-01/control/switch/relay1/on
   *   GET  /nodes/esp32-kitchen-01/control/sensor/tempSensor1/read
   */
  async function handleControlProxy(req, res) {
    try {
      const { nodeId, deviceType, deviceId, cmd } = req.params;
      const node = nodeRegistry.getNode(nodeId);
      if (!node) {
        return res.status(404).json({ status: 'error', error: `Node '${nodeId}' not found` });
      }
      if (!node.ip) {
        return res.status(400).json({ status: 'error', error: `Node '${nodeId}' has no IP` });
      }

      const manifest = nodeRegistry.getManifest(nodeId);
      if (!manifest) {
        return res.status(404).json({ status: 'error', error: `No manifest for node '${nodeId}'` });
      }

      // Resolve the path from the control map: manifest.control[deviceType][deviceId]
      const controlEntry = manifest.control?.[deviceType]?.[deviceId];
      if (!controlEntry) {
        return res.status(404).json({
          status: 'error',
          error: `No control entry for ${deviceType}/${deviceId} on node '${nodeId}'`
        });
      }

      // The control map api may be a template like "/power/<cmd>" or a direct path
      let apiPath = controlEntry.api || controlEntry.read || controlEntry;
      if (typeof apiPath !== 'string') {
        return res.status(400).json({ status: 'error', error: 'Control entry has no resolvable api path' });
      }
      apiPath = apiPath.replace('<cmd>', cmd).replace(':cmd', cmd);

      const method = req.method.toUpperCase();
      const url = `http://${node.ip}:${node.port || 80}${apiPath}`;
      console.log(`[NodeRegistry] Control proxy: ${method} ${nodeId}/${deviceType}/${deviceId}/${cmd} -> ${url}`);

      const axiosOpts = { timeout: 10000, headers: { 'Content-Type': 'application/json' } };
      const proxyResponse = method === 'GET'
        ? await axios.get(url, axiosOpts)
        : await axios.post(url, req.body || {}, axiosOpts);

      await nodeRegistry.updateLastSeen(nodeId);

      res.json({ status: 'ok', nodeId, deviceType, deviceId, cmd, result: proxyResponse.data });
    } catch (err) {
      console.error('[NodeRegistry] Control proxy error:', err);
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        return res.status(503).json({ status: 'error', error: 'Node unreachable', details: err.message });
      }
      res.status(500).json({ status: 'error', error: err.message });
    }
  }

  router.post('/nodes/:nodeId/control/:deviceType/:deviceId/:cmd', handleControlProxy);
  router.get('/nodes/:nodeId/control/:deviceType/:deviceId/:cmd', handleControlProxy);

  return router;
}

// Made with Bob
