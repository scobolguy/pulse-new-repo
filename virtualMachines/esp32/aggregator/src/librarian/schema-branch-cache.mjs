export function createSchemaBranchCache(loadPage, { maxBytes = 262144 } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1500) throw new Error('Invalid schema branch cache capacity');
  const entries = new Map();
  const subscribers = new Set();
  let version = 0;
  let bytes = 0;
  let notice = '';
  const key = (scope, nodeId) => JSON.stringify([scope, nodeId]);
  function changed() { version++; for (const subscriber of subscribers) subscriber(); }
  function remove(entry) {
    entry.controller?.abort();
    bytes -= entry.bytes;
    entries.delete(key(entry.scope, entry.nodeId));
  }
  function collapse(scope, nodeId) {
    for (const entry of entries.values()) {
      if (entry.scope === scope && (nodeId === undefined || entry.nodeId === nodeId || entry.nodeId.startsWith(`${nodeId}.`))) {
        remove(entry);
      }
    }
    changed();
  }
  async function expand(scope, request) {
    const nodeId = request.nodeId || 'n0';
    const id = key(scope, nodeId);
    const previous = entries.get(id);
    const revision = request.revision || previous?.page?.revision;
    collapse(scope, nodeId);
    if (entries.size >= 128) {
      const oldest = [...entries.values()].find(candidate =>
        !(candidate.scope === scope && nodeId.startsWith(`${candidate.nodeId}.`)));
      if (!oldest) {
        notice = 'Expanded schema path exceeds the tree cache entry limit; collapse a branch.';
        changed();
        return;
      }
      collapse(oldest.scope, oldest.nodeId);
      notice = 'Older branches were collapsed to stay within the tree cache limit.';
    }
    const entry = { scope, nodeId, bytes: 0, loading: true, controller: new AbortController() };
    entries.set(id, entry);
    changed();
    try {
      const page = await loadPage({ ...request, nodeId, revision, signal: entry.controller.signal });
      if (entries.get(id) !== entry) return;
      if (!page || page.nodeId !== nodeId || !/^[a-f0-9]{64}$/.test(page.revision)
        || (revision && revision !== page.revision) || !page.node || page.node.nodeId !== nodeId
        || !Array.isArray(page.items) || page.items.some(node => typeof node.nodeId !== 'string'
          || !node.nodeId.startsWith(`${nodeId}.`) || !Number.isSafeInteger(node.childCount) || node.childCount < 0)
        || (page.nextCursor !== null && !/^[0-9]{1,8}$/.test(page.nextCursor))) {
        throw new Error('Invalid schema branch page');
      }
      const size = new TextEncoder().encode(JSON.stringify(page)).byteLength;
      if (size > 1500 || size > maxBytes) throw new Error('Schema branch page capacity exceeded');
      while (bytes + size > maxBytes) {
        const oldest = [...entries.values()].find(candidate => candidate !== entry);
        if (!oldest) throw new Error('Schema branch cache capacity exceeded');
        // Preserve the path to the branch being loaded; evict unrelated subtrees first.
        const victim = [...entries.values()].find(candidate => candidate !== entry
          && !(candidate.scope === scope && nodeId.startsWith(`${candidate.nodeId}.`)));
        if (!victim) throw new Error('Expanded schema path exceeds tree cache capacity; collapse a branch');
        collapse(victim.scope, victim.nodeId);
        notice = 'Older branches were collapsed to stay within the tree cache limit.';
      }
      entry.page = page;
      entry.cursor = request.cursor || '0';
      entry.bytes = size;
      entry.loading = false;
      bytes += size;
      changed();
    } catch (error) {
      if (entries.get(id) !== entry) return;
      entry.loading = false;
      entry.error = error.message;
      changed();
    }
  }
  return {
    expand, collapse,
    get: (scope, nodeId = 'n0') => entries.get(key(scope, nodeId)),
    subscribe: listener => { subscribers.add(listener); return () => subscribers.delete(listener); },
    snapshot: () => version,
    status: () => ({ bytes, entries: entries.size, notice }),
    clear: () => {
      for (const entry of entries.values()) remove(entry);
      notice = '';
      changed();
    },
  };
}
