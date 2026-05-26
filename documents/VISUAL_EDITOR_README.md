# Visual Workflow Editor & Generic Graph Service

A comprehensive, service-based visual editor for creating workflows, task charts, and message orchestrations. Build diagrams as **node-and-edge graphs**, visualize in **Mermaid**, and compile to **Pulse0 DSL** and **pcode**.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Visual Editor UI (HTML5)                  │
│  - Drag & drop nodes, connect with edges                     │
│  - Real-time Mermaid preview                                 │
│  - Property panel for node configuration                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ JSON Graph API
┌──────────────────────▼──────────────────────────────────────┐
│              Graph Service REST API (Express.js)             │
│  - CRUD for graphs, nodes, edges                             │
│  - Validation & analysis                                     │
│  - Code generation (Mermaid, DSL, pcode)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   [Mermaid]     [DSL Generator]  [Pcode Generator]
   (Diagram)     (Pulse0 Code)    (Bytecode)
```

## Components

### 1. **GraphService.ts** — Core Graph Engine

Defines the generic graph model with properties, actions, and serialization.

**Key Types:**
- `GraphNode` — Node with properties and actions
- `GraphEdge` — Edge with optional condition
- `Graph` — Collection of nodes and edges
- `NodeTypeRegistry` — Registry of available node types

**Core Operations:**
```typescript
// Create and manage graphs
const service = new GraphService(id, name, type, registry);

// Nodes
const node = service.createNode(id, type, label, properties);
service.updateNodeProperty(nodeId, property, value);
service.removeNode(id);

// Edges
const edge = service.createEdge(sourceId, targetId, label);
service.removeEdge(id);

// Export
const mermaid = service.toMermaid();
const json = service.toJSON();
```

### 2. **DSLGenerator.ts** — Pulse0 DSL Code Generation

Converts graphs to Pascal-like Pulse0 DSL code.

**Generates:**
- Variable declarations from node properties
- Procedure declarations for complex operations (e.g., routers)
- Statement sequences following the flow
- Conditional branches and loops

**Example Output:**
```
program my_workflow;
var
  operation: integer;
begin
  { Action: process_order (timeout=5000ms, retries=0) }
  if amount > 1000 then
    { Route to high-value-orders }
  else
    { Route to standard-orders }
end.
```

### 3. **PcodeGenerator.ts** — Bytecode Compilation

Converts graphs directly to pcode bytecode instructions.

**Instruction Types:**
- `LIT` — Push literal
- `SYS` — System operation
- `JMP` / `JZ` — Jumps for control flow
- `ROUTE_*` — Queue routing operations
- `CAL` — Call procedures
- `HALT` — End program

**Example Output:**
```
# Auto-generated pcode from visual workflow
NOP           # Start node
LIT 1         # Condition evaluation
JZ NODE_END   # Jump if false
ROUTE_EMIT correspondent.pacs008.outbound
JMP FINISH
HALT          # End of program
```

### 4. **visual-workflow-editor.html** — Interactive UI

Standalone HTML5 canvas-based editor with drag-and-drop node creation.

**Features:**
- Drag nodes from palette
- Connect nodes with edges
- Real-time Mermaid preview
- Property editor for node configuration
- Export to JSON, Mermaid, DSL, pcode
- Import/export workflows

**Node Types:**
- **Workflow:** start, end, action, decision, queue-router, async-task
- **Task Charts:** task-node, parallel-task, wait-node
- **Message Flow:** message-source, message-sink, message-filter, message-transform

### 5. **graph-service-api.ts** — REST API Server

Express.js service providing full CRUD and code generation.

**Endpoints:**

#### Graphs
```
POST   /api/graphs                   Create graph
GET    /api/graphs                   List graphs
GET    /api/graphs/:id               Get graph
DELETE /api/graphs/:id               Delete graph
```

#### Nodes
```
POST   /api/graphs/:id/nodes         Create node
GET    /api/graphs/:id/nodes         List nodes
PUT    /api/graphs/:id/nodes/:nodeId Update node
DELETE /api/graphs/:id/nodes/:nodeId Delete node
```

#### Edges
```
POST   /api/graphs/:id/edges         Create edge
GET    /api/graphs/:id/edges         List edges
DELETE /api/graphs/:id/edges/:edgeId Delete edge
```

#### Code Generation
```
GET    /api/graphs/:id/export/mermaid   Mermaid diagram
GET    /api/graphs/:id/export/dsl       Pulse0 DSL code
GET    /api/graphs/:id/export/pcode     Pcode bytecode
POST   /api/graphs/:id/export/json      JSON export
```

#### Validation
```
POST   /api/graphs/:id/validate      Validate graph
GET    /api/node-types               List all node types
GET    /api/node-types/:category     Node types by category
```

## Usage Flows

### Flow 1: Visual → DSL → Pcode (Full Compilation)

```
User creates workflow in editor
         ↓
Graph JSON to backend API
         ↓
DSLGenerator creates .pulse0 code
         ↓
Pulse0Compiler parses to AST
         ↓
PcodeGenerator emits bytecode
         ↓
Bytecode deployed to ESP32/JS runtime
```

### Flow 2: Direct Visual → Pcode (Fast Path)

```
User drags nodes in editor
         ↓
PcodeGenerator emits bytecode directly
         ↓
Instant bytecode preview
         ↓
Copy or download .pcode file
```

### Flow 3: Task Charts → Mermaid → Documentation

```
User creates task chart diagram
         ↓
Export to Mermaid format
         ↓
Embed in documentation or wiki
         ↓
Share/collaborate on task plan
```

## Node Properties & Actions

Each node type has configurable properties and actions.

### Example: Action Node

**Properties:**
- `operation` (string) — What to execute
- `timeout` (number) — Milliseconds before timeout
- `retries` (number) — How many times to retry

**Actions:**
- `execute()` — Run the action
- `preview()` — Show what would execute

### Example: Decision Node

**Properties:**
- `condition` (string) — Expression to evaluate

**Edges:**
- `true` label → execute if condition is true
- `false` label → execute if condition is false

### Example: Queue Router

**Properties:**
- `inputQueue` (string) — Input queue name
- `transformRule` (string) — Transformation expression

**Edges (each is an output):**
- Connected node label becomes output queue name
- Edge properties: `when`, `transform`

## Extensibility

### Adding Custom Node Types

```typescript
const customRegistry = new NodeTypeRegistry();

customRegistry.register({
  type: 'my-custom-action',
  label: 'My Custom Node',
  description: 'Does something special',
  category: 'action',
  defaultProperties: [
    { name: 'param1', type: 'string', value: '', label: 'Parameter 1' },
  ],
  defaultActions: [
    { name: 'doSomething', description: 'Execute custom logic' },
  ],
});

const service = new GraphService(id, name, type, customRegistry);
```

### Custom Code Generators

Extend the code generator classes to target different languages:

```typescript
class MyCustomLanguageGenerator {
  constructor(service: GraphService) {}
  
  generate(): string {
    // Your code generation logic
    return generatedCode;
  }
}
```

## Installation & Setup

### Requirements
- Node.js 16+
- TypeScript 4.5+
- Express.js
- Mermaid.js

### Backend Setup

```bash
# Install dependencies
npm install express uuid typescript @types/express

# Compile TypeScript
npx tsc

# Start API server
node dist/graph-service-api.js
```

### Frontend Setup

1. Open `visual-workflow-editor.html` in a web browser
2. Or serve via your Express server:

```typescript
app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile('visual-workflow-editor.html'));
```

## Data Model (JSON)

```json
{
  "id": "graph_123",
  "name": "Payment Workflow",
  "type": "workflow",
  "description": "Route MT103 payments",
  "nodes": [
    {
      "id": "node_1",
      "type": "action",
      "label": "Validate Payment",
      "properties": {
        "operation": "validate_payment",
        "timeout": 5000,
        "retries": 2
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "sourceId": "node_1",
      "targetId": "node_2",
      "label": "Next",
      "condition": null
    }
  ]
}
```

## Example API Usage

### Create a Workflow

```bash
curl -X POST http://localhost:3000/api/graphs \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workflow", "type": "workflow"}'
```

### Add a Node

```bash
curl -X POST http://localhost:3000/api/graphs/graph_123/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "type": "action",
    "label": "Process Order",
    "properties": {
      "operation": "process_order",
      "timeout": 5000
    }
  }'
```

### Connect Nodes

```bash
curl -X POST http://localhost:3000/api/graphs/graph_123/edges \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "node_1",
    "targetId": "node_2",
    "label": "success"
  }'
```

### Export to Pcode

```bash
curl http://localhost:3000/api/graphs/graph_123/export/pcode
```

## Future Enhancements

- [ ] Real-time collaboration (WebSocket)
- [ ] Custom node plugins/marketplace
- [ ] Advanced validation rules engine
- [ ] Performance profiling
- [ ] Deployment management
- [ ] Version control integration
- [ ] Unit test generation from diagrams
- [ ] State machine analysis
- [ ] Cycle detection for graphs

## License

Internal Project — All Rights Reserved
