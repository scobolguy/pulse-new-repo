// Pascalish View Renderer - Simple version without Monaco (fallback)
import React from 'react';

/**
 * PascalishViewRendererSimple - Displays Pascalish code with basic syntax highlighting
 * This is a simpler version that doesn't require Monaco editor
 */
const PascalishViewRendererSimple = ({ file, role, mode }) => {
  const code = file?.content || '';

  // Simple syntax highlighting
  const highlightSyntax = (code) => {
    const keywords = /\b(program|var|begin|end|if|then|else|while|do|for|to|function|procedure|integer|real|string|boolean|true|false|and|or|not|div|mod|const|type|array|of|record|writeln|write)\b/gi;
    const comments = /\{[^}]*\}|\/\/.*$/gm;
    const strings = /"[^"]*"|'[^']*'/g;
    const numbers = /\b\d+(\.\d+)?\b/g;

    let highlighted = code;
    
    // Escape HTML
    highlighted = highlighted
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>');

    // Apply syntax highlighting
    highlighted = highlighted
      .replace(comments, '<span style="color: #6a9955; font-style: italic;">$&</span>')
      .replace(strings, '<span style="color: #ce9178;">$&</span>')
      .replace(numbers, '<span style="color: #b5cea8;">$&</span>')
      .replace(keywords, '<span style="color: #569cd6; font-weight: bold;">$&</span>');

    return highlighted;
  };

  const lines = code.split('\n');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
      fontSize: '14px',
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#2d2d30',
        borderBottom: '1px solid #3e3e42',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 'bold' }}>{file?.name || 'Untitled.pas'}</span>
          <span style={{ 
            fontSize: '0.75rem', 
            padding: '0.25rem 0.5rem', 
            backgroundColor: '#0e639c',
            borderRadius: '3px',
          }}>
            VIEW MODE
          </span>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#858585' }}>
          Role: {role} | Lines: {lines.length}
        </div>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '1rem 0',
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td style={{
                  width: '50px',
                  textAlign: 'right',
                  paddingRight: '1rem',
                  color: '#858585',
                  userSelect: 'none',
                  borderRight: '1px solid #3e3e42',
                  verticalAlign: 'top',
                }}>
                  {index + 1}
                </td>
                <td style={{
                  paddingLeft: '1rem',
                  paddingRight: '1rem',
                  whiteSpace: 'pre',
                  verticalAlign: 'top',
                }}>
                  <code dangerouslySetInnerHTML={{ 
                    __html: highlightSyntax(line) || '&nbsp;' 
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PascalishViewRendererSimple;

// Made with Bob
