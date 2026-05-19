import React, { useEffect, useState } from 'react';
import { getJson, postJson, putJson } from './http-client.js';

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
    const data = await getJson('/api/gateways', 'Gateway API failed');
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
      await putJson('/api/runtime/instances/gateway%3Aswift/config', {
        config: {
          intervalMs: Number(intervalMs),
          batchSize: Number(batchSize)
        }
      }, 'Config update failed');

      await postJson('/api/runtime/classes/gateway/actions/start', {
        swift: { intervalMs: Number(intervalMs), batchSize: Number(batchSize) }
      }, 'Start failed');

      setResult('SWIFT gateway started.');
      await refresh();
    } catch (e) {
      setResult(`Start failed: ${e.message || e}`);
    }
  }

  async function stopGateway() {
    try {
      await postJson('/api/runtime/classes/gateway/actions/stop', { swift: {} }, 'Stop failed');

      setResult('SWIFT gateway stopped.');
      await refresh();
    } catch (e) {
      setResult(`Stop failed: ${e.message || e}`);
    }
  }

  return (
    <div className="gothic-screen" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="gothic-title" style={{ fontSize: 26 }}>SWIFT Catacomb Gateway</div>
          <div className="gothic-subtitle" style={{ marginTop: 4 }}>
            Behind Victorian ironwork, the SWIFT wardens keep their silent watch.
          </div>
        </div>
        <div className={`gothic-status-pill ${gateway?.running ? 'running' : 'stopped'}`}>
          {gateway?.running ? 'RUNNING' : 'STOPPED'}
        </div>
      </div>

      <div className="gothic-panel poe-panel">
        <div className="gothic-controls">
          <label className="gothic-label">
            Interval (ms)
            <input
              type="number"
              min={100}
              step={100}
              value={intervalMs}
              onChange={e => setIntervalMs(e.target.value)}
              className="gothic-input"
              style={{ width: 90 }}
            />
          </label>
          <label className="gothic-label">
            Batch size
            <input
              type="number"
              min={1}
              step={1}
              value={batchSize}
              onChange={e => setBatchSize(e.target.value)}
              className="gothic-input"
              style={{ width: 70 }}
            />
          </label>
          <button onClick={startGateway} className="gothic-button">Start SWIFT Gateway</button>
          <button onClick={stopGateway} className="gothic-button">Stop SWIFT Gateway</button>
          <button onClick={refresh} className="gothic-button">Refresh</button>
        </div>
        <div className="gothic-result">{result || 'Use Start to summon queue-driven SWIFT workers.'}</div>
        {error ? <div className="gothic-error">{error}</div> : null}
      </div>

      <div className="gothic-panel poe-panel">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>SWIFT Worker Status</div>
        <div className="gothic-table-wrap">
          <table className="gothic-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Processed</th>
                <th>Last Run</th>
                <th>Last Error</th>
              </tr>
            </thead>
            <tbody>
              {(gateway?.workers || []).map(worker => (
                <tr key={worker.workerId}>
                  <td>{worker.workerId}</td>
                  <td>{formatCount(worker.processedMessages)}</td>
                  <td>{worker.lastRunAt || '-'}</td>
                  <td style={{ color: worker.lastError ? '#f1a1b8' : '#c9bfd0' }}>
                    {worker.lastError || '-'}
                  </td>
                </tr>
              ))}
              {(gateway?.workers || []).length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: '#c9bfd0' }}>No SWIFT gateway workers running.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="gothic-panel poe-panel">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>SWIFT Queue Telemetry</div>
        <div className="gothic-grid">
          {SWIFT_QUEUES.map(queueName => {
            const q = queues[queueName] || {};
            return (
              <div key={queueName} className="gothic-queue-card">
                <div className="gothic-queue-name">{queueName}</div>
                <div className="gothic-queue-value">
                  {q.error ? 'ERR' : formatCount(q.primary)}
                </div>
                <div className="gothic-queue-secondary">
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
