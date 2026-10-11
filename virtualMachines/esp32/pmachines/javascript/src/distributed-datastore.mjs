import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export function datastoreError(message, status = 400, code = 'InvalidData') {
  return Object.assign(new Error(message), { status, code });
}

export function tableSchema(definition) {
  const { name, fields } = definition;
  if (typeof name !== 'string' || !/^[a-z][a-z0-9_.:-]{0,127}$/.test(name) ||
      !Array.isArray(fields) || fields.length < 1 || fields.length > 32 ||
      fields.some(field => !field || typeof field.name !== 'string' || !field.name ||
        field.name.length > 256 || !['integer', 'string', 'boolean'].includes(field.type)) ||
      new Set(fields.map(field => field.name)).size !== fields.length) {
    throw datastoreError('Invalid distributed table schema');
  }
  const sorted = fields.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name));
  return { name, fields: sorted, schemaId: createHash('sha256').update(JSON.stringify(sorted)).digest('hex') };
}

export function validateTableKey(key) {
  if (typeof key !== 'string' || !key.trim() || Buffer.byteLength(key) > 256) throw datastoreError('Invalid table key');
}

export function validateTableValue(fields, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== fields.length || fields.some(field => {
        const item = value[field.name];
        return !Object.hasOwn(value, field.name) || (field.type === 'string' ? typeof item !== 'string' :
          field.type === 'boolean' ? item !== 0 && item !== 1 :
            !Number.isInteger(item) || item < -2147483648 || item > 2147483647);
      }) || Buffer.byteLength(JSON.stringify(value)) > 2048) throw datastoreError('Invalid distributed table value');
}

// The lock is deliberately not stolen after a crash: an operator must first verify
// that no authority is running before removing a stale, explicitly named lock file.
export async function createFileDatastoreAdapter(file, { maxBytes = 2 * 1024 * 1024 } = {}) {
  if (!path.isAbsolute(file)) throw datastoreError('Datastore file must be absolute');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const lock = await fs.open(`${file}.lock`, 'wx');
  let closed = false;
  return {
    async load() {
      try {
        const stat = await fs.stat(file);
        if (stat.size > maxBytes) throw datastoreError('Datastore file exceeds capacity', 507, 'CapacityExceeded');
        return JSON.parse(await fs.readFile(file, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async commit(state) {
      if (closed) throw datastoreError('Datastore adapter closed', 503, 'Unavailable');
      const json = JSON.stringify(state);
      if (Buffer.byteLength(json) > maxBytes) throw datastoreError('Datastore capacity exceeded', 507, 'CapacityExceeded');
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        const handle = await fs.open(temporary, 'wx');
        try { await handle.writeFile(json); await handle.sync(); } finally { await handle.close(); }
        await fs.rename(temporary, file);
      } finally {
        await fs.rm(temporary, { force: true });
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      await lock.close();
      await fs.unlink(`${file}.lock`);
    }
  };
}

export async function createDistributedTableAuthority({
  adapter, tables, ttlMs = 60000, maxKeys = 256, maxReplicas = 32, clock = Date.now
}) {
  if (!adapter || !['load', 'commit', 'close'].every(method => typeof adapter[method] === 'function') ||
      !Array.isArray(tables) || tables.length < 1 || tables.length > 16 ||
      !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 180000 ||
      !Number.isSafeInteger(maxKeys) || maxKeys < 1 || maxKeys > 1000 ||
      !Number.isSafeInteger(maxReplicas) || maxReplicas < 1 || maxReplicas > 64) {
    throw datastoreError('Invalid datastore authority configuration');
  }
  const schemas = tables.map(tableSchema);
  if (new Set(schemas.map(schema => schema.name)).size !== schemas.length) throw datastoreError('Duplicate table');
  let state;
  try {
    state = await adapter.load();
    if (!state) {
      state = { version: 1, generation: randomUUID(), tables: schemas.map(schema =>
        ({ ...schema, revision: 0, entries: [], replicas: [] })) };
      await adapter.commit(state);
    }
    if (state.version !== 1 || typeof state.generation !== 'string' || !state.generation ||
        !Array.isArray(state.tables) || state.tables.length !== schemas.length) throw datastoreError('Invalid stored authority state');
    for (const schema of schemas) {
      const table = state.tables.find(table => table.name === schema.name);
      if (!table || table.schemaId !== schema.schemaId || JSON.stringify(table.fields) !== JSON.stringify(schema.fields) ||
          !Number.isSafeInteger(table.revision) || table.revision < 0 ||
          !Array.isArray(table.entries) || table.entries.length > maxKeys ||
          !Array.isArray(table.replicas) || table.replicas.length > maxReplicas ||
          new Set(table.entries.map(entry => entry.key)).size !== table.entries.length ||
          new Set(table.replicas.map(replica => replica.id)).size !== table.replicas.length) throw datastoreError('Stored table schema/state mismatch');
      for (const entry of table.entries) {
        validateTableKey(entry.key);
        if (!Number.isSafeInteger(entry.version) || entry.version < 1 || entry.version > table.revision ||
            !Number.isSafeInteger(entry.delivery) || entry.delivery < entry.version || entry.delivery > table.revision ||
            !Number.isSafeInteger(entry.expiresAt) || entry.expiresAt < 0 ||
            typeof entry.deleted !== 'boolean' || (entry.deleted && entry.value !== null)) throw datastoreError('Invalid stored table revision');
        if (!entry.deleted) validateTableValue(table.fields, entry.value);
      }
      for (const replica of table.replicas) {
        if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(replica.id) ||
            !Number.isSafeInteger(replica.ack) || replica.ack < 0 || replica.ack > table.revision) throw datastoreError('Invalid stored replica acknowledgment');
      }
    }
  } catch (error) {
    await adapter.close();
    throw error;
  }
  let tail = Promise.resolve(), closed = false;
  function serialize(fn) {
    const work = tail.then(async () => {
      if (closed) throw datastoreError('Authority closed', 503, 'Unavailable');
      return fn();
    });
    tail = work.then(() => {}, () => {});
    return work;
  }
  function find(data, name, schemaId) {
    const table = data.tables.find(table => table.name === name);
    if (!table || table.schemaId !== schemaId) throw datastoreError('Table schema mismatch', 409, 'SchemaMismatch');
    return table;
  }
  function envelope(data, table, entry, time) {
    return { table: table.name, schemaId: table.schemaId, generation: data.generation,
      ...entry, remainingTTLms: Math.max(0, Math.min(ttlMs, entry.expiresAt - time)) };
  }
  function advance(table) {
    if (table.revision >= Number.MAX_SAFE_INTEGER) throw datastoreError('Revision exhausted', 507, 'CapacityExceeded');
    return ++table.revision;
  }
  async function commit(next) { await adapter.commit(next); state = next; }
  return {
    read(name, schemaId, key) {
      validateTableKey(key);
      return serialize(async () => {
        const next = structuredClone(state), table = find(next, name, schemaId);
        const entry = table.entries.find(entry => entry.key === key && !entry.deleted);
        if (!entry) throw datastoreError('Table key not found', 404, 'KeyNotFound');
        entry.delivery = advance(table);
        entry.expiresAt = clock() + ttlMs;
        await commit(next);
        return envelope(next, table, entry, clock());
      });
    },
    write(name, schemaId, key, value, deleted = false) {
      validateTableKey(key);
      return serialize(async () => {
        const next = structuredClone(state), table = find(next, name, schemaId);
        if (!deleted) validateTableValue(table.fields, value);
        const index = table.entries.findIndex(entry => entry.key === key);
        const existed = index >= 0 && !table.entries[index].deleted;
        if (index < 0 && table.entries.length >= maxKeys) throw datastoreError('Table/version guard capacity exceeded', 507, 'CapacityExceeded');
        const revision = advance(table), time = clock();
        const entry = { key, value: deleted ? null : structuredClone(value), deleted,
          version: revision, delivery: revision, expiresAt: time + ttlMs };
        if (index < 0) table.entries.push(entry); else table.entries[index] = entry;
        await commit(next);
        return { ...envelope(next, table, entry, clock()), existed };
      });
    },
    synchronize(name, schemaId, replicaId, generation = '', ack = 0) {
      if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(replicaId) || !Number.isSafeInteger(ack) || ack < 0) {
        throw datastoreError('Invalid replica acknowledgment');
      }
      return serialize(async () => {
        const next = structuredClone(state), table = find(next, name, schemaId);
        if (generation === next.generation && ack > table.revision) throw datastoreError('Replica revision ahead of authority', 409);
        let replica = table.replicas.find(replica => replica.id === replicaId);
        if (!replica) {
          if (table.replicas.length >= maxReplicas) throw datastoreError('Replica capacity exceeded', 507, 'CapacityExceeded');
          replica = { id: replicaId, ack: 0 };
          table.replicas.push(replica);
        }
        const acknowledged = generation === next.generation ? Math.max(replica.ack, ack) : 0;
        if (replica.ack !== acknowledged || !state.tables.find(item => item.name === name).replicas.some(item => item.id === replicaId)) {
          replica.ack = acknowledged;
          await commit(next);
        }
        const time = clock();
        return { table: name, schemaId, generation: next.generation, revision: table.revision,
          records: table.entries.map(entry => envelope(next, table, entry, time)) };
      });
    },
    status() {
      return { generation: state.generation, tables: state.tables.map(table => ({
        name: table.name, revision: table.revision, liveKeys: table.entries.filter(entry => !entry.deleted).length,
        replicas: table.replicas.map(replica => ({ ...replica, lag: table.revision - replica.ack }))
      })) };
    },
    async close() { await tail; closed = true; await adapter.close(); }
  };
}

export async function serveDistributedTableAuthority(authority, { port = 0, token, host = '127.0.0.1' } = {}) {
  if (host !== '127.0.0.1' || typeof token !== 'string' || token.length < 32) throw datastoreError('Authority requires loopback binding and a deployment token');
  const expected = Buffer.from(token);
  const server = http.createServer(async (req, res) => {
    try {
      const supplied = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw datastoreError('Unauthorized', 401, 'Unauthorized');
      if (req.method === 'GET' && req.url === '/status') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(authority.status()));
        return;
      }
      if (req.method !== 'POST' || req.url !== '/table') throw datastoreError('Route not found', 404);
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 8192) throw datastoreError('Request too large', 413);
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw datastoreError('Invalid JSON'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw datastoreError('Invalid request');
      let result;
      const { table, schemaId, key } = body;
      if (body.operation === 'get') result = await authority.read(table, schemaId, key);
      else if (body.operation === 'put' || body.operation === 'remove') {
        result = await authority.write(table, schemaId, key, body.value, body.operation === 'remove');
      } else if (body.operation === 'sync') result = await authority.synchronize(table, schemaId, body.replicaId, body.generation, body.ack);
      else throw datastoreError('Unknown table operation');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(error.status || 500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error.message, code: error.code || 'DatastoreFailure' }));
    }
  });
  server.requestTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return { origin: `http://${host}:${server.address().port}`,
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
