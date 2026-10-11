# Generic CPM networks

`use "CPMNetwork";` links a Pascalish activity-on-node dependency network library.
All graph algorithms are Pascalish. The existing desktop host supplies JSON/string
primitives only; application payloads are typed values, not JSON-erased objects.

```pascal
use "CPMNetwork";
service 'planning';
type Work = record owner: string; cost: integer; end;
var project: CPMNetwork<Work>; work: Work; activity: CPMNode<Work>;
get '/schedule';
begin
  project.initialize('release');
  project.addSubnetwork('build', 'release');
  work.owner := 'Engineering'; work.cost := 30;
  project.addNode('compile', 3, work, 'build');
  activity := project.node('compile');
  work := activity.payload;
  work.cost := 35;
  project.setPayload('compile', work);
  return project.schedule()
end
end.
```

See [the complete example](../../../src/cpm-network-example.pas) for nested
subnetworks, cross-network dependencies and a ten-unit critical path.

## API

| Method | Result / meaning |
| --- | --- |
| `initialize(rootId: string)` | Reset the network and create its root entry/exit milestones. |
| `addSubnetwork(id: string; parentId: string)` | Expand a child network under an existing parent. |
| `entry(network: string): string` | Explicit entry milestone identity. |
| `exit(network: string): string` | Explicit exit milestone identity. |
| `addNode(id: string; duration: integer; payload: T; network: string)` | Create a typed activity belonging to a network. |
| `node(id: string): CPMNode<T>` | Typed record containing `id`, `duration`, `network`, `payload`. |
| `payload(id: string): T` | Read an activity's payload. |
| `setPayload(id: string; value: T)` | Replace an activity's payload without changing the schedule. |
| `addDependency(predecessor: string; successor: string)` | Add an idempotent finish-to-start edge. |
| `topologicalSort(): string` | JSON array of node IDs, including milestones. |
| `schedule(): string` | JSON schedule described below. |

Each activity is connected to its group's entry and exit. Each child group's entry
and exit are connected to its parent's milestones. Subnetworks are **expanded**,
not opaque activities. Use milestone IDs to sequence complete subnetworks:

```pascal
project.addDependency(project.exit('build'), project.entry('test'))
```

Individual activities can also have cross-subnetwork dependencies. Cycles,
including cycles through milestones, are reported explicitly by sorting/scheduling.
Topological sorting chooses the first available node in insertion order.
Do not mutate the class's internal `graph` or `payloads` fields directly.

## Schedule

The result contains:

- `duration`: overall project duration.
- `nodes`: IDs, durations, membership/kind, `earliestStart`, `earliestFinish`,
  `latestStart`, `latestFinish`, `totalFloat`, and `freeFloat`.
- `edges`: index-based `from`/`to` references into `nodes`.
- `topologicalOrder`: deterministic node ID order.
- `criticalNodes`: every zero-total-float node, including milestones.
- `criticalEdges`: ID-based edges connecting critical nodes with no intervening slack.
- `criticalPath`: one deterministic representative critical path, including milestones.
  Equal critical branches remain visible in `criticalNodes`/`criticalEdges`; the
  library does not enumerate exponentially many paths.
- `subnetworks`: ID, parent, entry/exit identities, earliest start/finish and
  `elapsedDuration` in the overall schedule. This includes waiting imposed by
  external dependencies, not an independently rescheduled standalone duration.

Application payloads are retrieved through the typed API, not included in schedule
JSON. Durations use one caller-chosen unit, integer values from zero to 2147483647.
Dependencies have zero lag. Calendars, resource leveling and fractional durations
are not implemented.

## Compiler and host limits

- Currently requires hosted JavaScript PMachine compilation (`hostServices: true`);
  graph sizes require the desktop execution budget (`desktopBudget: true`).
- At most **32 nodes including all entry/exit milestones**, and **256 edges**.
  Every group consumes two node slots. Rejected additions leave the graph unchanged.
- Payloads can be scalar values or nested records/fixed arrays. With the current
  flattened class calling convention and 256-slot host operand stack,
  `CPMNetwork<T>` supports at most **seven scalar leaves per payload**.
  Larger specializations fail at compile time with an explicit capacity error.
  Deeply nested caller expressions also remain subject to host stack limits.
- Generic classes and generic type aliases are specialized at compile time;
  different instances retain independent state. Generic calls, assignments in
  generic methods and explicit returns are checked structurally.
  Method-specific generic parameters and recursive generic layouts are unsupported.
  At most 64 type specializations are produced per compilation.
- Runtime-indexed aggregate arrays use existing PMachine instructions and support
  up to 256 elements, with explicit out-of-range errors. This does not change the
  existing scalar-array bounds behavior or add indexed-record-field syntax.
- Overall schedule overflow, missing identities, duplicate identities, self
  dependencies and payload access on milestones raise explicit errors.
