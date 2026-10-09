import fs from 'node:fs/promises';
import path from 'node:path';

// Lazily parsed schema field trees. An entry is reused only while the schema file and every
// file it was built from (XSD include/import) keep the same mtime and size.
export function createSchemaStructureCache({
  schemaRoot,
  parse,
  maxEntries = 128,
  maxBytes = 64 * 1024 * 1024,
  idleMs = 30 * 60 * 1000,
  concurrency = 4,
  sweepIntervalMs = Math.min(60000, Math.max(1000, idleMs)),
  now = Date.now
}) {
  const entries = new Map();
  const pending = new Map();
  const waiters = [];
  let active = 0;
  let totalBytes = 0;
  let generation = 0;
  const stats = { hits: 0, misses: 0, parses: 0, evictions: 0, invalidations: 0 };

  const sweepTimer = idleMs > 0 ? setInterval(sweep, sweepIntervalMs) : null;
  sweepTimer?.unref?.();

  async function fingerprint(relPath) {
    try {
      const stat = await fs.stat(path.join(schemaRoot, relPath));
      return { path: relPath, mtimeMs: stat.mtimeMs, size: stat.size };
    } catch (error) {
      if (error.code === 'ENOENT') return { path: relPath, mtimeMs: -1, size: -1 };
      throw error;
    }
  }

  async function isCurrent(entry) {
    const current = await Promise.all(entry.files.map(file => fingerprint(file.path)));
    return current.every((file, index) =>
      file.mtimeMs === entry.files[index].mtimeMs && file.size === entry.files[index].size);
  }

  function remove(relPath) {
    const entry = entries.get(relPath);
    if (!entry) return false;
    totalBytes -= entry.bytes;
    entries.delete(relPath);
    return true;
  }

  function store(relPath, entry) {
    remove(relPath);
    if (entry.bytes > maxBytes) return;
    while (entries.size && (entries.size >= maxEntries || totalBytes + entry.bytes > maxBytes)) {
      remove(entries.keys().next().value);
      stats.evictions += 1;
    }
    entries.set(relPath, entry);
    totalBytes += entry.bytes;
  }

  function touch(relPath, entry) {
    entry.lastUsed = now();
    entries.delete(relPath);
    entries.set(relPath, entry);
  }

  async function withSlot(work) {
    if (active >= concurrency) await new Promise(resolve => waiters.push(resolve));
    active += 1;
    try {
      return await work();
    } finally {
      active -= 1;
      waiters.shift()?.();
    }
  }

  async function load(relPath, type) {
    const startedGeneration = generation;
    const primary = await fingerprint(relPath);
    if (primary.size < 0) throw Object.assign(new Error(`Schema not found: ${relPath}`), { code: 'ENOENT', status: 404 });
    stats.parses += 1;
    const { structure, dependencies = [] } = await withSlot(() => parse(relPath, type));
    const dependencyPaths = [...new Set(dependencies)].filter(item => item !== relPath);
    const files = [primary, ...await Promise.all(dependencyPaths.map(fingerprint))];
    const bytes = Buffer.byteLength(JSON.stringify(structure ?? null));
    // A reparse request that arrived mid-parse must not be overwritten by the older result.
    if (startedGeneration === generation) {
      store(relPath, { type, structure, files, bytes, parsedAt: now(), lastUsed: now() });
    }
    return structure;
  }

  async function get(relPath, type) {
    const entry = entries.get(relPath);
    if (entry && entry.type === type && await isCurrent(entry)) {
      stats.hits += 1;
      touch(relPath, entry);
      return entry.structure;
    }
    if (entry && entries.get(relPath) === entry) remove(relPath);
    stats.misses += 1;
    const key = `${type}\u0000${relPath}`;
    if (!pending.has(key)) {
      const work = load(relPath, type).finally(() => {
        if (pending.get(key) === work) pending.delete(key);
      });
      pending.set(key, work);
    }
    return pending.get(key);
  }

  async function peek(relPath, type) {
    const entry = entries.get(relPath);
    if (!entry || entry.type !== type) return undefined;
    if (!await isCurrent(entry)) {
      if (entries.get(relPath) === entry) remove(relPath);
      return undefined;
    }
    touch(relPath, entry);
    return entry.structure;
  }

  function invalidate(relPath) {
    generation += 1;
    stats.invalidations += 1;
    for (const key of [...pending.keys()]) {
      if (relPath === undefined || key.endsWith(`\u0000${relPath}`)) pending.delete(key);
    }
    if (relPath === undefined) {
      const count = entries.size;
      entries.clear();
      totalBytes = 0;
      return count;
    }
    let count = remove(relPath) ? 1 : 0;
    // Drop schemas that include the changed file so they are reparsed on next use.
    for (const [key, entry] of [...entries]) {
      if (entry.files.some(file => file.path === relPath) && remove(key)) count += 1;
    }
    return count;
  }

  function sweep() {
    if (idleMs <= 0) return 0;
    const cutoff = now() - idleMs;
    let count = 0;
    for (const [key, entry] of [...entries]) {
      if (entry.lastUsed < cutoff && remove(key)) {
        count += 1;
        stats.evictions += 1;
      }
    }
    return count;
  }

  function status() {
    return {
      entries: entries.size, bytes: totalBytes, pending: pending.size, active,
      maxEntries, maxBytes, idleMs, concurrency, ...stats,
      cached: [...entries].map(([key, entry]) => ({
        path: key, type: entry.type, bytes: entry.bytes,
        parsedAt: new Date(entry.parsedAt).toISOString(),
        lastUsed: new Date(entry.lastUsed).toISOString(),
        dependencies: entry.files.slice(1).map(file => file.path)
      }))
    };
  }

  return {
    get, peek, invalidate, sweep, status,
    has: relPath => entries.has(relPath),
    stop() {
      if (sweepTimer) clearInterval(sweepTimer);
      entries.clear();
      totalBytes = 0;
    }
  };
}
