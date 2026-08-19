import { useEffect, useMemo, useState } from 'react';
import { Bell, Camera, Clock3, Database, Droplets, Fingerprint, Gauge, HousePlug, Lightbulb, Lock, LockOpen, Monitor, Network, Pencil, PlugZap, Power, PowerOff, RefreshCw } from 'lucide-react';

const REFRESH_MS = 30_000;

function normalizeNodeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getNodeKey(node) {
  return normalizeNodeKey(node?.topology?.nodeKey || node?.nodeId || node?.nodeName || node?.ip);
}

function getNodeLabel(node) {
  return String(node?.nodeName || node?.details?.nodeName || node?.nodeId || node?.ip || 'unknown').trim();
}

function getNodeTransport(node) {
  let rawMetadata = null;
  try { rawMetadata = typeof node?.raw === 'string' ? JSON.parse(node.raw) : node?.raw; } catch { rawMetadata = null; }
  const candidates = [
    node?.protocol,
    node?.scheme,
    node?.url,
    node?.baseUrl,
    node?.statusUrl,
    node?.servicesUrl,
    node?.details?.protocol,
    node?.details?.scheme,
    node?.details?.url,
    node?.details?.baseUrl,
    node?.details?.statusUrl,
    node?.details?.servicesUrl,
    rawMetadata?.statusUrl,
    rawMetadata?.servicesUrl
  ];
  const advertisedUrl = candidates.find((value) => /^https?:\/\//i.test(String(value || '').trim()));
  let advertisedPort = null;
  if (advertisedUrl) {
    try { advertisedPort = Number(new URL(String(advertisedUrl)).port || 0) || null; } catch { advertisedPort = null; }
  }
  const usesHttps = node?.httpsPort != null
    || node?.details?.httpsPort != null
    || node?.httpsEnabled === true
    || node?.details?.httpsEnabled === true
    || candidates.some((value) => /^https(?::|$)/i.test(String(value || '').trim()));
  const explicitProtocol = String(node?.protocol || node?.details?.protocol || '').trim().toLowerCase();
  const protocol = usesHttps ? 'https' : (explicitProtocol || 'http');
  if (protocol !== 'http' && protocol !== 'https') {
    const ip = String(node?.ip || '').trim();
    const port = Number(node?.port || 0);
    return {
      protocol,
      port,
      endpoint: ip ? `${protocol}://${ip}${port ? `:${port}` : ''}` : `${protocol}://n/a`
    };
  }
  const defaultPort = usesHttps ? 443 : 80;
  const port = Number(usesHttps
    ? (node?.httpsPort || node?.details?.httpsPort || advertisedPort || node?.port || defaultPort)
    : (advertisedPort || node?.port || node?.details?.httpPort || defaultPort));
  const ip = String(node?.ip || '').trim();
  return {
    protocol,
    port,
    endpoint: ip ? `${protocol}://${ip}${port === defaultPort ? '' : `:${port}`}` : `${protocol}://n/a`
  };
}

function getNodeCapabilities(node) {
  const details = node?.details || {};
  const serviceNames = (Array.isArray(details.services) ? details.services : [])
    .map((service) => String(typeof service === 'string' ? service : service?.name || '').toLowerCase());
  const metadata = [
    details.hardware,
    details.deviceRole,
    details.preferredTaskType,
    node?.hardware,
    node?.deviceRole,
    ...serviceNames
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  const doorbell = metadata.includes('doorbell');
  return {
    doorbell,
    camera: doorbell || metadata.includes('camera') || metadata.includes('esp32-cam'),
    display: metadata.includes('display'),
    sensor: metadata.includes('sensorservice') || metadata.includes('time-sensor'),
    timeAuthority: metadata.includes('timeauthorityservice') || metadata.includes('time-authority'),
    filesystem: serviceNames.some((name) => name === 'ffs'),
    uniqueId: metadata.includes('uniqueidservice'),
    homeAutomation: metadata.includes('home-automation'),
    light: metadata.includes('bulb') || metadata.includes('light'),
    plug: metadata.includes('plug') || metadata.includes('outlet') || metadata.includes('switch'),
    waterController: metadata.includes('water_controller') || metadata.includes('water controller') || metadata.includes('melnor')
  };
}

function NodeCapabilityIcons({ node }) {
  const capabilities = getNodeCapabilities(node);
  return (
    <span className="topology-device-icons" aria-label="Device capabilities">
      {capabilities.doorbell ? <Bell size={16} aria-label="Doorbell" /> : null}
      {capabilities.camera ? <Camera size={16} aria-label="Camera" /> : null}
      {capabilities.display ? <Monitor size={16} aria-label="Display" /> : null}
      {capabilities.sensor ? <Gauge size={16} aria-label="Sensors" /> : null}
      {capabilities.timeAuthority ? <Clock3 size={16} aria-label="Time authority" /> : null}
      {capabilities.filesystem ? <Database size={16} aria-label="File system" /> : null}
      {capabilities.uniqueId ? <Fingerprint size={16} aria-label="Unique ID" /> : null}
      {capabilities.homeAutomation ? <HousePlug size={16} aria-label="Home automation" /> : null}
      {capabilities.light ? <Lightbulb size={16} aria-label="Smart light" /> : null}
      {capabilities.plug ? <PlugZap size={16} aria-label="Smart plug" /> : null}
      {capabilities.waterController ? <Droplets size={16} aria-label="Water controller" /> : null}
    </span>
  );
}

function TransportBadge({ protocol }) {
  const secure = protocol === 'https';
  const webProtocol = protocol === 'http' || protocol === 'https';
  const TransportIcon = secure ? Lock : (webProtocol ? LockOpen : Network);
  return (
    <span
      title={`Communicating via ${protocol.toUpperCase()}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '1px 5px',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: 700,
        color: secure ? '#1f6f43' : (webProtocol ? '#57606a' : '#8250df'),
        background: secure ? '#dafbe1' : (webProtocol ? '#eaeef2' : '#f5f0ff')
      }}
    >
      <TransportIcon size={13} aria-hidden="true" />
      {protocol.toUpperCase()}
    </span>
  );
}

function buildTree(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const byKey = new Map();
  const childrenByParent = new Map();

  for (const node of list) {
    const key = getNodeKey(node);
    if (!key) continue;
    byKey.set(key, node);
  }

  for (const node of list) {
    const key = getNodeKey(node);
    if (!key) continue;
    const parent = normalizeNodeKey(node?.topology?.parentNodeId);
    if (!parent) continue;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(key);
  }

  const roots = [];
  const freePool = [];
  for (const key of byKey.keys()) {
    const parent = normalizeNodeKey(byKey.get(key)?.topology?.parentNodeId);
    const hasChildren = (childrenByParent.get(key) || []).length > 0;
    if (!parent && hasChildren) roots.push(key);
    else if (!parent || !byKey.has(parent)) freePool.push(key);
  }

  roots.sort((a, b) => a.localeCompare(b));
  freePool.sort((a, b) => a.localeCompare(b));
  for (const [parent, childKeys] of childrenByParent.entries()) {
    childKeys.sort((a, b) => a.localeCompare(b));
    childrenByParent.set(parent, childKeys);
  }

  return { byKey, childrenByParent, roots, freePool };
}

function TreeNode({ nodeKey, tree, depth = 0, expanded, onToggle, onRename, onSetParent, onDeviceAction, busyNodeKey }) {
  const node = tree.byKey.get(nodeKey);
  if (!node) return null;

  const children = tree.childrenByParent.get(nodeKey) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expanded[nodeKey] === true;
  
  const nodeName = getNodeLabel(node);
  const clusterId = String(node?.topology?.activeClusterId || 'default');
  const clusterController = node?.topology?.clusterController === true;
  const siteName = String(node?.topology?.siteName || node?.topology?.siteId || 'primary-site');
  const siteMode = String(node?.topology?.siteMode || 'hot-warm');
  const siteCategory = String(node?.topology?.siteCategory || 'internal');
  const transport = getNodeTransport(node);
  const topologyManaged = node?.details?.topologyManaged === true;
  const manageable = node?.details?.manageable === true;
  const powerState = typeof node?.details?.powerState === 'boolean' ? node.details.powerState : null;
  const managementReason = String(node?.details?.managementReason || '').trim();
  const rssi = Number(node?.details?.rssi);
  const distanceFeet = Number(node?.details?.distanceFeet);

  const handleToggle = () => {
    onToggle(nodeKey);
  };

  return (
    <li>
      <div className="topology-node" style={{ marginLeft: `${depth * 16}px`, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {hasChildren ? (
          <button
            onClick={handleToggle}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '0 4px',
              fontSize: '12px',
              color: '#666',
              minWidth: '20px'
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span style={{ width: '20px', display: 'inline-block' }}></span>
        )}
        <span className="topology-node-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <NodeCapabilityIcons node={node} />
          {nodeName}
          <TransportBadge protocol={transport.protocol} />
        </span>
        <span className="topology-node-meta">{transport.endpoint}</span>
        <span className="topology-node-meta">cluster: {clusterId}</span>
        <span className="topology-node-meta">site: {siteName} ({siteMode}, {siteCategory})</span>
        {clusterController ? <span className="topology-node-badge">clusterController</span> : null}
        {hasChildren ? <span className="topology-node-badge" style={{ backgroundColor: '#e3f2fd' }}>+{children.length} children</span> : null}
        {manageable ? (
          <span
            className="topology-node-badge"
            aria-label={`${nodeName} power is ${powerState == null ? 'unknown' : powerState ? 'on' : 'off'}`}
            style={{
              color: powerState == null ? '#57606a' : powerState ? '#116329' : '#82071e',
              backgroundColor: powerState == null ? '#eaeef2' : powerState ? '#dafbe1' : '#ffebe9'
            }}
          >
            {powerState == null ? 'UNKNOWN' : powerState ? 'ON' : 'OFF'}
          </span>
        ) : null}
        {topologyManaged && !manageable && managementReason ? (
          <span className="topology-node-badge" title={managementReason} style={{ color: '#57606a', backgroundColor: '#eaeef2' }}>
            MONITOR ONLY
          </span>
        ) : null}
        {Number.isFinite(rssi) && rssi !== 0 ? (
          <span className="topology-node-meta">
            signal: {rssi} dBm{Number.isFinite(distanceFeet) && distanceFeet > 0 ? ` (~${distanceFeet.toFixed(1)} ft)` : ''}
          </span>
        ) : null}
        <span className="topology-node-tools">
          {manageable ? <>
            <button type="button" title="Turn on" aria-label={`Turn on ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onDeviceAction(node, 'on')}><Power size={14} aria-hidden="true" /></button>
            <button type="button" title="Turn off" aria-label={`Turn off ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onDeviceAction(node, 'off')}><PowerOff size={14} aria-hidden="true" /></button>
            <button type="button" title="Toggle power" aria-label={`Toggle ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onDeviceAction(node, 'toggle')}><RefreshCw size={14} aria-hidden="true" /></button>
          </> : null}
          {!topologyManaged ? <>
            <button type="button" title="Rename node" aria-label={`Rename ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onRename(node)}><Pencil size={14} aria-hidden="true" /></button>
            <button type="button" title="Set parent node" aria-label={`Set parent for ${nodeName}`} disabled={busyNodeKey === nodeKey} onClick={() => onSetParent(node)}><Network size={14} aria-hidden="true" /></button>
          </> : null}
        </span>
      </div>
      {hasChildren && isExpanded && (
        <ul className="topology-tree-list">
          {children.map((childKey) => (
            <TreeNode key={childKey} nodeKey={childKey} tree={tree} depth={depth + 1} expanded={expanded} onToggle={onToggle} onRename={onRename} onSetParent={onSetParent} onDeviceAction={onDeviceAction} busyNodeKey={busyNodeKey} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TopologyPage() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState('');
  const [expanded, setExpanded] = useState({});
  const [busyNodeKey, setBusyNodeKey] = useState('');

  async function loadTopology() {
    try {
      const response = await fetch('/api/nodes');
      if (!response.ok) {
        throw new Error(`Topology request failed (${response.status})`);
      }
      const payload = await response.json();
      const nextNodes = Array.isArray(payload) ? payload : [];
      const statusEntries = await Promise.all(nextNodes.map(async (node) => {
        const nodeId = String(node?.nodeId || '').trim();
        if (!nodeId || node?.details?.manageable !== true || node?.topology?.parentNodeId !== 'home-automation') return null;
        try {
          const statusResponse = await fetch(`/api/home-automation/devices/${encodeURIComponent(nodeId)}/action`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'status' })
          });
          const statusPayload = await statusResponse.json().catch(() => ({}));
          return statusResponse.ok && typeof statusPayload?.result?.power === 'boolean'
            ? [getNodeKey(node), statusPayload.result.power]
            : null;
        } catch {
          return null;
        }
      }));
      const powerByNodeKey = new Map(statusEntries.filter(Boolean));
      setNodes(nextNodes.map((node) => powerByNodeKey.has(getNodeKey(node))
        ? { ...node, details: { ...node.details, powerState: powerByNodeKey.get(getNodeKey(node)) } }
        : node));
      setError('');
      setLastRefreshedAt(new Date().toISOString());
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
    } finally {
      setLoading(false);
    }
  }

  const handleToggleNode = (nodeKey) => {
    setExpanded(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  async function postNodeChange(node, action, body) {
    const nodeId = String(node?.nodeId || node?.topology?.nodeKey || node?.nodeName || node?.ip || '').trim();
    const nodeKey = getNodeKey(node);
    if (!nodeId || !nodeKey) return;

    setBusyNodeKey(nodeKey);
    setError('');
    try {
      const response = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ip: node?.ip || '', ...body })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Node update failed (${response.status})`);
      await loadTopology();
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
    } finally {
      setBusyNodeKey('');
    }
  }

  function handleRenameNode(node) {
    const currentName = getNodeLabel(node);
    const nextName = window.prompt('Node name', currentName);
    if (nextName == null || nextName.trim() === '' || nextName.trim() === currentName) return;
    postNodeChange(node, 'rename', { nodeName: nextName.trim() });
  }

  function handleSetParent(node) {
    const currentKey = getNodeKey(node);
    const candidates = nodes
      .filter((candidate) => getNodeKey(candidate) !== currentKey)
      .sort((a, b) => getNodeLabel(a).localeCompare(getNodeLabel(b)));
    const choices = candidates.map((candidate, index) => `${index + 1}. ${getNodeLabel(candidate)}`).join('\n');
    const answer = window.prompt(`Choose parent number for ${getNodeLabel(node)}, or 0 for Free Pool:\n${choices}`, '0');
    if (answer == null) return;
    const selected = Number.parseInt(answer, 10);
    if (!Number.isInteger(selected) || selected < 0 || selected > candidates.length) {
      setError('Choose a valid parent number.');
      return;
    }
    const parent = selected === 0 ? null : candidates[selected - 1];
    postNodeChange(node, 'parent', {
      parentNodeId: parent ? getNodeKey(parent) : '',
      parentHost: parent?.ip || '',
      activeClusterId: parent?.topology?.activeClusterId || node?.topology?.activeClusterId || 'default'
    });
  }

  async function handleDeviceAction(node, action) {
    const nodeId = String(node?.nodeId || '').trim();
    const nodeKey = getNodeKey(node);
    if (!nodeId || !nodeKey) return;
    setBusyNodeKey(nodeKey);
    setError('');
    try {
      const response = await fetch(`/api/home-automation/devices/${encodeURIComponent(nodeId)}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Device action failed (${response.status})`);
      await loadTopology();
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
    } finally {
      setBusyNodeKey('');
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
        <p>Auto-refreshes every 30 seconds. Click the arrow (▶/▼) to expand/collapse nodes with children.</p>
        <div className="topology-actions">
          <button type="button" onClick={loadTopology}>Refresh now</button>
          <span className="topology-last-refresh">Last refresh: {lastRefreshedAt || 'never'}</span>
        </div>
      </header>

      {loading ? <div className="topology-info">Loading topology...</div> : null}
      {error ? <div className="topology-error">{error}</div> : null}

      <section className="topology-section">
        <h2>Tree View</h2>
        {tree.roots.length > 0 ? (
          <ul className="topology-tree-list">
            {tree.roots.map((rootKey) => (
              <TreeNode key={rootKey} nodeKey={rootKey} tree={tree} depth={0} expanded={expanded} onToggle={handleToggleNode} onRename={handleRenameNode} onSetParent={handleSetParent} onDeviceAction={handleDeviceAction} busyNodeKey={busyNodeKey} />
            ))}
          </ul>
        ) : null}
        <div className="topology-free-pool">
          <h3>Free Pool <span>{tree.freePool.length}</span></h3>
          {tree.freePool.length === 0 ? <div className="topology-info">No unassigned or waiting nodes.</div> : (
            <ul className="topology-tree-list">
              {tree.freePool.map((nodeKey) => (
                <TreeNode key={nodeKey} nodeKey={nodeKey} tree={tree} depth={0} expanded={expanded} onToggle={handleToggleNode} onRename={handleRenameNode} onSetParent={handleSetParent} onDeviceAction={handleDeviceAction} busyNodeKey={busyNodeKey} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="topology-section">
        <h2>Raw Node List</h2>
        <div className="topology-table-wrap">
          <table className="topology-table">
            <thead>
              <tr>
                <th>Node</th>
                <th>IP</th>
                <th>Transport</th>
                <th>Parent</th>
                <th>Cluster</th>
                <th>Site</th>
                <th>Site Mode</th>
                <th>Site Category</th>
                <th>Children</th>
                <th>Cluster Controller</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const key = getNodeKey(node);
                const children = tree.childrenByParent.get(key) || [];
                const transport = getNodeTransport(node);
                return (
                  <tr key={key || Math.random()}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <NodeCapabilityIcons node={node} />
                        {String(node?.nodeName || node?.nodeId || key || 'unknown')}
                      </span>
                    </td>
                    <td>{String(node?.ip || 'n/a')}</td>
                    <td><TransportBadge protocol={transport.protocol} /> {transport.endpoint}</td>
                    <td>{String(node?.topology?.parentNodeId || '-')}</td>
                    <td>{String(node?.topology?.activeClusterId || 'default')}</td>
                    <td>{String(node?.topology?.siteName || node?.topology?.siteId || 'primary-site')}</td>
                    <td>{String(node?.topology?.siteMode || 'hot-warm')}</td>
                    <td>{String(node?.topology?.siteCategory || 'internal')}</td>
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