import { useCallback, useEffect, useState } from 'react';

export default function QueueManagerLauncher() {
  const defaultHost = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
  const [managerId, setManagerId] = useState('qm-local-4101');
  const [nodeId, setNodeId] = useState(defaultHost);
  const [port, setPort] = useState('4101');
  const [advertiseIp, setAdvertiseIp] = useState(defaultHost === 'localhost' ? '127.0.0.1' : defaultHost);
  const [aggregatorUrl, setAggregatorUrl] = useState(`http://${defaultHost}:4000`);
  const [launchers, setLaunchers] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function readJson(res, label) {
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${label} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(`${label} returned non-JSON: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/local-queue-managers');
      const data = await readJson(res, 'Launcher status');
      setLaunchers(Array.isArray(data.launchers) ? data.launchers : []);
    } catch (e) {
      setStatusMsg(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      refresh();
    }, 0);
    const t = setInterval(refresh, 3000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(t);
    };
  }, [refresh]);

  async function handleStart() {
    setLoading(true);
    setStatusMsg('Starting queue manager...');
    try {
      const res = await fetch('/api/local-queue-managers/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ managerId, nodeId, port: Number(port), advertiseIp, aggregatorUrl }),
      });
      const data = await readJson(res, 'Start queue manager');
      setStatusMsg(JSON.stringify(data));
      refresh();
    } catch (e) {
      setStatusMsg(e.message || String(e));
    }
    setLoading(false);
  }

  async function handleStop(id) {
    setStatusMsg(`Stopping ${id}...`);
    try {
      const res = await fetch(`/api/local-queue-managers/${id}/stop`, { method: 'POST' });
      const data = await readJson(res, 'Stop queue manager');
      setStatusMsg(JSON.stringify(data));
      refresh();
    } catch (e) {
      setStatusMsg(e.message || String(e));
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
      <h2>Queue Manager Launcher</h2>
      <p style={{ color: '#555', maxWidth: 760 }}>
        Start a standalone queue manager process on this machine and have it register back to the aggregator.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <label>
          <div>Manager ID</div>
          <input value={managerId} onChange={e => setManagerId(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          <div>Node ID</div>
          <input value={nodeId} onChange={e => setNodeId(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          <div>Port</div>
          <input value={port} onChange={e => setPort(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          <div>Advertise IP</div>
          <input value={advertiseIp} onChange={e => setAdvertiseIp(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          <div>Aggregator URL</div>
          <input value={aggregatorUrl} onChange={e => setAggregatorUrl(e.target.value)} style={{ width: '100%' }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={handleStart} disabled={loading}>{loading ? 'Starting...' : 'Start Queue Manager'}</button>
        <button onClick={refresh}>Refresh</button>
      </div>

      <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#444', background: '#fafafa', padding: 12, border: '1px solid #ddd', borderRadius: 6, marginBottom: 16 }}>
        {statusMsg || 'No status yet.'}
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#f3f3f3', padding: 12, fontWeight: 600 }}>Local Queue Manager Processes</div>
        {launchers.length === 0 && <div style={{ padding: 12, color: '#777' }}>No launched queue managers yet.</div>}
        {launchers.length > 0 && launchers.map(launcher => (
          <div key={launcher.managerId} style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{launcher.managerId}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{launcher.nodeId} | {launcher.advertiseIp}:{launcher.port}</div>
              <div style={{ fontSize: 12, color: '#666' }}>Aggregator: {launcher.aggregatorUrl}</div>
              <div style={{ fontSize: 12, color: '#666' }}>PID: {launcher.pid ?? 'n/a'} | Status: {launcher.status}</div>
            </div>
            <div>
              <button onClick={() => handleStop(launcher.managerId)} disabled={launcher.status !== 'running'}>Stop</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
