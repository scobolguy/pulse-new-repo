import { performance } from 'node:perf_hooks';
import { createHostCacheStore } from './host-cache.mjs';
import { datastoreError, tableSchema, validateTableKey, validateTableValue } from './distributed-datastore.mjs';

export async function createReplicatedCache({
  definition, binding, fetchImpl = fetch, clock = () => Math.floor(performance.now()),
  pollMs = 1000, maxKeys = 256, maxStorageBytes = 16384, logger = console
}) {
  const schema = tableSchema({ name: definition.backingTable, fields: definition.fields });
  const origin = new URL(binding?.origin);
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' ||
      origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      typeof binding.token !== 'string' || binding.token.length < 32 ||
      !/^[a-zA-Z0-9_.:-]{1,128}$/.test(binding.replicaId) ||
      !Number.isSafeInteger(pollMs) || pollMs < 20 || pollMs > 60000 ||
      !Number.isSafeInteger(maxKeys) || maxKeys < 1 || maxKeys > 1000) {
    throw datastoreError('Invalid replicated-cache deployment binding');
  }
  const store = createHostCacheStore([{ ...definition, capacity: 50 }], { clock, maxStorageBytes });
  const name = definition.name, guards = new Map(), pending = new Map(), retired = new Set();
  let generation = '', revision = 0, lastSync = null, lastError = '', stopped = false, syncing = null;
  const abort = new AbortController();
  async function request(operation, values = {}) {
    if (stopped) throw datastoreError('Replica stopped', 503, 'Unavailable');
    const started = clock();
    const response = await fetchImpl(new URL('/table', origin), {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${binding.token}` },
      body: JSON.stringify({ operation, table: schema.name, schemaId: schema.schemaId, ...values }),
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]), redirect: 'error'
    });
    const chunks = [];
    let bytes = 0;
    if (!response.body) throw datastoreError('Missing datastore response body', 502);
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) throw datastoreError('Datastore response exceeds capacity', 502);
      chunks.push(Buffer.from(chunk));
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw datastoreError('Invalid datastore JSON', 502); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw datastoreError('Invalid datastore response', 502);
    if (!response.ok) throw datastoreError(body.error || `Datastore HTTP ${response.status}`, response.status, body.code || 'DatastoreFailure');
    return { body, elapsed: Math.max(0, clock() - started) };
  }
  function check(envelope) {
    if (!envelope || envelope.table !== schema.name || envelope.schemaId !== schema.schemaId ||
        typeof envelope.generation !== 'string' || !envelope.generation || envelope.generation.length > 128 ||
        !Number.isSafeInteger(envelope.version) || envelope.version < 1 ||
        !Number.isSafeInteger(envelope.delivery) || envelope.delivery < envelope.version ||
        !Number.isSafeInteger(envelope.remainingTTLms) || envelope.remainingTTLms < 0 || envelope.remainingTTLms > 180000 ||
        typeof envelope.deleted !== 'boolean' || (envelope.deleted && envelope.value !== null)) {
      throw datastoreError('Invalid replication envelope', 502, 'SchemaMismatch');
    }
    validateTableKey(envelope.key);
    if (!envelope.deleted) validateTableValue(schema.fields, envelope.value);
  }
  function changeGeneration(next) {
    if (generation === next) return;
    if (retired.has(next)) throw datastoreError('Retired datastore generation replay', 409);
    if (generation) {
      if (retired.size >= 8) throw datastoreError('Generation guard capacity exceeded; restart replica', 507);
      retired.add(generation);
    }
    generation = next;
    revision = 0;
    guards.clear();
    store.clear();
  }
  function apply(envelope, elapsed) {
    check(envelope);
    if (envelope.generation !== generation) throw datastoreError('Replica needs generation resynchronization', 409);
    const previous = guards.get(envelope.key);
    if (previous && (envelope.version < previous.version || envelope.delivery <= previous.delivery)) return;
    if (!previous && guards.size >= maxKeys) throw datastoreError('Replica version guard capacity exceeded', 507);
    const remaining = Math.max(0, envelope.remainingTTLms - elapsed);
    if (envelope.deleted || remaining === 0) store.remove(name, envelope.key);
    else store.put(name, envelope.key, JSON.stringify(envelope.value), remaining);
    guards.set(envelope.key, { version: envelope.version, delivery: envelope.delivery, deleted: envelope.deleted });
  }
  function local(key) {
    try { return store.get(name, key); }
    catch (error) {
      if (error.message === 'Cache key missing or expired') return undefined;
      throw error;
    }
  }
  function synchronize() {
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        const { body, elapsed } = await request('sync', { replicaId: binding.replicaId, generation, ack: revision });
        if (body.table !== schema.name || body.schemaId !== schema.schemaId ||
            typeof body.generation !== 'string' || !body.generation ||
            !Number.isSafeInteger(body.revision) || body.revision < 0 ||
            !Array.isArray(body.records) || body.records.length > maxKeys ||
            new Set(body.records.map(record => record.key)).size !== body.records.length) {
          throw datastoreError('Invalid replication snapshot', 502);
        }
        for (const record of body.records) {
          check(record);
          if (record.generation !== body.generation || record.delivery > body.revision) throw datastoreError('Mixed replication snapshot', 502);
        }
        if (generation === body.generation && body.revision < revision) throw datastoreError('Stale replication snapshot', 409);
        const savedGeneration = generation, savedRevision = revision;
        const savedGuards = new Map(guards), savedRetired = new Set(retired);
        try {
          store.transaction(() => {
            changeGeneration(body.generation);
            for (const record of body.records) apply(record, elapsed);
          });
        } catch (error) {
          generation = savedGeneration;
          revision = savedRevision;
          guards.clear();
          for (const [key, guard] of savedGuards) guards.set(key, guard);
          retired.clear();
          for (const item of savedRetired) retired.add(item);
          throw error;
        }
        revision = body.revision;
        lastSync = clock();
        lastError = '';
      } catch (error) {
        lastError = error.message;
        throw error;
      } finally { syncing = null; }
    })();
    return syncing;
  }
  async function installReply(reply) {
    check(reply.body);
    const started = clock();
    if (reply.body.generation !== generation) await synchronize();
    apply(reply.body, reply.elapsed + Math.max(0, clock() - started));
  }
  // Fail installation explicitly if the backing table cannot be reached/schema-checked.
  await synchronize();
  const timer = setInterval(() => {
    synchronize().catch(error => logger.warn(`[REPLICA] ${binding.replicaId}: ${error.message}`));
  }, pollMs);
  timer.unref();
  return {
    async get(key) {
      validateTableKey(key);
      const value = local(key);
      if (value !== undefined) return value;
      if (pending.has(key)) return pending.get(key);
      const work = (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          await installReply(await request('get', { key }));
          const value = local(key);
          if (value !== undefined) return value;
          if (guards.get(key)?.deleted) throw datastoreError('Table key not found', 404, 'KeyNotFound');
        }
        throw datastoreError('Cache fill superseded or expired; retry read', 409, 'ReadConflict');
      })().finally(() => pending.delete(key));
      pending.set(key, work);
      return work;
    },
    async put(key, json) {
      validateTableKey(key);
      let value;
      try { value = JSON.parse(json); } catch { throw datastoreError('Invalid cache value JSON'); }
      validateTableValue(schema.fields, value);
      const reply = await request('put', { key, value });
      try { await installReply(reply); }
      catch (error) { throw datastoreError(`Table committed; local installation failed: ${error.message}`, 503, 'CommittedLocalFailure'); }
      return 1;
    },
    async remove(key) {
      validateTableKey(key);
      const reply = await request('remove', { key });
      try { await installReply(reply); }
      catch (error) { throw datastoreError(`Table deletion committed; local installation failed: ${error.message}`, 503, 'CommittedLocalFailure'); }
      return reply.body.existed ? 1 : 0;
    },
    async contains(key) {
      try { await this.get(key); return 1; }
      catch (error) { if (error.code === 'KeyNotFound') return 0; throw error; }
    },
    next(cursor) { return store.next(name, cursor); },
    count() { return store.count(name); },
    clearLocal() { store.clear(); return 1; },
    synchronize,
    status() { return { table: schema.name, replicaId: binding.replicaId, generation, revision,
      lastSync, lastError, synchronized: !lastError && lastSync !== null && clock() - lastSync < pollMs * 3,
      resident: store.count(name), pending: pending.size }; },
    async stop() {
      stopped = true;
      clearInterval(timer);
      abort.abort();
      await Promise.allSettled([syncing, ...pending.values()].filter(Boolean));
    }
  };
}
