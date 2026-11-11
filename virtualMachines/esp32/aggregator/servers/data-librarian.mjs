const COLLECTIONS = Object.freeze([
  ['files', '/api/librarian/files', 'file'],
  ['schemas', '/api/librarian/schemas', 'schema'],
  ['subschemas', '/api/librarian/subschemas', 'subschema'],
  ['dataTypes', '/api/librarian/data-types', 'data-type'],
  ['mapperRulesets', '/api/librarian/mapper-rulesets', 'mapper-ruleset'],
]);

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function collection(payload, name) {
  const value = record(payload)[name];
  if (!Array.isArray(value)) {
    throw new Error(`Data Librarian response does not contain an array named '${name}'.`);
  }
  return value;
}

function objectId(value, fallback) {
  const item = record(value);
  return String(item.id ?? item.path ?? item.name ?? item.file ?? fallback).trim();
}

export class DataLibrarian {
  constructor({ baseUrl = 'http://127.0.0.1:4300', fetchImpl = fetch, timeoutMs = 15000 } = {}) {
    this.baseUrl = String(baseUrl).trim().replace(/\/+$/, '');
    if (!this.baseUrl) throw new Error('Data Librarian baseUrl is required.');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = record(payload).error || `HTTP ${response.status}`;
      throw new Error(`Data Librarian request failed for ${path}: ${detail}`);
    }
    return payload;
  }

  async listObjects() {
    const results = await Promise.all(COLLECTIONS.map(async ([name, path, kind]) => {
      const payload = await this.request(path);
      return collection(payload, name).map((value, index) => ({
        id: objectId(value, `${kind}:${index}`),
        kind,
        name: String(record(value).name ?? record(value).label ?? objectId(value, `${kind}:${index}`)),
        value,
      }));
    }));
    return results.flat().sort((left, right) =>
      left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  }

  async displayModel() {
    const objects = await this.listObjects();
    const groups = new Map();
    for (const object of objects) {
      const entries = groups.get(object.kind) || [];
      entries.push(object);
      groups.set(object.kind, entries);
    }
    return {
      name: 'Data Librarian',
      objectCount: objects.length,
      groups: [...groups.entries()].map(([kind, entries]) => ({
        kind,
        count: entries.length,
        objects: entries,
      })),
    };
  }

  async getObject(kind, id) {
    const object = (await this.listObjects()).find(entry => entry.kind === kind && entry.id === id);
    if (!object) throw new Error(`Data Librarian object '${kind}:${id}' was not found.`);
    return object;
  }
}

export default DataLibrarian;
