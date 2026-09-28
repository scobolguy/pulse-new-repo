function clean(value, label) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`GenericSystem ${label} is required`);
  return result;
}

function normalizePort(port) {
  const direction = String(port?.direction || '').trim().toLowerCase();
  if (!['input', 'output'].includes(direction)) {
    throw new Error(`GenericSystem port '${port?.symbol || ''}' direction must be input or output`);
  }
  return {
    symbol: clean(port?.symbol, 'port symbol'),
    direction,
    dataTypeId: clean(port?.dataTypeId || port?.typeName, 'port dataTypeId')
  };
}

function normalizeConnection(connection) {
  return {
    symbol: clean(connection?.symbol, 'connection symbol'),
    source: clean(connection?.source, 'connection source'),
    target: clean(connection?.target, 'connection target'),
    dataTypeId: clean(connection?.dataTypeId || connection?.typeName, 'connection dataTypeId')
  };
}

function normalizeNode(value, ancestors, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GenericSystem must be an object');
  }
  if (ancestors.has(value)) throw new Error(`GenericSystem containment cycle at '${path.join('.') || 'root'}'`);

  const systemId = clean(value.systemId || value.id || value.name, 'systemId');
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  const nextPath = [...path, systemId];
  const ports = (Array.isArray(value.ports) ? value.ports : []).map(normalizePort);
  const systems = (Array.isArray(value.systems) ? value.systems : []).map(child => normalizeNode(child, nextAncestors, nextPath));
  const connections = (Array.isArray(value.connections) ? value.connections : []).map(normalizeConnection);

  const unique = (items, key, label) => {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item[key])) throw new Error(`Duplicate GenericSystem ${label} '${item[key]}' in '${nextPath.join('.')}'`);
      seen.add(item[key]);
    }
  };
  unique(ports, 'symbol', 'port');
  unique(systems, 'systemId', 'child');
  unique(connections, 'symbol', 'connection');

  return {
    kind: 'generic-system',
    systemId,
    name: String(value.name || systemId).trim() || systemId,
    systemPath: nextPath,
    ports,
    systems,
    connections
  };
}

function indexPorts(system, index = new Map()) {
  for (const port of system.ports) index.set(`${system.systemPath.join('.')}.${port.symbol}`, port);
  for (const child of system.systems) indexPorts(child, index);
  return index;
}

function resolveEndpoint(owner, endpoint, ports) {
  const raw = clean(endpoint, 'endpoint');
  const absolute = raw.startsWith(`${owner.systemPath[0]}.`)
    ? raw
    : `${owner.systemPath.join('.')}.${raw}`;
  const port = ports.get(absolute);
  if (!port) throw new Error(`GenericSystem endpoint '${raw}' does not exist in '${owner.systemPath.join('.')}'`);
  return { absolute, port };
}

function validateConnections(system, ports) {
  const childIds = new Set(system.systems.map(child => child.systemId));
  const adjacency = new Map([...childIds].map(childId => [childId, new Set()]));
  for (const connection of system.connections) {
    const source = resolveEndpoint(system, connection.source, ports);
    const target = resolveEndpoint(system, connection.target, ports);
    if (source.port.direction !== 'output') throw new Error(`GenericSystem connection '${connection.symbol}' source must be an output port`);
    if (target.port.direction !== 'input') throw new Error(`GenericSystem connection '${connection.symbol}' target must be an input port`);
    if (source.port.dataTypeId !== connection.dataTypeId || target.port.dataTypeId !== connection.dataTypeId) {
      throw new Error(`GenericSystem connection '${connection.symbol}' type '${connection.dataTypeId}' does not match its endpoints`);
    }
    connection.sourcePath = source.absolute;
    connection.targetPath = target.absolute;
    const sourceChild = connection.source.split('.')[0];
    const targetChild = connection.target.split('.')[0];
    if (childIds.has(sourceChild) && childIds.has(targetChild) && sourceChild !== targetChild) {
      adjacency.get(sourceChild).add(targetChild);
      adjacency.get(targetChild).add(sourceChild);
    }
  }
  if (childIds.size > 1) {
    const visited = new Set();
    const pending = [[...childIds][0]];
    while (pending.length > 0) {
      const childId = pending.pop();
      if (visited.has(childId)) continue;
      visited.add(childId);
      pending.push(...adjacency.get(childId));
    }
    if (visited.size !== childIds.size) {
      const disconnected = [...childIds].filter(childId => !visited.has(childId));
      throw new Error(`GenericSystem '${system.systemPath.join('.')}' has disconnected children: ${disconnected.join(', ')}`);
    }
  }
  for (const child of system.systems) validateConnections(child, ports);
}

export function buildGenericSystem(value) {
  const system = normalizeNode(value, new Set(), []);
  validateConnections(system, indexPorts(system));
  return system;
}

export function flattenGenericSystems(system) {
  return [system, ...system.systems.flatMap(flattenGenericSystems)];
}

export function flattenGenericSystemConnections(system) {
  return [...system.connections, ...system.systems.flatMap(flattenGenericSystemConnections)];
}
