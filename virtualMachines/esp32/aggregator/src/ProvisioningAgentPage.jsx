import { useEffect, useMemo, useState } from 'react';

const POLL_MS = 4000;

function toJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function ProvisioningAgentPage() {
  const [mode, setMode] = useState('inventory');
  const [configPath, setConfigPath] = useState('scripts/provisioning-lan-agent.config.example.json');
  const [pattern, setPattern] = useState('^Pulse-.*-Provision$');
  const [dryRun, setDryRun] = useState(true);
  const [timeoutMs, setTimeoutMs] = useState(15000);
  const [settleMs, setSettleMs] = useState(4000);
  const [retries, setRetries] = useState(2);
  const [backoffMs, setBackoffMs] = useState(800);
  const [backoffMultiplier, setBackoffMultiplier] = useState(2);

  const [activeRuns, setActiveRuns] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [statusText, setStatusText] = useState('Ready');
  const [errorText, setErrorText] = useState('');
  const [busy, setBusy] = useState(false);

  const canUseConfig = mode === 'ap-batch' || mode === 'aggregator-batch';

  async function refreshRuns() {
    try {
      const response = await fetch('/api/provisioning-agent/runs?limit=30');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
      setActiveRuns(Array.isArray(payload.active) ? payload.active : []);
      setHistory(Array.isArray(payload.history) ? payload.history : []);
      setErrorText('');
    } catch (error) {
      setErrorText(String(error?.message || error));
    }
  }

  async function refreshSelected(runId) {
    if (!runId) return;
    try {
      const response = await fetch(`/api/provisioning-agent/runs/${encodeURIComponent(runId)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
      setSelectedRun(payload?.run || null);
      setErrorText('');
    } catch (error) {
      setErrorText(String(error?.message || error));
    }
  }

  useEffect(() => {
    void refreshRuns();
    const intervalId = window.setInterval(() => {
      void refreshRuns();
      if (selectedRun?.runId) void refreshSelected(selectedRun.runId);
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [selectedRun?.runId]);

  async function startRun() {
    setBusy(true);
    setStatusText('Submitting provisioning run...');
    setErrorText('');

    try {
      const body = {
        mode,
        dryRun,
        timeoutMs: Number(timeoutMs) || 15000,
        settleMs: Number(settleMs) || 4000,
        retries: Number(retries) || 0,
        backoffMs: Number(backoffMs) || 0,
        backoffMultiplier: Number(backoffMultiplier) || 1,
      };

      if (canUseConfig) {
        body.configPath = String(configPath || '').trim();
      }
      if (mode === 'inventory') {
        body.pattern = String(pattern || '^Pulse-.*-Provision$').trim();
      }

      const response = await fetch('/api/provisioning-agent/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `Run start failed (${response.status})`);
      }

      const run = payload?.run || null;
      setStatusText(run?.runId ? `Run started: ${run.runId}` : 'Run started');
      setSelectedRun(run);
      await refreshRuns();
    } catch (error) {
      setErrorText(String(error?.message || error));
      setStatusText('Run failed to start');
    } finally {
      setBusy(false);
    }
  }

  async function cancelRun(runId) {
    try {
      const response = await fetch(`/api/provisioning-agent/runs/${encodeURIComponent(runId)}/cancel`, {
        method: 'POST',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `Cancel failed (${response.status})`);
      }
      setStatusText(`Cancel requested for ${runId}`);
      await refreshRuns();
      await refreshSelected(runId);
    } catch (error) {
      setErrorText(String(error?.message || error));
    }
  }

  const mergedRuns = useMemo(() => {
    const map = new Map();
    for (const run of history) {
      map.set(String(run?.runId || ''), run);
    }
    for (const run of activeRuns) {
      map.set(String(run?.runId || ''), run);
    }
    return Array.from(map.values())
      .filter((run) => String(run?.runId || '').trim().length > 0)
      .sort((a, b) => String(b?.startedAt || '').localeCompare(String(a?.startedAt || '')));
  }, [activeRuns, history]);

  return (
    <section className="prov-agent-page">
      <header className="prov-agent-header">
        <h1>Provisioning Agent</h1>
        <p>Run inventory, AP batch provisioning, or aggregator batch provisioning with retry/backoff policy and run ledger tracking.</p>
      </header>

      <section className="prov-agent-panel">
        <h2>Run Controls</h2>
        <div className="prov-agent-grid">
          <label>
            <span>Mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="inventory">inventory</option>
              <option value="ap-batch">ap-batch</option>
              <option value="aggregator-batch">aggregator-batch</option>
            </select>
          </label>

          {canUseConfig ? (
            <label className="wide">
              <span>Config Path</span>
              <input value={configPath} onChange={(event) => setConfigPath(event.target.value)} />
            </label>
          ) : (
            <label className="wide">
              <span>SSID Pattern</span>
              <input value={pattern} onChange={(event) => setPattern(event.target.value)} />
            </label>
          )}

          <label>
            <span>Timeout (ms)</span>
            <input type="number" min="1000" value={timeoutMs} onChange={(event) => setTimeoutMs(event.target.value)} />
          </label>

          <label>
            <span>Settle (ms)</span>
            <input type="number" min="0" value={settleMs} onChange={(event) => setSettleMs(event.target.value)} />
          </label>

          <label>
            <span>Retries</span>
            <input type="number" min="0" value={retries} onChange={(event) => setRetries(event.target.value)} />
          </label>

          <label>
            <span>Backoff (ms)</span>
            <input type="number" min="0" value={backoffMs} onChange={(event) => setBackoffMs(event.target.value)} />
          </label>

          <label>
            <span>Backoff Multiplier</span>
            <input type="number" min="1" step="0.1" value={backoffMultiplier} onChange={(event) => setBackoffMultiplier(event.target.value)} />
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
            <span>Dry Run</span>
          </label>
        </div>

        <div className="prov-agent-actions">
          <button type="button" disabled={busy} onClick={() => void startRun()}>Start Run</button>
          <button type="button" disabled={busy} onClick={() => void refreshRuns()}>Refresh</button>
          <span className="status">{statusText}</span>
        </div>

        {errorText ? <div className="prov-agent-error">{errorText}</div> : null}
      </section>

      <section className="prov-agent-panel">
        <h2>Runs</h2>
        <div className="prov-agent-table-wrap">
          <table className="prov-agent-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Dry Run</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mergedRuns.map((run) => (
                <tr key={run.runId}>
                  <td>{run.runId}</td>
                  <td>{run.mode || '-'}</td>
                  <td>{run.status || '-'}</td>
                  <td>{run.dryRun ? 'yes' : 'no'}</td>
                  <td>{run.startedAt || '-'}</td>
                  <td>{Number.isFinite(run.durationMs) ? `${run.durationMs} ms` : '-'}</td>
                  <td>
                    <button type="button" onClick={() => void refreshSelected(run.runId)}>View</button>
                    {run.status === 'running' ? (
                      <button type="button" onClick={() => void cancelRun(run.runId)}>Cancel</button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {mergedRuns.length === 0 ? (
                <tr>
                  <td colSpan="7">No runs yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="prov-agent-panel">
        <h2>Selected Run</h2>
        <pre className="prov-agent-json">{selectedRun ? JSON.stringify(selectedRun, null, 2) : 'Select a run to view details.'}</pre>
        {selectedRun?.result ? (
          <details>
            <summary>Result Snapshot</summary>
            <pre className="prov-agent-json">{JSON.stringify(selectedRun.result, null, 2)}</pre>
          </details>
        ) : null}

        {selectedRun?.result?.body && typeof selectedRun.result.body === 'string' && toJsonOrNull(selectedRun.result.body) ? (
          <details>
            <summary>Parsed Body</summary>
            <pre className="prov-agent-json">{JSON.stringify(toJsonOrNull(selectedRun.result.body), null, 2)}</pre>
          </details>
        ) : null}
      </section>
    </section>
  );
}
