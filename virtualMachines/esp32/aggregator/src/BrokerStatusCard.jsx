import React, { useEffect, useState } from 'react';

export default function BrokerStatusCard() {
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchState() {
    try {
      const res = await fetch('/api/broker/state');
      const data = await res.json();
      setState(data.state);
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

  async function sendAction(action) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/broker/${action}`, { method: 'POST' });
      const data = await res.json();
      setState(data.state);
    } catch (e) {
      setError('Action failed');
    }
    setLoading(false);
  }

  return (
    <div style={{ border: '1px solid #d4d4d4', background: '#e3f2fd', borderRadius: 4, padding: 12, minWidth: 160, maxWidth: 200, marginBottom: 16, boxShadow: '0 1px 2px #eee', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="40" height="32" viewBox="0 0 40 32" style={{ marginBottom: 4 }}><rect x="2" y="6" width="36" height="18" rx="3" fill="#90caf9" stroke="#1976d2" strokeWidth="1.5"/><rect x="8" y="10" width="24" height="10" rx="1.5" fill="#fff" stroke="#1976d2" strokeWidth="1"/><rect x="14" y="26" width="12" height="3" rx="1.5" fill="#1976d2"/></svg>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1976d2', marginBottom: 2, textAlign: 'center' }}>Message Broker</div>
      <div style={{ fontSize: 12, color: '#333', marginBottom: 4, textAlign: 'center' }}>( {state || 'unknown'} )</div>
      {error && <div style={{ color: 'red', fontSize: 11 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction('start')}>Start</button>
        <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction('stop')}>Stop</button>
        <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction('quiesce')}>Quiesce</button>
        <button disabled={loading} style={{ fontSize: 11 }} onClick={() => sendAction('unquiesce')}>Unquiesce</button>
      </div>
    </div>
  );
}
