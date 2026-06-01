import { useEffect, useState, memo } from 'react';

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
    serviceName.includes('pmachine') ||
    serviceName.includes('esp32-node') ||
    runtime.includes('pmachine') ||
    runtime.includes('javascript') ||
    deviceRole.length > 0 ||
    services.some((service) => service.includes('pmachine'))
  );
}

function getClusterLabel(node) {
  const details = node?.details || {};
  return String(details.clusterName || details.clusterId || node?.clusterName || node?.clusterId || 'Magic Cluster');
}

function makeMermaidId(value) {
  return String(value || 'node')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^([0-9])/, 'n_$1')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
// Memoized NodeCard to prevent unnecessary re-renders
const NodeCard = memo(function NodeCard({ node, anchorId, title }) {
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

export default function TopologyDashboard() {

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
  const [nowTs, setNowTs] = useState(() => Date.now());

  const activePhysicalNodes = topology.filter(node => {
    const isActive = nowTs - node.lastSeen <= 10 * 60 * 1000;
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

  const discoveredNodes = pmachineNodes.flatMap((node) => {
    const list = Array.isArray(node.details?.discoveredNodes) ? node.details.discoveredNodes : [];
    const nodeKey = makeMermaidId(node.details?.nodeName || node.nodeName || node.ip || node.mac || 'node');
    return list.map((peer, index) => {
      const peerKey = makeMermaidId(`${peer.mac || peer.ip || 'peer'}_${index}`);
      return {
        key: `${nodeKey}_${peerKey}`,
        source: node,
        peer,
        peerAnchorId: `peer-${nodeKey}_${peerKey}`
      };
    });
  });

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
          {pmachineNodes.length === 0 && !loading && <p style={{ fontSize: 12 }}>No PMachine nodes are currently visible.</p>}
          {pmachineNodes.length > 0 && Object.entries(clusterGroups).map(([clusterLabel, nodes], clusterIndex) => {
            const clusterId = makeMermaidId(`cluster_${clusterIndex}_${clusterLabel}`);
            return (
            <div key={clusterId} id={`cluster-${clusterId}`} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 10px 0', color: '#3a4a5e' }}>{clusterLabel} ({nodes.length})</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {nodes.map((node, nodeIndex) => {
                  const nodeLabel = node.details?.nodeName || node.nodeName || node.ip || `pmachine-${nodeIndex + 1}`;
                  const nodeId = makeMermaidId(`${clusterId}_${nodeLabel}_${node.mac || node.ip || nodeIndex}`);
                  return (
                  <NodeCard
                    key={node.mac || node.ip || node.nodeName}
                    node={node}
                    anchorId={`pmachine-${nodeId}`}
                    title={node.details?.nodeName || node.nodeName || node.ip}
                  />
                  );
                })}
              </div>
            </div>
            );
          })}
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
