import { useEffect, useMemo, useState } from 'react';

const REFRESH_MS = 30_000;

function normalizeNodeKey(value) {
  return String(value || '').trim();
}

function buildTree(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const byKey = new Map();
  const childrenByParent = new Map();

  for (const node of list) {
    const key = normalizeNodeKey(node?.topology?.nodeKey || node?.nodeId || node?.nodeName || node?.ip);
    if (!key) continue;
    byKey.set(key, node);
  }

  for (const node of list) {
    const key = normalizeNodeKey(node?.topology?.nodeKey || node?.nodeId || node?.nodeName || node?.ip);
    if (!key) continue;
    const parent = normalizeNodeKey(node?.topology?.parentNodeId);
    if (!parent) continue;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(key);
  }

  const roots = [];
  for (const key of byKey.keys()) {
    const parent = normalizeNodeKey(byKey.get(key)?.topology?.parentNodeId);
    if (!parent || !byKey.has(parent)) roots.push(key);
  }

  roots.sort((a, b) => a.localeCompare(b));
  for (const [parent, childKeys] of childrenByParent.entries()) {
    childKeys.sort((a, b) => a.localeCompare(b));
    childrenByParent.set(parent, childKeys);
  }

  return { byKey, childrenByParent, roots };
}

function TreeNode({ nodeKey, tree, depth = 0 }) {
  const node = tree.byKey.get(nodeKey);
  if (!node) return null;

  const children = tree.childrenByParent.get(nodeKey) || [];
  const nodeName = String(node?.nodeName || node?.nodeId || node?.ip || nodeKey);
  const nodeIp = String(node?.ip || 'n/a');
  const clusterId = String(node?.topology?.activeClusterId || 'default');
  const clusterController = node?.topology?.clusterController === true;

  return (
    <li>
      <div className="topology-node" style={{ marginLeft: `${depth * 16}px` }}>
        <span className="topology-node-name">{nodeName}</span>
        <span className="topology-node-meta">{nodeIp}</span>
        <span className="topology-node-meta">cluster: {clusterId}</span>
        {clusterController ? <span className="topology-node-badge">clusterController</span> : null}
      </div>
      {children.length > 0 ? (
        <ul className="topology-tree-list">
          {children.map((childKey) => (
            <TreeNode key={childKey} nodeKey={childKey} tree={tree} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function TopologyPage() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState('');

  async function loadTopology() {
    try {
      const response = await fetch('/api/nodes');
      if (!response.ok) {
        throw new Error(`Topology request failed (${response.status})`);
      }
      const payload = await response.json();
      const nextNodes = Array.isArray(payload) ? payload : [];
      setNodes(nextNodes);
      setError('');
      setLastRefreshedAt(new Date().toISOString());
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTopology();
    const intervalId = window.setInterval(loadTopology, REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  return (
    <div className="topology-page">
      <header className="topology-header">
        <h1>Network Topology</h1>
        <p>Auto-refreshes every 30 seconds.</p>
        <div className="topology-actions">
          <button type="button" onClick={loadTopology}>Refresh now</button>
          <span className="topology-last-refresh">Last refresh: {lastRefreshedAt || 'never'}</span>
        </div>
      </header>

      {loading ? <div className="topology-info">Loading topology...</div> : null}
      {error ? <div className="topology-error">{error}</div> : null}

      <section className="topology-section">
        <h2>Tree View</h2>
        {tree.roots.length === 0 ? (
          <div className="topology-info">No nodes found.</div>
        ) : (
          <ul className="topology-tree-list">
            {tree.roots.map((rootKey) => (
              <TreeNode key={rootKey} nodeKey={rootKey} tree={tree} />
            ))}
          </ul>
        )}
      </section>

      <section className="topology-section">
        <h2>Raw Node List</h2>
        <div className="topology-table-wrap">
          <table className="topology-table">
            <thead>
              <tr>
                <th>Node</th>
                <th>IP</th>
                <th>Parent</th>
                <th>Cluster</th>
                <th>Children</th>
                <th>Cluster Controller</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const key = normalizeNodeKey(node?.topology?.nodeKey || node?.nodeId || node?.nodeName || node?.ip);
                const children = tree.childrenByParent.get(key) || [];
                return (
                  <tr key={key || Math.random()}>
                    <td>{String(node?.nodeName || node?.nodeId || key || 'unknown')}</td>
                    <td>{String(node?.ip || 'n/a')}</td>
                    <td>{String(node?.topology?.parentNodeId || '-')}</td>
                    <td>{String(node?.topology?.activeClusterId || 'default')}</td>
                    <td>{children.length}</td>
                    <td>{node?.topology?.clusterController ? 'yes' : 'no'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}