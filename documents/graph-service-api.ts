/**
 * Graph Service API
 * 
 * Express-based REST API for the generic graph/workflow service
 * Provides endpoints for:
 * - Graph CRUD operations
 * - Node/Edge management
 * - Export to Mermaid, DSL, pcode
 * - Validation and analysis
 */

import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { GraphService, NodeTypeRegistry, createDefaultWorkflowRegistry } from './GraphService';
import { generateDSL } from './DSLGenerator';
import { generatePcode } from './PcodeGenerator';

const app = express();
app.use(express.json());
app.use((req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.static('public'));

// Store for active graph services (in-memory; use DB in production)
const graphs: Map<string, GraphService> = new Map();
const nodeRegistry = createDefaultWorkflowRegistry();
const templates: Map<string, any> = new Map();

// ============================================================================
// Template Registry Endpoints
// ============================================================================

/**
 * GET /api/templates
 * List shared templates
 */
app.get('/api/templates', (req: Request, res: Response) => {
  res.json(Array.from(templates.values()));
});

/**
 * POST /api/templates
 * Create or update a shared template
 */
app.post('/api/templates', (req: Request, res: Response) => {
  const { id, name, version, source, icon, description, graph } = req.body;
  if (!name || !graph || !graph.nodes || !graph.edges) {
    return res.status(400).json({ error: 'name and graph required' });
  }

  const templateId = id || `template_${uuidv4()}`;
  const template = {
    id: templateId,
    name,
    version: version || '1.0.0',
    source: source || 'shared',
    icon: icon || 'T',
    description: description || '',
    graph,
    updatedAt: new Date().toISOString(),
  };

  templates.set(templateId, template);
  res.status(201).json(template);
});

/**
 * GET /api/templates/:id
 * Get a shared template by id
 */
app.get('/api/templates/:id', (req: Request, res: Response) => {
  const template = templates.get(req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(template);
});

/**
 * DELETE /api/templates/:id
 * Delete a shared template
 */
app.delete('/api/templates/:id', (req: Request, res: Response) => {
  if (templates.delete(req.params.id)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

// ============================================================================
// Graph API Endpoints
// ============================================================================

/**
 * GET /api/graphs
 * List all graphs
 */
app.get('/api/graphs', (req: Request, res: Response) => {
  const graphList = Array.from(graphs.values()).map((g) => ({
    id: g.getGraph().id,
    name: g.getGraph().name,
    type: g.getGraph().type,
    nodeCount: g.getAllNodes().length,
    edgeCount: g.getAllEdges().length,
  }));
  res.json(graphList);
});

/**
 * POST /api/graphs
 * Create a new graph
 */
app.post('/api/graphs', (req: Request, res: Response) => {
  const { name, type } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type required' });
  }

  const id = 'graph_' + uuidv4();
  const service = new GraphService(id, name, type as any, nodeRegistry);
  graphs.set(id, service);

  res.status(201).json({ id, name, type });
});

/**
 * GET /api/graphs/:id
 * Get a graph by ID
 */
app.get('/api/graphs/:id', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  const graph = service.getGraph();
  res.json({
    id: graph.id,
    name: graph.name,
    type: graph.type,
    description: graph.description,
    nodes: service.getAllNodes(),
    edges: service.getAllEdges(),
  });
});

/**
 * DELETE /api/graphs/:id
 * Delete a graph
 */
app.delete('/api/graphs/:id', (req: Request, res: Response) => {
  if (graphs.delete(req.params.id)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Graph not found' });
  }
});

// ============================================================================
// Node API Endpoints
// ============================================================================

/**
 * POST /api/graphs/:id/nodes
 * Create a node in a graph
 */
app.post('/api/graphs/:id/nodes', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  const { type, label, properties } = req.body;
  if (!type || !label) {
    return res.status(400).json({ error: 'type and label required' });
  }

  const nodeId = 'node_' + uuidv4();
  const node = service.createNode(nodeId, type, label, properties);

  res.status(201).json({
    id: node.id,
    type: node.type,
    label: node.label,
    properties: Object.fromEntries(node.properties),
  });
});

/**
 * GET /api/graphs/:id/nodes
 * List nodes in a graph
 */
app.get('/api/graphs/:id/nodes', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  const nodes = service.getAllNodes().map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    description: n.description,
    properties: Object.fromEntries(n.properties),
  }));

  res.json(nodes);
});

/**
 * PUT /api/graphs/:id/nodes/:nodeId
 * Update a node
 */
app.put('/api/graphs/:id/nodes/:nodeId', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  const node = service.getNode(req.params.nodeId);
  if (!node) {
    return res.status(404).json({ error: 'Node not found' });
  }

  const { label, properties } = req.body;
  if (label) node.label = label;
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      service.updateNodeProperty(node.id, key, value);
    }
  }

  res.json({ success: true });
});

/**
 * DELETE /api/graphs/:id/nodes/:nodeId
 * Delete a node
 */
app.delete('/api/graphs/:id/nodes/:nodeId', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  service.removeNode(req.params.nodeId);
  res.json({ success: true });
});

// ============================================================================
// Edge API Endpoints
// ============================================================================

/**
 * POST /api/graphs/:id/edges
 * Create an edge
 */
app.post('/api/graphs/:id/edges', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  const { sourceId, targetId, label, condition } = req.body;
  if (!sourceId || !targetId) {
    return res.status(400).json({ error: 'sourceId and targetId required' });
  }

  try {
    const edge = service.createEdge(sourceId, targetId, label, condition);
    res.status(201).json({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      label: edge.label,
      condition: edge.condition,
    });
  } catch (err) {
    res.status(400).json({ error: (err as any).message });
  }
});

/**
 * GET /api/graphs/:id/edges
 * List edges in a graph
 */
app.get('/api/graphs/:id/edges', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  const edges = service.getAllEdges().map((e) => ({
    id: e.id,
    sourceId: e.sourceId,
    targetId: e.targetId,
    label: e.label,
    condition: e.condition,
  }));

  res.json(edges);
});

/**
 * DELETE /api/graphs/:id/edges/:edgeId
 * Delete an edge
 */
app.delete('/api/graphs/:id/edges/:edgeId', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  service.removeEdge(req.params.edgeId);
  res.json({ success: true });
});

// ============================================================================
// Export/Code Generation Endpoints
// ============================================================================

/**
 * GET /api/graphs/:id/export/mermaid
 * Export graph as Mermaid diagram
 */
app.get('/api/graphs/:id/export/mermaid', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  const mermaid = service.toMermaid();
  res.set('Content-Type', 'text/plain');
  res.send(mermaid);
});

/**
 * GET /api/graphs/:id/export/dsl
 * Export graph as Pulse0 DSL
 */
app.get('/api/graphs/:id/export/dsl', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  try {
    const dsl = generateDSL(service);
    res.set('Content-Type', 'text/plain');
    res.send(dsl);
  } catch (err) {
    res.status(400).json({ error: (err as any).message });
  }
});

/**
 * GET /api/graphs/:id/export/pcode
 * Export graph as pcode bytecode
 */
app.get('/api/graphs/:id/export/pcode', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  try {
    const pcode = generatePcode(service);
    res.set('Content-Type', 'text/plain');
    res.send(pcode);
  } catch (err) {
    res.status(400).json({ error: (err as any).message });
  }
});

/**
 * POST /api/graphs/:id/export/json
 * Export graph as JSON
 */
app.post('/api/graphs/:id/export/json', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  res.json(JSON.parse(service.toJSON()));
});

// ============================================================================
// Validation & Analysis Endpoints
// ============================================================================

/**
 * POST /api/graphs/:id/validate
 * Validate a graph
 */
app.post('/api/graphs/:id/validate', (req: Request, res: Response) => {
  const service = graphs.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Graph not found' });
  }

  const result = service.validate();
  res.json(result);
});

/**
 * GET /api/node-types
 * Get available node types
 */
app.get('/api/node-types', (req: Request, res: Response) => {
  const types = nodeRegistry.list().map((def) => ({
    type: def.type,
    label: def.label,
    description: def.description,
    category: def.category,
    properties: def.defaultProperties,
    actions: def.defaultActions,
  }));

  res.json(types);
});

/**
 * GET /api/node-types/:category
 * Get node types by category
 */
app.get('/api/node-types/:category', (req: Request, res: Response) => {
  const types = nodeRegistry.listByCategory(req.params.category).map((def) => ({
    type: def.type,
    label: def.label,
    description: def.description,
    category: def.category,
  }));

  res.json(types);
});

// ============================================================================
// Health & Info Endpoints
// ============================================================================

/**
 * GET /api/health
 * Health check
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    graphs: graphs.size,
  });
});

/**
 * GET /api/info
 * Service information
 */
app.get('/api/info', (req: Request, res: Response) => {
  res.json({
    name: 'Graph Service API',
    version: '1.0.0',
    capabilities: ['workflow', 'task-chart', 'message-flow', 'state-machine'],
    exports: ['mermaid', 'dsl', 'pcode', 'json'],
    registries: ['templates'],
  });
});

// ============================================================================
// Error Handler
// ============================================================================

app.use((err: any, req: Request, res: Response) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Graph Service API listening on port ${PORT}`);
  console.log(`Documentation: http://localhost:${PORT}/api/info`);
});

export default app;
