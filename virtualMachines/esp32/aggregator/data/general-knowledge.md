# Global System Knowledge & Constraints

## Core Operating Principles

### No Hallucination Policy
- **Only recommend message types and transformations that exist in the Data Librarian**
- Do not invent or assume message formats, field mappings, or schema types
- If asked about something not in the Data Librarian, explicitly state: "This message type/field is not in the current Data Librarian"
- Always verify availability before suggesting a solution

### Data Authority
- The Data Librarian is the single source of truth for:
  - Available message types (e.g., MT103, MT202, MT201, CAMT.053, PAIN.001)
  - Field mappings and transformations in `/data/data-maps/`
  - Validation rules in `/data/validation-schemas/`
  - Integration patterns

### Recommendation Guidelines
- Only suggest transformations defined in existing `.map` files
- Only reference message types present in available patterns and schemas
- When recommending a pattern, cite its file location and key verification steps
- Include confidence scores when selecting between multiple patterns

## Available Message Types & Transformations
(Auto-populated by Data Librarian at query time)

Current known transformations:
- **MT103 → PAIN.001**: Payment initiation (Swift → ISO 20022)
- **MT202 → CAMT.053**: Clearing confirmation (Swift → ISO 20022)
- **MT940 → Bank Statement**: Reconciliation feed format

## Best Practices for Pattern Matching

1. **Match by Intent First**: Understand what the user is trying to accomplish
2. **Verify Availability**: Confirm all required message types exist
3. **Cite Sources**: Always reference which data files support the recommendation
4. **Suggest Alternatives**: If exact match unavailable, suggest closest available pattern
5. **Flag Gaps**: If user needs something not in Data Librarian, recommend investigating that gap first

## Response Format Standards

When recommending a solution:
- Confidence: Always include as 0.0-1.0 (1.0 = Data Librarian has exact match)
- Source/Target Types: Use official message type names only
- Intent: One-sentence summary of the user's goal
- Missing Data: If requirements exceed Data Librarian coverage, state explicitly

## Network & System Information


### Discovering Network Nodes
To see all nodes available on the network:
```
GET http://localhost:4000/api/nodes
```
This endpoint returns the complete list of connected nodes, their types, and capabilities. Use this when the user asks about infrastructure topology or available processing nodes.

### Structure of a Node
A node can contain services or devices. This information can be gotten from the nodes query

### Structure of a Cluster
A cluster can contain many nodes arranged in a hierarchical structure. Given a cluster called Cluster1, there could be nodes underneath it referred to cluster1.NodeA, cluster1.NodeB, etc.

### Clusters are recursive
A cluster can contain other clusters

### Node Display Rules
When the user asks for nodes (e.g. "show me nodes", "what nodes are available", "list nodes"):

1. **Placement**: Render the node tree **immediately below the query** that triggered it, inline in the conversation — not at the end of a long response.
2. **Format**: Display nodes as a **collapsible tree**. Top-level entries are node types or groups; children are individual nodes and their properties.
3. **Lazy Loading**: Expand only the top level by default. Child details (services, capabilities, metrics) are shown **only when the user expands a node** — do not dump all nested data upfront.
4. **Tree structure template**:
```
▶ <NodeType / Group>           (collapsed — click/expand to load children)
  ├─ id: <nodeId>
  ├─ status: <online|offline>
  ├─ ▶ services               (lazy — expand to see service list)
  └─ ▶ capabilities           (lazy — expand to see capability list)
```
5. **Stub placeholder**: For nodes whose children have not yet been fetched, show `▶ … (click to load)` rather than making all API calls eagerly.
6. **Fallback**: If the `/api/nodes` call fails or returns an empty list, state that clearly directly under the query before continuing.

### Make Device/Service Discovery Easier

1. **Use stable identities**: Ensure every node, device, and service has a stable ID that does not change across restarts.
2. **Publish a canonical shape**: Keep one standard payload schema for discovery results. Include `nodeId`, `nodeType`, `status`, `lastSeen`, `services[]`, and `devices[]`.
3. **Track freshness**: Include timestamps (`lastSeen`, `lastHeartbeat`) and mark entries as stale when they exceed a TTL.
4. **Add filterable discovery queries**: Support common filters such as `type`, `status`, `service`, `capability`, `cluster`, and `q` (free-text search).
5. **Expose service-first lookup**: Add or maintain a route that answers "which nodes run service X" without requiring full tree traversal.
6. **Expose capabilities explicitly**: For each service/device, return capability tags (for example `printer`, `broker-client`, `telemetry`, `queue-consumer`) to improve matching and routing.
7. **Separate summary vs detail**: Default discovery calls should return compact summaries. Fetch full node detail only on demand.
8. **Keep local cache + invalidation**: Cache discovery snapshots for quick UI responses, but invalidate or refresh when heartbeats/config changes arrive.
9. **Use consistent health states**: Standardize on `online`, `degraded`, `offline`, and `unknown` so cluster views are easy to reason about.
10. **Improve observability**: Log discovery updates with source, version, and diff count so topology drift is diagnosable.

### Suggested Discovery API Shapes

Compact inventory:
```
GET /api/nodes?view=summary
```

Node details:
```
GET /api/nodes/:nodeId
```

Find service placements:
```
GET /api/services/:serviceName/nodes
```

List capabilities:
```
GET /api/capabilities
```

Cluster topology snapshot:
```
GET /api/clusters/topology
```

### Cluster Management Guidance

1. **Model desired state**: Store desired cluster topology/config separately from observed runtime state.
2. **Use declarative membership**: Treat node roles and service placement as declarations, then reconcile actual state toward desired state.
3. **Define role boundaries**: Mark nodes by role (for example `ingress`, `worker`, `storage`, `gateway`) and schedule services by role.
4. **Use anti-affinity for resilience**: Avoid placing all replicas of a critical service on the same node.
5. **Implement controlled failover**: Define promotion rules and cooldown windows so role failover is deterministic.
6. **Version topology changes**: Every cluster mutation should include change ID, actor, timestamp, and rollback info.
7. **Guard management operations**: Require explicit permissions for cluster-changing actions (`drain`, `promote`, `rebalance`, `delete`).
8. **Support safe maintenance mode**: Allow draining a node before restart/update to reduce dropped work.
9. **Track placement intent and result**: Persist scheduler intent and final placement outcomes for postmortem/debugging.
10. **Add cluster-level SLO checks**: Continuously evaluate availability, queue lag, and service replica health.

### Cluster Management Checklist

- Before adding a node: verify identity, role, capability tags, and heartbeat.
- Before deploying a service: confirm placement rules and replica strategy.
- Before draining/removing a node: rebalance workloads and validate downstream dependencies.
- After any topology change: run health probes for affected services and compare expected vs observed topology.

## Available APIs & Endpoints

The aggregator exposes the following API endpoints:

### Pattern Matching
```
POST /api/patterns/match
Body: { query: "<natural language query>" }
Returns: { engine: "ollama"|"keyword", classification: {...}, matches: [...] }
```
Use this to understand user intent and find matching problem patterns.

### Message Conversion
```
POST /api/convert
Body: { mapId: "<map-id>", payload: {...} }
Returns: { output: {...}, diagnostics: [...] }

GET /api/convert/mt103-to-pain001/sample
Returns: Sample MT103 message payload for testing

POST /api/convert/mt103-to-pain001
Body: { payload: {...} } or omit to use sample
Returns: { output: {...}, diagnostics: [...] }
```

### Discovering Available APIs
**To find all available APIs at runtime:**
1. Check backend route files: `aggregator/src/backend/*.mjs` (patternRoutes, conversionRoutes, nodeRoutes, etc.)
2. Each file exports a `registerRoutes(app)` function that defines endpoints
3. Endpoints are registered in `aggregator/backend.mjs` on startup

**To debug API availability:**
- Check Express app logs for route registration messages
- Query any endpoint and check HTTP status (404 = route not found, 500 = server error, 200 = success)

### API Base URL
All APIs are accessed at: `http://localhost:4000/api/*`

---

**Last Updated**: Auto-generated system constraints  
**Authority**: System configuration at startup
