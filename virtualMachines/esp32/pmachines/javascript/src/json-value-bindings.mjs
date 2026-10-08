export function createJsonValueBindings({ maxHandles = 8, maxNodes = 100000 } = {}) {
  if (!Number.isInteger(maxHandles) || maxHandles < 1 || maxHandles > 8
    || !Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 100000) {
    throw new Error('Invalid JSON value limits');
  }
  const handles = new Map();
  const failure = message => Object.assign(new Error(message), { status: 400 });
  const node = (handle, index) => {
    const entries = handles.get(handle);
    if (!entries || !Number.isInteger(index) || index < 0 || index >= entries.length) {
      throw failure('Invalid JSON value handle or node');
    }
    return entries[index];
  };
  const child = (handle, index, key) => {
    const entry = node(handle, index);
    if (entry.value === null || typeof entry.value !== 'object') throw failure('Expected JSON object or array node');
    if (!Object.hasOwn(entry.value, key)) return -1;
    if (!entry.children.has(key)) {
      const entries = handles.get(handle);
      if (entries.length >= maxNodes) throw failure('JSON value node capacity exceeded');
      entry.children.set(key, entries.length);
      entries.push({ value: entry.value[key], children: new Map() });
    }
    return entry.children.get(key);
  };
  return {
    'host.json_parse_value': raw => {
      if (handles.size >= maxHandles) throw failure('JSON value handle capacity exceeded');
      if (typeof raw !== 'string') throw failure('Expected serialized JSON text');
      let value;
      try { value = JSON.parse(raw); } catch { throw failure('Invalid JSON value'); }
      const handle = handles.size + 1;
      handles.set(handle, [{ value, children: new Map() }]);
      return handle;
    },
    'host.json_node_kind': (handle, index) => {
      const { value } = node(handle, index);
      return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    },
    'host.json_node_member': (handle, index, key) => {
      if (typeof key !== 'string') throw failure('Expected JSON member name');
      return child(handle, index, key);
    },
    'host.json_node_count': (handle, index) => {
      const { value } = node(handle, index);
      if (!Array.isArray(value)) throw failure('Expected JSON array node');
      return value.length;
    },
    'host.json_node_key': (handle, index, position) => {
      const { value } = node(handle, index);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw failure('Expected JSON object node');
      }
      const keys = Object.keys(value);
      if (!Number.isInteger(position) || position < 0 || position >= keys.length) {
        throw failure('JSON object key index out of bounds');
      }
      return keys[position];
    },
    'host.json_node_object_count': (handle, index) => {
      const { value } = node(handle, index);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw failure('Expected JSON object node');
      }
      return Object.keys(value).length;
    },
    'host.json_node_item': (handle, index, position) => {
      const { value } = node(handle, index);
      if (!Array.isArray(value)) throw failure('Expected JSON array node');
      if (!Number.isInteger(position) || position < 0 || position >= value.length) throw failure('JSON value index out of bounds');
      return child(handle, index, String(position));
    },
    'host.json_node_value': (handle, index) => JSON.stringify(node(handle, index).value)
  };
}
