import { useState, useEffect, useMemo, useCallback } from 'react';
import DevelopWorkspace from './DevelopWorkspace';

/**
 * Developer Dashboard Component
 * 
 * Implements the Developer role from the architecture specification.
 * Responsibilities:
 * - Write Pascalish/COBOLish code
 * - Edit configs
 * - Build & compile
 * - Run & debug in VM
 * - Manage files
 * - View logs
 * - Run tests
 * 
 * Integrates with existing DevelopWorkspace and adds enhanced features.
 */
export default function DeveloperDashboard({ actorPermissions = [] }) {
  const [activeView, setActiveView] = useState('editor'); // 'editor', 'vm-inspector', 'test-harness', 'logs', 'api-manager'
  const [vmState, setVmState] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [apiEndpoints, setApiEndpoints] = useState([]);
  const [status, setStatus] = useState('');

  const permissions = useMemo(
    () => (Array.isArray(actorPermissions) ? actorPermissions : []),
    [actorPermissions]
  );

  const canDevelop = useMemo(
    () => permissions.includes('*') || permissions.includes('develop.*') || permissions.includes('topology.read'),
    [permissions]
  );

  const loadVmState = useCallback(async () => {
    try {
      const res = await fetch('/api/develop/vm/state');
      if (!res.ok) throw new Error(`Load VM state failed (${res.status})`);
      const payload = await res.json();
      setVmState(payload.state || null);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, []);

  const loadTestResults = useCallback(async () => {
    try {
      const res = await fetch('/api/develop/tests/results');
      if (!res.ok) throw new Error(`Load test results failed (${res.status})`);
      const payload = await res.json();
      setTestResults(Array.isArray(payload.results) ? payload.results : []);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/develop/logs?limit=100');
      if (!res.ok) throw new Error(`Load logs failed (${res.status})`);
      const payload = await res.json();
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, []);

  const loadApiEndpoints = useCallback(async () => {
    try {
      const res = await fetch('/api/develop/api-catalog');
      if (!res.ok) throw new Error(`Load API catalog failed (${res.status})`);
      const payload = await res.json();
      setApiEndpoints(Array.isArray(payload.endpoints) ? payload.endpoints : []);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    if (activeView === 'vm-inspector') {
      void loadVmState();
      const interval = setInterval(loadVmState, 2000);
      return () => clearInterval(interval);
    }
  }, [activeView, loadVmState]);

  useEffect(() => {
    if (activeView === 'test-harness') {
      void loadTestResults();
    }
  }, [activeView, loadTestResults]);

  useEffect(() => {
    if (activeView === 'logs') {
      void loadLogs();
      const interval = setInterval(loadLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [activeView, loadLogs]);

  useEffect(() => {
    if (activeView === 'api-manager') {
      void loadApiEndpoints();
    }
  }, [activeView, loadApiEndpoints]);

  async function handleRunTests() {
    try {
      setStatus('Running tests...');
      const res = await fetch('/api/develop/tests/run', { method: 'POST' });
      if (!res.ok) throw new Error(`Run tests failed (${res.status})`);
      await loadTestResults();
      setStatus('Tests completed.');
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleStepVm() {
    try {
      const res = await fetch('/api/develop/vm/step', { method: 'POST' });
      if (!res.ok) throw new Error(`VM step failed (${res.status})`);
      await loadVmState();
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleResetVm() {
    try {
      const res = await fetch('/api/develop/vm/reset', { method: 'POST' });
      if (!res.ok) throw new Error(`VM reset failed (${res.status})`);
      await loadVmState();
      setStatus('VM reset.');
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  if (!canDevelop) {
    return <div style={{ color: '#b71c1c' }}>You do not have permission to access developer tools.</div>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #c7cdd4', background: '#f8f9fb' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Developer Workspace / Espace développeur</h2>
        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#666' }}>
          Code, build, test, and debug in isolated VM environment
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid #c7cdd4', background: '#fff' }}>
        <button
          style={{
            padding: '6px 12px',
            border: 'none',
            borderBottom: activeView === 'editor' ? '2px solid #9b8cff' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeView === 'editor' ? 600 : 400
          }}
          onClick={() => setActiveView('editor')}
        >
          📝 Editor
        </button>
        <button
          style={{
            padding: '6px 12px',
            border: 'none',
            borderBottom: activeView === 'vm-inspector' ? '2px solid #9b8cff' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeView === 'vm-inspector' ? 600 : 400
          }}
          onClick={() => setActiveView('vm-inspector')}
        >
          🔍 VM Inspector
        </button>
        <button
          style={{
            padding: '6px 12px',
            border: 'none',
            borderBottom: activeView === 'test-harness' ? '2px solid #9b8cff' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeView === 'test-harness' ? 600 : 400
          }}
          onClick={() => setActiveView('test-harness')}
        >
          🧪 Test Harness
        </button>
        <button
          style={{
            padding: '6px 12px',
            border: 'none',
            borderBottom: activeView === 'logs' ? '2px solid #9b8cff' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeView === 'logs' ? 600 : 400
          }}
          onClick={() => setActiveView('logs')}
        >
          📋 Logs
        </button>
        <button
          style={{
            padding: '6px 12px',
            border: 'none',
            borderBottom: activeView === 'api-manager' ? '2px solid #9b8cff' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeView === 'api-manager' ? 600 : 400
          }}
          onClick={() => setActiveView('api-manager')}
        >
          🔌 API Manager
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeView === 'editor' && (
          <DevelopWorkspace actorPermissions={permissions} />
        )}

        {activeView === 'vm-inspector' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>VM Inspector / Debugger</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleStepVm}>▶️ Step</button>
                <button onClick={handleResetVm}>🔄 Reset</button>
              </div>
            </div>

            {!vmState && (
              <div style={{ padding: 16, background: '#f8f9fb', borderRadius: 4, border: '1px solid #c7cdd4' }}>
                No VM instance running. Compile and run a program to start debugging.
              </div>
            )}

            {vmState && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 12, background: '#fff', borderRadius: 4, border: '1px solid #c7cdd4' }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>Execution State</h4>
                  <div style={{ fontSize: 13 }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Status:</strong> {vmState.status || 'Unknown'}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Program Counter:</strong> {vmState.pc || 0}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Stack Pointer:</strong> {vmState.sp || 0}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Instructions Executed:</strong> {vmState.instructionCount || 0}
                    </div>
                  </div>
                </div>

                <div style={{ padding: 12, background: '#fff', borderRadius: 4, border: '1px solid #c7cdd4' }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>Stack</h4>
                  <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, fontFamily: 'monospace' }}>
                    {Array.isArray(vmState.stack) && vmState.stack.length > 0 ? (
                      vmState.stack.map((value, index) => (
                        <div key={index} style={{ padding: '2px 4px', background: index === 0 ? '#e3f2fd' : 'transparent' }}>
                          [{index}] = {JSON.stringify(value)}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#666' }}>Stack is empty</div>
                    )}
                  </div>
                </div>

                <div style={{ padding: 12, background: '#fff', borderRadius: 4, border: '1px solid #c7cdd4', gridColumn: '1 / -1' }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>Variables</h4>
                  <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, fontFamily: 'monospace' }}>
                    {vmState.variables && Object.keys(vmState.variables).length > 0 ? (
                      Object.entries(vmState.variables).map(([name, value]) => (
                        <div key={name} style={{ padding: '2px 4px' }}>
                          <strong>{name}</strong> = {JSON.stringify(value)}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#666' }}>No variables defined</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'test-harness' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Test Harness</h3>
              <button onClick={handleRunTests} style={{ background: '#59c17f', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}>
                ▶️ Run All Tests
              </button>
            </div>

            {testResults.length === 0 && (
              <div style={{ padding: 16, background: '#f8f9fb', borderRadius: 4, border: '1px solid #c7cdd4' }}>
                No test results available. Click "Run All Tests" to execute tests.
              </div>
            )}

            {testResults.length > 0 && (
              <div>
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    style={{
                      padding: 12,
                      marginBottom: 8,
                      background: result.passed ? '#d4edda' : '#f8d7da',
                      borderRadius: 4,
                      border: `1px solid ${result.passed ? '#c3e6cb' : '#f5c6cb'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>
                        {result.passed ? '✓' : '✗'} {result.name}
                      </span>
                      <span style={{ fontSize: 12, color: '#666' }}>
                        {result.duration}ms
                      </span>
                    </div>
                    {result.message && (
                      <div style={{ fontSize: 13, color: '#666' }}>
                        {result.message}
                      </div>
                    )}
                    {result.error && (
                      <pre style={{ fontSize: 11, background: '#fff', padding: 8, borderRadius: 4, overflow: 'auto', marginTop: 8 }}>
                        {result.error}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'logs' && (
          <div>
            <h3 style={{ margin: '0 0 16px 0' }}>Development Logs</h3>
            <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 4, fontFamily: 'monospace', fontSize: 12, maxHeight: 500, overflowY: 'auto' }}>
              {logs.length === 0 && (
                <div style={{ color: '#666' }}>No logs available.</div>
              )}
              {logs.map((log, index) => (
                <div key={index} style={{ marginBottom: 4, color: log.level === 'error' ? '#f48771' : log.level === 'warn' ? '#e5c07b' : '#d4d4d4' }}>
                  <span style={{ color: '#666' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                  <span style={{ color: '#61afef' }}>{log.level.toUpperCase()}</span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'api-manager' && (
          <div>
            <h3 style={{ margin: '0 0 16px 0' }}>API Manager</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Browse and test available API endpoints (read-only access to schemas and mappings)
            </p>

            {apiEndpoints.length === 0 && (
              <div style={{ padding: 16, background: '#f8f9fb', borderRadius: 4, border: '1px solid #c7cdd4' }}>
                No API endpoints available.
              </div>
            )}

            {apiEndpoints.length > 0 && (
              <div>
                {apiEndpoints.map((endpoint, index) => (
                  <div
                    key={index}
                    style={{
                      padding: 12,
                      marginBottom: 8,
                      background: '#fff',
                      borderRadius: 4,
                      border: '1px solid #c7cdd4'
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: endpoint.method === 'GET' ? '#61afef' : endpoint.method === 'POST' ? '#98c379' : '#e5c07b',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600
                      }}>
                        {endpoint.method}
                      </span>
                      <code style={{ fontSize: 13 }}>{endpoint.path}</code>
                    </div>
                    {endpoint.description && (
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                        {endpoint.description}
                      </div>
                    )}
                    {endpoint.permissions && endpoint.permissions.length > 0 && (
                      <div style={{ fontSize: 12, color: '#999' }}>
                        Required permissions: {endpoint.permissions.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {status && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #c7cdd4',
          background: '#f8f9fb',
          fontSize: 12,
          color: status.toLowerCase().includes('failed') ? '#b71c1c' : '#333'
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

// Made with Bob
