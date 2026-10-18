import { useEffect, useSyncExternalStore } from 'react';
import { isSchemaBranch, schemaNodeNotice, schemaSimpleTypeSummary } from './schema-tree.mjs';

export default function LazySchemaTree({ schema, cache }) {
  const scope = JSON.stringify([schema.path, schema.mtime, schema.accessibleFields || []]);
  useSyncExternalStore(cache.subscribe, cache.snapshot);
  useEffect(() => {
    void cache.expand(scope, { path: schema.path });
    return () => cache.collapse(scope);
  }, [cache, scope, schema.path]);

  const root = cache.get(scope);
  const revision = root?.page?.revision;
  function renderNode(node) {
    const entry = cache.get(scope, node.nodeId);
    const branch = node.childCount > 0;
    const notice = schemaNodeNotice(node);
    const summary = schemaSimpleTypeSummary(node);
    return (
      <li key={node.nodeId} style={{ marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {branch ? (
            <button type="button" aria-expanded={Boolean(entry)} aria-label={`${entry ? 'Collapse' : 'Expand'} ${node.name}`}
              onClick={() => entry ? cache.collapse(scope, node.nodeId)
                : void cache.expand(scope, { path: schema.path, nodeId: node.nodeId, revision })}
              style={{ padding: '0 4px' }}>
              {entry ? '\u25be' : '\u25b8'}
            </button>
          ) : <span aria-label={isSchemaBranch(node) ? 'reference branch' : 'leaf'}>{'\u2022'}</span>}
          <span style={{ fontSize: 12 }}>{node.name}</span>
          <span style={{ fontSize: 10, color: '#777' }}>{node.valueType || 'unknown'}</span>
          {notice && <span style={{ fontSize: 10, color: '#8a5a00' }}>{notice}</span>}
          {summary && <span style={{ fontSize: 10, color: '#777' }}>{summary}</span>}
          {node.enumValues?.length > 0 && <span style={{ fontSize: 10 }}>enum: {node.enumValues.join(', ')}</span>}
        </div>
        {entry?.loading && <div role="status">Loading branch...</div>}
        {entry?.error && (
          <div role="alert">
            {entry.error}{' '}
            <button type="button" onClick={() => void cache.expand(scope, {
              path: schema.path, nodeId: node.nodeId, revision: node.nodeId === 'n0' ? undefined : revision,
            })}>Retry</button>
            {node.nodeId !== 'n0' && <button type="button" onClick={() => void cache.expand(scope, { path: schema.path })}>Reload tree</button>}
          </div>
        )}
        {entry?.page && (
          <>
            <ul style={{ listStyle: 'none', paddingLeft: 20, marginTop: 2 }}>
              {entry.page.items.map(renderNode)}
            </ul>
            {(entry.cursor !== '0' || entry.page.nextCursor !== null) && (
              <div style={{ marginLeft: 20 }}>
                <button type="button" disabled={entry.cursor === '0'} onClick={() => void cache.expand(scope, {
                  path: schema.path, nodeId: node.nodeId, revision: entry.page.revision,
                  cursor: String(Number(entry.cursor) - 1),
                })}>Previous page</button>
                <span> Page {Number(entry.cursor) + 1} </span>
                <button type="button" disabled={entry.page.nextCursor === null} onClick={() => void cache.expand(scope, {
                  path: schema.path, nodeId: node.nodeId, revision: entry.page.revision, cursor: entry.page.nextCursor,
                })}>Next page</button>
              </div>
            )}
          </>
        )}
      </li>
    );
  }
  return (
    <div>
      {cache.status().notice && <div role="status" style={{ fontSize: 11 }}>{cache.status().notice}</div>}
      <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
        {renderNode(root?.page?.node || { nodeId: 'n0', name: 'root', childCount: 1 })}
      </ul>
    </div>
  );
}
