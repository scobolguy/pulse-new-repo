import { useEffect, useState, memo } from 'react';
import { actorHeaders } from './http-client.js';

const FREE_POOL_CLUSTER_ID = 'free-pool';

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function getNodeKey(node) {
  return normalizeId(node?.topology?.nodeKey || node?.nodeId || node?.id || node?.ip || node?.nodeName);
}

function getNodeLabel(node) {
  return String(node?.details?.nodeName || node?.nodeName || node?.nodeId || node?.ip || '').trim();
}

function resolveSiteId(node) {
  const details = node?.details || {};
  const cluster = details?.cluster && typeof details.cluster === 'object' ? details.cluster : {};
  const raw =
    details.siteId
    || details.site
    || cluster.siteId
    || cluster.site
    || 'default-site';
  return String(raw || 'default-site').trim() || 'default-site';
}

function sortNodesByLabel(nodes) {
  return [...nodes].sort((a, b) => getNodeLabel(a).localeCompare(getNodeLabel(b)));
}

function getServiceKey(service) {
  if (typeof service === 'string') return normalizeId(service);
  return normalizeId(service?.name || service?.serviceName);
}

function getDeviceKey(device) {
  return normalizeId(device?.name || device?.deviceName || device?.id);
}

function getNodeServiceCount(node) {
  const set = new Set();
  const services = Array.isArray(node?.details?.services) ? node.details.services : [];
  for (const service of services) {
    const key = getServiceKey(service);
    if (key) set.add(key);
  }
  return set.size;
}

function getNodeDeviceCount(node) {
  const set = new Set();
  const devices = Array.isArray(node?.details?.devices) ? node.details.devices : [];
  for (const device of devices) {
    const key = getDeviceKey(device);
    if (key) set.add(key);
  }
  return set.size;
}

function SiteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 20h18v1H3zM5 19V8l7-5 7 5v11h-2v-5h-3v5h-4v-5H7v5z" fill="#f9a825" />
    </svg>
  );
}

function ClusterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h7v6H3zm11 0h7v6h-7zM8 15h8v6H8z" fill="#43a047" />
      <path d="M10 9h4M12 12v3" stroke="#2e7d32" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

function NodeLeafIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="12" rx="2" fill="#1e88e5" />
      <rect x="9" y="18" width="6" height="2" rx="1" fill="#1565c0" />
    </svg>
  );
}

function NodeBranchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#42a5f5" />
      <path d="M3 9h18" stroke="#1e88e5" strokeWidth="1.4" />
    </svg>
  );
}

function getPresenceClientIdentity() {
  const key = 'pulse.presenceClientId';
  let clientId = localStorage.getItem(key);
  if (!clientId) {
    clientId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem(key, clientId);
  }
  const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '').toLowerCase() : '';
  const isMac = ua.includes('macintosh') || ua.includes('mac os x');
  const nodeName = isMac ? 'MacBook Client' : 'Web Client';
  return { clientId, nodeName };
}

function isPmachineNode(node) {
  const details = node?.details || {};
  const hardware = String(details.hardware || '').toLowerCase();
  const serviceName = String(node?.serviceName || '').toLowerCase();
  const runtime = String(details.runtime || node?.runtime || '').toLowerCase();
  const deviceRole = String(details.deviceRole || node?.deviceRole || '').toLowerCase();
  const services = Array.isArray(details.services) ? details.services.map((service) => String(service).toLowerCase()) : [];
  return (
    hardware.includes('pmachine') ||
    hardware.includes('esp32') ||
    hardware.includes('esp8266') ||
    serviceName.includes('pmachine') ||
    serviceName.includes('esp32-node') ||
    runtime.includes('pmachine') ||
    runtime.includes('javascript') ||
    deviceRole.length > 0 ||
    services.some((service) => service.includes('pmachine'))
  );
}

// Memoized NodeCard to prevent unnecessary re-renders
const NodeCard = memo(function NodeCard({ node, anchorId, title, onRename, onSetGateway, onSetParent, clusterModeEnabled = false }) {
  // Force re-render every second for live color updates
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const inactiveMs = nowTs - node.lastSeen;
  let bg = '#e8f5e9'; // green
  if (inactiveMs > 5 * 60 * 1000) bg = '#ffebee'; // red
  else if (inactiveMs > 2 * 60 * 1000) bg = '#fffde7'; // yellow

  // Context menu state
  const [menu, setMenu] = useState(null);

  // Handle right-click
  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };
  // Close menu on click elsewhere
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  const handleRename = async () => {
    const currentName = String(node.details?.nodeName || node.nodeName || node.ip || '').trim();
    const nextName = window.prompt('Rename node', currentName);
    if (typeof nextName !== 'string') {
      setMenu(null);
      return;
    }
    const trimmed = nextName.trim();
    if (!trimmed) {
      setMenu(null);
      return;
    }
    if (trimmed === currentName) {
      setMenu(null);
      return;
    }
    try {
      if (typeof onRename === 'function') {
        await onRename(node, trimmed);
      }
    } catch (error) {
      window.alert(error?.message || 'Rename failed.');
    }
    setMenu(null);
  };

  const handleSetGateway = async () => {
    try {
      if (typeof onSetGateway === 'function') {
        await onSetGateway(node, !Boolean(node?.topology?.isClusterGateway));
      }
    } catch (error) {
      window.alert(error?.message || 'Failed to update cluster gateway flag.');
    }
    setMenu(null);
  };

  const handleSetParent = async () => {
    try {
      if (typeof onSetParent === 'function') {
        await onSetParent(node);
      }
    } catch (error) {
      window.alert(error?.message || 'Failed to update parent node.');
    }
    setMenu(null);
  };

  const parentPort = node?.topology?.udp?.parentPort;
  const siblingPort = node?.topology?.udp?.siblingPort;
  const parentName = node?.topology?.parentNodeName || node?.topology?.parentNodeId || 'none';
  const isGateway = node?.topology?.isClusterGateway === true;

  return (
    <div id={anchorId} title={title} style={{ border: '1px solid #d4d4d4', background: bg, borderRadius: 4, padding: 8, minWidth: 90, maxWidth: 120, marginBottom: 8, boxShadow: '0 1px 2px #eee', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }} onContextMenu={handleContextMenu}>
      {/* Computer icon (SVG) */}
      <svg width="40" height="32" viewBox="0 0 40 32" style={{ marginBottom: 4 }}><rect x="2" y="6" width="36" height="18" rx="3" fill="#90a4ae" stroke="#263238" strokeWidth="1.5"/><rect x="8" y="10" width="24" height="10" rx="1.5" fill="#fff" stroke="#607d8b" strokeWidth="1"/><rect x="14" y="26" width="12" height="3" rx="1.5" fill="#607d8b"/></svg>
      {/* Node name */}
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1a237e', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', width: '100%' }} title={node.details?.nodeName || node.nodeName || node.ip}>
        {(node.details?.nodeName || node.nodeName) ? (node.details?.nodeName || node.nodeName) : <span style={{ color: '#888' }}>{node.ip}</span>}
      </div>
      {isGateway && <div style={{ fontSize: 11, fontWeight: 700, color: '#0d47a1', marginBottom: 2 }}>Cluster Gateway</div>}
      <div style={{ fontSize: 11, color: '#455a64', textAlign: 'center', width: '100%' }}>
        Parent: {parentName}
      </div>
      <div style={{ fontSize: 11, color: '#455a64', textAlign: 'center', width: '100%' }}>
        UDP parent:{typeof parentPort === 'number' ? parentPort : 'n/a'} sibling:{typeof siblingPort === 'number' ? siblingPort : 'n/a'}
      </div>
      <div style={{ fontSize: 10, color: '#607d8b', textAlign: 'center', width: '100%' }}>
        Flow: bottom -&gt; upper nodes
      </div>
      {/* Context menu */}
      {menu && (
        <ul style={{ position: 'fixed', top: menu.y, left: menu.x, background: '#fff', border: '1px solid #aaa', borderRadius: 4, boxShadow: '0 2px 8px #888', padding: 0, margin: 0, zIndex: 1000, minWidth: 120, listStyle: 'none', fontSize: 13 }}>
          <li onClick={handleRename} style={{ padding: '7px 12px', cursor: 'pointer', fontWeight: 700, color: '#0d47a1', borderBottom: clusterModeEnabled ? '1px solid #e0e0e0' : 'none' }}>Rename</li>
          {clusterModeEnabled && (
            <>
              <li onClick={handleSetGateway} style={{ padding: '6px 12px', cursor: 'pointer' }}>{isGateway ? 'Unset Cluster Gateway' : 'Set Cluster Gateway'}</li>
              <li onClick={handleSetParent} style={{ padding: '6px 12px', cursor: 'pointer' }}>Set Parent Node</li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if node content or status changes
  return (
    prevProps.node.lastSeen === nextProps.node.lastSeen &&
    JSON.stringify(prevProps.node.details) === JSON.stringify(nextProps.node.details) &&
    JSON.stringify(prevProps.node.topology) === JSON.stringify(nextProps.node.topology)
  );
});

export default function TopologyDashboard() {

  const [topology, setTopology] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [expandedTree, setExpandedTree] = useState({});
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState({ status: 'unknown', available: false, draining: false });
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  // Use current hostname for backend URL by default
  let defaultBackendUrl = 'http://localhost:4000';
  if (typeof window !== 'undefined' && window.location) {
    const { hostname } = window.location;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      defaultBackendUrl = `http://${hostname}:4000`;
    }
  }
  const [backendUrl, setBackendUrl] = useState(defaultBackendUrl);
  const [presenceIdentity] = useState(() => getPresenceClientIdentity());
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [clusterModeEnabled, setClusterModeEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pulse.topology.clusterMode') === '1';
  });

  const activePhysicalNodes = topology.filter(node => {
    const isActive = nowTs - node.lastSeen <= 10 * 60 * 1000;
    const isLoopback = node.ip === '127.0.0.1' || node.ip === '::1' || node.nodeName === 'Aggregator Backend';
    return isActive && !isLoopback;
  });

  const pmachineNodes = activePhysicalNodes.filter(isPmachineNode);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('pulse.topology.clusterMode', clusterModeEnabled ? '1' : '0');
  }, [clusterModeEnabled]);

  async function fetchAvailability(url = backendUrl) {
    try {
      const statusUrl = `${url}/api/presence/client/status?clientId=${encodeURIComponent(presenceIdentity.clientId)}`;
      const res = await fetch(statusUrl, { headers: actorHeaders() });
      const payload = await res.json();
      if (!res.ok) {
        return;
      }
      setAvailability(payload || { status: 'unknown', available: false, draining: false });
    } catch {
      setAvailability({ status: 'unknown', available: false, draining: false });
    }
  }

  async function setAvailable(nextAvailable) {
    setAvailabilityBusy(true);
    try {
      const endpoint = nextAvailable ? '/api/presence/client/available' : '/api/presence/client/unavailable';
      await fetch(backendUrl + endpoint, {
        method: 'POST',
        headers: actorHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          clientId: presenceIdentity.clientId,
          nodeName: presenceIdentity.nodeName
        })
      });
      await fetchAvailability(backendUrl);
      await fetchTopology(backendUrl);
    } finally {
      setAvailabilityBusy(false);
    }
  }

  async function fetchTopology(url = backendUrl) {
    setLoading(true);
    try {
      const [nodesRes, clustersRes] = await Promise.all([
        fetch(url + '/api/nodes', { headers: actorHeaders() }),
        fetch(url + '/api/clusters', { headers: actorHeaders() })
      ]);
      const nodes = await nodesRes.json();
      const clusterPayload = await clustersRes.json().catch(() => ({ clusters: [] }));
      setTopology(nodes);
      setClusters(Array.isArray(clusterPayload?.clusters) ? clusterPayload.clusters : []);
    } catch {
      setTopology([]);
      setClusters([]);
    }
    setLoading(false);
  }

  function buildTreeBySite() {
    const activeNodes = pmachineNodes;
    const nodeByKey = new Map();
    const aliasToNodeKey = new Map();

    function getNodeAliases(node) {
      return [
        getNodeKey(node),
        normalizeId(node?.topology?.nodeKey),
        normalizeId(node?.nodeId),
        normalizeId(node?.id),
        normalizeId(node?.ip),
        normalizeId(node?.nodeName),
        normalizeId(node?.details?.nodeName)
      ].filter(Boolean);
    }

    for (const node of activeNodes) {
      const key = getNodeKey(node);
      if (key) {
        nodeByKey.set(key, node);
        for (const alias of getNodeAliases(node)) {
          if (!aliasToNodeKey.has(alias)) aliasToNodeKey.set(alias, key);
        }
      }
    }

    function resolveParentNodeKey(rawParentValue) {
      const normalized = normalizeId(rawParentValue);
      if (!normalized) return '';
      return aliasToNodeKey.get(normalized) || normalized;
    }

    const clusterByNode = new Map();
    const clusterLabelById = new Map();
    for (const cluster of Array.isArray(clusters) ? clusters : []) {
      const clusterId = normalizeId(cluster?.clusterId);
      if (!clusterId) continue;
      clusterLabelById.set(clusterId, String(cluster?.label || clusterId));
      for (const rawNodeId of Array.isArray(cluster?.nodes) ? cluster.nodes : []) {
        const nodeId = normalizeId(rawNodeId);
        if (nodeId) clusterByNode.set(nodeId, clusterId);
      }
    }
    if (!clusterLabelById.has(FREE_POOL_CLUSTER_ID)) {
      clusterLabelById.set(FREE_POOL_CLUSTER_ID, 'Free Pool');
    }

    const resolvedClusterByNode = new Map();
    function resolveUiCluster(nodeKey, visiting = new Set()) {
      const normalizedKey = normalizeId(nodeKey);
      if (!normalizedKey) return FREE_POOL_CLUSTER_ID;
      if (resolvedClusterByNode.has(normalizedKey)) {
        return resolvedClusterByNode.get(normalizedKey);
      }
      if (visiting.has(normalizedKey)) {
        return FREE_POOL_CLUSTER_ID;
      }

      visiting.add(normalizedKey);
      const node = nodeByKey.get(normalizedKey);
      const parentKey = resolveParentNodeKey(node?.topology?.parentNodeId);

      let resolvedCluster = '';
      if (parentKey && nodeByKey.has(parentKey)) {
        resolvedCluster = resolveUiCluster(parentKey, visiting);
      } else {
        resolvedCluster = clusterByNode.get(normalizedKey) || normalizeId(node?.topology?.activeClusterId) || FREE_POOL_CLUSTER_ID;
      }

      visiting.delete(normalizedKey);
      if (!resolvedCluster) resolvedCluster = FREE_POOL_CLUSTER_ID;
      resolvedClusterByNode.set(normalizedKey, resolvedCluster);
      return resolvedCluster;
    }

    const sites = new Map();
    for (const node of activeNodes) {
      const nodeKey = getNodeKey(node);
      if (!nodeKey) continue;

      const clusterId = resolveUiCluster(nodeKey);
      const siteId = resolveSiteId(node);

      if (!sites.has(siteId)) {
        sites.set(siteId, {
          siteId,
          clusters: new Map()
        });
      }
      const site = sites.get(siteId);
      if (!site.clusters.has(clusterId)) {
        site.clusters.set(clusterId, {
          clusterId,
          label: clusterLabelById.get(clusterId) || clusterId,
          nodes: []
        });
      }
      site.clusters.get(clusterId).nodes.push(node);
    }

    const renderedSites = [];
    for (const site of sites.values()) {
      const renderedClusters = [];
      const siteServiceSet = new Set();
      const siteDeviceSet = new Set();

      for (const cluster of site.clusters.values()) {
        const nodesInCluster = sortNodesByLabel(cluster.nodes);
        const clusterNodeMap = new Map();
        const childrenByParent = new Map();
        const clusterServiceSet = new Set();
        const clusterDeviceSet = new Set();

        for (const node of nodesInCluster) {
          const key = getNodeKey(node);
          if (key) clusterNodeMap.set(key, node);

          const services = Array.isArray(node?.details?.services) ? node.details.services : [];
          for (const service of services) {
            const svcKey = getServiceKey(service);
            if (svcKey) {
              clusterServiceSet.add(svcKey);
              siteServiceSet.add(svcKey);
            }
          }

          const devices = Array.isArray(node?.details?.devices) ? node.details.devices : [];
          for (const device of devices) {
            const devKey = getDeviceKey(device);
            if (devKey) {
              clusterDeviceSet.add(devKey);
              siteDeviceSet.add(devKey);
            }
          }
        }

        for (const node of nodesInCluster) {
          const parentKey = resolveParentNodeKey(node?.topology?.parentNodeId);
          const parentInCluster = parentKey && clusterNodeMap.has(parentKey);
          const attachKey = parentInCluster ? parentKey : '';
          if (!childrenByParent.has(attachKey)) childrenByParent.set(attachKey, []);
          childrenByParent.get(attachKey).push(node);
        }

        for (const key of childrenByParent.keys()) {
          childrenByParent.set(key, sortNodesByLabel(childrenByParent.get(key) || []));
        }

        renderedClusters.push({
          clusterId: cluster.clusterId,
          label: cluster.label,
          roots: childrenByParent.get('') || [],
          childrenByParent,
          serviceCount: clusterServiceSet.size,
          deviceCount: clusterDeviceSet.size
        });
      }

      renderedClusters.sort((a, b) => {
        if (a.clusterId === FREE_POOL_CLUSTER_ID) return -1;
        if (b.clusterId === FREE_POOL_CLUSTER_ID) return 1;
        return a.label.localeCompare(b.label);
      });

      renderedSites.push({
        siteId: site.siteId,
        clusters: renderedClusters,
        serviceCount: siteServiceSet.size,
        deviceCount: siteDeviceSet.size
      });
    }

    renderedSites.sort((a, b) => a.siteId.localeCompare(b.siteId));
    return renderedSites;
  }

  const treeBySite = buildTreeBySite();
  const safeTreeBySite = Array.isArray(treeBySite) ? treeBySite : [];

  useEffect(() => {
    setExpandedTree((current) => {
      const next = { ...current };
      for (const site of safeTreeBySite) {
        if (!site || typeof site !== 'object') continue;
        const siteKey = `site:${site.siteId}`;
        if (!(siteKey in next)) next[siteKey] = true;
        const clustersForSite = Array.isArray(site?.clusters) ? site.clusters : [];
        for (const cluster of clustersForSite) {
          if (!cluster || typeof cluster !== 'object') continue;
          const clusterKey = `cluster:${site.siteId}:${cluster.clusterId}`;
          if (!(clusterKey in next)) next[clusterKey] = false;
        }
      }
      return next;
    });
  }, [safeTreeBySite]);

  function toggleTreeRow(rowId) {
    setExpandedTree((current) => ({
      ...current,
      [rowId]: !Boolean(current[rowId])
    }));
  }

  function renderTreeNode(node, treeScope, childrenByParent, depth = 0, visited = new Set(), branchState = []) {
    const key = getNodeKey(node);
    if (!key || visited.has(key)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(key);
    const children = childrenByParent.get(key) || [];
    const hasChildren = children.length > 0;
    const rowId = `node:${treeScope}:${key}`;
    const expanded = Boolean(expandedTree[rowId]);
    const serviceCount = getNodeServiceCount(node);
    const deviceCount = getNodeDeviceCount(node);
    const tooltip = `Node: ${getNodeLabel(node)} | services: ${serviceCount} | devices: ${deviceCount}`;

    const branchSegments = branchState.map((hasNextSibling) => (hasNextSibling ? '│  ' : '   '));
    const branchPrefix = depth > 0 ? `${branchSegments.join('')}├─ ` : '';

    return (
      <div key={`${rowId}:${depth}`} style={{ marginTop: 1 }}>
        <div
          title={tooltip}
          style={{
            marginLeft: depth * 14,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minHeight: 18,
            borderRadius: 4,
            padding: '0 2px',
            cursor: hasChildren ? 'pointer' : 'default',
            position: 'relative'
          }}
          onClick={() => {
            if (hasChildren) toggleTreeRow(rowId);
          }}
        >
          {depth > 0 && (
            <span
              aria-hidden="true"
              style={{
                color: '#000',
                fontFamily: 'Consolas, monospace',
                fontWeight: 700,
                whiteSpace: 'pre',
                marginRight: 2
              }}
            >
              {branchPrefix}
            </span>
          )}
          <span style={{ width: 12, display: 'inline-block', color: '#546e7a', fontFamily: 'Consolas, monospace' }}>
            {hasChildren ? (expanded ? '▾' : '▸') : ''}
          </span>
          <span style={{ width: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasChildren ? <NodeBranchIcon /> : <NodeLeafIcon />}
          </span>
          <span style={{ color: '#263238' }}>{getNodeLabel(node)}</span>
          <span style={{ fontSize: 11, color: '#607d8b' }}>S:{serviceCount} D:{deviceCount}</span>
        </div>
        {hasChildren && expanded && (
          <div style={{ marginLeft: 6, paddingLeft: 4 }}>
            {children.map((child, index) => {
              const isLastChild = index === children.length - 1;
              const nextBranchState = [...branchState, !isLastChild];
              return renderTreeNode(child, treeScope, childrenByParent, depth + 1, nextVisited, nextBranchState);
            })}
          </div>
        )}
      </div>
    );
  }

  async function renameNode(node, nextName) {
    const nodeId = String(node?.nodeId || node?.id || node?.ip || node?.nodeName || '').trim();
    if (!nodeId) {
      throw new Error('Node id not available for rename.');
    }

    const res = await fetch(`${backendUrl}/api/nodes/${encodeURIComponent(nodeId)}/rename`, {
      method: 'POST',
      headers: actorHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ nodeName: nextName, ip: node?.ip || '' })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || `Rename failed (${res.status})`);
    }
    await fetchTopology(backendUrl);
  }

  async function updateNodeTopology(node, patch) {
    const nodeId = String(node?.nodeId || node?.id || node?.ip || node?.nodeName || '').trim();
    if (!nodeId) {
      throw new Error('Node id not available for topology update.');
    }

    const res = await fetch(`${backendUrl}/api/nodes/${encodeURIComponent(nodeId)}/topology`, {
      method: 'POST',
      headers: actorHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        ip: node?.ip || '',
        nodeId,
        ...patch
      })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || `Topology update failed (${res.status})`);
    }

    await fetchTopology(backendUrl);
  }

  async function setNodeGateway(node, isClusterGateway) {
    await updateNodeTopology(node, {
      isClusterGateway: isClusterGateway === true,
      parentNodeId: node?.topology?.parentNodeId || ''
    });
  }

  async function chooseParentNode(node) {
    const currentParent = String(node?.topology?.parentNodeId || '').trim();
    const candidates = activePhysicalNodes
      .filter((candidate) => {
        const candidateId = String(candidate?.topology?.nodeKey || candidate?.nodeId || candidate?.id || candidate?.ip || '').trim();
        const currentId = String(node?.topology?.nodeKey || node?.nodeId || node?.id || node?.ip || '').trim();
        return candidateId && currentId && candidateId !== currentId;
      })
      .map((candidate) => {
        const id = String(candidate?.topology?.nodeKey || candidate?.nodeId || candidate?.id || candidate?.ip || '').trim();
        const name = String(candidate?.details?.nodeName || candidate?.nodeName || candidate?.ip || id).trim();
        return { id, name };
      });

    const optionsText = candidates.length > 0
      ? candidates.map((candidate) => `${candidate.name} -> ${candidate.id}`).join('\n')
      : 'No parent candidates available.';
    const promptText = `Set parent node id (empty or \"none\" to clear).\nCurrent: ${currentParent || 'none'}\n\nCandidates:\n${optionsText}`;
    const input = window.prompt(promptText, currentParent || '');
    if (input === null) return;

    const nextParentRaw = String(input || '').trim();
    const nextParent = !nextParentRaw || nextParentRaw.toLowerCase() === 'none' ? '' : nextParentRaw.toLowerCase();
    await updateNodeTopology(node, {
      isClusterGateway: node?.topology?.isClusterGateway === true,
      parentNodeId: nextParent
    });
  }

  useEffect(() => {
    setTimeout(() => {
      void fetchTopology(backendUrl);
      void fetchAvailability(backendUrl);
    }, 0);
    const interval = setInterval(() => fetchTopology(backendUrl), 30000);
    const availabilityInterval = setInterval(async () => {
      if (availability.available) {
        try {
          await fetch(`${backendUrl}/api/presence/client/heartbeat`, {
            method: 'POST',
            headers: actorHeaders({ 'content-type': 'application/json' }),
            body: JSON.stringify({ clientId: presenceIdentity.clientId })
          });
        } catch {
          // Ignore heartbeat errors; status refresh below will reflect current state.
        }
      }
      await fetchAvailability(backendUrl);
    }, 5000);
    return () => {
      clearInterval(interval);
      clearInterval(availabilityInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, availability.available, presenceIdentity.clientId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 12, fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', fontSize: 13, background: '#f3f3f3' }}>
      <div style={{ marginBottom: 12 }}>
        <label>Backend URL: </label>
        <input value={backendUrl} onChange={e => setBackendUrl(e.target.value)} size={40} style={{ fontSize: 13, padding: '2px 6px', borderRadius: 4, border: '1px solid #bbb', marginRight: 8 }} />
        <button onClick={() => fetchTopology(backendUrl)} style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, border: '1px solid #bbb' }}>Refresh</button>
        <button
          onClick={() => setClusterModeEnabled((prev) => !prev)}
          style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, border: '1px solid #bbb', marginLeft: 8 }}
        >
          {clusterModeEnabled ? 'Disable Cluster Mode' : 'Enable Cluster Mode'}
        </button>
        <button
          onClick={() => setAvailable(!availability.available)}
          disabled={availabilityBusy || availability.draining}
          style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, border: '1px solid #bbb', marginLeft: 8 }}
        >
          {availability.draining ? 'Draining...' : (availability.available ? "I'm unavailable" : "I'm available")}
        </button>
        <span style={{ marginLeft: 8, fontSize: 12, color: availability.available ? '#1b5e20' : '#6d4c41' }}>
          Status: {availability.status || (availability.available ? 'available' : 'unavailable')}
        </span>
        {typeof availability.workload?.inFlight === 'number' && (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#455a64' }}>
            In-flight: {availability.workload.inFlight}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 2, marginRight: 16 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 10px 0', color: '#3a4a5e' }}>Site / Cluster Tree Topology</h3>
          <div style={{ fontSize: 12, color: '#546e7a', marginBottom: 8 }}>
            Explorer view: expand or collapse sites, clusters, and node subtrees. Child rows are lazy-rendered only when expanded.
          </div>
          {loading && <p style={{ fontSize: 12 }}>Loading...</p>}
          {pmachineNodes.length === 0 && !loading && <p style={{ fontSize: 12 }}>No PMachine nodes are currently visible.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: '#fff', border: '1px solid #cfd8dc', borderRadius: 6, padding: 6 }}>
            {safeTreeBySite.map((site) => (
              <div key={site.siteId}>
                {(() => {
                  const siteRowId = `site:${site.siteId}`;
                  const siteExpanded = Boolean(expandedTree[siteRowId]);
                  const siteTooltip = `Site: ${site.siteId} | deduped services: ${site.serviceCount} | deduped devices: ${site.deviceCount}`;
                  const clustersForSite = Array.isArray(site?.clusters) ? site.clusters : [];
                  return (
                    <>
                      <div
                        title={siteTooltip}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 18, borderRadius: 4, padding: '0 2px', cursor: 'pointer' }}
                        onClick={() => toggleTreeRow(siteRowId)}
                      >
                        <span style={{ width: 14, display: 'inline-block', color: '#546e7a', fontFamily: 'Consolas, monospace' }}>{siteExpanded ? 'v' : '>'}</span>
                        <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><SiteIcon /></span>
                        <span style={{ fontWeight: 700, color: '#1a237e' }}>{site.siteId}</span>
                        <span style={{ fontSize: 11, color: '#607d8b' }}>S:{site.serviceCount} D:{site.deviceCount}</span>
                      </div>
                      {siteExpanded && clustersForSite.map((cluster) => {
                        const clusterTooltip = `Cluster: ${cluster.label} (${cluster.clusterId}) | deduped services below: ${cluster.serviceCount} | deduped devices below: ${cluster.deviceCount}`;
                        const treeScope = `${site.siteId}:${cluster.clusterId}`;
                        const clusterRowId = `cluster:${site.siteId}:${cluster.clusterId}`;
                        const clusterExpanded = Boolean(expandedTree[clusterRowId]);

                        return (
                          <div key={`${site.siteId}:${cluster.clusterId}`} style={{ marginLeft: 14 }} title={clusterTooltip}>
                            <div
                              style={{ marginLeft: 2, marginBottom: 1, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                              onClick={() => toggleTreeRow(clusterRowId)}
                            >
                              <span style={{ width: 14, display: 'inline-block', color: '#546e7a', fontFamily: 'Consolas, monospace' }}>
                                {clusterExpanded ? '▾' : '▸'}
                              </span>
                              <ClusterIcon />
                              <span style={{ fontWeight: 600, color: '#455a64' }}>{cluster.label}</span>
                              <span style={{ fontSize: 11, color: '#607d8b' }}>S:{cluster.serviceCount} D:{cluster.deviceCount}</span>
                            </div>
                            {clusterExpanded && (
                              <div style={{ marginLeft: 14 }}>
                                {cluster.roots.length === 0 && <div style={{ fontSize: 12, color: '#607d8b' }}>No nodes in this cluster.</div>}
                                {cluster.roots.map((rootNode, rootIndex) => {
                                  const rootHasNextSibling = rootIndex < cluster.roots.length - 1;
                                  return renderTreeNode(rootNode, treeScope, cluster.childrenByParent, 0, new Set(), [rootHasNextSibling]);
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
