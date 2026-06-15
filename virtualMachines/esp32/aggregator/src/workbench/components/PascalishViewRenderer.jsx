// Pascalish View Renderer - Read-only code viewer with Monaco editor integration
import React from 'react';
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

/**
 * PascalishViewRenderer - Displays Pascalish code in read-only mode
 * No external dependencies - works standalone
 */
const PascalishViewRenderer = ({ file, role, mode }) => {
  const code = file?.content || '';
  const lines = code.split('\n').length;

  const handleEditorWillMount = (monaco) => {
    // Register Pascalish language with basic syntax highlighting
    monaco.languages.register({ id: 'pascalish' });
    
    monaco.languages.setMonarchTokensProvider('pascalish', {
      keywords: [
        'program', 'begin', 'end', 'var', 'const', 'type', 'function', 'procedure',
        'if', 'then', 'else', 'while', 'do', 'for', 'to', 'repeat', 'until',
        'case', 'of', 'daemon', 'role', 'library', 'from', 'use', 'as', 'interop',
        'router', 'input', 'output', 'when', 'transform', 'description', 'enabled',
        'true', 'false', 'nil', 'and', 'or', 'not', 'div', 'mod',
      ],
      
      typeKeywords: [
        'integer', 'real', 'boolean', 'char', 'string', 'envelope', 'wfl',
      ],
      
      operators: [
        '=', '>', '<', '<=', '>=', '<>', ':=', '+', '-', '*', '/', '..', ':', ';',
      ],
      
      tokenizer: {
        root: [
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier'
            }
          }],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],
          [/'[^']*'/, 'string'],
          [/\d+/, 'number'],
          [/[{}()\[\]]/, '@brackets'],
          [/[<>](?!@symbols)/, '@brackets'],
          [/@symbols/, {
            cases: {
              '@operators': 'operator',
              '@default': ''
            }
          }],
          [/\s+/, 'white'],
          [/\(\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],
        ],
        
        comment: [
          [/[^(*]+/, 'comment'],
          [/\*\)/, 'comment', '@pop'],
          [/[(*]/, 'comment']
        ],
        
        string: [
          [/[^\\"]+/, 'string'],
          [/"/, 'string', '@pop']
        ],
      },
    });

    // Set theme colors
    monaco.editor.defineTheme('pascalish-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
      }
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1e1e1e',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#2d2d30',
        borderBottom: '1px solid #3e3e42',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#d4d4d4',
        fontFamily: 'system-ui, -apple-system, sans-serif',
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
          Role: {role} | Lines: {lines}
        </div>
      </div>

      {/* Monaco Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <React.Suspense fallback={
          <div style={{ 
            padding: '2rem', 
            color: '#d4d4d4',
            fontFamily: 'monospace',
          }}>
            Loading Monaco Editor...
          </div>
        }>
          <MonacoEditor
            height="100%"
            language="pascalish"
            value={code}
            theme="pascalish-dark"
            options={{
              readOnly: true,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              automaticLayout: true,
            }}
            beforeMount={handleEditorWillMount}
          />
        </React.Suspense>
      </div>
    </div>
  );
};

export default PascalishViewRenderer;

// Made with Bob
