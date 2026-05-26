/**
 * Pcode Code Generator
 * 
 * Converts graph-based workflows to pcode bytecode
 * Can either parse DSL first or generate directly from graph
 */

import { Graph, GraphNode, GraphEdge, GraphService } from './GraphService';

export interface PcodeInstruction {
  address: number;
  opcode: string;
  operands?: string[];
  label?: string;
  comment?: string;
}

export class PcodeGenerator {
  private service: GraphService;
  private instructions: PcodeInstruction[] = [];
  private labelMap: Map<string, number> = new Map();
  private address: number = 0;
  private nodeToLabel: Map<string, string> = new Map();

  constructor(service: GraphService) {
    this.service = service;
  }

  /**
   * Generate pcode from the graph
   */
  generate(): string {
    this.instructions = [];
    this.labelMap = new Map();
    this.nodeToLabel = new Map();
    this.address = 0;

    // First pass: assign labels to nodes
    this.assignLabels();

    // Second pass: generate instructions
    const startNode = this.findNodeByType('start');
    if (startNode) {
      this.generateFromNode(startNode, new Set());
    }

    // Add halt instruction
    this.emit('HALT', [], 'End of program');

    // Resolve label addresses (second assembly pass)
    this.resolveLabels();

    return this.instructionsToString();
  }

  /**
   * Assign labels to key nodes for jumps
   */
  private assignLabels(): void {
    let labelCounter = 0;

    // Label all decision nodes and routers (potential jump targets)
    for (const node of this.service.getAllNodes()) {
      if (node.type === 'decision' || node.type === 'queue-router' || node.type === 'end') {
        const label = this.nodeLabelName(node);
        this.nodeToLabel.set(node.id, label);
      }
    }
  }

  /**
   * Generate label name for a node
   */
  private nodeLabelName(node: GraphNode): string {
    return `NODE_${node.type.toUpperCase()}_${node.id.slice(0, 8)}`.toUpperCase();
  }

  /**
   * Recursively generate instructions from a node
   */
  private generateFromNode(node: GraphNode, visited: Set<string>): void {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    // Emit label if this node has one
    if (this.nodeToLabel.has(node.id)) {
      const label = this.nodeToLabel.get(node.id)!;
      this.labelMap.set(label, this.address);
    }

    // Generate instructions for this node
    switch (node.type) {
      case 'start':
        this.emit('NOP', [], 'Start node');
        break;

      case 'end':
        this.emit('HALT', [], 'End node');
        return; // Don't process further

      case 'action':
        this.generateActionInstructions(node);
        break;

      case 'decision':
        this.generateDecisionInstructions(node, visited);
        return; // Decision handles its own flow

      case 'queue-router':
        this.generateRouterInstructions(node);
        break;

      case 'async-task':
        this.generateAsyncTaskInstructions(node);
        break;
    }

    // Follow outgoing edges to next node(s)
    const outgoingEdges = this.service.getOutgoingEdges(node.id);
    for (const edge of outgoingEdges) {
      const targetNode = this.service.getNode(edge.targetId);
      if (targetNode) {
        this.generateFromNode(targetNode, visited);
      }
    }
  }

  /**
   * Generate instructions for an action node
   */
  private generateActionInstructions(node: GraphNode): void {
    const operation = node.properties.get('operation')?.value || 'action';
    const timeout = node.properties.get('timeout')?.value || 5000;
    const retries = node.properties.get('retries')?.value || 0;

    // Push operation identifier
    this.emit('LIT', [operation], `Action: ${operation}`);

    // Push timeout
    this.emit('LIT', [String(timeout)], `Timeout: ${timeout}ms`);

    // Push retries count
    this.emit('LIT', [String(retries)], `Retries: ${retries}`);

    // Call operation (could be a library routine)
    this.emit('SYS', [operation], 'Execute action');
  }

  /**
   * Generate instructions for a decision node
   */
  private generateDecisionInstructions(node: GraphNode, visited: Set<string>): void {
    const condition = node.properties.get('condition')?.value || 'true';

    // Evaluate condition and push result
    this.emit('LIT', ['1'], `Condition: ${condition}`);

    // Find true and false branches
    const edges = this.service.getOutgoingEdges(node.id);
    const trueEdge = edges.find((e) => e.label === 'true' || !e.condition);
    const falseEdge = edges.find((e) => e.label === 'false');

    if (falseEdge) {
      const targetNode = this.service.getNode(falseEdge.targetId);
      if (targetNode && this.nodeToLabel.has(targetNode.id)) {
        const label = this.nodeToLabel.get(targetNode.id)!;
        // Jump if condition is false (JZ = jump if zero)
        this.emit('JZ', [label], `Jump to ${label} if condition false`);
      }
    }

    // Generate true branch
    if (trueEdge) {
      const targetNode = this.service.getNode(trueEdge.targetId);
      if (targetNode) {
        this.generateFromNode(targetNode, visited);
      }
    }

    // Generate false branch
    if (falseEdge) {
      const targetNode = this.service.getNode(falseEdge.targetId);
      if (targetNode) {
        this.generateFromNode(targetNode, visited);
      }
    }
  }

  /**
   * Generate instructions for a queue router
   */
  private generateRouterInstructions(node: GraphNode): void {
    const inputQueue = node.properties.get('inputQueue')?.value || 'queue';

    // Match input queue
    this.emit('ROUTE_MATCH_QUEUE', [inputQueue], `Match queue: ${inputQueue}`);

    // For each output edge, emit route instructions
    const outputs = this.service.getOutgoingEdges(node.id);
    for (let i = 0; i < outputs.length; i++) {
      const edge = outputs[i];
      const queueName = edge.label || 'output';
      const transformRule = edge.properties.get('transform')?.value || 'src';
      const whenRule = edge.properties.get('when')?.value || 'true';

      // Evaluate when condition
      this.emit('ROUTE_EVAL_WHEN', [whenRule], `When: ${whenRule}`);

      const skipLabel = `ROUTER_SKIP_${i}`;
      this.emit('JZ', [skipLabel], `Skip if condition false`);

      // Apply transform
      this.emit('ROUTE_TRANSFORM', [transformRule], `Transform: ${transformRule}`);

      // Emit to output queue
      this.emit('ROUTE_EMIT', [queueName], `Emit to: ${queueName}`);

      // Skip label
      this.labelMap.set(skipLabel, this.address);
      this.emit('NOP', [], skipLabel);
    }
  }

  /**
   * Generate instructions for an async task node
   */
  private generateAsyncTaskInstructions(node: GraphNode): void {
    const taskType = node.properties.get('taskType')?.value || 'http';
    const endpoint = node.properties.get('endpoint')?.value || 'unknown';

    if (taskType === 'spawn') {
      this.emit('CAL', [endpoint], `Spawn: ${endpoint}`);
    } else if (taskType === 'call') {
      this.emit('CAL', [endpoint], `Call: ${endpoint}`);
    } else {
      this.emit('SYS', [endpoint], `Async task: ${taskType}`);
    }
  }

  /**
   * Emit an instruction
   */
  private emit(
    opcode: string,
    operands: string[] = [],
    comment?: string
  ): void {
    const instruction: PcodeInstruction = {
      address: this.address,
      opcode,
      operands: operands.length > 0 ? operands : undefined,
      comment,
    };
    this.instructions.push(instruction);
    this.address++;
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
   * Resolve label references to actual addresses
   */
  private resolveLabels(): void {
    // Second pass: resolve jump addresses
    for (const instr of this.instructions) {
      if ((instr.opcode === 'JMP' || instr.opcode === 'JZ') && instr.operands) {
        const labelRef = instr.operands[0];
        if (this.labelMap.has(labelRef)) {
          instr.operands[0] = String(this.labelMap.get(labelRef));
        }
      }
    }
  }

  /**
   * Convert instructions to pcode text format
   */
  private instructionsToString(): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Auto-generated pcode from visual workflow`);
    lines.push(`# Generated at ${new Date().toISOString()}`);
    lines.push('');

    for (const instr of this.instructions) {
      let line = '';

      // Optional label
      if (instr.label) {
        line += `${instr.label}:\n`;
      }

      // Opcode and operands
      line += instr.opcode;
      if (instr.operands && instr.operands.length > 0) {
        line += ' ' + instr.operands.join(', ');
      }

      // Optional comment
      if (instr.comment) {
        line += ` # ${instr.comment}`;
      }

      lines.push(line);
    }

    return lines.join('\n');
  }
}

export function generatePcode(service: GraphService): string {
  const generator = new PcodeGenerator(service);
  return generator.generate();
}

/**
 * Export instruction array for programmatic use
 */
export function generatePcodeInstructions(service: GraphService): PcodeInstruction[] {
  const generator = new PcodeGenerator(service);
  generator.generate(); // Populate instructions
  return (generator as any).instructions;
}
