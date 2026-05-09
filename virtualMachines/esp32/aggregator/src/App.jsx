import './App.css';


import TopologyDashboard from './TopologyDashboard';
import QueueManagerDashboard from './QueueManagerDashboard';
import QueueManagerLauncher from './QueueManagerLauncher';
import SecondaryBrokerLauncher from './SecondaryBrokerLauncher';
import React, { useState } from 'react';


function App() {
  const [screen, setScreen] = useState('topology');
  return (
    <div className="App">
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <button onClick={() => setScreen('topology')} style={{ fontWeight: screen === 'topology' ? 'bold' : 'normal' }}>Topology</button>
        <button onClick={() => setScreen('queue')} style={{ fontWeight: screen === 'queue' ? 'bold' : 'normal' }}>Queue Manager</button>
        <button onClick={() => setScreen('queue-launcher')} style={{ fontWeight: screen === 'queue-launcher' ? 'bold' : 'normal' }}>Queue Manager Launcher</button>
        <button onClick={() => setScreen('secondary')} style={{ fontWeight: screen === 'secondary' ? 'bold' : 'normal' }}>Secondary Broker Launcher</button>
      </div>
      {screen === 'topology' && <TopologyDashboard />}
      {screen === 'queue' && <QueueManagerDashboard />}
      {screen === 'queue-launcher' && <QueueManagerLauncher />}
      {screen === 'secondary' && <SecondaryBrokerLauncher />}
    </div>
  );
}

export default App;
