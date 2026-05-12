import './App.css';
import TopologyDashboard from './TopologyDashboard';
import QueueManagerDashboard from './QueueManagerDashboard';
import DataLibrarian from './DataLibrarian';
import DataMapper from './DataMapper';
import React, { useState } from 'react';

const SCREENS = [
  { id: 'topology', label: 'Network Topology' },
  { id: 'queue', label: 'Queue Manager' },
  { id: 'librarian', label: 'Data Librarian' },
  { id: 'mapper', label: 'Data Mapper' },
];

function App() {
  const [screen, setScreen] = useState('topology');
  return (
    <div className="App">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '2px solid #e0e7ef', paddingBottom: 8 }}>
        {SCREENS.map(s => (
          <button
            key={s.id}
            onClick={() => setScreen(s.id)}
            style={{
              fontWeight: screen === s.id ? 'bold' : 'normal',
              borderBottom: screen === s.id ? '2px solid #1a73e8' : '2px solid transparent',
              background: 'none',
              border: 'none',
              borderBottom: screen === s.id ? '2px solid #1a73e8' : '2px solid transparent',
              cursor: 'pointer',
              padding: '6px 14px',
              fontSize: 14,
              color: screen === s.id ? '#1a73e8' : '#444',
            }}
          >{s.label}</button>
        ))}
      </div>
      {screen === 'topology' && <TopologyDashboard />}
      {screen === 'queue' && <QueueManagerDashboard />}
      {screen === 'librarian' && <DataLibrarian />}
      {screen === 'mapper' && <DataMapper />}
    </div>
  );
}

export default App;
