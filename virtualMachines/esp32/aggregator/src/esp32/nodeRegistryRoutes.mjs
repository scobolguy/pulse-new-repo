/**
 * ESP32 Node Registry API Routes
 * 
 * Provides REST API endpoints for Power Apps integration:
 * - GET /api/nodes - List all nodes
 * - GET /api/nodes/:nodeId - Get specific node
 * - GET /api/nodes/:nodeId/services - Get node services
 * - POST /api/register - Register/update a node
 * - POST /api/nodes/:nodeId/services/:serviceId - Invoke service
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

  return router;
}

// Made with Bob
