// Pascalish Debug Renderer - Code viewer with debug state visualization
import React, { Suspense, useEffect, useState } from 'react';
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));
import { initializePascalishLanguage } from '../../pascalishLanguage';
import { buildPascalishLibrarianContracts } from '../../librarianSchemaContracts';

/**
 * PascalishDebugRenderer - Displays Pascalish code with debug state (current line, registers, stack)
 */
const PascalishDebugRenderer = ({ file, role, mode, debugState }) => {
  const [types, setTypes] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [decorations, setDecorations] = useState([]);
  const editorRef = React.useRef(null);
  const typeNamesRef = React.useRef([]);
  const typeFieldMapRef = React.useRef({});
  const code = file?.content || '';
  
  const currentLine = debugState?.currentLine || 1;
  const registers = debugState?.registers || {};
  const stack = debugState?.stack || [];
  const variables = debugState?.variables || {};

  useEffect(() => {
    async function loadLibrarianData() {
      try {
        const [typesResponse, schemasResponse] = await Promise.all([
          fetch('/api/librarian/data-types'),
          fetch('/api/librarian/schemas')
        ]);
        
        if (typesResponse.ok) {
          const typePayload = await typesResponse.json();
          setTypes(Array.isArray(typePayload.types) ? typePayload.types : []);
        }
        
        if (schemasResponse.ok) {
          const schemaPayload = await schemasResponse.json();
          setSchemas(Array.isArray(schemaPayload.schemas) ? schemaPayload.schemas : []);
        }
      } catch (error) {
        console.error('Failed to load librarian data:', error);
      }
    }

    loadLibrarianData();
  }, []);

  useEffect(() => {
    const contracts = buildPascalishLibrarianContracts(types, schemas);
    typeNamesRef.current = contracts.typeNames;
    typeFieldMapRef.current = contracts.typeFieldMap;
  }, [types, schemas]);

  useEffect(() => {
    // Update line decorations when current line changes
    if (editorRef.current && currentLine) {
      const editor = editorRef.current;
      const newDecorations = editor.deltaDecorations(decorations, [
        {
          range: new window.monaco.Range(currentLine, 1, currentLine, 1),
          options: {
            isWholeLine: true,
            className: 'debug-current-line',
            glyphMarginClassName: 'debug-current-line-glyph',
          }
        }
      ]);
      setDecorations(newDecorations);
    }
  }, [currentLine]);

  const handleEditorWillMount = (monaco) => {
    const contracts = buildPascalishLibrarianContracts(types, schemas);
    typeNamesRef.current = contracts.typeNames;
    typeFieldMapRef.current = contracts.typeFieldMap;
    initializePascalishLanguage(monaco, typeNamesRef, typeFieldMapRef);
    
    // Define custom CSS for debug highlighting
    const style = document.createElement('style');
    style.textContent = `
      .debug-current-line {
        background-color: rgba(255, 235, 59, 0.2) !important;
        border-left: 3px solid #ffc107;
      }
      .debug-current-line-glyph {
        background-color: #ffc107;
        width: 10px !important;
        margin-left: 3px;
      }
    `;
    document.head.appendChild(style);
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Scroll to current line
    if (currentLine) {
      editor.revealLineInCenter(currentLine);
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: '#1e1e1e',
    }}>
      {/* Code Editor */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
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
              backgroundColor: '#f44336',
              borderRadius: '3px',
            }}>
              DEBUG MODE
            </span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#858585' }}>
            Line: {currentLine}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Suspense fallback={
            <div style={{ padding: '2rem', color: '#d4d4d4', fontFamily: 'monospace' }}>
              Loading Monaco Editor...
            </div>
          }>
            <MonacoEditor
              language="pascalish"
              value={code}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                fontSize: 14,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                automaticLayout: true,
                glyphMargin: true,
              }}
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
            />
          </Suspense>
        </div>
      </div>

      {/* Debug Panel */}
      <div style={{
        width: '300px',
        backgroundColor: '#252526',
        borderLeft: '1px solid #3e3e42',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        color: '#d4d4d4',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '0.875rem',
      }}>
        {/* Registers */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #3e3e42' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: 'bold', color: '#4fc3f7' }}>
            Registers
          </h3>
          {Object.keys(registers).length > 0 ? (
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {Object.entries(registers).map(([key, value]) => (
                <div key={key} style={{ padding: '0.25rem 0' }}>
                  <span style={{ color: '#ce9178' }}>{key}:</span>{' '}
                  <span style={{ color: '#b5cea8' }}>{JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#858585', fontStyle: 'italic' }}>No registers</div>
          )}
        </div>

        {/* Stack */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #3e3e42' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: 'bold', color: '#4fc3f7' }}>
            Stack
          </h3>
          {stack.length > 0 ? (
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {stack.map((item, index) => (
                <div key={index} style={{ padding: '0.25rem 0' }}>
                  <span style={{ color: '#858585' }}>[{index}]</span>{' '}
                  <span style={{ color: '#b5cea8' }}>{JSON.stringify(item)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#858585', fontStyle: 'italic' }}>Stack empty</div>
          )}
        </div>

        {/* Variables */}
        <div style={{ padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: 'bold', color: '#4fc3f7' }}>
            Variables
          </h3>
          {Object.keys(variables).length > 0 ? (
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} style={{ padding: '0.25rem 0' }}>
                  <span style={{ color: '#ce9178' }}>{key}:</span>{' '}
                  <span style={{ color: '#b5cea8' }}>{JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#858585', fontStyle: 'italic' }}>No variables</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PascalishDebugRenderer;

// Made with Bob
