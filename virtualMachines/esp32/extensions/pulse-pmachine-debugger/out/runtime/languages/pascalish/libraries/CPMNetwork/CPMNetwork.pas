program "CPMNetwork";

type CPMNode<T> = record
  id: string;
  duration: integer;
  network: string;
  payload: T;
end;

function CPM_FindNode(graph: string; id: string): integer;
var nodes: string; index: integer;
begin
  nodes := host.json_value(graph, 'nodes');
  index := 0;
  while index < host.json_array_count(nodes) do
  begin
    if host.json_text(host.json_array_get(nodes, index), 'id') = id then return index;
    index := index + 1
  end;
  return -1
end;

function CPM_NodeIndex(graph: string; id: string): integer;
var index: integer;
begin
  index := CPM_FindNode(graph, id);
  if index < 0 then host.raise_error('CPM unknown node: ' + id);
  return index
end;

function CPM_Group(graph: string; id: string): string;
var groups: string; group: string; index: integer;
begin
  groups := host.json_value(graph, 'subnetworks');
  index := 0;
  while index < host.json_array_count(groups) do
  begin
    group := host.json_array_get(groups, index);
    if host.json_text(group, 'id') = id then return group;
    index := index + 1
  end;
  host.raise_error('CPM unknown subnetwork: ' + id);
  return '{}'
end;

function CPM_CheckId(id: string): string;
begin
  if (host.text_trim(id) = '') or (host.text_trim(id) <> id) or
     (host.string_index(id, '@') = 0) then host.raise_error('CPM invalid or reserved identity');
  return id
end;

function CPM_AppendNode(graph: string; id: string; duration: integer; network: string; kind: string): string;
var nodes: string; node: string;
begin
  nodes := host.json_value(graph, 'nodes');
  if host.json_array_count(nodes) >= 32 then host.raise_error('CPM node capacity exceeded (32 including milestones)');
  if CPM_FindNode(graph, id) >= 0 then host.raise_error('CPM duplicate node: ' + id);
  if duration < 0 then host.raise_error('CPM duration cannot be negative');
  if duration > 2147483647 then host.raise_error('CPM duration exceeds signed 32-bit range');
  node := host.json_set('{}', 'id', id);
  node := host.json_set(node, 'duration', duration);
  node := host.json_set(node, 'network', network);
  node := host.json_set(node, 'kind', kind);
  return host.json_embed(graph, 'nodes', host.json_array_append(nodes, node))
end;

function CPM_Link(graph: string; predecessor: string; successor: string): string;
var edges: string; edge: string; index: integer; fromIndex: integer; toIndex: integer;
begin
  fromIndex := CPM_NodeIndex(graph, predecessor);
  toIndex := CPM_NodeIndex(graph, successor);
  if fromIndex = toIndex then host.raise_error('CPM self dependency');
  edges := host.json_value(graph, 'edges');
  index := 0;
  while index < host.json_array_count(edges) do
  begin
    edge := host.json_array_get(edges, index);
    if (host.json_integer(edge, 'from') = fromIndex) and
       (host.json_integer(edge, 'to') = toIndex) then return graph;
    index := index + 1
  end;
  if index >= 256 then host.raise_error('CPM dependency capacity exceeded (256)');
  edge := host.json_set(host.json_set('{}', 'from', fromIndex), 'to', toIndex);
  return host.json_embed(graph, 'edges', host.json_array_append(edges, edge))
end;

function CPM_AddGroup(graph: string; id: string; parentId: string): string;
var groups: string; group: string; previous: string; parentGroup: string; index: integer;
begin
  CPM_CheckId(id);
  groups := host.json_value(graph, 'subnetworks');
  index := 0;
  while index < host.json_array_count(groups) do
  begin
    previous := host.json_array_get(groups, index);
    if host.json_text(previous, 'id') = id then host.raise_error('CPM duplicate subnetwork: ' + id);
    index := index + 1
  end;
  if parentId <> '' then parentGroup := CPM_Group(graph, parentId);
  graph := CPM_AppendNode(graph, '@' + id + ':entry', 0, id, 'entry');
  graph := CPM_AppendNode(graph, '@' + id + ':exit', 0, id, 'exit');
  group := host.json_set(host.json_set('{}', 'id', id), 'parent', parentId);
  group := host.json_set(group, 'entry', '@' + id + ':entry');
  group := host.json_set(group, 'exit', '@' + id + ':exit');
  graph := host.json_embed(graph, 'subnetworks', host.json_array_append(groups, group));
  graph := CPM_Link(graph, '@' + id + ':entry', '@' + id + ':exit');
  if parentId <> '' then
  begin
    graph := CPM_Link(graph, host.json_text(parentGroup, 'entry'), '@' + id + ':entry');
    graph := CPM_Link(graph, '@' + id + ':exit', host.json_text(parentGroup, 'exit'))
  end;
  return graph
end;

function CPM_Order(graph: string): string;
var nodes: string; edges: string; node: string; edge: string; order: string;
    index: integer; edgeIndex: integer; chosen: integer; targetIndex: integer; emittedCount: integer;
begin
  nodes := host.json_value(graph, 'nodes');
  edges := host.json_value(graph, 'edges');
  index := 0;
  while index < host.json_array_count(nodes) do
  begin
    node := host.json_array_get(nodes, index);
    node := host.json_set(host.json_set(node, 'indegree', 0), 'emitted', 0);
    nodes := host.json_array_set(nodes, index, node);
    index := index + 1
  end;
  edgeIndex := 0;
  while edgeIndex < host.json_array_count(edges) do
  begin
    targetIndex := host.json_integer(host.json_array_get(edges, edgeIndex), 'to');
    node := host.json_array_get(nodes, targetIndex);
    node := host.json_set(node, 'indegree', host.json_integer(node, 'indegree') + 1);
    nodes := host.json_array_set(nodes, targetIndex, node);
    edgeIndex := edgeIndex + 1
  end;
  order := '[]';
  emittedCount := 0;
  while emittedCount < host.json_array_count(nodes) do
  begin
    chosen := -1;
    index := 0;
    while index < host.json_array_count(nodes) do
    begin
      node := host.json_array_get(nodes, index);
      if (chosen = -1) and (host.json_integer(node, 'indegree') = 0) and
         (host.json_integer(node, 'emitted') = 0) then chosen := index;
      index := index + 1
    end;
    if chosen = -1 then host.raise_error('CPM dependency cycle: no topological order');
    node := host.json_set(host.json_array_get(nodes, chosen), 'emitted', 1);
    nodes := host.json_array_set(nodes, chosen, node);
    order := host.json_array_append(order, host.json_set('{}', 'index', chosen));
    edgeIndex := 0;
    while edgeIndex < host.json_array_count(edges) do
    begin
      edge := host.json_array_get(edges, edgeIndex);
      if host.json_integer(edge, 'from') = chosen then
      begin
        targetIndex := host.json_integer(edge, 'to');
        node := host.json_array_get(nodes, targetIndex);
        node := host.json_set(node, 'indegree', host.json_integer(node, 'indegree') - 1);
        nodes := host.json_array_set(nodes, targetIndex, node)
      end;
      edgeIndex := edgeIndex + 1
    end;
    emittedCount := emittedCount + 1
  end;
  return order
end;

function CPM_OrderIds(graph: string; order: string): string;
var result: string; nodes: string; index: integer; nodeIndex: integer;
begin
  result := '[]';
  nodes := host.json_value(graph, 'nodes');
  index := 0;
  while index < host.json_array_count(order) do
  begin
    nodeIndex := host.json_integer(host.json_array_get(order, index), 'index');
    result := host.json_array_append(result, host.json_value(host.json_array_get(nodes, nodeIndex), 'id'));
    index := index + 1
  end;
  return result
end;

function CPM_Schedule(graph: string): string;
var nodes: string; edges: string; order: string; node: string; other: string; edge: string;
    criticalNodes: string; criticalEdges: string; path: string; reversePath: string;
    groups: string; group: string;
    position: integer; index: integer; edgeIndex: integer; fromIndex: integer; toIndex: integer;
    start: integer; finish: integer; duration: integer; projectFinish: integer; latest: integer;
    freeFloat: integer; candidate: integer; pathNode: integer; previous: integer; entryIndex: integer; exitIndex: integer;
begin
  order := CPM_Order(graph);
  nodes := host.json_value(graph, 'nodes');
  edges := host.json_value(graph, 'edges');
  projectFinish := 0;
  position := 0;
  while position < host.json_array_count(order) do
  begin
    index := host.json_integer(host.json_array_get(order, position), 'index');
    node := host.json_array_get(nodes, index);
    start := 0;
    edgeIndex := 0;
    while edgeIndex < host.json_array_count(edges) do
    begin
      edge := host.json_array_get(edges, edgeIndex);
      if host.json_integer(edge, 'to') = index then
      begin
        other := host.json_array_get(nodes, host.json_integer(edge, 'from'));
        candidate := host.json_integer(other, 'earliestFinish');
        if candidate > start then start := candidate
      end;
      edgeIndex := edgeIndex + 1
    end;
    duration := host.json_integer(node, 'duration');
    if start > 2147483647 - duration then host.raise_error('CPM schedule duration overflow');
    finish := start + duration;
    node := host.json_set(host.json_set(node, 'earliestStart', start), 'earliestFinish', finish);
    nodes := host.json_array_set(nodes, index, node);
    if finish > projectFinish then projectFinish := finish;
    position := position + 1
  end;
  position := host.json_array_count(order) - 1;
  while position >= 0 do
  begin
    index := host.json_integer(host.json_array_get(order, position), 'index');
    node := host.json_array_get(nodes, index);
    latest := projectFinish;
    freeFloat := projectFinish - host.json_integer(node, 'earliestFinish');
    edgeIndex := 0;
    while edgeIndex < host.json_array_count(edges) do
    begin
      edge := host.json_array_get(edges, edgeIndex);
      if host.json_integer(edge, 'from') = index then
      begin
        other := host.json_array_get(nodes, host.json_integer(edge, 'to'));
        candidate := host.json_integer(other, 'latestStart');
        if candidate < latest then latest := candidate;
        candidate := host.json_integer(other, 'earliestStart') - host.json_integer(node, 'earliestFinish');
        if candidate < freeFloat then freeFloat := candidate
      end;
      edgeIndex := edgeIndex + 1
    end;
    start := latest - host.json_integer(node, 'duration');
    node := host.json_set(host.json_set(node, 'latestStart', start), 'latestFinish', latest);
    node := host.json_set(node, 'totalFloat', start - host.json_integer(node, 'earliestStart'));
    node := host.json_set(node, 'freeFloat', freeFloat);
    nodes := host.json_array_set(nodes, index, node);
    position := position - 1
  end;
  criticalNodes := '[]';
  criticalEdges := '[]';
  pathNode := -1;
  index := 0;
  while index < host.json_array_count(nodes) do
  begin
    node := host.json_array_get(nodes, index);
    if host.json_integer(node, 'totalFloat') = 0 then
    begin
      criticalNodes := host.json_array_append(criticalNodes, host.json_value(node, 'id'));
      if (pathNode = -1) and (host.json_integer(node, 'earliestFinish') = projectFinish) then
      begin
        candidate := 0;
        edgeIndex := 0;
        while edgeIndex < host.json_array_count(edges) do
        begin
          if host.json_integer(host.json_array_get(edges, edgeIndex), 'from') = index then candidate := 1;
          edgeIndex := edgeIndex + 1
        end;
        if candidate = 0 then pathNode := index
      end
    end;
    index := index + 1
  end;
  edgeIndex := 0;
  while edgeIndex < host.json_array_count(edges) do
  begin
    edge := host.json_array_get(edges, edgeIndex);
    fromIndex := host.json_integer(edge, 'from');
    toIndex := host.json_integer(edge, 'to');
    node := host.json_array_get(nodes, fromIndex);
    other := host.json_array_get(nodes, toIndex);
    if (host.json_integer(node, 'totalFloat') = 0) and
       (host.json_integer(other, 'totalFloat') = 0) and
       (host.json_integer(node, 'earliestFinish') = host.json_integer(other, 'earliestStart')) then
      criticalEdges := host.json_array_append(criticalEdges,
        host.json_set(host.json_set('{}', 'from', host.json_text(node, 'id')), 'to', host.json_text(other, 'id')));
    edgeIndex := edgeIndex + 1
  end;
  reversePath := '[]';
  while pathNode >= 0 do
  begin
    node := host.json_array_get(nodes, pathNode);
    reversePath := host.json_array_append(reversePath, host.json_value(node, 'id'));
    previous := -1;
    edgeIndex := 0;
    while edgeIndex < host.json_array_count(edges) do
    begin
      edge := host.json_array_get(edges, edgeIndex);
      if (previous = -1) and (host.json_integer(edge, 'to') = pathNode) then
      begin
        candidate := host.json_integer(edge, 'from');
        other := host.json_array_get(nodes, candidate);
        if (host.json_integer(other, 'totalFloat') = 0) and
           (host.json_integer(other, 'earliestFinish') = host.json_integer(node, 'earliestStart')) then previous := candidate
      end;
      edgeIndex := edgeIndex + 1
    end;
    pathNode := previous
  end;
  path := '[]';
  position := host.json_array_count(reversePath) - 1;
  while position >= 0 do
  begin
    path := host.json_array_append(path, host.json_array_get(reversePath, position));
    position := position - 1
  end;
  groups := host.json_value(graph, 'subnetworks');
  index := 0;
  while index < host.json_array_count(groups) do
  begin
    group := host.json_array_get(groups, index);
    entryIndex := CPM_NodeIndex(graph, host.json_text(group, 'entry'));
    exitIndex := CPM_NodeIndex(graph, host.json_text(group, 'exit'));
    start := host.json_integer(host.json_array_get(nodes, entryIndex), 'earliestStart');
    finish := host.json_integer(host.json_array_get(nodes, exitIndex), 'earliestFinish');
    group := host.json_set(host.json_set(group, 'earliestStart', start), 'earliestFinish', finish);
    group := host.json_set(group, 'elapsedDuration', finish - start);
    groups := host.json_array_set(groups, index, group);
    index := index + 1
  end;
  graph := host.json_embed(host.json_embed(graph, 'nodes', nodes), 'subnetworks', groups);
  graph := host.json_embed(graph, 'topologicalOrder', CPM_OrderIds(graph, order));
  graph := host.json_embed(host.json_embed(graph, 'criticalNodes', criticalNodes), 'criticalEdges', criticalEdges);
  graph := host.json_embed(graph, 'criticalPath', path);
  return host.json_set(graph, 'duration', projectFinish)
end;

class CPMNetwork<T>;
  graph: string;
  payloads: array [0..31] of T;

  procedure initialize(rootId: string);
  begin
    self.graph := CPM_AddGroup('{"nodes":[],"edges":[],"subnetworks":[]}', rootId, '')
  end;

  procedure addSubnetwork(id: string; parentId: string);
  begin
    self.graph := CPM_AddGroup(self.graph, id, parentId)
  end;

  function entry(network: string): string;
  begin return host.json_text(CPM_Group(self.graph, network), 'entry') end;

  function exit(network: string): string;
  begin return host.json_text(CPM_Group(self.graph, network), 'exit') end;

  procedure addNode(id: string; duration: integer; payload: T; network: string);
  var nextGraph: string; group: string; index: integer;
  begin
    CPM_CheckId(id);
    group := CPM_Group(self.graph, network);
    nextGraph := CPM_AppendNode(self.graph, id, duration, network, 'activity');
    nextGraph := CPM_Link(nextGraph, host.json_text(group, 'entry'), id);
    nextGraph := CPM_Link(nextGraph, id, host.json_text(group, 'exit'));
    index := CPM_NodeIndex(nextGraph, id);
    self.payloads[index] := payload;
    self.graph := nextGraph
  end;

  function payload(id: string): T;
  var index: integer; node: string;
  begin
    index := CPM_NodeIndex(self.graph, id);
    node := host.json_array_get(host.json_value(self.graph, 'nodes'), index);
    if host.json_text(node, 'kind') <> 'activity' then host.raise_error('CPM milestone has no application payload');
    return self.payloads[index]
  end;

  function node(id: string): CPMNode<T>;
  var index: integer; metadata: string; item: CPMNode<T>;
  begin
    index := CPM_NodeIndex(self.graph, id);
    metadata := host.json_array_get(host.json_value(self.graph, 'nodes'), index);
    if host.json_text(metadata, 'kind') <> 'activity' then host.raise_error('CPM milestone has no application payload');
    item.id := host.json_text(metadata, 'id');
    item.duration := host.json_integer(metadata, 'duration');
    item.network := host.json_text(metadata, 'network');
    item.payload := self.payloads[index];
    return item
  end;

  procedure setPayload(id: string; value: T);
  var index: integer; node: string;
  begin
    index := CPM_NodeIndex(self.graph, id);
    node := host.json_array_get(host.json_value(self.graph, 'nodes'), index);
    if host.json_text(node, 'kind') <> 'activity' then host.raise_error('CPM milestone has no application payload');
    self.payloads[index] := value
  end;

  procedure addDependency(predecessor: string; successor: string);
  begin self.graph := CPM_Link(self.graph, predecessor, successor) end;

  function topologicalSort(): string;
  begin
    if self.graph = '' then host.raise_error('CPM network must be initialized');
    return CPM_OrderIds(self.graph, CPM_Order(self.graph))
  end;

  function schedule(): string;
  begin
    if self.graph = '' then host.raise_error('CPM network must be initialized');
    return CPM_Schedule(self.graph)
  end;
end;

begin
end.
