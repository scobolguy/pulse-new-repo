import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

export default function QueueManagerDashboard() {
  const [managers, setManagers] = useState([]);
  const [queues, setQueues] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [publishQueue, setPublishQueue] = useState('default');
  const [publishPayload, setPublishPayload] = useState('hello');
  const [publishResult, setPublishResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function readJsonResponse(res, label) {
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${label} failed (${res.status}): ${text.slice(0, 160)}`);
    }
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(`${label} returned non-JSON response: ${text.slice(0, 160)}`);
    }
    return res.json();
  }

  function statusStyle(status) {
    if (status === 'up') return { background: '#dff5e1', color: '#1d6b2a' };
    if (status === 'quiesced') return { background: '#fff4d8', color: '#8a5a00' };
    if (status === 'maintenance') return { background: '#e6f0ff', color: '#1e4c9a' };
    return { background: '#ffe6e6', color: '#7a1f1f' };
  }

  async function refresh() {
    setLoading(true);
    try {
      const [mgrRes, queueRes, routeRes] = await Promise.all([
        fetch('/api/registry/queue-managers'),
        fetch('/api/registry/queues'),
        fetch('/api/broker/routes')
      ]);
      const [mgrData, queueData, routeData] = await Promise.all([
        readJsonResponse(mgrRes, 'Queue manager registry'),
        readJsonResponse(queueRes, 'Queue assignment registry'),
        readJsonResponse(routeRes, 'Broker routes'),
      ]);
      setManagers(Array.isArray(mgrData.queueManagers) ? mgrData.queueManagers : []);
      setQueues(Array.isArray(queueData.queues) ? queueData.queues : []);
      setRoutes(Array.isArray(routeData.routes) ? routeData.routes : []);
    } catch (e) {
      setPublishResult(`Refresh failed: ${e.message || e}`);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  const queuesByManager = useMemo(() => {
    const bucket = {};
    for (const q of queues) {
      if (!bucket[q.managerId]) bucket[q.managerId] = [];
      bucket[q.managerId].push(q);
    }
    return bucket;
  }, [queues]);

  async function handlePublish() {
    setPublishResult('Publishing...');
    try {
      const payload = {
        queueName: publishQueue,
        message: publishPayload,
        sourceService: 'dashboard'
      };
      const res = await fetch('/api/broker/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await readJsonResponse(res, 'Publish');
      setPublishResult(`${res.status}: ${JSON.stringify(data)}`);
      refresh();
    } catch (e) {
      setPublishResult(`Publish failed: ${e.message || e}`);
    }
  }

  async function handleManagerAction(managerId, action) {
    setPublishResult(`Applying ${action} to ${managerId}...`);
    try {
      const res = await fetch(`/api/registry/queue-managers/${managerId}/${action}`, { method: 'POST' });
      const data = await readJsonResponse(res, `Manager action ${action}`);
      setPublishResult(`${res.status}: ${JSON.stringify(data)}`);
      refresh();
    } catch (e) {
      setPublishResult(`Manager action failed: ${e.message || e}`);
    }
  }

  return (
    <div className="dashboard-container">
      <h2>Queue Manager Dashboard (Live)</h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={refresh}>Refresh</button>
        <span style={{ fontSize: 12, color: '#555' }}>{loading ? 'Loading...' : `${managers.length} managers, ${queues.length} queues`}</span>
      </div>

      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 12, marginBottom: 16, background: '#fff' }}>
        <h3 style={{ marginTop: 0 }}>Publish Test Message</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={publishQueue} onChange={e => setPublishQueue(e.target.value)} placeholder="queue name" />
          <input value={publishPayload} onChange={e => setPublishPayload(e.target.value)} placeholder="message payload" style={{ minWidth: 260 }} />
          <button onClick={handlePublish}>Publish</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#444', whiteSpace: 'pre-wrap' }}>{publishResult}</div>
      </div>

      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 16, background: '#fafbfc', minWidth: 320 }}>
        <h3 style={{ marginTop: 0 }}>Registry and Queue Assignment</h3>
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {managers.map(m => (
            <li key={m.managerId} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ marginRight: 4 }}>📁</span>
                <span>{m.name} ({m.managerId})</span>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, ...statusStyle(m.status) }}>{m.status}</span>
                <span style={{ fontSize: 11, color: '#666' }}>{m.ip}:{m.port}</span>
                <button style={{ fontSize: 11 }} onClick={() => handleManagerAction(m.managerId, 'quiesce')}>Quiesce</button>
                <button style={{ fontSize: 11 }} onClick={() => handleManagerAction(m.managerId, 'maintenance')}>Maintenance</button>
                <button style={{ fontSize: 11 }} onClick={() => handleManagerAction(m.managerId, 'return-service')}>Return</button>
              </div>
              <ul style={{ listStyle: 'none', paddingLeft: 24 }}>
                {(queuesByManager[m.managerId] || []).map(q => (
                  <li key={`${q.managerId}:${q.queueName}`} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ marginRight: 2 }}>🗂️</span>
                      <span>{q.queueName}</span>
                      <span style={{ fontSize: 11, color: '#555' }}>len: {q.queueLength ?? 'n/a'}</span>
                    </div>
                  </li>
                ))}
                {(queuesByManager[m.managerId] || []).length === 0 && (
                  <li style={{ marginBottom: 4, color: '#888', fontSize: 12 }}>No assigned queues</li>
                )}
              </ul>
            </li>
          ))}
          {managers.length === 0 && <li style={{ color: '#888' }}>No queue managers found.</li>}
        </ul>
      </div>

      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 16, background: '#fff', marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Broker Route Table</h3>
        {routes.length === 0 && <div style={{ color: '#888', fontSize: 12 }}>No routes assigned yet. Publish a message to create one.</div>}
        {routes.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Queue</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Manager</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(route => (
                <tr key={`${route.queueName}:${route.managerId}`}>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 4px' }}>{route.queueName}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 4px' }}>{route.managerId}</td>
                  <td style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 4px' }}>{route.assignedAt || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
