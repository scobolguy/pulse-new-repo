# Visual Workflow Editor — Quick Reference

## 📦 What You Got

| Component | File | Purpose |
|-----------|------|---------|
| **Graph Engine** | `GraphService.ts` | Core node-edge model, properties, actions |
| **DSL Generator** | `DSLGenerator.ts` | Convert graphs → Pulse0 Pascal code |
| **Pcode Generator** | `PcodeGenerator.ts` | Convert graphs → bytecode |
| **Visual UI** | `visual-workflow-editor.html` | Interactive drag-drop editor |
| **API Server** | `graph-service-api.ts` | REST endpoints for CRUD & export |
| **Examples** | `USAGE_EXAMPLES.ts` | 6 complete usage scenarios |
| **Docs** | `VISUAL_EDITOR_README.md` | Full documentation |

## 🚀 Quick Start

### Option A: Visual Editor (No Code)

1. Open `visual-workflow-editor.html` in browser
2. Drag nodes from left sidebar
3. Connect with edges
4. Edit properties on right
5. Click **Export** buttons

### Option B: Programmatic (TypeScript)

```typescript
import { GraphService, createDefaultWorkflowRegistry } from './GraphService';
import { generateDSL, generatePcode } from './CodeGenerators';

// Create
const service = new GraphService('wf1', 'My Workflow', 'workflow');

// Add nodes
service.createNode('n1', 'start', 'Begin');
service.createNode('n2', 'action', 'Process');
service.createNode('n3', 'end', 'Done');

// Connect
service.createEdge('n1', 'n2');
service.createEdge('n2', 'n3');

// Export
console.log(service.toMermaid());   // Diagram
console.log(generateDSL(service));  // DSL code
console.log(generatePcode(service)); // Bytecode
```

### Option C: REST API (Backend)

```bash
# Create workflow
curl -X POST http://localhost:3000/api/graphs \
  -d '{"name":"My WF","type":"workflow"}' -H "Content-Type: application/json"

# Add node
curl -X POST http://localhost:3000/api/graphs/GRAPH_ID/nodes \
  -d '{"type":"action","label":"Process"}' -H "Content-Type: application/json"

# Export pcode
curl http://localhost:3000/api/graphs/GRAPH_ID/export/pcode
```

## 🎯 Available Node Types

### Workflows
- **start** — Entry point
- **end** — Exit point
- **action** — Execute operation (properties: operation, timeout, retries)
- **decision** — Conditional branch (property: condition)
- **queue-router** — Route messages (properties: inputQueue, transformRule)
- **async-task** — Non-blocking task (properties: taskType, endpoint)

### Task Charts
- **task-node** — Single task
- **parallel-task** — Parallel execution
- **wait-node** — Synchronization point

### Message Flows
- **message-source** — Entry
- **message-sink** — Exit
- **message-filter** — Filter messages
- **message-transform** — Transform/map messages

## 🔧 Key APIs

### GraphService

```typescript
// Create
const service = new GraphService(id, name, type, registry?);

// Nodes
service.createNode(id, type, label, properties);
service.getNode(id);
service.updateNodeProperty(nodeId, propertyName, value);
service.removeNode(id);
service.getAllNodes();

// Edges
service.createEdge(sourceId, targetId, label?, condition?);
service.getEdge(id);
service.removeEdge(id);
service.getAllEdges();
service.getOutgoingEdges(nodeId);
service.getIncomingEdges(nodeId);

// Analysis
service.validate();               // Returns {valid, errors[]}
service.toMermaid();              // Mermaid diagram
service.toJSON();                 // JSON serialization
```

### Code Generators

```typescript
import { generateDSL } from './DSLGenerator';
import { generatePcode } from './PcodeGenerator';

const dslCode = generateDSL(service);      // Pulse0 code
const pcodeCode = generatePcode(service);  // Bytecode
```

## 📊 Supported Exports

| Format | Use Case | Command |
|--------|----------|---------|
| **Mermaid** | Documentation, sharing | `service.toMermaid()` or `GET /export/mermaid` |
| **JSON** | Storage, version control | `service.toJSON()` or `POST /export/json` |
| **DSL** | Edit/review code | `generateDSL(service)` or `GET /export/dsl` |
| **Pcode** | Deploy to runtime | `generatePcode(service)` or `GET /export/pcode` |

## 🏗️ Customization

### Add Custom Node Type

```typescript
const registry = new NodeTypeRegistry();

registry.register({
  type: 'my-node',
  label: 'My Custom Node',
  description: 'Does something cool',
  category: 'action',
  defaultProperties: [
    { name: 'param', type: 'string', value: '', label: 'Parameter' }
  ],
  defaultActions: [
    { name: 'execute', description: 'Run it' }
  ]
});

const service = new GraphService(id, name, type, registry);
```

### Create Custom Code Generator

```typescript
class MyLanguageGenerator {
  constructor(service: GraphService) { this.service = service; }
  
  generate(): string {
    const lines = [];
    for (const node of this.service.getAllNodes()) {
      lines.push(`// Node: ${node.label}`);
      // Your code generation logic
    }
    return lines.join('\n');
  }
}
```

## 📡 REST API Routes

### Graph CRUD
```
POST   /api/graphs                      Create
GET    /api/graphs                      List
GET    /api/graphs/:id                  Get
DELETE /api/graphs/:id                  Delete
```

### Nodes
```
POST   /api/graphs/:id/nodes            Create
GET    /api/graphs/:id/nodes            List
PUT    /api/graphs/:id/nodes/:nodeId    Update
DELETE /api/graphs/:id/nodes/:nodeId    Delete
```

### Edges
```
POST   /api/graphs/:id/edges            Create
GET    /api/graphs/:id/edges            List
DELETE /api/graphs/:id/edges/:edgeId    Delete
```

### Exports
```
GET    /api/graphs/:id/export/mermaid   Mermaid
GET    /api/graphs/:id/export/dsl       DSL
GET    /api/graphs/:id/export/pcode     Pcode
POST   /api/graphs/:id/export/json      JSON
```

### Utilities
```
POST   /api/graphs/:id/validate         Validate
GET    /api/node-types                  All types
GET    /api/node-types/:category        By category
GET    /api/health                      Health check
GET    /api/info                        Service info
```

## 💾 Data Structure

```json
{
  "id": "graph_123",
  "name": "My Workflow",
  "type": "workflow",
  "nodes": [
    {
      "id": "n1",
      "type": "action",
      "label": "Process",
      "properties": {
        "operation": "validate",
        "timeout": 5000,
        "retries": 2
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "sourceId": "n1",
      "targetId": "n2",
      "label": "next",
      "condition": null
    }
  ]
}
```

## ✅ Validation Rules

- Nodes must exist at edge endpoints
- Non-terminal nodes should have outgoing edges (configurable)
- No duplicate node IDs
- No duplicate edge IDs
- Graph must be connected (warnings if isolated subgraphs)

## 🎨 Visual Editor Keyboard/Mouse

| Action | Method |
|--------|--------|
| Add node | Drag from sidebar → canvas |
| Move node | Click & drag on canvas |
| Delete node | Right-click |
| Connect nodes | Drag edge between nodes |
| Select node | Click node |
| Edit properties | Select node, edit on right panel |
| Export | Click buttons in toolbar |
| Save | Click 💾 Save |
| Load | Click 📂 Load, select JSON file |

## 🔄 Workflow: Visual → DSL → Pcode

```
┌─────────────────────┐
│  Visual Editor      │
│  (Drag & drop)      │
└──────────┬──────────┘
           │ nodes + edges
           ▼
┌─────────────────────┐
│  GraphService       │
│  (In-memory model)  │
└──────┬──────┬───────┘
       │      │
       ▼      ▼
   [DSL]   [Pcode]
   (Code)  (Bytecode)
```

## 📝 Example Workflow JSON

```json
{
  "id": "wf_payment",
  "name": "Payment Router",
  "type": "workflow",
  "nodes": [
    { "id": "start", "type": "start", "label": "Begin" },
    { 
      "id": "validate",
      "type": "action",
      "label": "Validate",
      "properties": { "operation": "validate_payment", "timeout": 3000 }
    },
    {
      "id": "decision",
      "type": "decision",
      "label": "Amount > $1000?",
      "properties": { "condition": "amount > 1000" }
    },
    { "id": "end", "type": "end", "label": "Done" }
  ],
  "edges": [
    { "id": "e1", "sourceId": "start", "targetId": "validate" },
    { "id": "e2", "sourceId": "validate", "targetId": "decision" },
    { "id": "e3", "sourceId": "decision", "targetId": "end", "label": "yes" }
  ]
}
```

## 🚨 Common Issues

| Problem | Solution |
|---------|----------|
| Can't connect nodes | Make sure both nodes exist, nodes must have IDs |
| Validation fails | Check all non-terminal nodes have outgoing edges |
| Mermaid not rendering | Ensure Mermaid.js is loaded in HTML |
| API returns 404 | Verify graph ID exists; create one first |
| Pcode has errors | Check DSL validates first; trace node types |

## 📚 Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| GraphService.ts | ~600 | Core graph model & API |
| DSLGenerator.ts | ~400 | DSL code generation |
| PcodeGenerator.ts | ~450 | Bytecode compilation |
| visual-workflow-editor.html | ~700 | Interactive UI |
| graph-service-api.ts | ~450 | REST API server |
| USAGE_EXAMPLES.ts | ~500 | 6 complete examples |

---

**Quick Links:**
- 📖 Full Docs: `VISUAL_EDITOR_README.md`
- 🎓 Examples: `USAGE_EXAMPLES.ts`
- 🏗️ Architecture: `IMPLEMENTATION_SUMMARY.md`
