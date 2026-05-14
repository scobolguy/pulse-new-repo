import React, { useEffect, useMemo, useState } from 'react';

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

export default function TransactionLifecycleDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  async function refresh() {
    try {
      const res = await fetch('/api/lifecycle/dashboard');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Dashboard API failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const payload = await res.json();
      setData(payload);
      setError('');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
    }
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  async function callLifecycleApi(url, body = {}) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    if (!res.ok) {
      throw new Error(payload?.error || `Request failed (${res.status})`);
    }
    return payload;
  }

  async function runAction(action) {
    try {
      if (action === 'start') {
        const txId = `TX-${Date.now()}`;
        const payload = await callLifecycleApi('/api/lifecycle/test/start', { txId });
        setActionResult(`Started test transaction ${payload?.active?.transactionId || txId}`);
      } else if (action === 'step-default') {
        const payload = await callLifecycleApi('/api/lifecycle/test/step', {});
        setActionResult(`Stepped by event ${payload?.transition?.event || 'auto'}`);
      } else if (action === 'step-map') {
        const payload = await callLifecycleApi('/api/lifecycle/test/step', { eventName: 'mapped_to_pacs' });
        setActionResult(`Stepped mapped_to_pacs -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'step-submit') {
        const payload = await callLifecycleApi('/api/lifecycle/test/step', { eventName: 'submitted_to_lynx' });
        setActionResult(`Stepped submitted_to_lynx -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'step-send-correspondent') {
        const payload = await callLifecycleApi('/api/lifecycle/test/step', { eventName: 'sent_to_correspondent' });
        setActionResult(`Stepped sent_to_correspondent -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'sim-boc-approve') {
        const payload = await callLifecycleApi('/api/lifecycle/simulators/bank-of-canada/approve', {});
        setActionResult(`Simulated BoC approve -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'sim-boc-reject') {
        const payload = await callLifecycleApi('/api/lifecycle/simulators/bank-of-canada/reject', {});
        setActionResult(`Simulated BoC reject -> ${payload?.active?.currentState || ''}`);
      } else if (action === 'sim-mt940') {
        const payload = await callLifecycleApi('/api/lifecycle/simulators/correspondent/send-mt940', {});
        setActionResult(`Simulated correspondent MT940 -> ${payload?.active?.currentState || ''}`);
      }
      await refresh();
    } catch (e) {
      setActionResult(`Action failed: ${e.message || e}`);
    }
  }

  const stateByName = useMemo(() => {
    const map = new Map();
    for (const state of data?.states || []) {
      map.set(state.stateName, state);
    }
    return map;
  }, [data]);

  const transitionLookup = useMemo(() => {
    const map = new Map();
    for (const transition of data?.transitions || []) {
      const key = `${transition.from}__${transition.to}`;
      map.set(key, transition.event || '');
    }
    return map;
  }, [data]);

  if (loading) {
    return <div style={{ padding: 12 }}>Loading transaction lifecycle dashboard...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 12, color: '#7a1f1f' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Unable to load lifecycle dashboard</div>
        <div>{error}</div>
      </div>
    );
  }

  const layers = Array.isArray(data?.topology?.layers) ? data.topology.layers : [];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data?.transactionId || 'transaction-lifecycle'}</div>
          <div style={{ color: '#334155', marginTop: 4 }}>{data?.description || ''}</div>
          <div style={{ color: '#64748b', marginTop: 6, fontSize: 12 }}>
            Right-click anywhere on this screen for test controls.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Total messages across lifecycle states</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{formatCount(data?.totalMessagesAcrossStates || 0)}</div>
        </div>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#fff', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Active Test Transaction</div>
          <div style={{ fontSize: 12, color: '#334155' }}>ID: {data?.harness?.active?.transactionId || '(none)'}</div>
          <div style={{ fontSize: 12, color: '#334155' }}>Current state: {stateByName.get(data?.harness?.active?.currentState)?.label || data?.harness?.active?.currentState || '(none)'}</div>
          <div style={{ fontSize: 12, color: '#334155' }}>Last event: {data?.harness?.active?.lastEvent || '(none)'}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'right', fontSize: 12, color: '#475569' }}>
          {actionResult || 'Use right-click actions to start, step, or simulate external actors.'}
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #dbe3ef', borderRadius: 10, background: '#f8fbff' }}>
        <div style={{ display: 'flex', gap: 12, padding: 12, minWidth: 980, alignItems: 'stretch' }}>
          {layers.map((layer, index) => {
            const layerStates = (layer.stateNames || []).map(name => stateByName.get(name)).filter(Boolean);
            const layerTotal = Number(data?.totalsByLayer?.[layer.index] || 0);
            return (
              <div key={`layer-${index}`} style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: '#0f172a', color: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontWeight: 700 }}>Step {layer.index + 1}</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>Messages in step: {formatCount(layerTotal)}</div>
                </div>

                {layerStates.map(state => (
                  <div key={state.stateName} style={{ border: '1px solid #c6d4ea', background: '#fff', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ fontWeight: 700 }}>{state.label}</div>
                      {state.isInitial ? <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>INITIAL</div> : null}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
                      Queue: {state.queueName || '(none)'}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 12, color: '#334155' }}>Messages waiting</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{formatCount(state.queueLength)}</div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                      Next events:
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(data?.transitions || [])
                        .filter(t => t.from === state.stateName)
                        .map(t => (
                          <span key={`${t.from}-${t.to}-${t.event}`} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>
                            {t.event}{' -> '}{stateByName.get(t.to)?.label || t.to}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}

                {index < layers.length - 1 ? (
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: 12 }}>
                    {'->'}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#fff' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Transition Matrix</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '6px 4px' }}>From</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '6px 4px' }}>To</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '6px 4px' }}>Event</th>
              </tr>
            </thead>
            <tbody>
              {(data?.transitions || []).map(t => (
                <tr key={`${t.from}-${t.to}-${t.event}`}>
                  <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 4px' }}>{stateByName.get(t.from)?.label || t.from}</td>
                  <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 4px' }}>{stateByName.get(t.to)?.label || t.to}</td>
                  <td style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 4px' }}>{transitionLookup.get(`${t.from}__${t.to}`) || t.event}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {contextMenu ? (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.2)',
            minWidth: 260,
            overflow: 'hidden'
          }}
        >
          {[
            { id: 'start', label: 'Start Test Transaction' },
            { id: 'step-default', label: 'Single Step (auto)' },
            { id: 'step-map', label: 'Step: mapped_to_pacs' },
            { id: 'step-submit', label: 'Step: submitted_to_lynx' },
            { id: 'step-send-correspondent', label: 'Step: sent_to_correspondent' },
            { id: 'sim-boc-approve', label: 'Simulator: Bank of Canada Approve' },
            { id: 'sim-boc-reject', label: 'Simulator: Bank of Canada Reject' },
            { id: 'sim-mt940', label: 'Simulator: Correspondent Send MT940' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setContextMenu(null);
                runAction(item.id);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: '#fff',
                border: 'none',
                borderBottom: '1px solid #e2e8f0',
                padding: '9px 12px',
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
