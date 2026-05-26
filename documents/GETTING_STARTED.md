# 🚀 Visual Workflow Editor — Getting Started in 2 Minutes

## What You Have

A complete, production-ready platform for creating workflows visually, then converting them to code:

```
Visual Nodes & Edges → Mermaid Diagram → DSL Code → Pcode Bytecode
```

## The 3 Ways to Use It

### 1️⃣ **Visual Editor (No Coding)**

```bash
# Just open this file in your web browser:
documents/visual-workflow-editor.html
```

Then:
- 🖱️ Drag nodes from the left sidebar onto the canvas
- 🔗 Connect nodes with edges
- ⚙️ Edit properties in the right panel
- 📥 Click "Export" buttons to get code

**No server, no installation, works immediately.**

---

### 2️⃣ **TypeScript/JavaScript (Developers)**

```typescript
import { GraphService, createDefaultWorkflowRegistry } from './GraphService';
import { generateDSL, generatePcode } from './CodeGenerators';

// Create a workflow
const service = new GraphService('wf1', 'My Workflow', 'workflow');

// Add nodes
const start = service.createNode('start', 'start', 'Begin');
const action = service.createNode('action', 'action', 'Process');
const end = service.createNode('end', 'end', 'Done');

// Connect them
service.createEdge(start.id, action.id);
service.createEdge(action.id, end.id);

// Export
console.log(service.toMermaid());   // Diagram
console.log(generateDSL(service));  // Readable code
console.log(generatePcode(service)); // Bytecode
```

**TypeScript, no dependencies, easy to integrate.**

---

### 3️⃣ **REST API (Backend)**

```bash
# Start the server
node graph-service-api.ts

# Create a workflow
curl -X POST http://localhost:3000/api/graphs \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workflow", "type": "workflow"}'

# Export bytecode
curl http://localhost:3000/api/graphs/GRAPH_ID/export/pcode
```

**Full HTTP API, stateless, scalable.**

---

## Node Types Available

| Category | Types |
|----------|-------|
| **Workflows** | start, end, action, decision, queue-router, async-task |
| **Task Charts** | task-node, parallel-task, wait-node |
| **Message Flow** | message-source, message-sink, message-filter, message-transform |

Each node has **configurable properties** (operation name, timeout, conditions, etc).

---

## Quick Example

**Create a payment routing workflow:**

```
Receive Payment
    ↓
Validate Amount
    ↓
Is Amount > $1000?
    ├→ YES → Route to High-Value Queue
    └→ NO  → Route to Standard Queue
    ↓
Complete
```

**In the visual editor:**
1. Drag "Start" → "Action" → "Decision" → "Queue Router" → "Queue Router" → "End"
2. Set "Decision" condition: `amount > 1000`
3. Label edges: "true" / "false"
4. Click "Export DSL" → get Pascal-like code
5. Click "Export Pcode" → get bytecode for ESP32

**Programmatically:**
```typescript
// Same workflow, 10 lines of code
service.createNode(...start...);
service.createNode(...validate...);
service.createNode(...decision..., { condition: 'amount > 1000' });
// ... etc
```

---

## What Can I Build?

✅ **Payment Workflows** — Route transactions based on rules  
✅ **Task Charts** — Plan parallel processing, dependencies  
✅ **Message Pipelines** — Filter, transform, route messages  
✅ **State Machines** — Define states and transitions  
✅ **Business Logic** — Decision trees, conditional flows  
✅ **Anything with Nodes & Edges!**

---

## Documentation Files

| File | Purpose | Read Time |
|------|---------|-----------|
| **INDEX.md** ⭐ | Navigation & index | 5 min |
| **QUICK_REFERENCE.md** | Cheat sheet & quick start | 10 min |
| **USAGE_EXAMPLES.ts** | 6 working code examples | 15 min |
| **IMPLEMENTATION_SUMMARY.md** | Architecture overview | 10 min |
| **VISUAL_EDITOR_README.md** | Complete API docs | 30 min |
| **DELIVERABLES.md** | What was built | 10 min |

**Start with:** `INDEX.md` or `QUICK_REFERENCE.md`

---

## The Flow

```
┌─────────────────────────────────────────────┐
│  Step 1: DESIGN (Visual Editor)             │
│  Drag nodes, connect edges, edit properties │
└────────────────┬────────────────────────────┘
                 │ Export as JSON
┌────────────────▼────────────────────────────┐
│  Step 2: VISUALIZE (Mermaid Preview)        │
│  See diagram in editor or embed in docs     │
└────────────────┬────────────────────────────┘
                 │ Export
┌────────────────▼────────────────────────────┐
│  Step 3: GENERATE (Code)                    │
│  ├─ DSL (Pulse0 Pascal code)                │
│  └─ Pcode (bytecode)                        │
└────────────────┬────────────────────────────┘
                 │ Compile / Deploy
┌────────────────▼────────────────────────────┐
│  Step 4: DEPLOY (Runtime)                   │
│  Run on ESP32, JavaScript VM, or anywhere   │
└─────────────────────────────────────────────┘
```

---

## API Summary

### Creating Nodes
```typescript
service.createNode(id, type, label, properties);
```

### Connecting Nodes
```typescript
service.createEdge(sourceId, targetId, label, condition);
```

### Exporting
```typescript
service.toMermaid()      // Diagram
generateDSL(service)     // DSL code
generatePcode(service)   // Bytecode
service.toJSON()         // JSON
```

### Validation
```typescript
const result = service.validate();
if (!result.valid) {
  result.errors.forEach(err => console.log(err));
}
```

---

## File Locations

All files in: **`c:\dev\pulse-new-repo\documents\`**

- `GraphService.ts` — Core graph engine
- `DSLGenerator.ts` — Generate Pulse0 DSL code
- `PcodeGenerator.ts` — Generate bytecode
- `visual-workflow-editor.html` — Open in browser
- `graph-service-api.ts` — REST API server

---

## Installation (Optional)

**If you want the REST API server:**

```bash
# Install dependencies
npm install express uuid

# Compile TypeScript (if not pre-compiled)
npx tsc graph-service-api.ts GraphService.ts DSLGenerator.ts PcodeGenerator.ts

# Run the server
node graph-service-api.js
```

**Then API is at:** `http://localhost:3000`

---

## Pro Tips

✨ **Save your work:** Visual editor → Click "💾 Save" → Get JSON file  
✨ **Share diagrams:** Export to Mermaid → Paste into documentation  
✨ **Collaborate:** Each workflow is JSON → Version control friendly  
✨ **Extend:** Add custom node types with simple registration  
✨ **Deploy:** Export pcode → Flash to ESP32 → Done  

---

## Common Questions

**Q: Do I need Node.js?**  
A: No! Visual editor works in browser. Only needed for REST API.

**Q: Can I use this for state machines?**  
A: Yes! Decision nodes → states, conditions → transitions.

**Q: Can I add custom node types?**  
A: Yes! See `USAGE_EXAMPLES.ts` → Example 5.

**Q: What formats can I export?**  
A: Mermaid (diagram), DSL (code), Pcode (bytecode), JSON (storage).

**Q: Does it integrate with my backend?**  
A: Yes! REST API for full control, or embed TypeScript directly.

**Q: Is it production-ready?**  
A: Yes! Type-safe, tested, documented, zero dependencies (core).

---

## Next Steps

1. **Right now (2 min):** Open `visual-workflow-editor.html` in browser
2. **Next (10 min):** Read `QUICK_REFERENCE.md`
3. **Then (30 min):** Try `USAGE_EXAMPLES.ts` examples
4. **Finally:** Build your first workflow!

---

## Bonus: Run an Example

**Copy this into browser console** while `visual-workflow-editor.html` is open:

```javascript
// Add example nodes
app.graphService.nodes.push({
  id: 'ex1', type: 'start', label: 'Start', x: 50, y: 50
});
app.graphService.nodes.push({
  id: 'ex2', type: 'action', label: 'Process', x: 200, y: 50
});
app.graphService.nodes.push({
  id: 'ex3', type: 'end', label: 'End', x: 350, y: 50
});
app.graphService.edges.push({
  id: 'e1', sourceId: 'ex1', targetId: 'ex2'
});
app.graphService.edges.push({
  id: 'e2', sourceId: 'ex2', targetId: 'ex3'
});
app.render();
```

Instant workflow! 🎉

---

## Support

- 📖 See `INDEX.md` for complete documentation index
- 💡 See `USAGE_EXAMPLES.ts` for 6 working examples
- 🔍 See `QUICK_REFERENCE.md` for API cheat sheet
- 🏗️ See `VISUAL_EDITOR_README.md` for deep technical guide

---

## Summary

You have a **complete, generic platform** for:
- ✅ Visual workflow design (no coding needed)
- ✅ Code generation (DSL + Pcode)
- ✅ REST API integration
- ✅ Extensible node types
- ✅ Multiple export formats
- ✅ Full documentation

**Start with the visual editor. Scale as needed.**

---

🎉 **You're all set! Open `visual-workflow-editor.html` and start building!**
