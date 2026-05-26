# Visual Workflow Editor — Complete Documentation Index

## 📚 Documentation Files (in `documents/`)

### Getting Started
1. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** ⭐ **START HERE**
   - Quick start guide (3 ways to use)
   - Node types catalog
   - API cheat sheet
   - Common issues & solutions
   - **Perfect for**: Getting started in 5 minutes

2. **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)**
   - What was created & why
   - Key features overview
   - Architecture diagram
   - Next steps for enhancement
   - **Perfect for**: Understanding the platform

### Deep Dives
3. **[VISUAL_EDITOR_README.md](VISUAL_EDITOR_README.md)** 
   - Complete architecture documentation
   - Detailed API reference with examples
   - Component breakdown
   - Data model specification
   - Extension points
   - **Perfect for**: Building on top / extending

4. **[USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts)**
   - 6 complete, runnable examples:
     1. Payment Routing Workflow
     2. Task Chart for Parallel Processing
     3. Message Flow Pipeline
     4. REST API Client Usage
     5. Custom Node Type Registration
     6. Validation & Analysis
   - **Perfect for**: Learning by example

### Source Code
5. **[GraphService.ts](GraphService.ts)**
   - Core graph model (600 lines)
   - Node types registry
   - Properties & actions system
   - JSON serialization
   - Mermaid export
   - Full TypeScript types

6. **[DSLGenerator.ts](DSLGenerator.ts)**
   - Convert graphs to Pulse0 Pascal DSL (400 lines)
   - Variable declaration generation
   - Procedure declaration generation
   - Control flow handling
   - Comments & formatting

7. **[PcodeGenerator.ts](PcodeGenerator.ts)**
   - Compile graphs to bytecode (450 lines)
   - Label assignment for jumps
   - Instruction emission
   - Conditional branching
   - Queue routing operations
   - Full pcode instruction set

8. **[visual-workflow-editor.html](visual-workflow-editor.html)**
   - Interactive drag-drop UI (700 lines)
   - Canvas rendering
   - Mermaid live preview
   - Property editor
   - Import/export functionality
   - Responsive design

9. **[graph-service-api.ts](graph-service-api.ts)**
   - Express REST API server (450 lines)
   - Full CRUD endpoints
   - Code generation endpoints
   - Validation endpoints
   - Health checks
   - Node type registry endpoint

---

## 🎯 Use Cases & Which Doc to Read

### "I want to create workflows visually"
1. Open `visual-workflow-editor.html` in browser
2. Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → "Visual Editor (No Code)" section

### "I want to understand the architecture"
1. Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
2. Then read [VISUAL_EDITOR_README.md](VISUAL_EDITOR_README.md) → "Components" section

### "I want to build with the API programmatically"
1. Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → "Programmatic (TypeScript)" section
2. View [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Example 1 or 4
3. Reference [VISUAL_EDITOR_README.md](VISUAL_EDITOR_README.md) → "GraphService API" section

### "I want to run the REST API server"
1. Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → "REST API (Backend)" section
2. Reference [graph-service-api.ts](graph-service-api.ts) for all endpoints
3. View [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Example 4

### "I want to add custom node types"
1. Read [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Example 5
2. Reference [GraphService.ts](GraphService.ts) → "NodeTypeRegistry" class

### "I want to extend with custom code generators"
1. Read [VISUAL_EDITOR_README.md](VISUAL_EDITOR_README.md) → "Extensibility" section
2. Study [DSLGenerator.ts](DSLGenerator.ts) or [PcodeGenerator.ts](PcodeGenerator.ts) as examples

### "I want to understand data formats"
1. Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → "Data Structure" section
2. Reference [VISUAL_EDITOR_README.md](VISUAL_EDITOR_README.md) → "Data Model (JSON)" section

---

## 🏗️ Architecture Flow

```
┌──────────────────────────────────────────────────────────┐
│                   Documentation                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ QUICK_REFERENCE.md ← START HERE (5 min read)       │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                 │                                         │
│         ┌───────┴────────┬──────────────┬──────────────┐  │
│         ▼                ▼              ▼              ▼  │
│  USAGE_EXAMPLES  IMPL_SUMMARY   EDITOR_README    Source  │
│  (Learn by       (Architecture)   (Deep dive)      Code   │
│   example)                                         Files   │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  GraphService    │
                    │  (Core Engine)   │
                    └────┬─────┬───────┘
                         │     │
                    ┌────▼─┐  ┌▼────────┐
                    │ DSL  │  │ Pcode   │
                    │Gen   │  │Gen      │
                    └──────┘  └─────────┘
```

---

## 📋 File Sizes & Line Counts

| File | Size | Lines | Complexity |
|------|------|-------|-----------|
| GraphService.ts | 22 KB | 600 | Medium |
| DSLGenerator.ts | 14 KB | 400 | Medium |
| PcodeGenerator.ts | 16 KB | 450 | Medium |
| visual-workflow-editor.html | 28 KB | 700 | High |
| graph-service-api.ts | 16 KB | 450 | Medium |
| QUICK_REFERENCE.md | 12 KB | 350 | Low |
| USAGE_EXAMPLES.ts | 18 KB | 500 | High |
| VISUAL_EDITOR_README.md | 20 KB | 500 | Medium |
| IMPLEMENTATION_SUMMARY.md | 16 KB | 400 | Low |

**Total: ~160 KB, ~3800 lines of code + docs**

---

## 🚀 Quick Navigation

### "How do I...?"

#### Create a workflow?
- **Visually?** → Open HTML file, read [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-quick-start)
- **Programmatically?** → Read [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Example 1
- **Via REST API?** → Read [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Example 4

#### Export to different formats?
- **Mermaid?** → `service.toMermaid()` — [GraphService.ts](GraphService.ts#L150)
- **DSL?** → `generateDSL(service)` — [DSLGenerator.ts](DSLGenerator.ts)
- **Pcode?** → `generatePcode(service)` — [PcodeGenerator.ts](PcodeGenerator.ts)
- **JSON?** → `service.toJSON()` — [GraphService.ts](GraphService.ts#L200)

#### Add validation?
- Read [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Example 6
- Reference `service.validate()` in [GraphService.ts](GraphService.ts)

#### Add custom nodes?
- Read [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Example 5
- Reference [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-customization) → "Add Custom Node Type"

#### Deploy & run?
- Start API server from [graph-service-api.ts](graph-service-api.ts)
- Make API calls as shown in [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Example 4

#### Understand node types?
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-available-node-types) — Catalog with properties
- [VISUAL_EDITOR_README.md](VISUAL_EDITOR_README.md#node-properties--actions) — Detailed guide
- [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Examples 1-3 show different types in action

---

## 💡 Key Concepts

### Node Types
There are 15+ pre-built node types across 3 categories:
- **Workflows:** start, end, action, decision, queue-router, async-task
- **Task Charts:** task-node, parallel-task, wait-node
- **Message Flow:** message-source, message-sink, message-filter, message-transform

### Properties
Each node has configurable properties (strings, numbers, enums, arrays):
```
action node has: operation, timeout, retries
decision node has: condition
queue-router has: inputQueue, transformRule
```

### Code Generation Pipeline
```
Graph → DSL (readable) → Pcode (bytecode) → Runtime
```

### Export Formats
- **Mermaid:** For documentation & collaboration
- **JSON:** For storage & version control
- **DSL:** For review & modification
- **Pcode:** For deployment to embedded systems

---

## 📞 Support Map

| Question | File | Section |
|----------|------|---------|
| Where do I start? | QUICK_REFERENCE.md | 🚀 Quick Start |
| How do I use it? | USAGE_EXAMPLES.ts | All 6 examples |
| What's the architecture? | IMPLEMENTATION_SUMMARY.md | Full document |
| How do I extend it? | VISUAL_EDITOR_README.md | Extensibility |
| What APIs are available? | QUICK_REFERENCE.md | 🔧 Key APIs |
| What node types exist? | QUICK_REFERENCE.md | 🎯 Available Node Types |
| How do I validate? | USAGE_EXAMPLES.ts | Example 6 |
| How do I add custom nodes? | USAGE_EXAMPLES.ts | Example 5 |
| What's the data format? | QUICK_REFERENCE.md | 💾 Data Structure |
| How do I use the REST API? | USAGE_EXAMPLES.ts | Example 4 |

---

## ✅ Checklist: You've Got Everything

- ✅ Visual editor UI (HTML)
- ✅ Core graph engine (TypeScript)
- ✅ DSL code generator
- ✅ Pcode bytecode compiler
- ✅ REST API server
- ✅ Complete documentation
- ✅ 6 working examples
- ✅ Quick reference guide
- ✅ This index

## 🎓 Learning Path

**For Visual Users (5-10 minutes):**
1. Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → "Quick Start" section
2. Open `visual-workflow-editor.html` in browser
3. Drag a few nodes, connect them, hit export

**For Developers (30 minutes):**
1. Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
2. Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → "Programmatic" section
3. Review [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → Examples 1 & 5
4. Study [GraphService.ts](GraphService.ts) source code

**For Architects (1-2 hours):**
1. Read [VISUAL_EDITOR_README.md](VISUAL_EDITOR_README.md) → Full document
2. Review all source files:
   - [GraphService.ts](GraphService.ts) — Model
   - [DSLGenerator.ts](DSLGenerator.ts) — DSL generation
   - [PcodeGenerator.ts](PcodeGenerator.ts) — Bytecode compilation
   - [graph-service-api.ts](graph-service-api.ts) — API design
3. Study [USAGE_EXAMPLES.ts](USAGE_EXAMPLES.ts) → All examples

---

**Last Updated:** May 26, 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅
