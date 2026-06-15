// WFL View Renderer - Static workflow diagram viewer
import React from 'react';
import MermaidRenderer from './MermaidRenderer';
import { wflToMermaid } from '../wflToMermaid';

/**
 * WFLViewRenderer - Displays WFL workflow as a static Mermaid state diagram
 */
const WFLViewRenderer = ({ file, role, mode }) => {
  const wflSource = file?.content || '';
  const mermaidSource = wflToMermaid(wflSource);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#ffffff',
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
            backgroundColor: '#2196f3',
            color: '#fff',
            borderRadius: '3px',
          }}>
            WFL VIEW
          </span>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          Role: {role}
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
          className="wfl-view-diagram"
        />
      </div>
    </div>
  );
};

export default WFLViewRenderer;

// Made with Bob
