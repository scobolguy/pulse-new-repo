import React, { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';

const POLL_MS = 1200;

const STATE_ORDER = [
  'INIT',
  'KILL_BACKEND_PROCESSES',
  'SANITIZE_QUEUE_PERSISTENCE',
  'CHECK_BACKEND',
  'START_BACKEND',
  'WAIT_BACKEND',
  'CHECK_FRONTEND',
  'START_FRONTEND',
  'WAIT_FRONTEND',
  'READY',
  'FAILED'
];

function buildMermaidDefinition(status) {
  const state = String(status?.state || 'IDLE');
  const completed = Array.isArray(status?.workflow) ? status.workflow : [];

  const lines = [
    'stateDiagram-v2',
    '  [*] --> INIT',
    '  INIT --> KILL_BACKEND_PROCESSES',
    '  KILL_BACKEND_PROCESSES --> SANITIZE_QUEUE_PERSISTENCE',
    '  SANITIZE_QUEUE_PERSISTENCE --> CHECK_BACKEND',
    '  CHECK_BACKEND --> START_BACKEND',
    '  CHECK_BACKEND --> CHECK_FRONTEND',
    '  START_BACKEND --> WAIT_BACKEND',
    '  WAIT_BACKEND --> START_BACKEND',
    '  WAIT_BACKEND --> CHECK_FRONTEND',
    '  WAIT_BACKEND --> FAILED',
    '  CHECK_FRONTEND --> START_FRONTEND',
    '  CHECK_FRONTEND --> READY',
    '  START_FRONTEND --> WAIT_FRONTEND',
    '  WAIT_FRONTEND --> START_FRONTEND',
    '  WAIT_FRONTEND --> READY',
    '  WAIT_FRONTEND --> FAILED',
    '  classDef active fill:#0ea5e9,stroke:#38bdf8,color:#001019,stroke-width:2px;',
    '  classDef done fill:#14532d,stroke:#22c55e,color:#dcfce7,stroke-width:2px;',
    '  classDef failed fill:#7f1d1d,stroke:#ef4444,color:#fee2e2,stroke-width:2px;'
  ];

  const done = completed.filter((item) => STATE_ORDER.includes(item));
  if (done.length > 0) {
    lines.push(`  class ${done.join(',')} done;`);
  }

  if (state && STATE_ORDER.includes(state)) {
    lines.push(`  class ${state} active;`);
  }

  if (state === 'FAILED') {
    lines.push('  class FAILED failed;');
  }

  return lines.join('\n');
}

export default function StartupFsmMonitor({ fsmId = 'startup-fsm' }) {
  const [status, setStatus] = useState({ state: 'IDLE', logs: [], workflow: [] });
  const [notes, setNotes] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [versionChoice, setVersionChoice] = useState('');
  const [newVersionId, setNewVersionId] = useState('');
  const [subflowsDraft, setSubflowsDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const diagramRef = useRef(null);
  const renderCounterRef = useRef(0);

  const logEntries = useMemo(() => {
    const logs = Array.isArray(status?.logs) ? status.logs : [];
    return [...logs].slice(-120).reverse();
  }, [status]);

  const retrySummary = useMemo(() => {
    const logs = Array.isArray(status?.logs) ? status.logs : [];
    const summary = {
      backend: { attempt: 0, maxRetries: null, retriesScheduled: 0, lastTimeoutMs: null, lastError: '' },
      frontend: { attempt: 0, maxRetries: null, retriesScheduled: 0, lastTimeoutMs: null, lastError: '' }
    };

    for (const entry of logs) {
      const event = String(entry?.event || '');
      const data = entry?.data && typeof entry.data === 'object' ? entry.data : {};
      const state = String(data?.state || '');

      if (event === 'state' && state === 'WAIT_BACKEND') {
        summary.backend.attempt = Math.max(summary.backend.attempt, Number(data?.attempt || 0));
      }
      if (event === 'state' && state === 'WAIT_FRONTEND') {
        summary.frontend.attempt = Math.max(summary.frontend.attempt, Number(data?.attempt || 0));
      }

      if (event === 'retry-scheduled' && state === 'WAIT_BACKEND') {
        summary.backend.retriesScheduled += 1;
        summary.backend.maxRetries = Number.isFinite(Number(data?.maxRetries)) ? Number(data.maxRetries) : summary.backend.maxRetries;
      }
      if (event === 'retry-scheduled' && state === 'WAIT_FRONTEND') {
        summary.frontend.retriesScheduled += 1;
        summary.frontend.maxRetries = Number.isFinite(Number(data?.maxRetries)) ? Number(data.maxRetries) : summary.frontend.maxRetries;
      }

      if (event === 'timeout' && state === 'WAIT_BACKEND') {
        summary.backend.lastTimeoutMs = Number.isFinite(Number(data?.timeoutMs)) ? Number(data.timeoutMs) : null;
        summary.backend.lastError = String(data?.error || '');
      }
      if (event === 'timeout' && state === 'WAIT_FRONTEND') {
        summary.frontend.lastTimeoutMs = Number.isFinite(Number(data?.timeoutMs)) ? Number(data.timeoutMs) : null;
        summary.frontend.lastError = String(data?.error || '');
      }
    }

    return summary;
  }, [status]);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const [statusRes, notesRes, catalogRes] = await Promise.all([
          fetch(`/api/fsm/status?fsmId=${encodeURIComponent(String(fsmId || 'startup-fsm'))}`),
          fetch(`/api/fsm/notes?fsmId=${encodeURIComponent(String(fsmId || 'startup-fsm'))}&limit=50`),
          fetch('/api/fsm/catalog')
        ]);
        const payload = await statusRes.json().catch(() => ({}));
        const notesPayload = await notesRes.json().catch(() => ({}));
        const catalogPayload = await catalogRes.json().catch(() => ({}));
        if (!cancelled) {
          setStatus(payload || {});
          setNotes(Array.isArray(notesPayload?.items) ? notesPayload.items.slice().reverse() : []);
          setCatalog(catalogPayload && typeof catalogPayload === 'object' ? catalogPayload : null);
          setError('');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || String(e));
        }
      }
    }

    loadStatus();
    const timer = setInterval(loadStatus, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fsmId]);

  useEffect(() => {
    const fsms = Array.isArray(catalog?.fsms) ? catalog.fsms : [];
    const current = fsms.find((item) => String(item?.id || '') === String(fsmId || 'startup-fsm'));
    const activeVersion = String(current?.activeVersion || status?.version || '').trim();
    if (activeVersion && activeVersion !== versionChoice) {
      setVersionChoice(activeVersion);
    }
    const subflows = Array.isArray(status?.subflows) ? status.subflows : [];
    setSubflowsDraft(subflows.join('\n'));
  }, [catalog, fsmId, status?.version]);

  useEffect(() => {
    async function renderDiagram() {
      if (!diagramRef.current) return;
      const id = `startup-fsm-${Date.now()}-${renderCounterRef.current++}`;
      const definition = buildMermaidDefinition(status);
      try {
        const { svg } = await mermaid.render(id, definition);
        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg;
        }
      } catch (e) {
        if (diagramRef.current) {
          diagramRef.current.innerHTML = `<pre style="color:#fecaca;white-space:pre-wrap;">Diagram render failed: ${String(e?.message || e)}</pre>`;
        }
      }
    }

    renderDiagram();
  }, [status]);

  async function startWorkflow() {
    setBusy(true);
    try {
      const response = await fetch('/api/fsm/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fsmId: String(fsmId || 'startup-fsm') })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Start failed (${response.status})`);
      }
      setError('');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function promoteVersion() {
    const targetVersion = String(versionChoice || '').trim();
    if (!targetVersion) return;
    setBusy(true);
    try {
      const response = await fetch('/api/fsm/catalog/promote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fsmId: String(fsmId || 'startup-fsm'), targetVersion, reason: 'promoted from runner UI' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Promote failed (${response.status})`);
      }
      setError('');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveSubflows() {
    const versionId = String(versionChoice || status?.version || '').trim();
    if (!versionId) return;
    const subflows = String(subflowsDraft || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    setBusy(true);
    try {
      const response = await fetch('/api/fsm/catalog/upsert-subflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fsmId: String(fsmId || 'startup-fsm'), versionId, subflows })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Save subflows failed (${response.status})`);
      }
      setError('');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createVersionFromCurrent() {
    const targetVersion = String(newVersionId || '').trim();
    const sourceVersion = String(status?.version || versionChoice || '').trim();
    if (!targetVersion || !sourceVersion) return;
    const versions = currentFsm?.versions && typeof currentFsm.versions === 'object' ? currentFsm.versions : {};
    const source = versions[sourceVersion] && typeof versions[sourceVersion] === 'object' ? versions[sourceVersion] : null;
    if (!source) {
      setError(`Source version not found: ${sourceVersion}`);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/fsm/catalog/upsert-version', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fsmId: String(fsmId || 'startup-fsm'),
          versionId: targetVersion,
          version: {
            ...source,
            subflows: String(subflowsDraft || '')
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean)
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Create version failed (${response.status})`);
      }
      setVersionChoice(targetVersion);
      setNewVersionId('');
      setError('');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const currentFsm = useMemo(() => {
    const fsms = Array.isArray(catalog?.fsms) ? catalog.fsms : [];
    return fsms.find((item) => String(item?.id || '') === String(fsmId || 'startup-fsm')) || null;
  }, [catalog, fsmId]);

  const availableVersions = useMemo(() => {
    const versions = currentFsm?.versions && typeof currentFsm.versions === 'object' ? currentFsm.versions : {};
    return Object.keys(versions);
  }, [currentFsm]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) 420px', gap: 12, minHeight: 320 }}>
      <section style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: 10, background: 'rgba(2, 6, 23, 0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 0.08, textTransform: 'uppercase', opacity: 0.75 }}>Startup FSM</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>State: {String(status?.state || 'IDLE')} | Version: {String(status?.version || 'n/a')}</div>
          </div>
          <button onClick={startWorkflow} disabled={busy}>{busy ? 'Starting...' : 'Run Startup Workflow'}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, opacity: 0.85 }}>Version</label>
          <select value={versionChoice} onChange={(event) => setVersionChoice(event.target.value)}>
            {availableVersions.map((versionId) => <option key={versionId} value={versionId}>{versionId}</option>)}
          </select>
          <button onClick={promoteVersion} disabled={busy || !versionChoice}>Promote Version</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, opacity: 0.85 }}>New Version</label>
          <input
            value={newVersionId}
            onChange={(event) => setNewVersionId(event.target.value)}
            placeholder="e.g. v2"
            style={{ minWidth: 120 }}
          />
          <button onClick={createVersionFromCurrent} disabled={busy || !newVersionId || !versionChoice}>Create from Current</button>
        </div>
        <div style={{ border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: 8, marginBottom: 8, background: 'rgba(15, 23, 42, 0.5)' }}>
          <div style={{ fontSize: 12, letterSpacing: 0.08, textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 }}>Retry Summary</div>
          <div style={{ fontSize: 12, display: 'grid', gap: 6 }}>
            <div>
              <strong>Backend</strong>: attempt {retrySummary.backend.attempt || 0}, retries used {retrySummary.backend.retriesScheduled}
              {Number.isFinite(retrySummary.backend.maxRetries) ? ` / ${retrySummary.backend.maxRetries}` : ''}
              {Number.isFinite(retrySummary.backend.lastTimeoutMs) ? `, last timeout ${retrySummary.backend.lastTimeoutMs}ms` : ''}
            </div>
            {retrySummary.backend.lastError && <div style={{ opacity: 0.8 }}>Backend last error: {retrySummary.backend.lastError}</div>}
            <div>
              <strong>Frontend</strong>: attempt {retrySummary.frontend.attempt || 0}, retries used {retrySummary.frontend.retriesScheduled}
              {Number.isFinite(retrySummary.frontend.maxRetries) ? ` / ${retrySummary.frontend.maxRetries}` : ''}
              {Number.isFinite(retrySummary.frontend.lastTimeoutMs) ? `, last timeout ${retrySummary.frontend.lastTimeoutMs}ms` : ''}
            </div>
            {retrySummary.frontend.lastError && <div style={{ opacity: 0.8 }}>Frontend last error: {retrySummary.frontend.lastError}</div>}
          </div>
        </div>
        {error && <div style={{ color: '#fecaca', marginBottom: 8 }}>{error}</div>}
        <div ref={diagramRef} style={{ width: '100%', minHeight: 240, overflow: 'auto' }} />
      </section>

      <section style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: 10, background: 'rgba(2, 6, 23, 0.55)', display: 'flex', flexDirection: 'column', minHeight: 320 }}>
        <div style={{ fontSize: 12, letterSpacing: 0.08, textTransform: 'uppercase', opacity: 0.75, marginBottom: 8 }}>Operator Log</div>
        <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logEntries.length === 0 && <div style={{ opacity: 0.7 }}>No startup events yet.</div>}
          {logEntries.map((entry, index) => (
            <div key={`${entry?.at || 'na'}-${index}`} style={{ border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: 8 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{String(entry?.at || '')}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{String(entry?.event || 'event')}</div>
              {entry?.data && <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontSize: 11, opacity: 0.9 }}>{JSON.stringify(entry.data, null, 2)}</pre>}
            </div>
          ))}
          {notes.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, letterSpacing: 0.08, textTransform: 'uppercase', opacity: 0.75, marginBottom: 8 }}>Failure Notes</div>
              {notes.map((entry, index) => (
                <div key={`note-${entry?.at || 'na'}-${index}`} style={{ border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{String(entry?.at || '')}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{String(entry?.type || 'note')}</div>
                  <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontSize: 11, opacity: 0.9 }}>{JSON.stringify(entry, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 10 }}>
            <div style={{ fontSize: 12, letterSpacing: 0.08, textTransform: 'uppercase', opacity: 0.75, marginBottom: 8 }}>Subflow Editor</div>
            <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 6 }}>One subflow per line for active version.</div>
            <textarea
              value={subflowsDraft}
              onChange={(event) => setSubflowsDraft(event.target.value)}
              style={{ width: '100%', minHeight: 130, background: 'rgba(15,23,42,0.8)', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: 8 }}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveSubflows} disabled={busy || !versionChoice}>Save Subflows</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
