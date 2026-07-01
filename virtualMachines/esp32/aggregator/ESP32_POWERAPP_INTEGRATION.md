# ESP32 Node Integration with Microsoft Power Apps

## Implementation Status: Phase 1 Complete ✅

This document tracks the implementation of the ESP32 Node Registry and Power Apps integration system.

---

## Phase 1: Node Registry + Aggregator API ✅ COMPLETE

### Components Implemented

#### 1. Node Registry (`src/esp32/nodeRegistry.mjs`)
A complete registry system for managing ESP32 nodes with the following features:

**Core Functionality:**
- ✅ In-memory node storage with Map-based indexing
- ✅ Persistent storage to JSON file (`data/esp32-nodes.json`)
- ✅ Auto-save on every update
- ✅ Node registration and updates
- ✅ Query by ID, type, or capability
- ✅ Automatic stale node cleanup (10-minute timeout)
- ✅ Statistics and monitoring

**Data Model:**
```javascript
{
  id: "esp32-01",
  type: "bt-light-node",
  name: "Living Room Node",
  ip: "192.168.1.100",
  port: 80,
  capabilities: {
    "bt.light.on": "/bluetooth/control",
    "bt.light.off": "/bluetooth/control",
    "bt.light.color": "/bluetooth/control"
  },
  metadata: {
    serviceDescriptions: {
      "bt.light.on": "Turn on BLE light"
    }
  },
  registeredAt: 1234567890,
  lastSeen: 1234567890
}
```

#### 2. Node Registry API Routes (`src/esp32/nodeRegistryRoutes.mjs`)
Complete REST API implementation with all required endpoints:

**Endpoints Implemented:**

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/nodes` | List all nodes (with optional type/capability filters) | ✅ |
| GET | `/api/nodes/:nodeId` | Get specific node details | ✅ |
| GET | `/api/nodes/:nodeId/services` | Get available services for a node | ✅ |
| POST | `/api/register` | Register or update a node | ✅ |
| POST | `/api/nodes/:nodeId/services/:serviceId` | Invoke service on node | ✅ |
| DELETE | `/api/nodes/:nodeId` | Remove node from registry | ✅ |
| GET | `/api/nodes/stats` | Get registry statistics | ✅ |

**Service Invocation Proxy:**
- ✅ Forwards requests to ESP32 nodes via HTTP
- ✅ Constructs URLs from node IP, port, and capability path
- ✅ Handles connection errors and timeouts
- ✅ Updates node's last-seen timestamp
- ✅ Returns normalized JSON responses

#### 3. Backend Integration (`backend.mjs`)
- ✅ Imported Node Registry modules
- ✅ Initialized registry on startup
- ✅ Registered API routes at `/api/*`
- ✅ Added periodic cleanup task (every 5 minutes)
- ✅ Integrated with existing Express app

---

## API Examples

### Register a Node
```bash
POST http://localhost:5000/api/register
Content-Type: application/json

{
  "id": "esp32-living-room",
  "type": "bt-light-node",
  "name": "Living Room BLE Controller",
  "ip": "192.168.1.100",
  "port": 80,
  "capabilities": {
    "bt.light.on": "/bluetooth/control",
    "bt.light.off": "/bluetooth/control",
    "bt.light.brightness": "/bluetooth/control",
    "bt.light.color": "/bluetooth/control"
  },
  "metadata": {
    "serviceDescriptions": {
      "bt.light.on": "Turn on BLE light",
      "bt.light.off": "Turn off BLE light",
      "bt.light.brightness": "Set light brightness (0-100)",
      "bt.light.color": "Set light color (RGB hex)"
    }
  }
}
```

**Response:**
```json
{
  "status": "ok",
  "message": "Node registered successfully",
  "node": {
    "id": "esp32-living-room",
    "name": "Living Room BLE Controller",
    "type": "bt-light-node"
  }
}
```

### List All Nodes
```bash
GET http://localhost:5000/api/nodes
```

**Response:**
```json
{
  "status": "ok",
  "count": 1,
  "nodes": [
    {
      "id": "esp32-living-room",
      "type": "bt-light-node",
      "name": "Living Room BLE Controller",
      "ip": "192.168.1.100",
      "port": 80,
      "lastSeen": 1719000000000,
      "registeredAt": 1718999000000
    }
  ]
}
```

### Get Node Services
```bash
GET http://localhost:5000/api/nodes/esp32-living-room/services
```

**Response:**
```json
{
  "status": "ok",
  "nodeId": "esp32-living-room",
  "nodeName": "Living Room BLE Controller",
  "services": [
    {
      "id": "bt.light.on",
      "path": "/bluetooth/control",
      "description": "Turn on BLE light"
    },
    {
      "id": "bt.light.off",
      "path": "/bluetooth/control",
      "description": "Turn off BLE light"
    }
  ]
}
```

### Invoke a Service
```bash
POST http://localhost:5000/api/nodes/esp32-living-room/services/bt.light.on
Content-Type: application/json

{
  "args": {
    "action": "on",
    "brightness": 100
  }
}
```

**Response:**
```json
{
  "status": "ok",
  "nodeId": "esp32-living-room",
  "serviceId": "bt.light.on",
  "result": {
    "status": "ok",
    "message": "Light turned on"
  }
}
```

---

## Phase 2: Pascal Compiler Service (Next)

### Requirements
- [ ] POST `/api/pascal/compile` - Compile Pascal source to p-code
- [ ] POST `/api/pascal/symbols` - Get symbol table
- [ ] POST `/api/pascal/complete` - Autocomplete suggestions
- [ ] GET `/editor` - Monaco editor UI

### Implementation Plan
1. Create `src/pascal/compilerService.mjs`
2. Integrate with existing Pascal compiler in `dsl/services/Pulse0Compiler/`
3. Add Monaco editor HTML page
4. Register routes in backend.mjs

---

## Phase 3: Monaco Editor Integration

### Requirements
- [ ] Syntax highlighting for Pascal
- [ ] Autocomplete with symbol table
- [ ] Error markers
- [ ] Compile button
- [ ] Deploy to ESP32 button

---

## Phase 4: OpenAPI Connector for Power Apps

### Requirements
- [ ] OpenAPI 2.0 specification
- [ ] Dynamic schema for service arguments
- [ ] Connector definition file
- [ ] Import instructions for Power Apps

---

## Phase 5: Example ESP32 Node

### Requirements
- [ ] ESP32 code to register with aggregator
- [ ] Example service implementations
- [ ] Auto-registration on boot
- [ ] Heartbeat mechanism

---

## Testing Checklist

### Node Registry
- [ ] Register a node
- [ ] List all nodes
- [ ] Get node details
- [ ] Get node services
- [ ] Invoke a service
- [ ] Remove a node
- [ ] Verify stale node cleanup
- [ ] Test with multiple nodes
- [ ] Test query by type
- [ ] Test query by capability

### Service Invocation
- [ ] Successful invocation
- [ ] Node unreachable error
- [ ] Service not found error
- [ ] Invalid arguments error
- [ ] Timeout handling

---

## Deployment

### Starting the Backend
```bash
cd aggregator
node backend.mjs
```

The ESP32 Node Registry will be available at:
- Base URL: `http://localhost:5000/api`
- Node list: `http://localhost:5000/api/nodes`
- Registration: `http://localhost:5000/api/register`

### Data Storage
- Registry data: `aggregator/data/esp32-nodes.json`
- Auto-saved on every update
- Loaded on startup

---

## Architecture

```
┌─────────────────┐
│   Power Apps    │
│   (Frontend)    │
└────────┬────────┘
         │ REST API
         ▼
┌─────────────────┐
│   Aggregator    │
│   (Node.js)     │
│                 │
│ ┌─────────────┐ │
│ │   Node      │ │
│ │  Registry   │ │
│ └─────────────┘ │
│                 │
│ ┌─────────────┐ │
│ │  Service    │ │
│ │  Proxy      │ │
│ └─────────────┘ │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  ESP32 Nodes    │
│                 │
│ ┌─────────────┐ │
│ │ Bluetooth   │ │
│ │  Service    │ │
│ └─────────────┘ │
│                 │
│ ┌─────────────┐ │
│ │   Event     │ │
│ │ Scheduler   │ │
│ └─────────────┘ │
└─────────────────┘
```

---

## Next Steps

1. ✅ **COMPLETE**: Node Registry + API
2. **IN PROGRESS**: Pascal Compiler Service
3. **PENDING**: Monaco Editor Integration
4. **PENDING**: OpenAPI Connector
5. **PENDING**: Example ESP32 Node
6. **PENDING**: End-to-end Testing

---

## Notes

- LAN-only deployment (no cloud dependencies)
- JSON over HTTP (no MQTT)
- Soft-configurable registry
- 10-minute node timeout (configurable)
- Automatic cleanup every 5 minutes
- Persistent storage with auto-save

---

**Last Updated:** 2026-06-20  
**Status:** Phase 1 Complete, Phase 2 Starting