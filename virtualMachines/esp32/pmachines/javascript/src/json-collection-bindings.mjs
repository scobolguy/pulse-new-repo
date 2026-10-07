function failure(message) { return Object.assign(new Error(message), { status: 400 }); }

function parse(value) {
  if (typeof value !== 'string') throw failure('Expected serialized JSON text');
  try { return JSON.parse(value); }
  catch { throw failure('Invalid JSON collection value'); }
}

function array(value) {
  const parsed = parse(value);
  if (!Array.isArray(parsed)) throw failure('Expected a JSON array');
  return parsed;
}

function indexOf(value, entries) {
  if (!Number.isInteger(value) || value < 0 || value >= entries.length) throw failure('JSON array index out of bounds');
  return value;
}

export function createJsonCollectionBindings() {
  return {
    'host.json_kind': value => {
      const parsed = parse(value);
      return parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed;
    },
    'host.json_to_text': value => String(parse(value)),
    'host.json_remove': (value, key) => {
      const parsed = parse(value);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || typeof key !== 'string') {
        throw failure('Expected JSON object and member name');
      }
      delete parsed[key];
      return JSON.stringify(parsed);
    },
    'host.json_object': value => {
      const parsed = parse(value);
      if (parsed === null || typeof parsed !== 'object') throw failure('Expected a JSON object or array');
      return JSON.stringify({ ...parsed });
    },
    'host.json_array_count': value => array(value).length,
    'host.json_array_get': (value, index) => {
      const entries = array(value);
      return JSON.stringify(entries[indexOf(index, entries)]);
    },
    'host.json_array_append': (value, item) => {
      const entries = array(value);
      entries.push(parse(item));
      return JSON.stringify(entries);
    },
    'host.json_array_set': (value, index, item) => {
      const entries = array(value);
      entries[indexOf(index, entries)] = parse(item);
      return JSON.stringify(entries);
    },
    'host.json_array_remove': (value, index) => {
      const entries = array(value);
      entries.splice(indexOf(index, entries), 1);
      return JSON.stringify(entries);
    },
    'host.json_format': (value, indent) => {
      if (!Number.isInteger(indent) || indent < 0 || indent > 10) throw failure('Invalid JSON indentation');
      return JSON.stringify(parse(value), null, indent);
    }
  };
}
