import React, { useEffect, useState } from 'react';

export default function BrokerStatusCard() {
  const [state, setState] = useState('');
  const [classStatus, setClassStatus] = useState('unknown');
  const [brokers, setBrokers] = useState({});
  const [newInstanceId, setNewInstanceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchState() {
    try {
      const res = await fetch('/api/broker/state');
      const data = await res.json();
      setState(data.state);
      setClassStatus(data.classStatus || 'unknown');
      setBrokers(data.brokers || {});
      setError('');
    } catch (e) {
      setError('Error fetching broker state');
    }
  }

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  async function sendAction(path) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(path, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Action failed');
      }
      await fetchState();
    } catch (e) {
      setError(e.message || 'Action failed');
    }
    setLoading(false);
  }

  function renderInstanceStatus(instanceId, instance) {
    const statusText = instance.active
      ? (instance.quiesced ? 'quiesced' : 'up')
      : 'down';
    return (
      <div key={instanceId} style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 8, width: '100%' }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{instanceId}</div>
        <div style={{ fontSize: 12, color: '#444', marginBottom: 6 }}>{statusText}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction(`/api/broker/instances/${encodeURIComponent(instanceId)}/up`)}>Up</button>
          <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction(`/api/broker/instances/${encodeURIComponent(instanceId)}/down`)}>Down</button>
          <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction(`/api/broker/instances/${encodeURIComponent(instanceId)}/quiesce`)}>Quiesce</button>
          <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction(`/api/broker/instances/${encodeURIComponent(instanceId)}/unquiesce`)}>Unquiesce</button>
        </div>
      </div>
    );
  }

  async function handleAddInstance() {
    const id = newInstanceId.trim().toLowerCase();
    if (!id) return;
    await sendAction(`/api/broker/instances/${encodeURIComponent(id)}/up`);
    setNewInstanceId('');
  }

  const brokerEntries = Object.entries(brokers || {}).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div style={{ border: '1px solid #d4d4d4', background: '#e3f2fd', borderRadius: 4, padding: 12, minWidth: 220, maxWidth: 360, marginBottom: 16, boxShadow: '0 1px 2px #eee', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="40" height="32" viewBox="0 0 40 32" style={{ marginBottom: 4 }}><rect x="2" y="6" width="36" height="18" rx="3" fill="#90caf9" stroke="#1976d2" strokeWidth="1.5"/><rect x="8" y="10" width="24" height="10" rx="1.5" fill="#fff" stroke="#1976d2" strokeWidth="1"/><rect x="14" y="26" width="12" height="3" rx="1.5" fill="#1976d2"/></svg>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1976d2', marginBottom: 2, textAlign: 'center' }}>Message Broker</div>
      <div style={{ fontSize: 12, color: '#333', marginBottom: 4, textAlign: 'center' }}>( {state || 'unknown'} )</div>
      <div style={{ fontSize: 12, color: classStatus === 'down' ? '#a32020' : '#1d6b2a', fontWeight: 600 }}>Class: {classStatus}</div>
      {error && <div style={{ color: 'red', fontSize: 11 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction('/api/broker/class/up')}>Class Up</button>
        <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction('/api/broker/class/down')}>Class Down</button>
      </div>
      <div style={{ width: '100%', display: 'flex', gap: 6 }}>
        <input
          value={newInstanceId}
          onChange={e => setNewInstanceId(e.target.value)}
          placeholder="new instance id"
          style={{ flex: 1, fontSize: 11 }}
          disabled={loading}
        />
        <button disabled={loading || !newInstanceId.trim()} style={{ fontSize: 11 }} onClick={handleAddInstance}>Add/Up</button>
      </div>
      <div style={{ width: '100%', fontSize: 11, color: '#4a4a4a' }}>Instances: {brokerEntries.length}</div>
      {brokerEntries.map(([instanceId, instance]) => renderInstanceStatus(instanceId, instance))}
    </div>
  );
}
