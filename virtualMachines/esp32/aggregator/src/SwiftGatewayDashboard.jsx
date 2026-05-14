import React, { useEffect, useState } from 'react';

const SWIFT_QUEUES = [
  'swift.mt103.parsed',
  'tx.pacs.created',
  'tx.lynx.pending',
  'lynx.pacs009.outbound'
];

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

export default function SwiftGatewayDashboard() {
  const [gateway, setGateway] = useState(null);
  const [queues, setQueues] = useState({});
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [intervalMs, setIntervalMs] = useState(500);
  const [batchSize, setBatchSize] = useState(25);

  async function fetchGateway() {
    const res = await fetch('/api/gateways');
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gateway API failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    setGateway(data?.swift || null);
  }

  async function fetchQueues() {
    const next = {};
    for (const queueName of SWIFT_QUEUES) {
      const res = await fetch(`/api/queue/${encodeURIComponent(queueName)}/length`);
      if (!res.ok) {
        next[queueName] = { primary: null, secondary: null, error: `HTTP ${res.status}` };
      } else {
        next[queueName] = await res.json();
      }
    }
    setQueues(next);
  }

  async function refresh() {
    try {
      await Promise.all([fetchGateway(), fetchQueues()]);
      setError('');
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, []);

  async function startGateway() {
    try {
      const res = await fetch('/api/gateways/swift/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intervalMs: Number(intervalMs), batchSize: Number(batchSize) })
      });
      const text = await res.text();
      const payload = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(payload?.error || `Start failed (${res.status})`);
      }
      setResult('SWIFT gateway started.');
      await refresh();
    } catch (e) {
      setResult(`Start failed: ${e.message || e}`);
    }
  }

  async function stopGateway() {
    try {
      const res = await fetch('/api/gateways/swift/stop', { method: 'POST' });
      const text = await res.text();
      const payload = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(payload?.error || `Stop failed (${res.status})`);
      }
      setResult('SWIFT gateway stopped.');
      await refresh();
    } catch (e) {
      setResult(`Stop failed: ${e.message || e}`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>SWIFT Gateway</div>
          <div style={{ color: '#475569', marginTop: 4 }}>
            Queue-driven SWIFT ingress and mapping workers.
          </div>
        </div>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: gateway?.running ? '#166534' : '#991b1b',
          background: gateway?.running ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${gateway?.running ? '#86efac' : '#fecaca'}`,
          borderRadius: 999,
          padding: '6px 10px'
        }}>
          {gateway?.running ? 'RUNNING' : 'STOPPED'}
        </div>
      </div>

      <div style={{ border: '1px solid #dbe3ef', borderRadius: 10, background: '#fff', padding: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#334155' }}>
            Interval (ms)
            <input
              type="number"
              min={100}
              step={100}
              value={intervalMs}
              onChange={e => setIntervalMs(e.target.value)}
              style={{ marginLeft: 8, width: 90 }}
            />
          </label>
          <label style={{ fontSize: 12, color: '#334155' }}>
            Batch size
            <input
              type="number"
              min={1}
              step={1}
              value={batchSize}
              onChange={e => setBatchSize(e.target.value)}
              style={{ marginLeft: 8, width: 70 }}
            />
          </label>
          <button onClick={startGateway} style={{ padding: '6px 12px', cursor: 'pointer' }}>Start SWIFT Gateway</button>
          <button onClick={stopGateway} style={{ padding: '6px 12px', cursor: 'pointer' }}>Stop SWIFT Gateway</button>
          <button onClick={refresh} style={{ padding: '6px 12px', cursor: 'pointer' }}>Refresh</button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#475569' }}>{result || 'Use Start to enable queue-driven SWIFT workers.'}</div>
        {error ? <div style={{ marginTop: 8, fontSize: 12, color: '#991b1b' }}>{error}</div> : null}
      </div>

      <div style={{ border: '1px solid #dbe3ef', borderRadius: 10, background: '#fff', padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>SWIFT Worker Status</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '6px 4px' }}>Worker</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '6px 4px' }}>Processed</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '6px 4px' }}>Last Run</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '6px 4px' }}>Last Error</th>
              </tr>
            </thead>
            <tbody>
              {(gateway?.workers || []).map(worker => (
                <tr key={worker.workerId}>
                  <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 4px' }}>{worker.workerId}</td>
                  <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 4px' }}>{formatCount(worker.processedMessages)}</td>
                  <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 4px' }}>{worker.lastRunAt || '-'}</td>
                  <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 4px', color: worker.lastError ? '#991b1b' : '#64748b' }}>
                    {worker.lastError || '-'}
                  </td>
                </tr>
              ))}
              {(gateway?.workers || []).length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '8px 4px', color: '#64748b' }}>No SWIFT gateway workers running.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ border: '1px solid #dbe3ef', borderRadius: 10, background: '#fff', padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>SWIFT Queue Telemetry</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
          {SWIFT_QUEUES.map(queueName => {
            const q = queues[queueName] || {};
            return (
              <div key={queueName} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{queueName}</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                  {q.error ? 'ERR' : formatCount(q.primary)}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: '#475569' }}>
                  Secondary: {q.error ? q.error : formatCount(q.secondary)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
