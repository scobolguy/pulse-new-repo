import React, { useEffect, useState } from 'react';

function createEmptyFlow(flowId = '') {
  return {
    flowId,
    description: '',
    p95Ms: 500,
    warningRatio: 0.8,
    queuesText: '',
    throughputQueue: '',
    targetThroughputTps: 10
  };
}

export default function FlowTargetsDashboard() {
  const [enabled, setEnabled] = useState(true);
  const [flows, setFlows] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const actorUserId = localStorage.getItem('pulse.actorUserId') || 'system-admin';
      const response = await fetch('/api/lifecycle/policy/flow-targets', {
        headers: { 'x-user-id': actorUserId }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Load failed (${response.status})`);
      }
      const flowTargets = payload.flowTargets || {};
      const nextFlows = Object.entries(flowTargets.targets || {}).map(([flowId, target]) => ({
        flowId,
        description: String(target.description || ''),
        p95Ms: Number(target.p95Ms || 0),
        warningRatio: Number(target.warningRatio || 0.8),
        queuesText: Array.isArray(target.queues) ? target.queues.join(', ') : '',
        throughputQueue: String(target.throughputQueue || ''),
        targetThroughputTps: Number(target.targetThroughputTps || 0)
      }));
      setEnabled(flowTargets.enabled === true);
      setFlows(nextFlows);
      setStatus('');
    } catch (e) {
      setStatus(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateFlow(index, key, value) {
    setFlows((current) => current.map((flow, flowIndex) => (
      flowIndex === index ? { ...flow, [key]: value } : flow
    )));
  }

  function addFlow() {
    setFlows((current) => [...current, createEmptyFlow(`flow-${current.length + 1}`)]);
  }

  function removeFlow(index) {
    setFlows((current) => current.filter((_, flowIndex) => flowIndex !== index));
  }

  async function save() {
    try {
      setStatus('Saving flow targets...');
      const actorUserId = localStorage.getItem('pulse.actorUserId') || 'system-admin';
      const targets = {};
      for (const flow of flows) {
        const flowId = String(flow.flowId || '').trim();
        if (!flowId) continue;
        targets[flowId] = {
          description: String(flow.description || '').trim(),
          p95Ms: Number(flow.p95Ms || 0),
          warningRatio: Number(flow.warningRatio || 0),
          queues: String(flow.queuesText || '').split(',').map((value) => value.trim()).filter(Boolean),
          throughputQueue: String(flow.throughputQueue || '').trim(),
          targetThroughputTps: Number(flow.targetThroughputTps || 0)
        };
      }

      const response = await fetch('/api/lifecycle/policy/flow-targets', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': actorUserId
        },
        body: JSON.stringify({ enabled, targets })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(payload.details) ? payload.details.join(' | ') : '';
        throw new Error([payload.error, details].filter(Boolean).join(': ') || `Save failed (${response.status})`);
      }

      setStatus(payload.message || 'Saved flow targets.');
      await load();
    } catch (e) {
      setStatus(String(e.message || e));
    }
  }

  return (
    <section className="flow-targets-panel">
      <div className="flow-targets-header">
        <div>
          <h3>Flow Targets</h3>
          <p>Configure flow latency and throughput targets without editing code.</p>
        </div>
        <div className="flow-targets-actions">
          <label className="flow-targets-toggle">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            <span>Monitoring Enabled</span>
          </label>
          <button type="button" className="utility-button" onClick={addFlow}>Add Flow</button>
          <button type="button" className="utility-button" onClick={save} disabled={loading}>Save</button>
        </div>
      </div>

      {status ? <div className="flow-targets-status">{status}</div> : null}

      <div className="flow-targets-grid">
        {flows.map((flow, index) => (
          <article key={`${flow.flowId || 'new'}-${index}`} className="flow-target-card">
            <div className="flow-target-card-header">
              <strong>{flow.flowId || `Flow ${index + 1}`}</strong>
              <button type="button" className="server-monitor-test-button" onClick={() => removeFlow(index)}>Remove</button>
            </div>
            <label>
              Flow ID
              <input value={flow.flowId} onChange={(event) => updateFlow(index, 'flowId', event.target.value)} />
            </label>
            <label>
              Description
              <input value={flow.description} onChange={(event) => updateFlow(index, 'description', event.target.value)} />
            </label>
            <div className="flow-target-row">
              <label>
                Target p95 ms
                <input type="number" value={flow.p95Ms} onChange={(event) => updateFlow(index, 'p95Ms', event.target.value)} />
              </label>
              <label>
                Warning Ratio
                <input type="number" step="0.05" value={flow.warningRatio} onChange={(event) => updateFlow(index, 'warningRatio', event.target.value)} />
              </label>
            </div>
            <label>
              Source Queues
              <input value={flow.queuesText} onChange={(event) => updateFlow(index, 'queuesText', event.target.value)} placeholder="queue.one, queue.two" />
            </label>
            <div className="flow-target-row">
              <label>
                Throughput Queue
                <input value={flow.throughputQueue} onChange={(event) => updateFlow(index, 'throughputQueue', event.target.value)} />
              </label>
              <label>
                Target Throughput TPS
                <input type="number" step="0.1" value={flow.targetThroughputTps} onChange={(event) => updateFlow(index, 'targetThroughputTps', event.target.value)} />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
