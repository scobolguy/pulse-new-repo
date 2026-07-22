import { useEffect, useMemo, useState } from 'react'

function NumberField({ label, value, onChange, min = 0, step = 1 }) {
  return (
    <label className="evo-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function TextField({ label, value, onChange }) {
  return (
    <label className="evo-field evo-field-wide">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export default function EvolutionTestPage() {
  const [statusPayload, setStatusPayload] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)

  const [manifest, setManifest] = useState('data/evolution-manifest-4.json')
  const [transactions, setTransactions] = useState('10000')
  const [cycles, setCycles] = useState('10')
  const [concurrency, setConcurrency] = useState('4')
  const [generation, setGeneration] = useState('7000')

  const runtime = statusPayload?.runtime || null
  const drift = statusPayload?.drift || null
  const driftSeries = drift?.series || []

  async function callEvolutionApi(path, { method = 'GET', body = null, timeoutMs = 8000 } = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const actorUserId = localStorage.getItem('pulse.actorUserId') || 'system-admin'
      const headers = {
        'x-user-id': actorUserId
      }
      if (body != null) {
        headers['content-type'] = 'application/json'
      }

      const response = await fetch(path, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal
      })

      const text = await response.text()
      let payload = {}
      if (text) {
        try {
          payload = JSON.parse(text)
        } catch {
          payload = { raw: text }
        }
      }

      if (!response.ok) {
        throw new Error(payload?.error || `${method} ${path} failed (${response.status})`)
      }

      return payload
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`${method} ${path} timed out after ${Math.round(timeoutMs / 1000)}s. Check backend status.`)
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  async function refreshStatus() {
    try {
      const payload = await callEvolutionApi('/api/evolution-test/status', { method: 'GET', timeoutMs: 8000 })
      setStatusPayload(payload)
      setLastRefreshedAt(new Date().toISOString())
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    void refreshStatus()
    const timer = setInterval(() => {
      void refreshStatus()
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  async function startRun() {
    setBusy(true)
    try {
      await callEvolutionApi('/api/evolution-test/start', {
        method: 'POST',
        timeoutMs: 12000,
        body: {
        manifest: manifest.trim(),
        transactions: Number.parseInt(transactions, 10) || 10000,
        cycles: Number.parseInt(cycles, 10) || 10,
        concurrency: Number.parseInt(concurrency, 10) || 4,
        generation: Number.parseInt(generation, 10) || 7000
        }
      })
      await refreshStatus()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function stopRun() {
    setBusy(true)
    try {
      await callEvolutionApi('/api/evolution-test/stop', {
        method: 'POST',
        timeoutMs: 8000,
        body: {}
      })
      await refreshStatus()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const ancestorRows = useMemo(() => {
    const freq = drift?.ancestorFrequency || {}
    const total = Object.values(freq).reduce((sum, value) => sum + Number(value || 0), 0)
    return Object.entries(freq)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([ancestor, count]) => ({
        ancestor,
        count: Number(count),
        pct: total > 0 ? Number(((Number(count) / total) * 100).toFixed(1)) : 0
      }))
  }, [drift])

  const running = Boolean(runtime?.running)

  return (
    <section className="evolution-page">
      <header className="evolution-header">
        <h1>Evolution Test Control</h1>
        <p>Run the PMachine evolution harness, stop it safely, and monitor organism drift over a selected window. The page refreshes every 30 seconds.</p>
      </header>

      <section className="evolution-panel">
        <h2>Run Controls</h2>
        <div className="evo-grid">
          <TextField label="Manifest" value={manifest} onChange={setManifest} />
          <NumberField label="Transactions" value={transactions} onChange={setTransactions} min={1} />
          <NumberField label="Cycles" value={cycles} onChange={setCycles} min={1} />
          <NumberField label="Concurrency" value={concurrency} onChange={setConcurrency} min={1} />
          <NumberField label="Generation Start" value={generation} onChange={setGeneration} min={0} />
        </div>

        <div className="evolution-actions">
          <button type="button" className="evo-button start" disabled={busy || running} onClick={startRun}>Start Test</button>
          <button type="button" className="evo-button stop" disabled={busy || !running} onClick={stopRun}>Stop Test</button>
          <button type="button" className="evo-button refresh" disabled={busy} onClick={() => void refreshStatus()}>Refresh</button>
        </div>

        {error ? <div className="evolution-error">{error}</div> : null}
      </section>

      <section className="evolution-panel">
        <h2>Runtime</h2>
        <div className="evolution-kpis">
          <div className="kpi"><strong>Status</strong><span>{runtime?.status || 'unknown'}</span></div>
          <div className="kpi"><strong>PID</strong><span>{runtime?.pid || '-'}</span></div>
          <div className="kpi"><strong>Run ID</strong><span>{runtime?.runId ?? '-'}</span></div>
          <div className="kpi"><strong>Exit</strong><span>{runtime?.lastExitCode ?? '-'}</span></div>
          <div className="kpi"><strong>Started</strong><span>{runtime?.startedAt || '-'}</span></div>
          <div className="kpi"><strong>Stopped</strong><span>{runtime?.stoppedAt || '-'}</span></div>
          <div className="kpi"><strong>Auto Refresh</strong><span>30s</span></div>
          <div className="kpi"><strong>Last Refreshed</strong><span>{lastRefreshedAt || '-'}</span></div>
        </div>
      </section>

      <section className="evolution-panel">
        <h2>Drift Summary</h2>
        <div className="evolution-kpis">
          <div className="kpi"><strong>Window Start</strong><span>{drift?.generationStart ?? 0}</span></div>
          <div className="kpi"><strong>Window Length</strong><span>{drift?.cycles ?? 0}</span></div>
          <div className="kpi"><strong>Available Cycles</strong><span>{drift?.availableCycles ?? 0}</span></div>
          <div className="kpi"><strong>Selector Changes</strong><span>{drift?.selectorChanges ?? 0}</span></div>
          <div className="kpi"><strong>Best Ancestor</strong><span>{drift?.summary?.bestAncestor || '-'}</span></div>
          <div className="kpi"><strong>Latency μ/σ</strong><span>{drift?.latency ? `${drift.latency.mean} / ${drift.latency.stdev}` : '-'}</span></div>
          <div className="kpi"><strong>Score μ/σ</strong><span>{drift?.score ? `${drift.score.mean} / ${drift.score.stdev}` : '-'}</span></div>
        </div>

        <div className="evolution-table-wrap">
          <table className="evolution-table">
            <thead>
              <tr>
                <th>Ancestor</th>
                <th>Wins</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {ancestorRows.length === 0 ? (
                <tr><td colSpan={3}>No drift data yet.</td></tr>
              ) : ancestorRows.map((row) => (
                <tr key={row.ancestor}>
                  <td>{row.ancestor}</td>
                  <td>{row.count}</td>
                  <td>
                    <div className="evo-bar-wrap">
                      <div className="evo-bar" style={{ width: `${row.pct}%` }} />
                      <span>{row.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="evolution-panel">
        <h2>Drift Over Time</h2>
        <div className="evolution-table-wrap">
          <table className="evolution-table">
            <thead>
              <tr>
                <th>Generation</th>
                <th>Organism</th>
                <th>Ancestor</th>
                <th>Latency</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {driftSeries.length === 0 ? (
                <tr><td colSpan={5}>No drift data yet.</td></tr>
              ) : driftSeries.map((row) => (
                <tr key={`${row.generation}-${row.organismId}`}>
                  <td>{row.generation}</td>
                  <td>{row.organismId}</td>
                  <td>{row.ancestorId}</td>
                  <td>{Number(row.latencyMs || 0)}</td>
                  <td>{Number(row.score || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="evolution-panel">
        <h2>Live Logs</h2>
        <pre className="evolution-log">
          {(runtime?.logs || []).map((entry, index) => `${entry.at} [${entry.source}] ${entry.line}`).join('\n') || 'No logs yet.'}
        </pre>
      </section>
    </section>
  )
}
