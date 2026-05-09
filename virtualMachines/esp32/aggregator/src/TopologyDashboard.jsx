import React, { useEffect, useState, useRef, memo } from 'react';
import BrokerStatusCard from './BrokerStatusCard';
import TopologyServerDiagram from './TopologyServerDiagram';
// Memoized NodeCard to prevent unnecessary re-renders
const NodeCard = memo(function NodeCard({ node }) {
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
    <div style={{ border: '1px solid #d4d4d4', background: bg, borderRadius: 4, padding: 8, minWidth: 90, maxWidth: 120, marginBottom: 8, boxShadow: '0 1px 2px #eee', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }} onContextMenu={handleContextMenu}>
      {/* Computer icon (SVG) */}
      <svg width="40" height="32" viewBox="0 0 40 32" style={{ marginBottom: 4 }}><rect x="2" y="6" width="36" height="18" rx="3" fill="#90a4ae" stroke="#263238" strokeWidth="1.5"/><rect x="8" y="10" width="24" height="10" rx="1.5" fill="#fff" stroke="#607d8b" strokeWidth="1"/><rect x="14" y="26" width="12" height="3" rx="1.5" fill="#607d8b"/></svg>
      {/* Node name */}
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1a237e', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', width: '100%' }} title={node.details?.nodeName || node.ip}>
        {node.details?.nodeName ? node.details.nodeName : <span style={{ color: '#888' }}>{node.ip}</span>}
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

const SERVICE_PATHS = ['/status'];

function useDebugLogs() {
  const [debugLogs, setDebugLogs] = useState([]);
  const chatRef = useRef(null);
  const addDebugLog = (msg) => {
    setDebugLogs(logs => [...logs, { msg, ts: new Date().toLocaleTimeString() }]);
  };
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [debugLogs]);
  return { debugLogs, addDebugLog, chatRef };
}



export default function TopologyDashboard() {

  const [topology, setTopology] = useState([]);
  const [loading, setLoading] = useState(false);
  const { debugLogs, addDebugLog, chatRef } = useDebugLogs();
  const [showLog, setShowLog] = useState(false);
  // Use current hostname for backend URL by default
  let defaultBackendUrl = 'http://localhost:4000';
  if (typeof window !== 'undefined' && window.location) {
    const { hostname } = window.location;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      defaultBackendUrl = `http://${hostname}:4000`;
    }
  }
  const [backendUrl, setBackendUrl] = useState(defaultBackendUrl);

  async function fetchTopology(url = backendUrl) {
    setLoading(true);
    try {
      const res = await fetch(url + '/api/nodes');
      const nodes = await res.json();
      addDebugLog(`[GET ${url}/api/nodes]: ${JSON.stringify(nodes)}`);
      addDebugLog(`[Topology results]: ${JSON.stringify(nodes)}`);
      setTopology(nodes);
    } catch (e) {
      addDebugLog(`[Error fetching topology]: ${e}`);
      setTopology([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchTopology(backendUrl);
    const interval = setInterval(() => fetchTopology(backendUrl), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 12, fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', fontSize: 13, background: '#f3f3f3' }}>
      <div style={{ marginBottom: 12 }}>
        <label>Backend URL: </label>
        <input value={backendUrl} onChange={e => setBackendUrl(e.target.value)} size={40} style={{ fontSize: 13, padding: '2px 6px', borderRadius: 4, border: '1px solid #bbb', marginRight: 8 }} />
        <button onClick={() => fetchTopology(backendUrl)} style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, border: '1px solid #bbb' }}>Refresh</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 2, marginRight: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '8px 0 16px 0', color: '#2d2d2d' }}>Network Topology Dashboard</h2>
          {loading && <p style={{ fontSize: 12 }}>Loading...</p>}
          {topology.length === 0 && !loading && <p style={{ fontSize: 12 }}>No nodes found.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {topology.filter(node => {
              // Hide nodes inactive for more than 10 minutes
              const now = Date.now();
              return now - node.lastSeen <= 10 * 60 * 1000;
            }).map((node) => (
              <NodeCard key={node.mac || node.ip} node={node} />
            ))}
          </div>
        </div>
        {/* Collapsible Debug Log Panel */}
        <div style={{ width: 340, minWidth: 220, maxWidth: 400, marginLeft: 8, background: '#fff', border: '1px solid #d4d4d4', borderRadius: 6, boxShadow: '0 2px 8px #eee', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f5f5', borderBottom: '1px solid #e0e0e0', padding: '6px 10px', borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>Debug Log</span>
            <button onClick={() => setShowLog(l => !l)} style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2', padding: 0 }}>
              {showLog ? 'Minimize' : 'Show'}
            </button>
          </div>
          {showLog && (
            <div ref={chatRef} style={{ padding: 10, height: 320, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, background: '#fafafa', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}>
              {debugLogs.length === 0 ? <div style={{ color: '#888' }}>No logs yet.</div> :
                debugLogs.map((log, i) => (
                  <div key={i} style={{ marginBottom: 2 }}>
                    <span style={{ color: '#888', marginRight: 6 }}>{log.ts}</span>
                    <span>{log.msg}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
      {/* Server Topology Diagram (dynamic) */}
      <TopologyServerDiagram topology={topology} />
    </div>
  );
}
