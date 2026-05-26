/**
 * Visual Workflow Editor — Usage Examples
 * 
 * Demonstrates how to use GraphService, code generators,
 * and the REST API for various scenarios.
 */

// ============================================================================
// Example 1: Build a Payment Routing Workflow Programmatically
// ============================================================================

import { GraphService, createDefaultWorkflowRegistry } from './GraphService';
import { generateDSL } from './DSLGenerator';
import { generatePcode } from './PcodeGenerator';

function example1_PaymentRouting() {
  console.log('=== Example 1: Payment Routing Workflow ===\n');

  // Create graph service
  const registry = createDefaultWorkflowRegistry();
  const service = new GraphService('wf_payment', 'Payment Router', 'workflow', registry);

  // Add nodes
  const start = service.createNode('n_start', 'start', 'Receive Payment');
  const validate = service.createNode('n_validate', 'action', 'Validate Amount', {
    operation: 'validate_payment',
    timeout: 3000,
  });
  const decision = service.createNode('n_decision', 'decision', 'Amount > $1000?', {
    condition: 'amount > 1000',
  });
  const highValue = service.createNode('n_high', 'queue-router', 'High Value Route', {
    inputQueue: 'payments.high_value',
    transformRule: 'add_priority_flag(src)',
  });
  const standard = service.createNode('n_standard', 'queue-router', 'Standard Route', {
    inputQueue: 'payments.standard',
  });
  const end = service.createNode('n_end', 'end', 'Complete');

  // Connect nodes (define flow)
  service.createEdge(start.id, validate.id);
  service.createEdge(validate.id, decision.id);
  service.createEdge(decision.id, highValue.id, 'true', 'amount > 1000');
  service.createEdge(decision.id, standard.id, 'false', 'amount <= 1000');
  service.createEdge(highValue.id, end.id);
  service.createEdge(standard.id, end.id);

  // Validate
  const validation = service.validate();
  console.log(`Validation: ${validation.valid ? 'PASS' : 'FAIL'}`);
  if (!validation.valid) {
    validation.errors.forEach((e) => console.log(`  ❌ ${e}`));
  }

  // Export formats
  console.log('\n--- Mermaid Diagram ---');
  console.log(service.toMermaid());

  console.log('\n--- Pulse0 DSL ---');
  console.log(generateDSL(service));

  console.log('\n--- Pcode Bytecode ---');
  console.log(generatePcode(service));
}

// ============================================================================
// Example 2: Task Chart for Parallel Processing
// ============================================================================

function example2_TaskChart() {
  console.log('\n\n=== Example 2: Task Chart ===\n');

  const registry = createDefaultWorkflowRegistry();
  const service = new GraphService('chart_build', 'Build Task Chart', 'task-chart', registry);

  // Create task nodes
  const start = service.createNode('t_start', 'start', 'Build Start');

  // Parallel tasks (no enforced parallelism, just layout)
  const compile = service.createNode('t_compile', 'task-node', 'Compile Code');
  const test = service.createNode('t_test', 'task-node', 'Run Tests');
  const lint = service.createNode('t_lint', 'task-node', 'Lint Code');

  // Wait node (synchronization point)
  const wait = service.createNode('t_wait', 'wait-node', 'Wait for Tasks');
  const deploy = service.createNode('t_deploy', 'task-node', 'Deploy');
  const end = service.createNode('t_end', 'end', 'Done');

  // Connect (all tasks start from start)
  service.createEdge(start.id, compile.id);
  service.createEdge(start.id, test.id);
  service.createEdge(start.id, lint.id);

  // All tasks converge at wait node
  service.createEdge(compile.id, wait.id);
  service.createEdge(test.id, wait.id);
  service.createEdge(lint.id, wait.id);

  // Then deploy
  service.createEdge(wait.id, deploy.id);
  service.createEdge(deploy.id, end.id);

  console.log('--- Task Chart Diagram ---');
  console.log(service.toMermaid());
}

// ============================================================================
// Example 3: Message Flow with Filtering and Transformation
// ============================================================================

function example3_MessageFlow() {
  console.log('\n\n=== Example 3: Message Flow Pipeline ===\n');

  const registry = createDefaultWorkflowRegistry();
  const service = new GraphService('flow_messages', 'Message Pipeline', 'message-flow', registry);

  // Create nodes
  const source = service.createNode('msg_src', 'message-source', 'SWIFT Queue');
  const parse = service.createNode('msg_parse', 'message-filter', 'Parse MT Messages');
  const filterMT103 = service.createNode('msg_filter103', 'message-filter', 'Filter MT103');
  const transformPacs = service.createNode('msg_transform', 'message-transform', 'MT103 → PACS008');
  const enrichPacs = service.createNode('msg_enrich', 'message-transform', 'Enrich PACS');
  const sink = service.createNode('msg_sink', 'message-sink', 'Output Queue');

  // Connect flow
  service.createEdge(source.id, parse.id);
  service.createEdge(parse.id, filterMT103.id);
  service.createEdge(filterMT103.id, transformPacs.id, 'is_mt103');
  service.createEdge(transformPacs.id, enrichPacs.id);
  service.createEdge(enrichPacs.id, sink.id);

  console.log('--- Message Flow Diagram ---');
  console.log(service.toMermaid());
}

// ============================================================================
// Example 4: REST API Client Usage
// ============================================================================

async function example4_APIUsage() {
  console.log('\n\n=== Example 4: REST API Usage ===\n');

  const BASE_URL = 'http://localhost:3000/api';

  // 1. Create a graph
  console.log('Creating workflow...');
  const createResp = await fetch(`${BASE_URL}/graphs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'API-Created Workflow',
      type: 'workflow',
    }),
  });
  const { id: graphId } = await createResp.json();
  console.log(`✓ Created graph: ${graphId}\n`);

  // 2. Add nodes
  console.log('Adding nodes...');
  const node1 = await fetch(`${BASE_URL}/graphs/${graphId}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'start',
      label: 'Begin',
    }),
  }).then((r) => r.json());

  const node2 = await fetch(`${BASE_URL}/graphs/${graphId}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'action',
      label: 'Process',
      properties: { operation: 'my_operation', timeout: 5000 },
    }),
  }).then((r) => r.json());

  const node3 = await fetch(`${BASE_URL}/graphs/${graphId}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'end',
      label: 'Finish',
    }),
  }).then((r) => r.json());

  console.log(`✓ Added 3 nodes\n`);

  // 3. Create edges
  console.log('Connecting nodes...');
  await fetch(`${BASE_URL}/graphs/${graphId}/edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceId: node1.id,
      targetId: node2.id,
    }),
  });

  await fetch(`${BASE_URL}/graphs/${graphId}/edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceId: node2.id,
      targetId: node3.id,
    }),
  });

  console.log('✓ Connected nodes\n');

  // 4. Validate
  console.log('Validating graph...');
  const validation = await fetch(`${BASE_URL}/graphs/${graphId}/validate`, {
    method: 'POST',
  }).then((r) => r.json());

  console.log(`Validation: ${validation.valid ? '✓ PASS' : '✗ FAIL'}\n`);

  // 5. Export Mermaid
  console.log('Exporting Mermaid...');
  const mermaid = await fetch(`${BASE_URL}/graphs/${graphId}/export/mermaid`).then((r) =>
    r.text()
  );
  console.log(mermaid);
  console.log();

  // 6. Export DSL
  console.log('Exporting DSL...');
  const dsl = await fetch(`${BASE_URL}/graphs/${graphId}/export/dsl`).then((r) => r.text());
  console.log(dsl);
  console.log();

  // 7. Export Pcode
  console.log('Exporting Pcode...');
  const pcode = await fetch(`${BASE_URL}/graphs/${graphId}/export/pcode`).then((r) =>
    r.text()
  );
  console.log(pcode);
}

// ============================================================================
// Example 5: Custom Node Type Registration
// ============================================================================

import { NodeTypeRegistry, NodeTypeDefinition } from './GraphService';

function example5_CustomNodeTypes() {
  console.log('\n\n=== Example 5: Custom Node Types ===\n');

  // Create registry
  const registry = new NodeTypeRegistry();

  // Register custom node type
  const customNodeDef: NodeTypeDefinition = {
    type: 'kafka-consumer',
    label: 'Kafka Consumer',
    description: 'Consume messages from Kafka topic',
    category: 'integration',
    defaultProperties: [
      { name: 'topic', type: 'string', value: '', label: 'Topic Name', required: true },
      { name: 'group_id', type: 'string', value: 'default', label: 'Consumer Group' },
      { name: 'batch_size', type: 'number', value: 100, label: 'Batch Size' },
    ],
    defaultActions: [
      { name: 'start', description: 'Start consuming' },
      { name: 'stop', description: 'Stop consuming' },
      { name: 'seek', description: 'Seek to position' },
    ],
  };

  registry.register(customNodeDef);

  // Use custom node type
  const service = new GraphService('wf_kafka', 'Kafka Integration', 'workflow', registry);

  const consumer = service.createNode('kafka_1', 'kafka-consumer', 'Read Events', {
    topic: 'transactions',
    group_id: 'payment-processor',
    batch_size: 500,
  });

  console.log('✓ Registered custom node type: kafka-consumer');
  console.log(`✓ Created node with properties:`);
  for (const [name, prop] of consumer.properties) {
    console.log(`  - ${name}: ${prop.value}`);
  }
}

// ============================================================================
// Example 6: Complex Validation & Analysis
// ============================================================================

function example6_Validation() {
  console.log('\n\n=== Example 6: Validation & Analysis ===\n');

  const registry = createDefaultWorkflowRegistry();
  const service = new GraphService('test_validate', 'Test Validation', 'workflow', registry);

  // Create incomplete graph (will have validation errors)
  const start = service.createNode('start', 'start', 'Start');
  const action1 = service.createNode('action1', 'action', 'Do Something');
  const action2 = service.createNode('action2', 'action', 'Do Something Else');
  // Intentionally not connecting action2 to anything

  // Connect partially
  service.createEdge(start.id, action1.id);
  service.createEdge(action1.id, action2.id);
  // action2 has no outgoing edge (error!)

  // Validate
  const result = service.validate();
  console.log(`Valid: ${result.valid}`);
  console.log('Errors:');
  result.errors.forEach((e) => console.log(`  ❌ ${e}`));

  // Analyze structure
  const nodes = service.getAllNodes();
  const edges = service.getAllEdges();
  console.log(`\nGraph Statistics:`);
  console.log(`  Nodes: ${nodes.length}`);
  console.log(`  Edges: ${edges.length}`);

  // Trace paths
  console.log(`\nOutgoing from 'action1':`);
  service.getOutgoingEdges(action1.id).forEach((e) => {
    const target = service.getNode(e.targetId);
    console.log(`  → ${target?.label}`);
  });

  console.log(`\nIncoming to 'action1':`);
  service.getIncomingEdges(action1.id).forEach((e) => {
    const source = service.getNode(e.sourceId);
    console.log(`  ← ${source?.label}`);
  });
}

// ============================================================================
// Example 7: Legacy MT103/MT202 Mapper Flow (WFL)
// ============================================================================

function example7_LegacySwiftMapperFlow() {
  console.log('\n\n=== Example 7: Legacy MT103/MT202 Mapper Flow ===\n');

  const registry = createDefaultWorkflowRegistry();
  const service = new GraphService('flow_mt103_mt202', 'Legacy MT103/MT202 Mapper', 'message-flow', registry);

  // Source and parsing
  const source = service.createNode('swift_in', 'message-source', 'SWIFT Legacy Inbound', {
    queue: 'swift.legacy.inbound',
  });
  const parse = service.createNode('parse_swift', 'message-filter', 'Parse FIN Envelope', {
    operation: 'parse_swift_fin',
  });

  // Split path by message type
  const routeByType = service.createNode('route_type', 'decision', 'MT103 or MT202?', {
    condition: "msg_type == 'MT103' or msg_type == 'MT202'",
  });

  const map103 = service.createNode('map_103', 'message-transform', 'Mapper: MT103 -> Canonical Payment', {
    mapper: 'legacy_mt103_mapper_v2',
    sourceType: 'MT103',
    targetType: 'CanonicalPayment',
  });
  const map202 = service.createNode('map_202', 'message-transform', 'Mapper: MT202 -> Canonical Settlement', {
    mapper: 'legacy_mt202_mapper_v2',
    sourceType: 'MT202',
    targetType: 'CanonicalSettlement',
  });

  const validateCanonical = service.createNode('validate_canonical', 'action', 'Validate Canonical Payload', {
    operation: 'validate_canonical_schema',
    timeout: 2000,
  });
  const sink = service.createNode('canonical_out', 'message-sink', 'Canonical Outbound Queue', {
    queue: 'payments.canonical.outbound',
  });
  const deadLetter = service.createNode('dead_letter', 'message-sink', 'Dead Letter Queue', {
    queue: 'payments.deadletter',
  });

  // Flow edges
  service.createEdge(source.id, parse.id);
  service.createEdge(parse.id, routeByType.id);
  service.createEdge(routeByType.id, map103.id, 'MT103', "msg_type == 'MT103'");
  service.createEdge(routeByType.id, map202.id, 'MT202', "msg_type == 'MT202'");
  service.createEdge(routeByType.id, deadLetter.id, 'OTHER', "msg_type != 'MT103' and msg_type != 'MT202'");
  service.createEdge(map103.id, validateCanonical.id);
  service.createEdge(map202.id, validateCanonical.id);
  service.createEdge(validateCanonical.id, sink.id, 'valid', 'schema_ok');
  service.createEdge(validateCanonical.id, deadLetter.id, 'invalid', 'not schema_ok');

  // Validate and export
  const validation = service.validate();
  console.log(`Validation: ${validation.valid ? 'PASS' : 'FAIL'}`);
  if (!validation.valid) {
    validation.errors.forEach((e) => console.log(`  ❌ ${e}`));
  }

  console.log('\n--- Mermaid Diagram ---');
  console.log(service.toMermaid());

  console.log('\n--- Pulse0 DSL ---');
  console.log(generateDSL(service));

  console.log('\n--- Pcode Bytecode ---');
  console.log(generatePcode(service));
}

// ============================================================================
// Main — Run Examples
// ============================================================================

export async function runAllExamples() {
  example1_PaymentRouting();
  example2_TaskChart();
  example3_MessageFlow();
  // example4_APIUsage(); // Requires running API server
  example5_CustomNodeTypes();
  example6_Validation();
  example7_LegacySwiftMapperFlow();

  console.log('\n\n✅ All examples completed!\n');
}

// Run if this is the main module
if (require.main === module) {
  runAllExamples().catch(console.error);
}
