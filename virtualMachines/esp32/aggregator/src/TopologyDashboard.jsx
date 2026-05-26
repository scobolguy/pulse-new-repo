import React, { useEffect, useMemo, useState, memo } from 'react';

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
  const services = Array.isArray(details.services) ? details.services.map((service) => String(service).toLowerCase()) : [];
  return hardware.includes('pmachine') || serviceName.includes('pmachine') || services.some((service) => service.includes('pmachine'));
}

function getClusterLabel(node) {
  const details = node?.details || {};
  return String(details.clusterName || details.clusterId || node?.clusterName || node?.clusterId || 'Unclustered');
}

function escapeMermaidLabel(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function makeMermaidId(value) {
  return String(value || 'node')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^([0-9])/, 'n_$1')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function buildTopologyEntries(clusterGroups) {
  return Object.entries(clusterGroups).map(([clusterLabel, nodes], clusterIndex) => {
    const clusterId = makeMermaidId(`cluster_${clusterIndex}_${clusterLabel}`);
    const clusterNodeId = `${clusterId}_parent`;
    const clusterAnchorId = `cluster-${clusterId}`;

    const nodeEntries = nodes.map((node, nodeIndex) => {
      const nodeLabel = node.details?.nodeName || node.nodeName || node.ip || `pmachine-${nodeIndex + 1}`;
      const nodeId = makeMermaidId(`${clusterId}_${nodeLabel}_${node.mac || node.ip || nodeIndex}`);
      const nodeAnchorId = `pmachine-${nodeId}`;
      const peers = Array.isArray(node.details?.discoveredNodes) ? node.details.discoveredNodes : [];
      const peerEntries = peers.map((peer, peerIndex) => {
        const peerLabel = peer.mac || peer.ip || `peer-${peerIndex + 1}`;
        const peerId = makeMermaidId(`${nodeId}_${peerLabel}_${peerIndex}`);
        return {
          peer,
          peerLabel,
          peerId,
          peerAnchorId: `peer-${peerId}`
        };
      });

      return {
        node,
        nodeLabel,
        nodeId,
        nodeAnchorId,
        peerEntries
      };
    });

    return {
      clusterLabel,
      clusterId,
      clusterNodeId,
      clusterAnchorId,
      nodeEntries
    };
  });
}

function buildTopologyMermaid(topologyEntries) {
  const lines = [
    'flowchart TB',
    '  classDef root fill:#223655,stroke:#5e7fb3,color:#ffffff,stroke-width:1px;',
    '  classDef cluster fill:#dbe7f7,stroke:#8fa9c5,color:#223655,stroke-width:1px;',
    '  classDef machine fill:#e8f5e9,stroke:#7fbf7f,color:#1a237e,stroke-width:1px;',
    '  classDef peer fill:#fff3cd,stroke:#e0c36a,color:#6b5300,stroke-width:1px;',
    '  topology_root["PMachine topology"]:::root'
  ];

  topologyEntries.forEach((cluster) => {
    lines.push(`  ${cluster.clusterNodeId}["${escapeMermaidLabel(`${cluster.clusterLabel} (${cluster.nodeEntries.length})`)}"]:::cluster`);
    lines.push(`  topology_root --> ${cluster.clusterNodeId}`);
    lines.push(`  click ${cluster.clusterNodeId} href "#${cluster.clusterAnchorId}" "View cluster details"`);

    cluster.nodeEntries.forEach((nodeEntry) => {
      lines.push(`  ${nodeEntry.nodeId}["${escapeMermaidLabel(nodeEntry.nodeLabel)}"]:::machine`);
      lines.push(`  ${cluster.clusterNodeId} --> ${nodeEntry.nodeId}`);
      lines.push(`  click ${nodeEntry.nodeId} href "#${nodeEntry.nodeAnchorId}" "View PMachine details"`);

      nodeEntry.peerEntries.forEach((peerEntry) => {
        lines.push(`  ${peerEntry.peerId}["${escapeMermaidLabel(peerEntry.peerLabel)}"]:::peer`);
        lines.push(`  ${nodeEntry.nodeId} --> ${peerEntry.peerId}`);
        lines.push(`  click ${peerEntry.peerId} href "#${peerEntry.peerAnchorId}" "View peer details"`);
      });
    });
  });

  return lines.join('\n');
}
// Memoized NodeCard to prevent unnecessary re-renders
const NodeCard = memo(function NodeCard({ node, anchorId, title }) {
  // Force re-render every second for live color updates
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick(tick => tick + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const inactiveMs = now - node.lastSeen;
  let bg = '#e8f5e9'; // green
  if (inactiveMs > 5 * 60 * 1000) bg = '#ffebee'; // red
  else if (inactiveMs > 2 * 60 * 1000) bg = '#fffde7'; // yellow

  // Context menu state
  const [menu, setMenu] = React.useState(null);

  // Handle right-click
  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };
  // Close menu on click elsewhere
  React.useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  return (
    <div id={anchorId} title={title} style={{ border: '1px solid #d4d4d4', background: bg, borderRadius: 4, padding: 8, minWidth: 90, maxWidth: 120, marginBottom: 8, boxShadow: '0 1px 2px #eee', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }} onContextMenu={handleContextMenu}>
      {/* Computer icon (SVG) */}
      <svg width="40" height="32" viewBox="0 0 40 32" style={{ marginBottom: 4 }}><rect x="2" y="6" width="36" height="18" rx="3" fill="#90a4ae" stroke="#263238" strokeWidth="1.5"/><rect x="8" y="10" width="24" height="10" rx="1.5" fill="#fff" stroke="#607d8b" strokeWidth="1"/><rect x="14" y="26" width="12" height="3" rx="1.5" fill="#607d8b"/></svg>
      {/* Node name */}
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1a237e', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', width: '100%' }} title={node.details?.nodeName || node.nodeName || node.ip}>
        {(node.details?.nodeName || node.nodeName) ? (node.details?.nodeName || node.nodeName) : <span style={{ color: '#888' }}>{node.ip}</span>}
      </div>
      {/* Context menu */}
      {menu && (
        <ul style={{ position: 'fixed', top: menu.y, left: menu.x, background: '#fff', border: '1px solid #aaa', borderRadius: 4, boxShadow: '0 2px 8px #888', padding: 0, margin: 0, zIndex: 1000, minWidth: 120, listStyle: 'none', fontSize: 13 }}>
          <li style={{ padding: '6px 12px', cursor: 'pointer' }}>Start</li>
          <li style={{ padding: '6px 12px', cursor: 'pointer' }}>Stop</li>
          <li style={{ padding: '6px 12px', cursor: 'pointer' }}>Quiesce</li>
          <li style={{ padding: '6px 12px', cursor: 'pointer' }}>Reboot</li>
        </ul>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if node content or status changes
  return (
    prevProps.node.lastSeen === nextProps.node.lastSeen &&
    JSON.stringify(prevProps.node.details) === JSON.stringify(nextProps.node.details)
  );
});

export default function TopologyDashboard({ permissions = [] }) {

  const [topology, setTopology] = useState([]);
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

  const activePhysicalNodes = topology.filter(node => {
    const now = Date.now();
    const isActive = now - node.lastSeen <= 10 * 60 * 1000;
    const isLoopback = node.ip === '127.0.0.1' || node.ip === '::1' || node.nodeName === 'Aggregator Backend';
    const isAvailable = node.availability?.available !== false;
    return isActive && !isLoopback && isAvailable;
  });

  const pmachineNodes = activePhysicalNodes.filter(isPmachineNode);

  const clusterGroups = pmachineNodes.reduce((groups, node) => {
    const clusterLabel = getClusterLabel(node);
    if (!groups[clusterLabel]) {
      groups[clusterLabel] = [];
    }
    groups[clusterLabel].push(node);
    return groups;
  }, {});

  const topologyEntries = useMemo(() => buildTopologyEntries(clusterGroups), [clusterGroups]);

  const discoveredNodes = topologyEntries.flatMap((cluster) =>
    cluster.nodeEntries.flatMap((nodeEntry) =>
      nodeEntry.peerEntries.map((peerEntry) => ({
        key: `${peerEntry.peerId}-${nodeEntry.nodeId}`,
        source: nodeEntry.node,
        peer: peerEntry.peer,
        peerAnchorId: peerEntry.peerAnchorId
      }))
    )
  );

  const topologyMermaidSource = useMemo(() => buildTopologyMermaid(topologyEntries), [topologyEntries]);
  const [topologyMermaidSvg, setTopologyMermaidSvg] = useState('');
  const [topologyMermaidError, setTopologyMermaidError] = useState('');

  useEffect(() => {
    if (!topologyMermaidSource) {
      setTopologyMermaidSvg('');
      setTopologyMermaidError('');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'base'
        });
        const renderId = `topology-diagram-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const { svg } = await mermaid.render(renderId, topologyMermaidSource);
        if (!cancelled) {
          setTopologyMermaidSvg(svg);
          setTopologyMermaidError('');
        }
      } catch (error) {
        if (!cancelled) {
          setTopologyMermaidSvg('');
          setTopologyMermaidError(error?.message || 'Unable to render topology diagram.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [topologyMermaidSource]);

  async function fetchAvailability(url = backendUrl) {
    try {
      const statusUrl = `${url}/api/presence/client/status?clientId=${encodeURIComponent(presenceIdentity.clientId)}`;
      const res = await fetch(statusUrl);
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
        headers: { 'content-type': 'application/json' },
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
      const res = await fetch(url + '/api/nodes');
      const nodes = await res.json();
      setTopology(nodes);
    } catch {
      setTopology([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchTopology(backendUrl);
    fetchAvailability(backendUrl);
    const interval = setInterval(() => fetchTopology(backendUrl), 30000);
    const availabilityInterval = setInterval(async () => {
      if (availability.available) {
        try {
          await fetch(`${backendUrl}/api/presence/client/heartbeat`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 12, fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', fontSize: 13, background: '#f3f3f3' }}>
      <div style={{ marginBottom: 12 }}>
        <label>Backend URL: </label>
        <input value={backendUrl} onChange={e => setBackendUrl(e.target.value)} size={40} style={{ fontSize: 13, padding: '2px 6px', borderRadius: 4, border: '1px solid #bbb', marginRight: 8 }} />
        <button onClick={() => fetchTopology(backendUrl)} style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, border: '1px solid #bbb' }}>Refresh</button>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 16px 0' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#2d2d2d' }}>PMachine Cluster Topology</h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 28,
              padding: '2px 8px',
              borderRadius: 999,
              background: '#dbe7f7',
              color: '#223655',
              border: '1px solid #b8c9df',
              fontSize: 12,
              fontWeight: 700
            }}>
              {pmachineNodes.length}
            </span>
          </div>
          <div style={{ marginBottom: 16 }}>
            {topologyMermaidError ? (
              <div style={{ fontSize: 12, color: '#8b3f3f', marginBottom: 10 }}>{topologyMermaidError}</div>
            ) : topologyMermaidSvg ? (
              <div
                style={{
                  border: '1px solid #d7dce3',
                  background: '#ffffff',
                  borderRadius: 10,
                  padding: 10,
                  overflow: 'auto',
                  marginBottom: 12
                }}
                dangerouslySetInnerHTML={{ __html: topologyMermaidSvg }}
              />
            ) : (
              <p style={{ fontSize: 12 }}>Loading topology diagram...</p>
            )}
          </div>
          {pmachineNodes.length === 0 && !loading && <p style={{ fontSize: 12 }}>No PMachine nodes are currently visible.</p>}
          {pmachineNodes.length > 0 && topologyEntries.map((cluster) => (
            <div key={cluster.clusterId} id={cluster.clusterAnchorId} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 10px 0', color: '#3a4a5e' }}>{cluster.clusterLabel} ({cluster.nodeEntries.length})</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {cluster.nodeEntries.map((nodeEntry) => (
                  <NodeCard
                    key={nodeEntry.node.mac || nodeEntry.node.ip || nodeEntry.node.nodeName}
                    node={nodeEntry.node}
                    anchorId={nodeEntry.nodeAnchorId}
                    title={nodeEntry.node.details?.nodeName || nodeEntry.node.nodeName || nodeEntry.node.ip}
                  />
                ))}
              </div>
            </div>
          ))}
          {discoveredNodes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 10px 0', color: '#3a4a5e' }}>Discovered Peers</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {discoveredNodes.map(({ key, source, peer, peerAnchorId }) => (
                  <div
                    key={key}
                    id={peerAnchorId}
                    style={{
                      border: '1px solid #d7dce3',
                      background: '#fff',
                      borderRadius: 8,
                      padding: 10,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#1a237e', marginBottom: 4 }}>{source.nodeName || source.ip}</div>
                    <div style={{ fontSize: 12, color: '#54616f' }}>Peer MAC: {peer.mac || 'n/a'}</div>
                    <div style={{ fontSize: 12, color: '#54616f' }}>Peer IP: {peer.ip || 'n/a'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {loading && <p style={{ fontSize: 12 }}>Loading...</p>}
          {activePhysicalNodes.length === 0 && !loading && <p style={{ fontSize: 12 }}>No active physical devices found.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {activePhysicalNodes.map((node) => (
              <NodeCard key={node.mac || node.ip} node={node} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
