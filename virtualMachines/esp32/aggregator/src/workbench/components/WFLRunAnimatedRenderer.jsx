// WFL Run Animated Renderer - Animated workflow execution viewer
import React from 'react';
import MermaidRenderer from './MermaidRenderer';
import { wflToMermaid } from '../wflToMermaid';

/**
 * WFLRunAnimatedRenderer - Displays WFL workflow with animated execution state
 */
const WFLRunAnimatedRenderer = ({ file, role, mode, executionState }) => {
  const wflSource = file?.content || '';
  const mermaidSource = wflToMermaid(wflSource);
  const activeStates = executionState?.activeStates || [];

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: '#ffffff',
    }}>
      {/* Workflow Diagram */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 'bold', color: '#333' }}>
              {file?.name || 'Untitled.wfl'}
            </span>
            <span style={{ 
              fontSize: '0.75rem', 
              padding: '0.25rem 0.5rem', 
              backgroundColor: '#4caf50',
              color: '#fff',
              borderRadius: '3px',
              animation: 'pulse 2s infinite',
            }}>
              ▶ RUNNING
            </span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>
            Active States: {activeStates.length}
          </div>
        </div>

        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <MermaidRenderer 
            mermaidSource={mermaidSource}
            activeStates={activeStates}
            className="wfl-run-diagram"
          />
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
      </div>

      {/* Execution State Panel */}
      <div style={{
        width: '280px',
        backgroundColor: '#fafafa',
        borderLeft: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '0.875rem',
      }}>
        {/* Active States */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>
          <h3 style={{ 
            margin: '0 0 0.75rem 0', 
            fontSize: '0.875rem', 
            fontWeight: 'bold', 
            color: '#4caf50',
          }}>
            Active States
          </h3>
          {activeStates.length > 0 ? (
            <div>
              {activeStates.map((state, index) => (
                <div 
                  key={index} 
                  style={{ 
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                    backgroundColor: '#e8f5e9',
                    border: '1px solid #4caf50',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    color: '#2e7d32',
                  }}
                >
                  {state}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999', fontStyle: 'italic' }}>
              No active states
            </div>
          )}
        </div>

        {/* Execution History */}
        <div style={{ padding: '1rem', flex: 1, overflow: 'auto' }}>
          <h3 style={{ 
            margin: '0 0 0.75rem 0', 
            fontSize: '0.875rem', 
            fontWeight: 'bold', 
            color: '#2196f3',
          }}>
            Execution History
          </h3>
          {executionState?.history && executionState.history.length > 0 ? (
            <div style={{ fontSize: '0.8rem' }}>
              {executionState.history.slice().reverse().map((event, index) => (
                <div 
                  key={index}
                  style={{
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ 
                    fontWeight: 'bold', 
                    color: getEventColor(event.type),
                    marginBottom: '0.25rem',
                  }}>
                    {event.type}
                  </div>
                  {event.stateId && (
                    <div style={{ color: '#666' }}>
                      State: {event.stateId}
                    </div>
                  )}
                  {event.fromStateId && event.toStateId && (
                    <div style={{ color: '#666' }}>
                      {event.fromStateId} → {event.toStateId}
                    </div>
                  )}
                  <div style={{ color: '#999', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999', fontStyle: 'italic' }}>
              No execution history
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function getEventColor(eventType) {
  switch (eventType) {
    case 'STATE_ENTER': return '#4caf50';
    case 'STATE_EXIT': return '#ff9800';
    case 'TRANSITION': return '#2196f3';
    case 'FLOW_START': return '#9c27b0';
    case 'FLOW_END': return '#f44336';
    default: return '#666';
  }
}

export default WFLRunAnimatedRenderer;

// Made with Bob
