import { useCallback, useState } from 'react';

const ENGINE_BADGE = {
  ollama: { label: '🤖 phi3', bg: '#e8f5e9', color: '#2e7d32', border: '#4CAF50' },
  keyword: { label: '🔑 keyword', bg: '#f5f5f5', color: '#555', border: '#bbb' },
};

/** Returns true if the query is asking about nodes / topology */
function isNodeQuery(q) {
  const lower = q.toLowerCase();
  return /\bnodes?\b|\btopolog|\binfrastructure\b|\bdevices?\b|\bnetwork\s+(nodes?|map)\b|\bshow\s+(all\s+)?nodes?\b|\blist\s+(all\s+)?nodes?\b|\bwhat\s+nodes\b/.test(lower);
}

export default function QueryPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // --- Node topology shortcut ---
      if (isNodeQuery(query.trim())) {
        const nodesRes = await fetch('/api/nodes');
        if (!nodesRes.ok) throw new Error(`/api/nodes failed: ${nodesRes.status}`);
        const nodesData = await nodesRes.json();
        const item = { type: 'nodes', query: query.trim(), nodes: nodesData, ts: new Date() };
        setResult(item);
        setHistory((h) => [item, ...h.slice(0, 9)]);
        return;
      }

      // 1. Match pattern
      const matchRes = await fetch('/api/patterns/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!matchRes.ok) throw new Error(`Pattern match failed: ${matchRes.status}`);
      const matchData = await matchRes.json();
      const topMatch = (matchData.matches || [])[0];
      if (!topMatch) {
        setError('No matching pattern found.');
        return;
      }

      // 2. Load full pattern
      const patternRes = await fetch(`/api/patterns/${topMatch.id}`);
      if (!patternRes.ok) throw new Error('Could not load pattern');
      const patternData = await patternRes.json();

      // 3. Extract steps from markdown
      const steps = extractSteps(patternData.content || '');

      const item = {
        query: query.trim(),
        engine: matchData.engine || 'keyword',
        classification: matchData.classification || null,
        pattern: topMatch,
        steps,
        ts: new Date(),
      };

      setResult(item);
      setHistory((h) => [item, ...h.slice(0, 9)]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleReloadOllama = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ollama/reload', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Reload failed: ${res.status}`);
      }
      const data = await res.json();
      setError(''); // Clear any errors
      // Force re-analysis with fresh context
      if (query.trim()) {
        handleSubmit(); // Re-run current query
      }
    } catch (e) {
      setError(`Reload failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [query, handleSubmit]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Input */}
      <form onSubmit={handleSubmit}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe what you need to build…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '14px 16px', fontSize: 15, lineHeight: 1.5,
            border: '1px solid #d0d0d0', borderRadius: 8,
            resize: 'vertical', minHeight: 90,
            outline: 'none', fontFamily: 'inherit',
            color: '#111',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#4CAF50'; }}
          onBlur={(e) => { e.target.style.borderColor = '#d0d0d0'; }}
        />
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              padding: '10px 22px', fontSize: 14, fontWeight: 600,
              background: loading ? '#aaa' : '#111', color: '#fff',
              border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Thinking…' : 'Analyze'}
          </button>
          {result && (
            <>
              <button
                type="button"
                onClick={() => { setResult(null); setQuery(''); setError(''); }}
                style={{
                  padding: '10px 16px', fontSize: 14, background: 'transparent',
                  color: '#888', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer',
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleReloadOllama}
                disabled={loading}
                title="Reload AI context and re-analyze"
                style={{
                  padding: '10px 16px', fontSize: 14, background: 'transparent',
                  color: loading ? '#ccc' : '#4CAF50', border: '1px solid #4CAF50', borderRadius: 6,
                  cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500,
                }}
              >
                🔄 Reload AI
              </button>
            </>
          )}
        </div>
      </form>

      {error && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fff0f0', border: '1px solid #f44336', borderRadius: 6, color: '#c62828', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && result.type === 'nodes' && <NodeTreeResult nodes={result.nodes} />}
      {result && result.type !== 'nodes' && <ResultCard result={result} />}

      {/* History */}
      {history.length > 1 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, color: '#999', textTransform: 'uppercase', marginBottom: 10 }}>History</div>
          {history.slice(1).map((item, i) => (
            <button
              key={i}
              onClick={() => setResult(item)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', marginBottom: 6,
                background: '#fafafa', border: '1px solid #eee', borderRadius: 6,
                cursor: 'pointer', fontSize: 13, color: '#333',
              }}
            >
              <span style={{ fontWeight: 500 }}>{item.query}</span>
              <span style={{ marginLeft: 10, fontSize: 11, color: '#aaa' }}>
                {item.pattern?.title} · {item.ts.toLocaleTimeString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node tree (lazy-loading collapsible)
// ---------------------------------------------------------------------------

function NodeTreeResult({ nodes }) {
  if (!nodes || nodes.length === 0) {
    return (
      <div style={{ marginTop: 20, padding: '12px 16px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6, color: '#5d4037', fontSize: 13 }}>
        No nodes found. The network may be empty or /api/nodes returned nothing.
      </div>
    );
  }
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, color: '#999', textTransform: 'uppercase', marginBottom: 10 }}>
        Network Nodes ({nodes.length})
      </div>
      {nodes.map((node, i) => (
        <NodeRow key={node.ip || i} node={node} />
      ))}
    </div>
  );
}

function NodeRow({ node }) {
  const [open, setOpen] = useState(false);
  const name = node.nodeName || node.ip || 'Unknown Node';
  const status = node.details?.status || 'unknown';
  const hardware = node.details?.hardware || '';
  const statusColor = status === 'ok' || status === 'online' ? '#2e7d32' : '#c62828';

  return (
    <div style={{ marginBottom: 6, border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
      {/* Header row — click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
          gap: 10, padding: '10px 14px', background: open ? '#f5f5f5' : '#fafafa',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 11, color: '#888', width: 14, flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#111', flex: 1 }}>{name}</span>
        {hardware && <span style={{ fontSize: 11, color: '#888' }}>{hardware}</span>}
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: status === 'ok' || status === 'online' ? '#e8f5e9' : '#fff0f0',
          color: statusColor, border: `1px solid ${statusColor}`,
        }}>{status}</span>
        <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{node.ip}</span>
      </button>

      {/* Children — only rendered when open (lazy) */}
      {open && <NodeDetails node={node} />}
    </div>
  );
}

function NodeDetails({ node }) {
  const [servicesOpen, setServicesOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const services = node.details?.services || [];
  const devices = node.details?.devices || node.details?.localDevices || [];
  const lastSeen = node.lastSeen ? new Date(node.lastSeen).toLocaleTimeString() : '—';

  return (
    <div style={{ padding: '10px 14px 12px 38px', background: '#fff', borderTop: '1px solid #eee', fontSize: 13 }}>
      <div style={{ color: '#555', marginBottom: 8 }}>
        <span style={{ color: '#888' }}>Last seen:</span> {lastSeen}
        {node.details?.version && <span style={{ marginLeft: 14, color: '#888' }}>v{node.details.version}</span>}
      </div>

      {/* Services subtree */}
      <TreeSection
        label={`Services (${services.length})`}
        open={servicesOpen}
        onToggle={() => setServicesOpen(o => !o)}
        empty={services.length === 0}
      >
        {services.map((svc, i) => {
          const svcColor = svc.status === 'online' ? '#2e7d32' : '#c62828';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: i < services.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: svcColor }}>●</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{svc.name}</span>
              {svc.api && <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{svc.api}</span>}
              <span style={{ fontSize: 11, color: svcColor }}>{svc.status}</span>
            </div>
          );
        })}
      </TreeSection>

      {/* Devices subtree */}
      <TreeSection
        label={`Devices (${devices.length})`}
        open={devicesOpen}
        onToggle={() => setDevicesOpen(o => !o)}
        empty={devices.length === 0}
        style={{ marginTop: 6 }}
      >
        {devices.map((dev, i) => (
          <div key={i} style={{ padding: '3px 0', color: '#444', fontSize: 12 }}>
            {dev.name || dev.id || JSON.stringify(dev)}
          </div>
        ))}
      </TreeSection>
    </div>
  );
}

function TreeSection({ label, open, onToggle, empty, children, style }) {
  return (
    <div style={style}>
      <button
        onClick={onToggle}
        disabled={empty}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: empty ? 'default' : 'pointer',
          padding: '3px 0', fontSize: 12, fontFamily: 'inherit',
          color: empty ? '#bbb' : '#444',
        }}
      >
        <span style={{ fontSize: 10, width: 12 }}>{empty ? '─' : open ? '▼' : '▶'}</span>
        <span>{label}</span>
        {empty && <span style={{ fontSize: 11, color: '#bbb' }}>(none)</span>}
      </button>
      {open && !empty && (
        <div style={{ paddingLeft: 18, marginTop: 4 }}>{children}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ResultCard({ result }) {
  const { engine, classification, pattern, steps } = result;
  const badge = ENGINE_BADGE[engine] || ENGINE_BADGE.keyword;

  return (
    <div style={{ marginTop: 28 }}>
      {/* Understanding block */}
      <div style={{
        padding: '20px 24px', background: '#fafafa',
        border: '1px solid #e0e0e0', borderRadius: 10, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Understanding</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
          }}>
            {badge.label}
          </span>
        </div>

        {classification?.intent && (
          <p style={{ margin: '0 0 14px', fontSize: 15, color: '#111', lineHeight: 1.6 }}>
            {classification.intent}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {classification?.sourceType && (
            <Chip label="Source" value={classification.sourceType} color="#1565c0" bg="#e3f2fd" />
          )}
          {classification?.targetType && (
            <Chip label="Target" value={classification.targetType} color="#1565c0" bg="#e3f2fd" />
          )}
          <Chip label="Pattern" value={pattern.title} color="#2e7d32" bg="#e8f5e9" />
          {classification?.confidence != null && (
            <Chip label="Confidence" value={`${Math.round(classification.confidence * 100)}%`} color="#555" bg="#f5f5f5" />
          )}
        </div>
      </div>

      {/* Solution steps */}
      {steps.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, color: '#999', textTransform: 'uppercase', marginBottom: 12 }}>
            Solution Steps
          </div>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', gap: 16, padding: '14px 0',
              borderBottom: i < steps.length - 1 ? '1px solid #eee' : 'none',
            }}>
              <div style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                background: '#111', color: '#fff', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111', marginBottom: 4 }}>{step.title}</div>
                {step.verification && (
                  <div style={{ fontSize: 13, color: '#555' }}>{step.verification}</div>
                )}
              </div>
              {step.needsVerification && (
                <div style={{ flexShrink: 0, fontSize: 11, color: '#e65100', fontWeight: 600, paddingTop: 6 }}>⚠ Verify</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, color, bg }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', background: bg, borderRadius: 20,
      fontSize: 12,
    }}>
      <span style={{ color: '#888', fontWeight: 500 }}>{label}:</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function extractSteps(content) {
  const lines = content.split('\n');
  const steps = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^### Step \d+:/)) {
      if (current) steps.push(current);
      current = {
        title: line.replace(/^### Step \d+:\s*/, '').trim(),
        verification: null,
        needsVerification: false,
      };
    } else if (current && line.includes('**Verification**')) {
      const next = lines[i + 1] || '';
      const text = next.replace(/^- /, '').replace(/\*\*/g, '').trim();
      current.verification = text;
      current.needsVerification = text.includes('⚠');
    }
  }
  if (current) steps.push(current);
  return steps;
}
