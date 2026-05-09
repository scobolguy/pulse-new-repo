import React, { useState, useEffect, useRef } from 'react';

export default function SecondaryBrokerLauncher() {
  // Default backend URL
  const [backendUrl, setBackendUrl] = useState('http://neptune:4000');
  const [log, setLog] = useState([]);
  const [listening, setListening] = useState(false);
  const logRef = useRef(null);

  // Scroll log to bottom on update
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  // Simulate UDP listening (replace with real backend API call)
  useEffect(() => {
    if (!listening) return;
    const interval = setInterval(() => {
      // Simulate receiving a UDP message
      const msg = `UDP: backend advertised at http://neptune:4000 (${new Date().toLocaleTimeString()})`;
      setLog(l => [...l, msg].slice(-100));
      // Example: auto-update backendUrl if found in UDP message
      if (msg.includes('backend advertised at')) {
        const match = msg.match(/backend advertised at (http:\/\/[^ ]+)/);
        if (match) setBackendUrl(match[1]);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [listening]);

  // Handler to create a secondary broker
  async function handleCreateSecondaryBroker() {
    setLog(l => [...l, `[${new Date().toLocaleTimeString()}] Creating secondary broker...`].slice(-100));
    try {
      const res = await fetch(`${backendUrl}/api/broker/launch-secondary`, { method: 'POST' });
      const data = await res.json();
      console.log('Response status:', res.status);
      console.log('Response data:', data);
      setLog(l => [...l, `[${new Date().toLocaleTimeString()}] Status ${res.status}: ${data.status || data.error || JSON.stringify(data)}`].slice(-100));
    } catch (e) {
      console.error('Fetch error:', e);
      setLog(l => [...l, `[${new Date().toLocaleTimeString()}] Error: ${e.message || e}`].slice(-100));
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', maxWidth: 600 }}>
      <h2>Secondary Broker Launcher</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Backend URL: </label>
        <input value={backendUrl} onChange={e => setBackendUrl(e.target.value)} size={40} style={{ fontSize: 13, padding: '2px 6px', borderRadius: 4, border: '1px solid #bbb', marginRight: 8 }} />
        <button onClick={() => setListening(l => !l)} style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, border: '1px solid #bbb', marginRight: 8 }}>
          {listening ? 'Stop Listening' : 'Start Listening'}
        </button>
        <button onClick={handleCreateSecondaryBroker} style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, border: '1px solid #4caf50', background: '#e8f5e9', color: '#256029', fontWeight: 600 }}>
          Create Secondary Broker
        </button>
      </div>
      <div style={{ border: '1px solid #bbb', borderRadius: 4, background: '#fafafa', height: 200, overflowY: 'auto', padding: 8, fontSize: 13 }} ref={logRef}>
        {log.length === 0 ? <div style={{ color: '#888' }}>No UDP messages yet.</div> : log.map((msg, i) => <div key={i}>{msg}</div>)}
      </div>
    </div>
  );
}
