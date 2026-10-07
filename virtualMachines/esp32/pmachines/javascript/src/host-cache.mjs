// Storage interface: get/put/remove/next/count/clear. A future distributed adapter can
// implement this contract without changing language lowering or legacy tables.
// Reads accept an optional pinned time (the invocation start) so one invocation sees a
// consistent snapshot; reads never refresh TTL or eviction order.
export function createHostCacheStore(definitions = [], { clock, maxStorageBytes = 16384 } = {}) {
  if (!Array.isArray(definitions) || definitions.length > 2) throw new Error('Invalid hosted cache declarations');
  const caches = new Map();
  const validText = value => typeof value === 'string' && Buffer.byteLength(value) <= 256 && /[^\t\r\n ]/.test(value);
  for (const definition of definitions) {
    const { name, capacity, fields } = definition;
    if (!validText(name) || name !== name.toLowerCase() || caches.has(name) || capacity !== 50
      || !Array.isArray(fields) || fields.length < 1 || fields.length > 32
      || fields.some(field => !validText(field.name) || !['integer', 'string', 'boolean'].includes(field.type))
      || new Set(fields.map(field => field.name)).size !== fields.length) throw new Error('Invalid hosted cache declaration');
    caches.set(name, { fields, entries: new Map() });
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
    if (!cache) throw new Error('Undeclared cache');
    return cache;
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
  return {
    snapshot(name, cursor = '', fence = '') {
      const cache = declared(name);
      if (typeof cursor !== 'string' || Buffer.byteLength(cursor) > 256 ||
          typeof fence !== 'string' || !/^(|[0-9]{1,16})$/.test(fence) || (cursor && !fence)) throw new Error('Invalid snapshot cursor or revision');
      const time = now();
      expire(time);
      if (fence && fence !== String(revision)) throw new Error('Snapshot revision changed');
      const keys = [...cache.entries.keys()].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
      if (cursor && !cache.entries.has(cursor)) throw new Error('Invalid snapshot cursor');
      const remaining = keys.filter(key => !cursor || Buffer.compare(Buffer.from(key), Buffer.from(cursor)) > 0);
      const selected = remaining.slice(0, 2);
      return { version: 1, revision: String(revision), sequence: revision, sampledAtMs: time,
        total: keys.length, records: selected.map(key => {
          const entry = cache.entries.get(key);
          return { key, device: JSON.parse(entry.json), observationMs: entry.observedAt,
            observationSequence: entry.order, remainingTTLms: entry.deadline - time };
        }), nextCursor: remaining.length > selected.length ? selected.at(-1) : '' };
    },
    get(name, key, at) {
      const cache = lookup(name, key);
      const time = readTime(at);
      const entry = cache.entries.get(key);
      if (!entry || entry.deadline <= time) throw new Error('Cache key missing or expired');
      return entry.json;
    },
    // Smallest live key strictly greater than cursor (bytewise); '' starts and ends enumeration.
    next(name, cursor, at) {
      if (typeof cursor !== 'string' || Buffer.byteLength(cursor) > 256) throw new Error('Invalid cache cursor');
      const cache = declared(name);
      const time = readTime(at);
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
      const cache = declared(name);
      const time = readTime(at);
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
      const time = now();
      if (!Number.isSafeInteger(time + ttlMs)) throw new Error('Cache deadline overflow');
      expire(time);
      const existing = cache.entries.get(key);
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
