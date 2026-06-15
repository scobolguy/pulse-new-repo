// IBM BOB Workbench - Main workbench component with role/file/mode-based rendering
import React, { useEffect, useState } from 'react';
import { getRenderer } from './rendererRegistry';
import { registerAllRenderers } from './registerRenderers';

// Sample files for demonstration
const SAMPLE_FILES = [
  {
    id: 'hello-world',
    name: 'hello-world.pas',
    fileType: 'pascalish',
    content: `program HelloWorld;
begin
  writeln('Hello, World!');
  writeln('Welcome to IBM BOB Workbench');
  writeln('Pascalish running on JavaScript P-machine');
end.`,
  },
  {
    id: 'sample-pascalish',
    name: 'payment-router.pas',
    fileType: 'pascalish',
    content: `daemon "payment-router" refresh 2 s;
role code_librarian;
library "payments-common" from librarian;
use "payments-common" as payments;
interop wfl "pain2-routing" as routingFlow;

var myLegacyMessage : envelope<swift-mt103> from librarian;

router "mt103-route" input "swift.mt103.inbound" description "Route MT103" enabled true begin
  output "swift.mt103.parsed"
    when "output := 1;"
    transform "output := src;";
end;`,
  },
  {
    id: 'sample-wfl',
    name: 'order-workflow.wfl',
    fileType: 'wfl',
    content: `workflow OrderProcessing
state Idle
state Processing
state Validation
state Complete
state Error

Idle -> Processing : start
Processing -> Validation : validate
Validation -> Complete : success
Validation -> Error : failure
Error -> Processing : retry`,
  },
  {
    id: 'sample-map',
    name: 'mt103-to-pain001.map',
    fileType: 'map',
    mappings: [
      { sourceField: 'MT103.Field20', targetField: 'Pain001.MsgId', transform: 'trim(source)' },
      { sourceField: 'MT103.Field32A.Amount', targetField: 'Pain001.InstdAmt', transform: 'parseDecimal(source)' },
      { sourceField: 'MT103.Field50K', targetField: 'Pain001.Dbtr.Nm', transform: 'extractName(source)' },
      { sourceField: 'MT103.Field59', targetField: 'Pain001.Cdtr.Nm', transform: 'extractName(source)' },
      { sourceField: 'MT103.Field71A', targetField: 'Pain001.ChrgBr', transform: 'mapChargeCode(source)' },
    ],
  },
  {
    id: 'sample-node',
    name: 'payment-service',
    fileType: 'node',
    type: 'service',
    status: 'active',
    description: 'Payment processing service handling MT103 messages',
    metadata: {
      version: '2.1.0',
      uptime: '45 days',
      throughput: '1,250 msg/sec',
      lastDeployed: '2026-04-28',
    },
  },
];

const ROLES = ['developer', 'dataMapper', 'analyst', 'projectManager'];
const MODES = ['view', 'edit', 'run', 'debug', 'animate'];

/**
 * IBM BOB Workbench - Role-based, file-type-based, mode-based rendering system
 */
const Workbench = () => {
  const [currentRole, setCurrentRole] = useState('developer');
  const [currentFile, setCurrentFile] = useState(SAMPLE_FILES[0]);
  const [currentMode, setCurrentMode] = useState('view');
  const [executionState, setExecutionState] = useState(null);
  const [debugState, setDebugState] = useState(null);

  useEffect(() => {
    // Register all renderers on mount
    registerAllRenderers();
  }, []);

  // Get the appropriate renderer for current context
  const Renderer = getRenderer(currentRole, currentFile.fileType, currentMode);

  // Simulate execution state for WFL run mode
  useEffect(() => {
    if (currentFile.fileType === 'wfl' && currentMode === 'run') {
      const states = ['Idle', 'Processing', 'Validation', 'Complete'];
      let currentIndex = 0;

      const interval = setInterval(() => {
        currentIndex = (currentIndex + 1) % states.length;
        setExecutionState({
          activeStates: [states[currentIndex]],
          history: [
            {
              type: 'STATE_ENTER',
              stateId: states[currentIndex],
              timestamp: Date.now(),
            },
          ],
        });
      }, 2000);

      return () => clearInterval(interval);
    } else {
      setExecutionState(null);
    }
  }, [currentFile.fileType, currentMode]);

  // Simulate debug state for debug modes
  useEffect(() => {
    if (currentMode === 'debug') {
      if (currentFile.fileType === 'pascalish') {
        setDebugState({
          currentLine: 8,
          registers: { PC: 42, SP: 100, BP: 95 },
          stack: [123, 'hello', true],
          variables: { myLegacyMessage: 'MT103{...}', output: 1 },
        });
      } else if (currentFile.fileType === 'map') {
        setDebugState({
          currentStep: 2,
        });
      }
    } else {
      setDebugState(null);
    }
  }, [currentFile.fileType, currentMode]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Top Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#2d2d30',
        borderBottom: '1px solid #3e3e42',
      }}>
        <div style={{
          fontSize: '1.25rem',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          IBM BOB Workbench
        </div>

        {/* Role Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#858585' }}>Role:</label>
          <select
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value)}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: '#3e3e42',
              color: '#d4d4d4',
              border: '1px solid #555',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {ROLES.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#858585' }}>Mode:</label>
          <select
            value={currentMode}
            onChange={(e) => setCurrentMode(e.target.value)}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: '#3e3e42',
              color: '#d4d4d4',
              border: '1px solid #555',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {MODES.map(mode => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#858585' }}>
          Experimental Workbench • localhost:5173/x
        </div>
      </div>

      {/* Main Content Area - Renderer */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Renderer
          file={currentFile}
          role={currentRole}
          mode={currentMode}
          executionState={executionState}
          debugState={debugState}
        />
      </div>
    </div>
  );
};

export default Workbench;

// Made with Bob