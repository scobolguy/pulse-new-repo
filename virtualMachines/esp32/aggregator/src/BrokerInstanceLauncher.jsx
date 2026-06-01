

import { useState } from 'react';

export default function BrokerInstanceLauncher() {
  // Try to auto-fill backend IP for secondary broker URL
  let defaultBackendUrl = 'http://localhost:4001';
  if (typeof window !== 'undefined' && window.location) {
    const { hostname } = window.location;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      defaultBackendUrl = `http://${hostname}:4001`;
    }
  }
  // UI state machine: 'start', 'sync', 'quiesce', 'stop'
  const [buttonState, setButtonState] = useState('start');
  const [log, setLog] = useState([]);
  const [primaryUrl, setPrimaryUrl] = useState('');
  const [secondaryUrl, setSecondaryUrl] = useState(defaultBackendUrl);
  const [discovering, setDiscovering] = useState(false);
  const [syncing, setSyncing] = useState(false);

  function addLog(msg) {
    setLog(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-100));
  }

  // Real UDP discovery via backend API
  async function discoverPrimary() {
    setDiscovering(true);
    addLog('Discovering primary broker via UDP...');
    try {
      const res = await fetch('/api/discover-primary');
      if (!res.ok) throw new Error('No primary broker found');
      const data = await res.json();
      setPrimaryUrl(data.url);
      addLog('Primary broker found at ' + data.url + (data.node?.nodeName ? ` (${data.node.nodeName})` : ''));
      setButtonState('sync');
    } catch (e) {
      addLog('Discovery failed: ' + e);
    }
    setDiscovering(false);
  }


  async function syncConfigs() {
    setSyncing(true);
    addLog('Synchronizing configuration with primary...');
    try {
      // Fetch queues/config from primary and POST to secondary
      if (!primaryUrl || !secondaryUrl) throw new Error('Missing broker URLs');
      const queues = await fetch(primaryUrl + '/api/queues').then(r => r.json());
      await fetch(secondaryUrl + '/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queues)
      });
      addLog('Sync complete.');
      setButtonState('quiesce');
    } catch (e) {
      addLog('Sync failed: ' + e);
    }
    setSyncing(false);
  }


  async function quiesceBroker() {
    addLog('Quiescing broker (removing from round robin)...');
    try {
      await fetch(secondaryUrl + '/api/broker/quiesce', { method: 'POST' });
      addLog('Quiesced. No new work will be assigned.');
      setButtonState('stop');
    } catch (e) {
      addLog('Quiesce failed: ' + e);
    }
  }


  async function stopBroker() {
    addLog('Stopping broker...');
    try {
      await fetch(secondaryUrl + '/api/broker/stop', { method: 'POST' });
      addLog('Broker stopped.');
      setButtonState('start');
      setPrimaryUrl('');
    } catch (e) {
      addLog('Stop failed: ' + e);
    }
  }

  function handleButton() {
    if (buttonState === 'start') discoverPrimary();
    else if (buttonState === 'sync') syncConfigs();
    else if (buttonState === 'quiesce') quiesceBroker();
    else if (buttonState === 'stop') stopBroker();
  }

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: '40px auto', background: '#f8fafc', borderRadius: 10, boxShadow: '0 2px 12px #e0e0e0' }}>
      <h2 style={{ fontWeight: 700, color: '#1a237e', marginBottom: 18 }}>Secondary Broker State Machine</h2>
      <div style={{ marginBottom: 16 }}>
        <label>Secondary Broker URL: <input value={secondaryUrl} onChange={e => setSecondaryUrl(e.target.value)} size={30} /></label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>Primary Broker URL: <input value={primaryUrl} onChange={e => setPrimaryUrl(e.target.value)} size={30} disabled={buttonState !== 'start'} /></label>
      </div>
      <div style={{ margin: '24px 0' }}>
        <button onClick={handleButton} disabled={discovering || syncing} style={{ fontSize: 16, padding: '10px 32px', borderRadius: 6, background: '#1976d2', color: '#fff', border: 'none', cursor: discovering || syncing ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {buttonState === 'start' && (discovering ? 'Discovering...' : 'Start')}
          {buttonState === 'sync' && (syncing ? 'Syncing...' : 'Sync')}
          {buttonState === 'quiesce' && 'Quiesce'}
          {buttonState === 'stop' && 'Stop'}
        </button>
      </div>
      <div style={{ marginTop: 24, background: '#222', color: '#b2ffb2', borderRadius: 6, padding: 12, minHeight: 120, fontFamily: 'monospace', fontSize: 13, maxHeight: 220, overflowY: 'auto' }}>
        <div>Log:</div>
        {log.length === 0 ? <div style={{ color: '#888' }}>No log entries yet.</div> : log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
