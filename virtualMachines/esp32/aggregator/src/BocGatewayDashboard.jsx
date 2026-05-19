import React, { useEffect, useState } from 'react';
import { getJson, postJson, putJson } from './http-client.js';

const BOC_QUEUES = [
  'lynx.pacs009.outbound',
  'tx.lynx.pending',
  'tx.lynx.approved',
  'tx.rejected',
  'tx.correspondent.unreconciled'
];

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

export default function BocGatewayDashboard() {
  const [gateway, setGateway] = useState(null);
  const [queues, setQueues] = useState({});
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [intervalMs, setIntervalMs] = useState(500);
  const [batchSize, setBatchSize] = useState(25);
  const [approvalMode, setApprovalMode] = useState('approved');

  async function fetchGateway() {
    const data = await getJson('/api/gateways', 'Gateway API failed');
    setGateway(data?.boc || null);
  }

  async function fetchQueues() {
    const next = {};
    for (const queueName of BOC_QUEUES) {
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
      await putJson('/api/runtime/instances/gateway%3Aboc/config', {
        config: {
          intervalMs: Number(intervalMs),
          batchSize: Number(batchSize),
          mode: approvalMode
        }
      }, 'Config update failed');

      await postJson('/api/runtime/classes/gateway/actions/start', {
        boc: {
          intervalMs: Number(intervalMs),
          batchSize: Number(batchSize),
          approvalMode
        }
      }, 'Start failed');

      setResult(`BoC gateway started (${approvalMode}).`);
      await refresh();
    } catch (e) {
      setResult(`Start failed: ${e.message || e}`);
    }
  }

  async function stopGateway() {
    try {
      await postJson('/api/runtime/classes/gateway/actions/stop', { boc: {} }, 'Stop failed');

      setResult('BoC gateway stopped.');
      await refresh();
    } catch (e) {
      setResult(`Stop failed: ${e.message || e}`);
    }
  }

  return (
    <div className="gothic-screen" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="gothic-title" style={{ fontSize: 26 }}>Bank of Canada Mausoleum Gateway</div>
          <div className="gothic-subtitle" style={{ marginTop: 4 }}>
            Victorian gatekeepers guide LYNX verdicts through mist and midnight.
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
          <label className="gothic-label">
            Approval mode
            <select
              value={approvalMode}
              onChange={e => setApprovalMode(e.target.value)}
              className="gothic-select"
            >
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          <button onClick={startGateway} className="gothic-button">Start BoC Gateway</button>
          <button onClick={stopGateway} className="gothic-button">Stop BoC Gateway</button>
          <button onClick={refresh} className="gothic-button">Refresh</button>
        </div>
        <div className="gothic-result">{result || 'Use Start to summon queue-driven BoC workers.'}</div>
        {error ? <div className="gothic-error">{error}</div> : null}
      </div>

      <div className="gothic-panel poe-panel">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>BoC Worker Status</div>
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
                  <td colSpan={4} style={{ color: '#c9bfd0' }}>No BoC gateway workers running.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="gothic-panel poe-panel">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>BoC Queue Telemetry</div>
        <div className="gothic-grid">
          {BOC_QUEUES.map(queueName => {
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
