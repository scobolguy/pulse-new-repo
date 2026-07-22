import { useCallback, useState } from 'react';

const ASK_ENDPOINT = '/api/ollama/ask';
const NODES_ENDPOINT = '/api/ollama/nodes';
const SERVICES_ENDPOINT = '/api/ollama/services';

async function postAskQuery(query) {
  const res = await fetch(ASK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `${ASK_ENDPOINT} failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return {
    endpoint: ASK_ENDPOINT,
    answer: String(data.answer || '').trim(),
    model: String(data.model || 'unknown-model'),
    queryType: String(data.queryType || 'general'),
  };
}

async function sendRelayControl(nodeId, pin, action, duration) {
  const res = await fetch('/api/ollama/relay/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId, pin, action, duration }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Relay control failed: HTTP ${res.status}`);
  }
  return await res.json();
}

async function fetchNodes() {
  try {
    const res = await fetch(NODES_ENDPOINT);
    if (!res.ok) return null;
    const data = await res.json();
    return data.nodes || [];
  } catch (e) {
    console.warn('Failed to fetch nodes:', e.message);
    return null;
  }
}

async function fetchServices() {
  try {
    const res = await fetch(SERVICES_ENDPOINT);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      services: data.services || [],
      servicesByNode: data.servicesByNode || {},
    };
  } catch (e) {
    console.warn('Failed to fetch services:', e.message);
    return null;
  }
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
      const response = await postAskQuery(query.trim());
      
      // If query is about nodes, also fetch actual node list
      let nodes = null;
      let services = null;
      let relayControl = null;
      const isNodesQuery = /node|network|topology|infrastructure|devices?|cluster/i.test(query.trim());
      const isServicesQuery = /service|capability|available|what can|what do|function/i.test(query.trim());
      const isRelayQuery = /relay|switch|activate|deactivate|turn\s+on|turn\s+off|pulse|gpio/i.test(query.trim());
      
      if (isNodesQuery) {
        nodes = await fetchNodes();
      }
      if (isServicesQuery) {
        services = await fetchServices();
      }
      
      // For relay control, try to parse the answer as JSON command
      if (isRelayQuery && response.queryType === 'relay-control') {
        try {
          // Ollama might wrap JSON in markdown code fences, extract it
          let jsonStr = response.answer;
          const jsonMatch = jsonStr.match(/```json\n([\s\S]*?)\n```/) || jsonStr.match(/```\n([\s\S]*?)\n```/) || jsonStr.match(/```([\s\S]*?)```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonStr = jsonMatch[1].trim();
          }
          
          // Remove any comments from JSON (e.g., "pin": 0, // comment)
          jsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/,\s*([\]}])/g, '$1');
          
          // Try to parse as JSON - Ollama returns structured relay command
          const relayCmd = JSON.parse(jsonStr);
          if (relayCmd.action && relayCmd.node && relayCmd.pin !== undefined) {
            // Execute the relay control command
            relayControl = await sendRelayControl(relayCmd.node, relayCmd.pin, relayCmd.action, relayCmd.duration);
          }
        } catch (parseErr) {
          // If parsing fails, treat answer as text response
          console.warn('Could not parse relay command as JSON:', response.answer, parseErr.message);
        }
      }

      const item = {
        type: 'ollamaQuery',
        query: query.trim(),
        answer: response.answer,
        model: response.model,
        provider: 'ollama',
        nodes: nodes || undefined,
        services: services || undefined,
        relayControl: relayControl || undefined,
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

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#111' }}>Ollama Query</h1>
      <p style={{ marginTop: 8, marginBottom: 18, color: '#555', fontSize: 14 }}>
        Single-page query interface backed by the local Ollama instance.
      </p>

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
            {loading ? 'Querying...' : 'Ask Ollama'}
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
      {result && <OllamaResultCard result={result} />}

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
                {historyLabel(item)} · {item.ts.toLocaleTimeString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OllamaResultCard({ result }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{
        padding: '20px 24px', background: '#fafafa',
        border: '1px solid #e0e0e0', borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Response</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
            background: '#e8f5e9', color: '#2e7d32', border: '1px solid #4CAF50',
          }}>
            {String(result.provider || 'ollama').toUpperCase()} {result.model || 'unknown-model'}
          </span>
        </div>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#111', lineHeight: 1.6 }}>
          {result.answer || 'No response text returned.'}
        </div>
      </div>

      {/* Nodes Table - if available */}
      {result.nodes && result.nodes.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{
            padding: '20px 24px', background: '#f0f7ff',
            border: '1px solid #b3e5fc', borderRadius: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#01579b', marginBottom: 12 }}>
              Network Nodes ({result.nodes.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: 13, color: '#333',
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #4db8ff' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#01579b' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#01579b' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#01579b' }}>IP</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#01579b' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#01579b' }}>Services</th>
                  </tr>
                </thead>
                <tbody>
                  {result.nodes.map((node, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #b3e5fc' }}>
                      <td style={{ padding: '8px 10px' }}>{node.name}</td>
                      <td style={{ padding: '8px 10px' }}>{node.type}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>{node.ip}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: 3,
                          background: node.status === 'online' ? '#c8e6c9' : '#ffccbc',
                          color: node.status === 'online' ? '#1b5e20' : '#d84315',
                          fontSize: 11, fontWeight: 600,
                        }}>
                          {node.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: '#555' }}>
                        {node.services && node.services.length > 0 ? node.services.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Services Table - if available */}
      {result.services && result.services.services && result.services.services.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{
            padding: '20px 24px', background: '#f3e5f5',
            border: '1px solid #ce93d8', borderRadius: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4a148c', marginBottom: 12 }}>
              Available Services ({result.services.services.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: 13, color: '#333',
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #da7fd8' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#4a148c' }}>Service</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#4a148c' }}>Providers</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600, color: '#4a148c' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {result.services.services.map((svc, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e1bee7' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{svc.name}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: '#555' }}>
                        {svc.providers.join(', ')}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#7b1fa2' }}>
                        {svc.providerCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Relay Control Result - if available */}
      {result.relayControl && result.relayControl.success && (
        <div style={{ marginTop: 18 }}>
          <div style={{
            padding: '20px 24px', background: '#fff3e0',
            border: '1px solid #ffb74d', borderRadius: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e65100', marginBottom: 12 }}>
              ✓ Relay Control Executed
            </div>
            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
              {result.relayControl.message}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#666', backgroundColor: '#fff9e6', padding: '8px 12px', borderRadius: 4 }}>
              <strong>Command Details:</strong>
              <div style={{ marginTop: 6, fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 11 }}>
                {JSON.stringify(result.relayControl.command, null, 2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function historyLabel(item) {
  return item.type === 'ollamaQuery' ? 'Ollama query' : 'Query';
}
