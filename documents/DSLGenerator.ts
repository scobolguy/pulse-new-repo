/**
 * DSL Code Generator
 * 
 * Converts graph-based workflows to Pulse0 DSL (Pascal-like syntax)
 * This is the intermediate representation before pcode compilation
 */

import { Graph, GraphNode, GraphEdge, GraphService } from './GraphService';

export class DSLCodeGenerator {
  private service: GraphService;
  private indentLevel: number = 0;

  constructor(service: GraphService) {
    this.service = service;
  }

  /**
   * Generate Pulse0 DSL code from the graph
   */
  generate(): string {
    const lines: string[] = [];
    const graph = this.service.getGraph();

    // Program header
    lines.push(`program ${this.sanitizeName(graph.name)};`);
    lines.push('');

    // Generate variable declarations
    lines.push(...this.generateVariableDeclarations());
    lines.push('');

    // Generate procedure declarations
    lines.push(...this.generateProcedureDeclarations());
    lines.push('');

    // Generate main begin..end
    lines.push('begin');
    this.indentLevel++;
    lines.push(...this.generateStatements());
    this.indentLevel--;
    lines.push('end.');

    return lines.join('\n');
  }

  /**
   * Generate variable declarations based on node properties
   */
  private generateVariableDeclarations(): string[] {
    const lines: string[] = [];
    const vars = new Set<string>();

    // Collect all variables from nodes
    for (const node of this.service.getAllNodes()) {
      for (const [propName, prop] of node.properties) {
        if (this.isVariableProperty(prop)) {
          vars.add(`${propName}: ${this.typeToString(prop.type)}`);
        }
      }
    }

    if (vars.size > 0) {
      lines.push('var');
      this.indentLevel++;
      for (const varDecl of vars) {
        lines.push(this.indent() + varDecl + ';');
      }
      this.indentLevel--;
    }

    return lines;
  }

  /**
   * Generate procedure declarations for nodes that are complex
   */
  private generateProcedureDeclarations(): string[] {
    const lines: string[] = [];
    const graph = this.service.getGraph();

    for (const node of this.service.getAllNodes()) {
      if (node.type === 'queue-router') {
        lines.push(...this.generateRouterProcedure(node));
        lines.push('');
      }
    }

    return lines;
  }

  /**
   * Generate main statement block
   */
  private generateStatements(): string[] {
    const lines: string[] = [];
    const startNode = this.findNodeByType('start');

    if (!startNode) {
      lines.push(this.indent() + '{ No start node found }');
      return lines;
    }

    // Traverse from start node following edges
    const visited = new Set<string>();
    this.generateStatementsFromNode(startNode, lines, visited);

    return lines;
  }

  /**
   * Recursively generate statements starting from a node
   */
  private generateStatementsFromNode(
    node: GraphNode,
    lines: string[],
    visited: Set<string>
  ): void {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    // Generate statement for this node
    if (node.type === 'start') {
      // No code for start node
    } else if (node.type === 'end') {
      lines.push(this.indent() + '{ End of workflow }');
    } else if (node.type === 'action') {
      lines.push(
        this.indent() +
          this.generateActionStatement(node) +
          ';'
      );
    } else if (node.type === 'decision') {
      lines.push(...this.generateDecisionStatement(node, visited));
    } else if (node.type === 'queue-router') {
      const operation = node.properties.get('inputQueue')?.value || 'route';
      lines.push(
        this.indent() + operation + ';'
      );
    } else if (node.type === 'async-task') {
      lines.push(
        this.indent() +
          this.generateAsyncTaskStatement(node) +
          ';'
      );
    }

    // Follow outgoing edges
    const outgoingEdges = this.service.getOutgoingEdges(node.id);
    for (const edge of outgoingEdges) {
      const targetNode = this.service.getNode(edge.targetId);
      if (targetNode) {
        this.generateStatementsFromNode(targetNode, lines, visited);
      }
    }
  }

  /**
   * Generate code for an action node
   */
  private generateActionStatement(node: GraphNode): string {
    const operation = node.properties.get('operation')?.value || 'unknown_operation';
    const timeout = node.properties.get('timeout')?.value || 5000;
    const retries = node.properties.get('retries')?.value || 0;

    return `{ Action: ${operation} (timeout=${timeout}ms, retries=${retries}) }`;
  }

  /**
   * Generate code for a decision node
   */
  private generateDecisionStatement(
    node: GraphNode,
    visited: Set<string>
  ): string[] {
    const lines: string[] = [];
    const condition = node.properties.get('condition')?.value || 'true';

    lines.push(this.indent() + `if ${condition} then`);
    this.indentLevel++;

    // Find true/false edges
    const trueEdges = this.service
      .getOutgoingEdges(node.id)
      .filter((e) => e.label === 'true' || e.condition === 'true' || !e.condition);
    const falseEdges = this.service
      .getOutgoingEdges(node.id)
      .filter((e) => e.label === 'false' || e.condition === 'false');

    if (trueEdges.length > 0) {
      const targetNode = this.service.getNode(trueEdges[0].targetId);
      if (targetNode) {
        this.generateStatementsFromNode(targetNode, lines, visited);
      }
    }

    this.indentLevel--;

    if (falseEdges.length > 0) {
      lines.push(this.indent() + 'else');
      this.indentLevel++;

      const targetNode = this.service.getNode(falseEdges[0].targetId);
      if (targetNode) {
        this.generateStatementsFromNode(targetNode, lines, visited);
      }

      this.indentLevel--;
    }

    return lines;
  }

  /**
   * Generate code for an async task node
   */
  private generateAsyncTaskStatement(node: GraphNode): string {
    const taskType = node.properties.get('taskType')?.value || 'http';
    const endpoint = node.properties.get('endpoint')?.value || 'unknown';

    if (taskType === 'spawn') {
      return `spawn ${endpoint}`;
    } else if (taskType === 'call') {
      return `${endpoint}()`;
    } else {
      return `{ Async task: ${taskType} ${endpoint} }`;
    }
  }

  /**
   * Generate a procedure for queue router
   */
  private generateRouterProcedure(node: GraphNode): string[] {
    const lines: string[] = [];
    const procName = this.sanitizeName(node.label || 'router_procedure');
    const inputQueue = node.properties.get('inputQueue')?.value || 'queue';

    lines.push(`procedure ${procName};`);
    this.indentLevel++;
    lines.push('begin');
    this.indentLevel++;

    lines.push(
      this.indent() +
        `{ Route messages from ${inputQueue} } `
    );

    // Generate output routes for each outgoing edge
    const outgoingEdges = this.service.getOutgoingEdges(node.id);
    for (const edge of outgoingEdges) {
      const outputQueue = edge.label || 'output';
      const transformRule = edge.properties.get('transform')?.value || 'src';
      lines.push(
        this.indent() +
          `output := ${transformRule};  { to: ${outputQueue} }`
      );
    }

    this.indentLevel--;
    lines.push('end;');
    this.indentLevel--;

    return lines;
  }

  /**
   * Find first node of a given type
   */
  private findNodeByType(type: string): GraphNode | undefined {
    for (const node of this.service.getAllNodes()) {
      if (node.type === type) return node;
    }
    return undefined;
  }

  /**
   * Check if a property represents a variable
   */
  private isVariableProperty(prop: any): boolean {
    return prop.type !== 'string' || prop.name.startsWith('var_');
  }

  /**
   * Map property type to Pulse0 type
   */
  private typeToString(type: string): string {
    switch (type) {
      case 'number':
        return 'integer';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array [0..99] of integer';
      default:
        return 'integer';
    }
  }

  /**
   * Sanitize identifiers for DSL
   */
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  /**
   * Generate indentation
   */
  private indent(): string {
    return '  '.repeat(this.indentLevel);
  }
}

export function generateDSL(service: GraphService): string {
  const generator = new DSLCodeGenerator(service);
  return generator.generate();
}
