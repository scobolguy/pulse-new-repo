import { createHash } from 'node:crypto';
import { executeCacheQuery } from '../../../../../languages/dotnet/cache-query.mjs';

// Storage interface: get/put/remove/next/count/clear. A future distributed adapter can
// implement this contract without changing language lowering or legacy tables.
// Reads accept an optional pinned time (the invocation start) so one invocation sees a
// consistent snapshot; reads never refresh TTL or eviction order.
export function createHostCacheStore(definitions = [], { clock, maxStorageBytes = 16384 } = {}) {
  if (!Array.isArray(definitions) || definitions.length > 16) throw new Error('Invalid hosted cache declarations');
  const caches = new Map();
  const virtuals = new Map();
  const validText = value => typeof value === 'string' && Buffer.byteLength(value) <= 256 && /[^\t\r\n ]/.test(value);
  for (const definition of definitions) {
    const { name, capacity, fields, virtual = false, sources, uniqueBy, latestBy,
      queryPlan, viewFields = fields, sourceDefinitions = [] } = definition;
    const fieldByName = new Map((fields || []).map(field => [field.name, field]));
    if (!validText(name) || name !== name.toLowerCase() || caches.has(name) || capacity !== 50
      || virtuals.has(name) || !Array.isArray(fields) || fields.length < 1 || fields.length > 32
      || fields.some(field => !validText(field.name) || !['integer', 'string', 'boolean'].includes(field.type))
      || new Set(fields.map(field => field.name)).size !== fields.length
      || (uniqueBy !== undefined && (!validText(uniqueBy) || !fieldByName.has(uniqueBy)))
      || (latestBy !== undefined && (!validText(latestBy)
        || !['integer', 'string'].includes(fieldByName.get(latestBy)?.type)))
      || (virtual && (uniqueBy !== undefined || latestBy !== undefined))
      || (queryPlan !== undefined && (queryPlan?.kind !== 'select' || !Array.isArray(viewFields)
        || viewFields.length < 1 || viewFields.length > 32))
      || (virtual && (!Array.isArray(sources) || sources.length < 1 || sources.length > 16
        || sources.some(source => typeof source !== 'string' || !validText(source))))) {
      throw new Error('Invalid hosted cache declaration');
    }
    if (virtual) virtuals.set(name, { fields, sources, sourceDefinitions, queryPlan });
    else caches.set(name, { fields, uniqueBy, latestBy, queryPlan, viewFields, entries: new Map() });
  }
  for (const [name, virtual] of virtuals) {
    const remoteQuery = virtual.queryPlan && virtual.sourceDefinitions.length === virtual.sources.length
      && virtual.sourceDefinitions.some(source => !source.local);
    if (virtual.sources.includes(name) || new Set(virtual.sources).size !== virtual.sources.length
      || virtual.sources.some(source => !remoteQuery
        && !caches.has(source) && !(virtual.queryPlan && virtuals.has(source)))
      || (virtual.queryPlan && (virtual.sourceDefinitions.length !== virtual.sources.length
        || virtual.sourceDefinitions.some(source => source.local
          ? !caches.has(source.cacheName) && !virtuals.has(source.cacheName)
          : typeof source.serviceId !== 'string' || typeof source.cacheName !== 'string')))) {
      throw new Error('Invalid virtual cache sources');
    }
    if (virtual.queryPlan && !virtual.sourceDefinitions.length) throw new Error('Missing virtual query source metadata');
    if (!virtual.queryPlan && virtual.sources.some(source =>
      JSON.stringify(caches.get(source)?.fields) !== JSON.stringify(virtual.fields))) {
      throw new Error('Virtual cache schema does not match its sources');
    }
  }
  let bytes = 0, order = 0, revision = 0, lastTime = -1;
  function now() {
    const time = clock();
    if (!Number.isSafeInteger(time) || time < lastTime || time < 0) throw new Error('Invalid cache monotonic clock');
    lastTime = time;
    return time;
  }
  function declared(name) {
    const cache = caches.get(name);
    if (cache) return cache;
    if (virtuals.has(name)) throw new Error('Virtual cache is read-only');
    throw new Error('Undeclared cache');
  }
  function virtual(name) {
    const definition = virtuals.get(name);
    if (!definition) return null;
    return definition;
  }
  function virtualEntries(name, time) {
    const definition = virtual(name);
    if (!definition) return null;
    return definition.sources.flatMap(source => [...caches.get(source).entries]
      .filter(([, entry]) => entry.deadline > time)
      .map(([key, entry]) => ({ key: `${source}:${key}`, json: entry.json,
        observedAt: entry.observedAt, order: entry.order, deadline: entry.deadline })))
      .sort((left, right) => Buffer.compare(Buffer.from(left.key), Buffer.from(right.key)));
  }
  function querySources(name, time) {
    const definition = virtual(name);
    if (!definition) {
      const cache = caches.get(name);
      return { [name]: [...cache.entries]
        .filter(([, entry]) => entry.deadline > time)
        .sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
        .map(([key, entry]) => ({
          row: JSON.parse(entry.json),
          metadata: { observationMs: entry.observedAt, observationSequence: entry.order,
            remainingTTLms: entry.deadline - time },
          key
        })) };
    }
    const sourceRows = {};
    for (const source of definition.sourceDefinitions) {
      if (!source.local) throw new Error(`Remote cache source '${source.serviceId}/${source.cacheName}' requires Aggregator resolution`);
      const cache = caches.get(source.cacheName);
      if (!cache) throw new Error(`Undeclared virtual cache source '${source.cacheName}'`);
      sourceRows[source.alias] = [...cache.entries]
        .filter(([, entry]) => entry.deadline > time)
        .sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
        .map(([key, entry]) => ({
          row: { cache_key: key, device_json: entry.json, observation_ms: entry.observedAt,
            observation_sequence: entry.order, remaining_ttl_ms: entry.deadline - time },
          metadata: { observationMs: entry.observedAt, observationSequence: entry.order,
            remainingTTLms: entry.deadline - time },
          key
        }));
    }
    return sourceRows;
  }
  function querySnapshot(name, definition, cursor, revisionFence, time,
    sourceRows = querySources(name, time), revisionValue = revision, completeness = null, pageSize = 2) {
    const revisionText = String(revisionValue);
    if (revisionFence && revisionFence !== revisionText) throw new Error('Snapshot revision changed');
    const results = executeCacheQuery(definition.queryPlan, sourceRows);
    const fields = definition.viewFields || definition.fields;
    const rows = results.map(({ row, metadata }, index) => {
      if (Object.keys(row).length !== fields.length || fields.some(field => {
        const value = row[field.name];
        return !(field.type === 'string' ? typeof value === 'string'
          : field.type === 'boolean' ? typeof value === 'boolean' || value === 0 || value === 1
            : Number.isSafeInteger(value));
      })) throw new Error('Cache query result does not match its declared view schema');
      const key = `q:${createHash('sha256').update(JSON.stringify([name, index, row])).digest('hex')}`;
      return { key, device: row, ...metadata };
    });
    const cursorIndex = cursor ? rows.findIndex(row => row.key === cursor) : -1;
    if (cursor && cursorIndex < 0) throw new Error('Invalid snapshot cursor');
    const remaining = rows.slice(cursorIndex + 1);
    const selected = remaining.slice(0, pageSize);
    return { version: 1, revision: revisionText, sequence: Number(revisionText), sampledAtMs: time,
      total: rows.length, records: selected.map(({ key, device, observationMs, observationSequence, remainingTTLms }) => ({
        key, device, observationMs, observationSequence, remainingTTLms
      })), nextCursor: remaining.length > selected.length ? selected.at(-1).key : '',
      ...(completeness ? { complete: completeness.complete, errors: completeness.errors } : {}) };
  }
  function lookup(name, key) {
    if (!validText(key)) throw new Error('Invalid cache key');
    return declared(name);
  }
  function readTime(at) {
    const time = now();
    if (at === undefined) return time;
    if (!Number.isSafeInteger(at) || at < 0 || at > time) throw new Error('Invalid cache read time');
    return at;
  }
  function erase(cache, key) {
    const entry = cache.entries.get(key);
    if (!entry) return false;
    bytes -= entry.bytes;
    cache.entries.delete(key);
    revision += 1;
    return true;
  }
  function expire(time) {
    for (const cache of caches.values()) for (const [key, entry] of cache.entries) {
      if (entry.deadline <= time) erase(cache, key);
    }
  }
  function syncSnapshot(name, cursor = '', fence = '', pageSize = 2) {
    if (typeof cursor !== 'string' || Buffer.byteLength(cursor) > 256 ||
        typeof fence !== 'string' || !/^(|[0-9]{1,16})$/.test(fence) || (cursor && !fence)
        || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 16) {
      throw new Error('Invalid snapshot cursor, revision, or page size');
    }
    const time = now();
    expire(time);
    if (fence && fence !== String(revision)) throw new Error('Snapshot revision changed');
    const queryDefinition = virtuals.get(name) || caches.get(name);
    if (queryDefinition?.queryPlan)
      return querySnapshot(name, queryDefinition, cursor, fence, time, undefined, revision, null, pageSize);
    const entries = virtualEntries(name, time);
    const cache = entries ? null : declared(name);
    const keys = entries ? entries.map(entry => entry.key)
      : [...cache.entries.keys()].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    if (cursor && !keys.includes(cursor)) throw new Error('Invalid snapshot cursor');
    const remaining = keys.filter(key => !cursor || Buffer.compare(Buffer.from(key), Buffer.from(cursor)) > 0);
    const selected = remaining.slice(0, pageSize);
    return { version: 1, revision: String(revision), sequence: revision, sampledAtMs: time,
      total: keys.length, records: selected.map(key => {
        const entry = entries ? entries.find(candidate => candidate.key === key) : cache.entries.get(key);
        return { key, device: JSON.parse(entry.json), observationMs: entry.observedAt,
          observationSequence: entry.order, remainingTTLms: entry.deadline - time };
      }), nextCursor: remaining.length > selected.length ? selected.at(-1) : '' };
  }
  function snapshotEnvelope(value) {
    if (!value || value.version !== 1 || typeof value.revision !== 'string'
      || !/^[0-9]{1,16}$/.test(value.revision) || !Number.isSafeInteger(value.sequence)
      || !Number.isSafeInteger(value.sampledAtMs) || !Number.isSafeInteger(value.total)
      || value.total < 0 || value.total > 800 || !Array.isArray(value.records)
      || value.records.length > 16 || typeof value.nextCursor !== 'string'
      || value.nextCursor.length > 256 || typeof value.collectorId !== 'string'
      || typeof value.bootId !== 'string' || (value.complete !== undefined && typeof value.complete !== 'boolean')
      || (value.errors !== undefined && !Array.isArray(value.errors))) {
      throw new Error('Invalid remote cache snapshot');
    }
    for (const record of value.records) {
      if (!record || typeof record.key !== 'string' || !record.key.length || record.key.length > 256
        || !record.device || typeof record.device !== 'object' || Array.isArray(record.device)
        || !Number.isSafeInteger(record.observationMs) || !Number.isSafeInteger(record.observationSequence)
        || !Number.isSafeInteger(record.remainingTTLms) || record.remainingTTLms < 0) {
        throw new Error('Invalid remote cache snapshot record');
      }
    }
    return value;
  }
  async function fetchRemoteSnapshot(endpoint, fetchImpl) {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
      throw new Error('Cache resolver returned an invalid snapshot URL');
    const records = [];
    const seenKeys = new Set();
    const pages = new Set();
    const propagatedErrors = [];
    let cursor = '', fence = '', first = null;
    for (let pageNumber = 0; pageNumber < 400; pageNumber += 1) {
      const pageUrl = new URL(url);
      if (cursor) pageUrl.searchParams.set('cursor', cursor);
      if (fence) pageUrl.searchParams.set('revision', fence);
      pageUrl.searchParams.set('limit', '2');
      const response = await fetchImpl(pageUrl, { signal: AbortSignal.timeout(3000) });
      const body = await response.text();
      if (Buffer.byteLength(body) > 4096) throw new Error('Remote cache snapshot page exceeds 4096 bytes');
      if (!response.ok) throw new Error(`Remote cache snapshot returned HTTP ${response.status}`);
      let payload;
      try { payload = snapshotEnvelope(JSON.parse(body)); }
      catch (error) { throw new Error(`Invalid remote cache snapshot response: ${error.message}`); }
      if (first && (payload.revision !== first.revision || payload.sequence !== first.sequence
        || payload.total !== first.total || payload.collectorId !== first.collectorId
        || payload.bootId !== first.bootId)) {
        throw new Error('Remote cache source changed during pagination');
      }
      first ||= payload;
      if (Array.isArray(payload.errors)) propagatedErrors.push(...payload.errors);
      else if (payload.complete === false) propagatedErrors.push('Nested source is incomplete');
      for (const record of payload.records) {
        if (seenKeys.has(record.key)) throw new Error('Duplicate key in remote cache snapshot');
        seenKeys.add(record.key);
        records.push(record);
      }
      if (records.length > first.total || records.length > 800)
        throw new Error('Remote cache snapshot exceeds its declared total');
      if (!payload.nextCursor) {
        if (records.length !== first.total) throw new Error('Remote cache snapshot ended before its declared total');
        return { records, revision: first.revision, sequence: first.sequence,
          collectorId: first.collectorId, bootId: first.bootId,
          complete: propagatedErrors.length === 0, errors: propagatedErrors };
      }
      if (!payload.records.length || payload.records.at(-1).key !== payload.nextCursor
        || pages.has(payload.nextCursor)) throw new Error('Invalid remote cache snapshot cursor');
      pages.add(payload.nextCursor);
      cursor = payload.nextCursor;
      fence = payload.revision;
    }
    throw new Error('Remote cache snapshot page limit exceeded');
  }
  async function collectLocalSnapshot(name, resolveSource, fetchImpl, stack, pageSize) {
    const records = [];
    const errors = [];
    let cursor = '', fence = '', first = null;
    for (let pageNumber = 0; pageNumber < 400; pageNumber += 1) {
      const page = await snapshotAsyncInternal(name, cursor, fence,
        { resolveSource, fetchImpl, stack, pageSize });
      if (first && (page.revision !== first.revision || page.total !== first.total))
        throw new Error('Local cache source changed during pagination');
      first ||= page;
      if (page.errors) errors.push(...page.errors);
      else if (page.complete === false) errors.push('Nested source is incomplete');
      records.push(...page.records);
      if (records.length > first.total || records.length > 800)
        throw new Error('Local cache snapshot exceeds its declared total');
      if (!page.nextCursor) {
        if (records.length !== first.total) throw new Error('Local cache snapshot ended before its declared total');
        return { records, revision: first.revision, sequence: first.sequence,
          complete: errors.length === 0, errors };
      }
      cursor = page.nextCursor;
      fence = page.revision;
    }
    throw new Error('Local cache snapshot page limit exceeded');
  }
  async function querySourcesAsync(name, time, resolveSource, fetchImpl, stack, pageSize) {
    const definition = virtuals.get(name);
    const sourceRows = {};
    const stamps = [];
    const errors = [];
    let complete = true;
    for (const source of definition.sourceDefinitions) {
      try {
        let snapshot;
        if (source.local) {
          snapshot = await collectLocalSnapshot(source.cacheName, resolveSource, fetchImpl, stack, pageSize);
          stamps.push({ alias: source.alias, source: source.cacheName, revision: snapshot.revision });
        } else {
          if (typeof resolveSource !== 'function')
            throw new Error('Aggregator cache resolver is not configured');
          const resolved = await resolveSource(source.serviceId, source.cacheName);
          const endpoint = typeof resolved === 'string' ? resolved : resolved?.snapshotUrl;
          if (!endpoint) throw new Error('Aggregator did not resolve a cache snapshot endpoint');
          snapshot = await fetchRemoteSnapshot(endpoint, fetchImpl);
          stamps.push({ alias: source.alias, serviceId: source.serviceId, cacheName: source.cacheName,
            instanceId: resolved?.instanceId || '', endpoint, revision: snapshot.revision,
            collectorId: snapshot.collectorId, bootId: snapshot.bootId });
        }
        sourceRows[source.alias] = snapshot.records.map(record => ({
          row: { cache_key: record.key, device_json: JSON.stringify(record.device),
            observation_ms: record.observationMs, observation_sequence: record.observationSequence,
            remaining_ttl_ms: record.remainingTTLms },
          metadata: { observationMs: record.observationMs, observationSequence: record.observationSequence,
            remainingTTLms: record.remainingTTLms },
          key: record.key
        }));
        if (!snapshot.complete) {
          complete = false;
          errors.push(...snapshot.errors.map(error => ({ alias: source.alias, error })));
        }
      } catch (error) {
        sourceRows[source.alias] = [];
        complete = false;
        errors.push({ alias: source.alias, serviceId: source.serviceId || '',
          cacheName: source.cacheName, error: error.message });
        stamps.push({ alias: source.alias, serviceId: source.serviceId || '',
          cacheName: source.cacheName, error: error.message });
      }
    }
    const digest = createHash('sha256').update(JSON.stringify({ name, stamps })).digest('hex');
    const combinedRevision = String(Number.parseInt(digest.slice(0, 13), 16));
    return { sourceRows, revision: combinedRevision, complete, errors };
  }
  async function snapshotAsyncInternal(name, cursor, fence,
    { resolveSource, fetchImpl, stack = [], pageSize = 2 } = {}) {
    const definition = virtuals.get(name);
    if (!definition?.queryPlan || !definition.sourceDefinitions.some(source => !source.local))
      return syncSnapshot(name, cursor, fence, pageSize);
    if (stack.length >= 8 || stack.includes(name)) throw new Error('Virtual cache source cycle or depth limit exceeded');
    const time = now();
    expire(time);
    if (typeof cursor !== 'string' || Buffer.byteLength(cursor) > 256
      || typeof fence !== 'string' || !/^(|[0-9]{1,16})$/.test(fence) || (cursor && !fence)) {
      throw new Error('Invalid snapshot cursor or revision');
    }
    const collected = await querySourcesAsync(name, time, resolveSource, fetchImpl, [...stack, name], pageSize);
    return querySnapshot(name, definition, cursor, fence, time, collected.sourceRows,
      collected.revision, { complete: collected.complete, errors: collected.errors }, pageSize);
  }
  return {
    transaction(apply) {
      const saved = [...caches.values()].map(cache => [cache, new Map(cache.entries)]);
      const counters = { bytes, order, revision };
      try { return apply(); }
      catch (error) {
        for (const [cache, entries] of saved) cache.entries = entries;
        ({ bytes, order, revision } = counters);
        throw error;
      }
    },
    snapshot: syncSnapshot,
    snapshotAsync(name, cursor = '', fence = '', options = {}) {
      return snapshotAsyncInternal(name, cursor, fence, {
        resolveSource: options.resolveSource,
        fetchImpl: options.fetchImpl || fetch,
        stack: options.stack || [],
        pageSize: options.pageSize || 2
      });
    },
    get(name, key, at) {
      const virtualDefinition = virtual(name);
      if (virtualDefinition) {
        const separator = key.indexOf(':');
        const source = separator < 1 ? '' : key.slice(0, separator);
        const childKey = separator < 1 ? '' : key.slice(separator + 1);
        if (!virtualDefinition.sources.includes(source)) throw new Error('Cache key missing or expired');
        return this.get(source, childKey, at);
      }
      const cache = lookup(name, key);
      const time = readTime(at);
      const entry = cache.entries.get(key);
      if (!entry || entry.deadline <= time) throw new Error('Cache key missing or expired');
      return entry.json;
    },
    // Smallest live key strictly greater than cursor (bytewise); '' starts and ends enumeration.
    next(name, cursor, at) {
      if (typeof cursor !== 'string' || Buffer.byteLength(cursor) > 256) throw new Error('Invalid cache cursor');
      const time = readTime(at);
      const entries = virtualEntries(name, time);
      if (entries) {
        const after = Buffer.from(cursor);
        const nextEntry = entries.find(entry => !cursor || Buffer.compare(Buffer.from(entry.key), after) > 0);
        return nextEntry ? nextEntry.key : '';
      }
      const cache = declared(name);
      const after = Buffer.from(cursor);
      let best = null;
      for (const [key, entry] of cache.entries) {
        if (entry.deadline <= time) continue;
        const candidate = Buffer.from(key);
        if (cursor && Buffer.compare(candidate, after) <= 0) continue;
        if (best === null || Buffer.compare(candidate, best) < 0) best = candidate;
      }
      return best === null ? '' : best.toString();
    },
    count(name, at) {
      const time = readTime(at);
      const entries = virtualEntries(name, time);
      if (entries) return entries.length;
      const cache = declared(name);
      let live = 0;
      for (const entry of cache.entries.values()) if (entry.deadline > time) live += 1;
      return live;
    },
    stats() {
      return { entries: [...caches.values()].reduce((sum, cache) => sum + cache.entries.size, 0), bytes };
    },
    put(name, key, json, ttlMs) {
      const cache = lookup(name, key);
      if (!Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > 2147483647) throw new Error('Invalid cache TTL');
      if (typeof json !== 'string' || Buffer.byteLength(json) > 2048) throw new Error('Invalid cache item size');
      let value;
      try { value = JSON.parse(json); } catch { throw new Error('Invalid cache item JSON'); }
      if (!value || Array.isArray(value) || typeof value !== 'object'
        || Object.keys(value).length !== cache.fields.length
        || cache.fields.some(field => !Object.hasOwn(value, field.name)
          || (field.type === 'string' ? typeof value[field.name] !== 'string'
            : field.type === 'boolean' ? ![0, 1].includes(value[field.name])
              : !Number.isInteger(value[field.name]) || value[field.name] < -2147483648 || value[field.name] > 2147483647))) {
        throw new Error('Cache item does not match declared type');
      }
      const latestValue = field => {
        const latest = value[field];
        if (typeof latest === 'number') return latest;
        const parsed = Date.parse(latest);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(latest)
          || Number(latest.slice(0, 4)) < 1 || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== latest)
          throw new Error(`Cache latestBy field '${cache.latestBy}' must be an ISO-8601 UTC timestamp with millisecond precision`);
        return parsed;
      };
      const timestamp = cache.latestBy === undefined ? null : latestValue(cache.latestBy);
      const time = now();
      if (!Number.isSafeInteger(time + ttlMs)) throw new Error('Cache deadline overflow');
      expire(time);
      const existing = cache.entries.get(key);
      if (cache.uniqueBy !== undefined) {
        for (const [candidateKey, entry] of cache.entries) {
          if (candidateKey === key) continue;
          if (Object.is(JSON.parse(entry.json)[cache.uniqueBy], value[cache.uniqueBy]))
            throw new Error(`Cache uniqueBy field '${cache.uniqueBy}' already exists`);
        }
      }
      if (existing && cache.latestBy !== undefined) {
        const previous = JSON.parse(existing.json)[cache.latestBy];
        if (timestamp <= (typeof previous === 'number' ? previous : Date.parse(previous))) return 0;
      }
      const victim = !existing && cache.entries.size >= 50
        ? [...cache.entries].reduce((oldest, entry) => entry[1].order < oldest[1].order ? entry : oldest)[0] : null;
      const size = Buffer.byteLength(key) + Buffer.byteLength(json);
      if (bytes - (existing?.bytes || 0) - (victim ? cache.entries.get(victim).bytes : 0) + size > maxStorageBytes) {
        throw new Error('Cache storage capacity exceeded');
      }
      if (victim) erase(cache, victim);
      if (existing) erase(cache, key);
      cache.entries.set(key, { json, observedAt: time, deadline: time + ttlMs, order: ++order, bytes: size });
      revision += 1;
      bytes += size;
      return 1;
    },
    remove(name, key) {
      const cache = lookup(name, key);
      expire(now());
      return erase(cache, key) ? 1 : 0;
    },
    clear() {
      for (const cache of caches.values()) cache.entries.clear();
      bytes = 0;
      order = 0;
      revision = 0;
    }
  };
}
