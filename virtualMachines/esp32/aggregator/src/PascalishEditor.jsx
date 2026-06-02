import React, { useEffect, useMemo, useRef, useState } from 'react';
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));
import { initializePascalishLanguage } from './pascalishLanguage';

const DEFAULT_PROGRAM = [
  'SERVICE "librarian-aware-demo";',
  '',
  'VAR myLegacyMessage : LegacyMT103 FROM Librarian;',
  '',
  'ROUTER "mt103-route" INPUT "swift.mt103.inbound" DESCRIPTION "Route MT103" ENABLED TRUE BEGIN',
  '  OUTPUT "swift.mt103.parsed"',
  '    WHEN "output := 1;"',
  '    TRANSFORM "output := src;";',
  'END;'
].join('\n');

export default function PascalishEditor() {
  const [source, setSource] = useState(DEFAULT_PROGRAM);
  const [types, setTypes] = useState([]);
  const [status, setStatus] = useState('Loading Librarian types...');
  const typeNamesRef = useRef([]);

  const typeNames = useMemo(() => {
    return (types || [])
      .map((item) => String(item?.id || item?.name || item?.typeName || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [types]);

  useEffect(() => {
    typeNamesRef.current = typeNames;
  }, [typeNames]);

  useEffect(() => {
    let cancelled = false;

    async function loadTypes() {
      try {
        const response = await fetch('/api/librarian/data-types');
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setStatus(`Failed to load types (${response.status}).`);
          return;
        }

        const nextTypes = Array.isArray(payload.types) ? payload.types : [];
        setTypes(nextTypes);
        setStatus(`Loaded ${nextTypes.length} Librarian data types.`);
      } catch (error) {
        if (!cancelled) {
          setStatus(`Type load failed: ${error.message}`);
        }
      }
    }

    loadTypes();
    const timer = setInterval(loadTypes, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Pascalish Editor</h3>
        <span style={{ fontSize: 12, opacity: 0.85 }}>{status}</span>
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        Tip: Type declarations can autocomplete Librarian types, for example: VAR myLegacyMessage : LegacyMT103 FROM Librarian;
      </div>

      <div style={{ flex: 1, minHeight: 540, border: '1px solid rgba(148, 163, 184, 0.35)', borderRadius: 8, overflow: 'hidden' }}>
        <React.Suspense fallback={<div style={{ padding: 20 }}>Loading editor…</div>}>
          <MonacoEditor
            height="100%"
            language="pascalish"
            theme="pascalishWorkbench"
            value={source}
            onChange={(value) => setSource(value || '')}
            beforeMount={(monaco) => initializePascalishLanguage(monaco, typeNamesRef)}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineHeight: 22,
              wordWrap: 'on',
              smoothScrolling: true,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              formatOnType: false,
            }}
          />
        </React.Suspense>
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Available types: {typeNames.length === 0 ? 'none loaded' : typeNames.slice(0, 12).join(', ')}{typeNames.length > 12 ? ' ...' : ''}
      </div>
    </div>
  );
}
