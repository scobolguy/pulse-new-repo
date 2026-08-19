/**
 * ESP32 Node Registry
 * 
 * Maintains registry of ESP32 nodes and their capabilities.
 * Provides CRUD operations and query capabilities.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class NodeRegistry {
  constructor(options = {}) {
    this.nodes = new Map();
    this.manifests = new Map(); // nodeId -> full capability manifest
    this.persistPath = options.persistPath || path.join(__dirname, '../../data/esp32-nodes.json');
    this.autoSave = options.autoSave !== false;
    this.nodeTimeout = options.nodeTimeout || 600000; // 10 minutes default
  }

  /**
   * Initialize registry - load from disk if exists
   */
  async initialize() {
    try {
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        for (const node of parsed.nodes) {
          this.nodes.set(node.id, {
            ...node,
            lastSeen: Date.now() // Reset last seen on startup
          });
        }
        console.log(`[NodeRegistry] Loaded ${this.nodes.size} nodes from disk`);
      }

      if (parsed.manifests && typeof parsed.manifests === 'object') {
        for (const [nodeId, manifest] of Object.entries(parsed.manifests)) {
          this.manifests.set(nodeId, manifest);
        }
        console.log(`[NodeRegistry] Loaded ${this.manifests.size} manifests from disk`);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[NodeRegistry] Error loading registry:', err);
      }
      console.log('[NodeRegistry] Starting with empty registry');
    }
  }

  /**
   * Register or update a node
   */
  async registerNode(nodeData) {
    const {
      id,
      type,
      name,
      ip,
      port = 80,
      capabilities = {},
      metadata = {}
    } = nodeData;

    if (!id) {
      throw new Error('Node ID is required');
    }

    const node = {
      id,
      type: type || 'esp32-generic',
      name: name || id,
      ip,
      port,
      capabilities,
      metadata,
      registeredAt: this.nodes.has(id) ? this.nodes.get(id).registeredAt : Date.now(),
      lastSeen: Date.now()
    };

    this.nodes.set(id, node);
    console.log(`[NodeRegistry] Registered node: ${id} (${name}) at ${ip}:${port}`);

    if (this.autoSave) {
      await this.persist();
    }

    return node;
  }

  /**
   * Store a full capability manifest for a node.
   * Also upserts the node's basic registration from manifest identity fields.
   */
  async storeManifest(manifest) {
    if (!manifest || !manifest.nodeId) {
      throw new Error('Manifest must include nodeId');
    }

    const nodeId = manifest.nodeId;
    this.manifests.set(nodeId, {
      ...manifest,
      _receivedAt: new Date().toISOString()
    });

    // Upsert node entry from manifest identity — preserves existing IP if not provided
    const existing = this.nodes.get(nodeId);
    const ip = manifest.ip || existing?.ip || null;
    const port = manifest.port || existing?.port || 80;

    await this.registerNode({
      id: nodeId,
      type: manifest.role || existing?.type || 'esp32-generic',
      name: manifest.name || manifest.nodeId,
      ip,
      port,
      capabilities: this._manifestToCapabilities(manifest),
      metadata: {
        version: manifest.version,
        model: manifest.model,
        manufacturer: manifest.manufacturer,
        hasManifest: true
      }
    });

    return this.manifests.get(nodeId);
  }

  /**
   * Get the full capability manifest for a node.
   */
  getManifest(nodeId) {
    return this.manifests.get(nodeId) || null;
  }

  /**
   * Get manifests for all nodes.
   */
  getAllManifests() {
    return Array.from(this.manifests.entries()).map(([nodeId, manifest]) => ({ nodeId, manifest }));
  }

  /**
   * Derive a flat capabilities map from a rich manifest for backward-compat storage.
   * @private
   */
  _manifestToCapabilities(manifest) {
    const caps = {};
    for (const svc of manifest.services || []) {
      for (const ep of svc.endpoints || []) {
        const key = `${svc.id}.${ep.method?.toLowerCase() || 'get'}`;
        caps[key] = ep.path;
      }
    }
    return caps;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Query nodes by type
   */
  getNodesByType(type) {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  /**
   * Query nodes by capability
   */
  getNodesByCapability(capabilityId) {
    return Array.from(this.nodes.values()).filter(node => 
      node.capabilities && node.capabilities[capabilityId]
    );
  }

  /**
   * Update node's last seen timestamp
   */
  async updateLastSeen(nodeId) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.lastSeen = Date.now();
      if (this.autoSave) {
        await this.persist();
      }
      return true;
    }
    return false;
  }

  /**
   * Remove a node
   */
  async removeNode(nodeId) {
    const deleted = this.nodes.delete(nodeId);
    if (deleted) {
      console.log(`[NodeRegistry] Removed node: ${nodeId}`);
      if (this.autoSave) {
        await this.persist();
      }
    }
    return deleted;
  }

  /**
   * Clean up stale nodes (not seen for nodeTimeout ms)
   */
  async cleanupStaleNodes() {
    const now = Date.now();
    const staleNodes = [];

    for (const [id, node] of this.nodes.entries()) {
      if (now - node.lastSeen > this.nodeTimeout) {
        staleNodes.push(id);
      }
    }

    for (const id of staleNodes) {
      await this.removeNode(id);
    }

    if (staleNodes.length > 0) {
      console.log(`[NodeRegistry] Cleaned up ${staleNodes.length} stale nodes`);
    }

    return staleNodes;
  }

  /**
   * Get node statistics
   */
  getStats() {
    const nodes = Array.from(this.nodes.values());
    const typeCount = {};
    
    for (const node of nodes) {
      typeCount[node.type] = (typeCount[node.type] || 0) + 1;
    }

    return {
      totalNodes: nodes.length,
      nodesByType: typeCount,
      oldestNode: nodes.reduce((oldest, node) => 
        !oldest || node.registeredAt < oldest.registeredAt ? node : oldest, null
      ),
      newestNode: nodes.reduce((newest, node) => 
        !newest || node.registeredAt > newest.registeredAt ? node : newest, null
      )
    };
  }

  /**
   * Persist registry to disk
   */
  async persist() {
    try {
      const manifestsObj = {};
      for (const [nodeId, manifest] of this.manifests.entries()) {
        manifestsObj[nodeId] = manifest;
      }

      const data = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        nodes: Array.from(this.nodes.values()),
        manifests: manifestsObj
      };

      // Ensure directory exists
      await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
      await fs.writeFile(this.persistPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[NodeRegistry] Error persisting registry:', err);
    }
  }

  /**
   * Clear all nodes
   */
  async clear() {
    this.nodes.clear();
    if (this.autoSave) {
      await this.persist();
    }
  }
}

// Singleton instance
let registryInstance = null;

export function createNodeRegistry(options) {
  if (!registryInstance) {
    registryInstance = new NodeRegistry(options);
  }
  return registryInstance;
}

export function getNodeRegistry() {
  if (!registryInstance) {
    throw new Error('Node registry not initialized. Call createNodeRegistry() first.');
  }
  return registryInstance;
}

// Made with Bob
