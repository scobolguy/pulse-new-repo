import React, { useEffect, useMemo, useRef, useState } from 'react';
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));
import { initializePascalishLanguage } from './pascalishLanguage';

const DEFAULT_PROGRAM = [
  'daemon "librarian-aware-demo" refresh 2 s;',
  'role code_librarian;',
  'library "payments-common" from librarian;',
  'use "payments-common" as payments;',
  'interop wfl "pain2-routing" as routingFlow;',
  '',
  'var myLegacyMessage : envelope<swift-mt103> from librarian;',
  '',
  'router "mt103-route" input "swift.mt103.inbound" description "Route MT103" enabled true begin',
  '  output "swift.mt103.parsed"',
  '    when "output := 1;"',
  '    transform "output := src;";',
  'end;'
].join('\n');

export default function PascalishEditor() {
  const [source, setSource] = useState(DEFAULT_PROGRAM);
  const [types, setTypes] = useState([]);
  const [status, setStatus] = useState('Loading Librarian types...');
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState('');
  const typeNamesRef = useRef([]);
  const typeFieldMapRef = useRef({});
  const mapNamesRef = useRef([]);
  const runMenuPanelStyle = {
    position: 'absolute',
    top: 34,
    right: 0,
    zIndex: 10,
    minWidth: 220,
    border: '1px solid rgba(148, 163, 184, 0.45)',
    borderRadius: 10,
    background: '#0b1220',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    boxShadow: '0 12px 28px rgba(2, 6, 23, 0.55)'
  };
  const runMenuItemStyle = {
    textAlign: 'left',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: 8,
    background: '#1e293b',
    color: '#f8fafc',
    padding: '8px 10px',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.3
  };

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
    fetch('/api/mapper/maps/names')
      .then((r) => r.ok ? r.json() : { maps: [] })
      .then((data) => { if (!cancelled) mapNamesRef.current = Array.isArray(data.maps) ? data.maps : []; })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    function collectPathsFromSchemaNode(node, prefix = '', out = []) {
      if (!node || typeof node !== 'object') return out;
      const rawName = String(node.name || '').trim();
      const normalizedName = rawName && rawName !== 'root' ? rawName : '';
      const nextPrefix = normalizedName
        ? (prefix ? `${prefix}.${normalizedName}` : normalizedName)
        : prefix;

      if (nextPrefix) out.push(nextPrefix);
      for (const child of Array.isArray(node.children) ? node.children : []) {
        collectPathsFromSchemaNode(child, nextPrefix, out);
      }
      return out;
    }

    function buildTypeFieldMap(schemas) {
      const map = {};
      for (const schema of Array.isArray(schemas) ? schemas : []) {
        const typeId = String(schema?.typeId || '').trim().toLowerCase();
        if (!typeId) continue;
        if (!map[typeId]) map[typeId] = new Set();
        const paths = collectPathsFromSchemaNode(schema?.structure, '');
        for (const fieldPath of paths) {
          if (fieldPath) map[typeId].add(fieldPath);
        }
      }

      const output = {};
      for (const [typeId, setValues] of Object.entries(map)) {
        output[typeId] = Array.from(setValues).sort((a, b) => a.localeCompare(b));
      }
      return output;
    }

    async function loadTypes() {
      try {
        const [typesResponse, schemasResponse] = await Promise.all([
          fetch('/api/librarian/data-types'),
          fetch('/api/librarian/schemas')
        ]);
        const typePayload = await typesResponse.json().catch(() => ({}));
        const schemaPayload = await schemasResponse.json().catch(() => ({}));
        if (cancelled) return;
        if (!typesResponse.ok) {
          setStatus(`Failed to load types (${typesResponse.status}).`);
          return;
        }

        const nextTypes = Array.isArray(typePayload.types) ? typePayload.types : [];
        const schemas = schemasResponse.ok && Array.isArray(schemaPayload.schemas) ? schemaPayload.schemas : [];
        typeFieldMapRef.current = buildTypeFieldMap(schemas);
        setTypes(nextTypes);
        setStatus(`Loaded ${nextTypes.length} types and ${schemas.length} schemas.`);
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

  async function runPascalishAction(mode) {
    setRunMenuOpen(false);
    setRunBusy(true);
    try {
      const response = await fetch('/api/develop/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: source,
          mode
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Pascalish action failed (${response.status}).`);
      }

      const compile = payload.compile || {};
      const baseMessage = `Compiled: ${Number(compile.routers || 0)} router(s), ${Number(compile.mappings || 0)} mapping(s).`;
      if (mode === 'compile-run') {
        setStatus(`${baseMessage} Runtime artifacts updated.`);
      } else if (mode === 'compile-debug') {
        setStatus(`${baseMessage} Opening debugger...`);
        window.dispatchEvent(new CustomEvent('pulse:open-debugger', {
          detail: { fsmId: payload?.debug?.fsmId || 'startup-fsm' }
        }));
      } else {
        setStatus(baseMessage);
      }
      setRunError('');
    } catch (errorValue) {
      setRunError(errorValue.message);
    } finally {
      setRunBusy(false);
    }
  }

  useEffect(() => {
    function handleRunShortcut(event) {
      if (runBusy) return;
      if (event.key !== 'F7') return;

      const activeTag = String(document?.activeElement?.tagName || '').toLowerCase();
      const editingTextInput = activeTag === 'input' || activeTag === 'textarea';
      if (editingTextInput) return;

      event.preventDefault();
      if (event.shiftKey) {
        runPascalishAction('compile-debug');
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        runPascalishAction('compile-run');
        return;
      }
      runPascalishAction('compile');
    }

    window.addEventListener('keydown', handleRunShortcut);
    return () => {
      window.removeEventListener('keydown', handleRunShortcut);
    };
  }, [runBusy, source]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Pascalish Editor</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <button type="button" onClick={() => setRunMenuOpen((current) => !current)} disabled={runBusy}>
            Run
          </button>
          {runMenuOpen && (
            <div style={runMenuPanelStyle}>
              <button type="button" onClick={() => runPascalishAction('compile')} style={runMenuItemStyle} disabled={runBusy}>Compile</button>
              <button type="button" onClick={() => runPascalishAction('compile-run')} style={runMenuItemStyle} disabled={runBusy}>Compile and Run</button>
              <button type="button" onClick={() => runPascalishAction('compile-debug')} style={runMenuItemStyle} disabled={runBusy}>Compile and Debug</button>
            </div>
          )}
          <span style={{ fontSize: 12, opacity: 0.85 }}>{status}</span>
        </div>
      </div>

      {runError && (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.14)', color: '#fecaca', fontSize: 12 }}>
          {runError}
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        Tip: Type declarations can autocomplete Librarian types, for example: var myLegacyMessage : swift-mt103 from librarian;
      </div>

      <div style={{ flex: 1, minHeight: 540, border: '1px solid rgba(148, 163, 184, 0.35)', borderRadius: 8, overflow: 'hidden' }}>
        <React.Suspense fallback={<div style={{ padding: 20 }}>Loading editor…</div>}>
          <MonacoEditor
            height="100%"
            language="pascalish"
            theme="pascalishWorkbench"
            value={source}
            onChange={(value) => setSource(value || '')}
            beforeMount={(monaco) => initializePascalishLanguage(monaco, typeNamesRef, typeFieldMapRef, mapNamesRef)}
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
