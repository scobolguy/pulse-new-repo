/**
 * Generic Graph Service API
 * 
 * A composable, service-based graph engine for building visual workflows,
 * task charts, message orchestration, and other flow-based systems.
 * 
 * Supports:
 * - Node and edge definitions with properties
 * - Service actions for graph manipulation
 * - Mermaid diagram export
 * - DSL and pcode generation
 */

// ============================================================================
// Core Types
// ============================================================================

export interface NodeProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
  value: any;
  label?: string;
  description?: string;
  required?: boolean;
  options?: string[]; // For enum type
}

export interface NodeAction {
  name: string;
  description?: string;
  parameters?: NodeProperty[];
  execute?: (node: GraphNode, params?: Record<string, any>) => void;
}

export interface GraphNode {
  id: string;
  type: string; // e.g., 'workflow-action', 'decision', 'task', 'queue-router'
  label: string;
  description?: string;
  properties: Map<string, NodeProperty>;
  actions: Map<string, NodeAction>;
  x?: number;
  y?: number;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  condition?: string; // For conditional edges (e.g., from decision node)
  properties: Map<string, NodeProperty>;
  metadata?: Record<string, any>;
}

export interface Graph {
  id: string;
  name: string;
  type: 'workflow' | 'task-chart' | 'message-flow' | 'state-machine' | 'custom';
  description?: string;
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  metadata?: Record<string, any>;
}

// ============================================================================
// Node Type Registry
// ============================================================================

export interface NodeTypeDefinition {
  type: string;
  label: string;
  description: string;
  defaultProperties: NodeProperty[];
  defaultActions: NodeAction[];
  category: 'action' | 'decision' | 'terminal' | 'integration';
  icon?: string;
}

export class NodeTypeRegistry {
  private registry: Map<string, NodeTypeDefinition> = new Map();

  register(def: NodeTypeDefinition): void {
    this.registry.set(def.type, def);
  }

  get(type: string): NodeTypeDefinition | undefined {
    return this.registry.get(type);
  }

  list(): NodeTypeDefinition[] {
    return Array.from(this.registry.values());
  }

  listByCategory(category: string): NodeTypeDefinition[] {
    return Array.from(this.registry.values()).filter((def) => def.category === category);
  }
}

// ============================================================================
// Graph Service
// ============================================================================

export class GraphService {
  private graph: Graph;
  private nodeRegistry: NodeTypeRegistry;

  constructor(id: string, name: string, type: Graph['type'], registry?: NodeTypeRegistry) {
    this.graph = {
      id,
      name,
      type,
      nodes: new Map(),
      edges: new Map(),
    };
    this.nodeRegistry = registry || new NodeTypeRegistry();
  }

  // --------- Graph Access ---------

  getGraph(): Graph {
    return this.graph;
  }

  setGraphMetadata(key: string, value: any): void {
    if (!this.graph.metadata) this.graph.metadata = {};
    this.graph.metadata[key] = value;
  }

  // --------- Node Operations ---------

  addNode(node: GraphNode): GraphNode {
    this.graph.nodes.set(node.id, node);
    return node;
  }

  createNode(
    id: string,
    type: string,
    label: string,
    properties?: Record<string, any>
  ): GraphNode {
    const def = this.nodeRegistry.get(type);
    const node: GraphNode = {
      id,
      type,
      label,
      properties: new Map(),
      actions: new Map(),
    };

    // Initialize default properties from type definition
    if (def) {
      for (const prop of def.defaultProperties) {
        node.properties.set(prop.name, { ...prop });
      }
      for (const action of def.defaultActions) {
        node.actions.set(action.name, { ...action });
      }
    }

    // Override with provided properties
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        const prop = node.properties.get(key);
        if (prop) {
          prop.value = value;
        } else {
          node.properties.set(key, {
            name: key,
            type: typeof value as any,
            value,
          });
        }
      }
    }

    return this.addNode(node);
  }

  getNode(id: string): GraphNode | undefined {
    return this.graph.nodes.get(id);
  }

  updateNodeProperty(nodeId: string, propertyName: string, value: any): void {
    const node = this.getNode(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    const prop = node.properties.get(propertyName);
    if (!prop) throw new Error(`Property ${propertyName} not found on node ${nodeId}`);
    prop.value = value;
  }

  removeNode(id: string): void {
    this.graph.nodes.delete(id);
    // Also remove edges connected to this node
    const edgesToRemove = Array.from(this.graph.edges.values()).filter(
      (e) => e.sourceId === id || e.targetId === id
    );
    edgesToRemove.forEach((e) => this.graph.edges.delete(e.id));
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.graph.nodes.values());
  }

  // --------- Edge Operations ---------

  addEdge(edge: GraphEdge): GraphEdge {
    // Validate nodes exist
    if (!this.graph.nodes.has(edge.sourceId)) {
      throw new Error(`Source node ${edge.sourceId} not found`);
    }
    if (!this.graph.nodes.has(edge.targetId)) {
      throw new Error(`Target node ${edge.targetId} not found`);
    }
    this.graph.edges.set(edge.id, edge);
    return edge;
  }

  createEdge(sourceId: string, targetId: string, label?: string, condition?: string): GraphEdge {
    const id = `edge_${sourceId}_${targetId}_${Date.now()}`;
    const edge: GraphEdge = {
      id,
      sourceId,
      targetId,
      label,
      condition,
      properties: new Map(),
    };
    return this.addEdge(edge);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.graph.edges.get(id);
  }

  removeEdge(id: string): void {
    this.graph.edges.delete(id);
  }

  getAllEdges(): GraphEdge[] {
    return Array.from(this.graph.edges.values());
  }

  getOutgoingEdges(nodeId: string): GraphEdge[] {
    return this.getAllEdges().filter((e) => e.sourceId === nodeId);
  }

  getIncomingEdges(nodeId: string): GraphEdge[] {
    return this.getAllEdges().filter((e) => e.targetId === nodeId);
  }

  // --------- Validation ---------

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for nodes without outgoing edges (except terminals)
    for (const node of this.getAllNodes()) {
      const def = this.nodeRegistry.get(node.type);
      if (def && def.category !== 'terminal') {
        const outgoing = this.getOutgoingEdges(node.id);
        if (outgoing.length === 0) {
          errors.push(`Node "${node.label}" (${node.id}) has no outgoing edges`);
        }
      }
    }

    // Check for dangling edges
    for (const edge of this.getAllEdges()) {
      if (!this.graph.nodes.has(edge.sourceId)) {
        errors.push(`Edge ${edge.id} references non-existent source node ${edge.sourceId}`);
      }
      if (!this.graph.nodes.has(edge.targetId)) {
        errors.push(`Edge ${edge.id} references non-existent target node ${edge.targetId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // --------- Export to Mermaid ---------

  toMermaid(): string {
    const lines: string[] = [];
    lines.push('graph TD');

    // Add nodes
    for (const node of this.getAllNodes()) {
      const label = this.escapeMermaid(node.label);
      lines.push(`  ${node.id}["${label}"]`);
    }

    // Add edges
    for (const edge of this.getAllEdges()) {
      const label = edge.label ? ` |${this.escapeMermaid(edge.label)}|` : '';
      if (edge.condition) {
        lines.push(
          `  ${edge.sourceId} -->|${this.escapeMermaid(edge.condition)}| ${edge.targetId}`
        );
      } else {
        lines.push(`  ${edge.sourceId} --> ${edge.targetId}`);
      }
    }

    return lines.join('\n');
  }

  private escapeMermaid(text: string): string {
    return text.replace(/"/g, '\\"').replace(/\n/g, '\\n').substring(0, 100);
  }

  // --------- Serialization ---------

  toJSON(): string {
    const data = {
      id: this.graph.id,
      name: this.graph.name,
      type: this.graph.type,
      description: this.graph.description,
      metadata: this.graph.metadata,
      nodes: Array.from(this.graph.nodes.entries()).map(([id, node]) => ({
        id,
        type: node.type,
        label: node.label,
        description: node.description,
        x: node.x,
        y: node.y,
        properties: Object.fromEntries(node.properties),
        actions: Array.from(node.actions.keys()),
        metadata: node.metadata,
      })),
      edges: Array.from(this.graph.edges.entries()).map(([id, edge]) => ({
        id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        label: edge.label,
        condition: edge.condition,
        properties: Object.fromEntries(edge.properties),
        metadata: edge.metadata,
      })),
    };
    return JSON.stringify(data, null, 2);
  }

  static fromJSON(json: string): GraphService {
    const data = JSON.parse(json);
    const service = new GraphService(data.id, data.name, data.type);
    service.graph.description = data.description;
    service.graph.metadata = data.metadata;

    // Reconstruct nodes
    for (const nodeData of data.nodes) {
      const node: GraphNode = {
        id: nodeData.id,
        type: nodeData.type,
        label: nodeData.label,
        description: nodeData.description,
        properties: new Map(Object.entries(nodeData.properties)),
        actions: new Map(),
        x: nodeData.x,
        y: nodeData.y,
        metadata: nodeData.metadata,
      };
      service.addNode(node);
    }

    // Reconstruct edges
    for (const edgeData of data.edges) {
      const edge: GraphEdge = {
        id: edgeData.id,
        sourceId: edgeData.sourceId,
        targetId: edgeData.targetId,
        label: edgeData.label,
        condition: edgeData.condition,
        properties: new Map(Object.entries(edgeData.properties)),
        metadata: edgeData.metadata,
      };
      service.addEdge(edge);
    }

    return service;
  }
}

// ============================================================================
// Standard Node Types for Workflow
// ============================================================================

export const WorkflowNodeTypes: NodeTypeDefinition[] = [
  {
    type: 'start',
    label: 'Start',
    description: 'Entry point of the workflow',
    category: 'terminal',
    defaultProperties: [],
    defaultActions: [],
  },
  {
    type: 'end',
    label: 'End',
    description: 'Exit point of the workflow',
    category: 'terminal',
    defaultProperties: [],
    defaultActions: [],
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Execute an operation or task',
    category: 'action',
    defaultProperties: [
      { name: 'operation', type: 'string', value: '', label: 'Operation Name' },
      { name: 'timeout', type: 'number', value: 5000, label: 'Timeout (ms)' },
      { name: 'retries', type: 'number', value: 0, label: 'Retries' },
    ],
    defaultActions: [
      { name: 'execute', description: 'Execute this action' },
      { name: 'preview', description: 'Preview the operation' },
    ],
  },
  {
    type: 'decision',
    label: 'Decision',
    description: 'Conditional branching',
    category: 'decision',
    defaultProperties: [
      { name: 'condition', type: 'string', value: '', label: 'Condition Expression' },
    ],
    defaultActions: [],
  },
  {
    type: 'queue-router',
    label: 'Queue Router',
    description: 'Route messages to output queues',
    category: 'action',
    defaultProperties: [
      { name: 'inputQueue', type: 'string', value: '', label: 'Input Queue' },
      { name: 'transformRule', type: 'string', value: '', label: 'Transform Rule' },
    ],
    defaultActions: [
      { name: 'addOutput', description: 'Add output route' },
    ],
  },
  {
    type: 'async-task',
    label: 'Async Task',
    description: 'Non-blocking async operation',
    category: 'action',
    defaultProperties: [
      { name: 'taskType', type: 'enum', value: 'http', label: 'Task Type', options: ['http', 'spawn', 'call'] },
      { name: 'endpoint', type: 'string', value: '', label: 'Endpoint/Target' },
    ],
    defaultActions: [],
  },
];

export function createDefaultWorkflowRegistry(): NodeTypeRegistry {
  const registry = new NodeTypeRegistry();
  WorkflowNodeTypes.forEach((def) => registry.register(def));
  return registry;
}
